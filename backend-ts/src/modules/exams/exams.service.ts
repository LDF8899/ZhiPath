import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ExamRecord, ExamQuestion } from '../../entities/exam.entity';
import { LearningTask } from '../../entities/learning-tasks.entity';
import { ReviewerAgentService } from '../../services/agents';
import { LlmService } from '../../services/llm.service';
import { extractJson } from '../../common/json-repair';

/**
 * Exams 服务 — 对齐 Python api/user/exams.py
 */
@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(ExamRecord) private examRepo: Repository<ExamRecord>,
    @InjectRepository(ExamQuestion) private questionRepo: Repository<ExamQuestion>,
    @InjectRepository(LearningTask) private learningTaskRepo: Repository<LearningTask>,
    private readonly reviewerAgent: ReviewerAgentService,
    private readonly llmService: LlmService,
  ) {}

  /** 考试列表 — 对齐 GET /api/user/exams */
  async getExams(userId: number, page = 1, pageSize = 20, examType?: number) {
    const skip = (page - 1) * pageSize;
    const where: any = { userId: userId, status: 1 };
    if (examType) where.examType = examType;

    const [items, total] = await this.examRepo.findAndCount({
      where,
      order: { createTime: 'DESC' },
      skip,
      take: pageSize,
    });
    return { list: items, total, page, pageSize };
  }

  /** 考试详情 — 对齐 GET /api/user/exams/:examId */
  async getExam(examId: number) {
    return this.examRepo.findOne({ where: { id: examId, status: 1 } });
  }

  /**
   * 开始/进入考试 — 从题库随机抽题 + 选项乱序（§24.1 防作弊）
   *
   * 规则：
   *   - 题库 > 考试题数 → 随机抽题（同一用户每次题目不同）
   *   - 选择题选项随机排列，并重算正确答案索引
   *   - 计算总时限：Σ每题时限 × 1.5（选择题60s/填空题90s/编程题15min）
   *   - 已开始且未提交的考试 → 返回已抽好的快照（断线续答）
   *
   * 服务端保存 served 快照（含正确答案），下发给前端的版本剔除答案。
   */
  async getExamForTake(userId: number, examId: number, count = 10): Promise<{
    examId: number;
    examType: number;
    skillName: string | null;
    questions: any[];
    timeLimitSec: number;
    startedAt: number;
  } | null> {
    const record = await this.examRepo.findOne({ where: { id: examId, status: 1 } });
    if (!record) return null;

    // 已抽题且未提交 → 续答（不重新抽题，防止刷新换简单题）
    const existingServed = record.answers?.served as any[] | undefined;
    if (existingServed?.length && !record.passed && !record.score) {
      return {
        examId,
        examType: record.examType,
        skillName: record.skillName || null,
        questions: this.sanitizeServed(existingServed),
        timeLimitSec: record.answers?.timeLimitSec || this.calcTimeLimit(existingServed),
        startedAt: record.answers?.startedAt || Date.now(),
      };
    }

    // 从题库抽题：按技能/岗位/类型过滤已上架题目
    const where: any = { status: 1 };
    if (record.examType) where.examType = record.examType;
    if (record.skillName) where.skillName = record.skillName;
    if (record.jobId) where.jobId = record.jobId;

    const bank = await this.questionRepo.find({ where });
    // 随机抽 count 题（题库不足则全取）
    const sampled = this.sampleRandom(bank, count);
    // 选项乱序 + 重算答案
    const served = sampled.map((q) => this.shuffleQuestion(q));
    const startedAt = Date.now();
    const timeLimitSec = this.calcTimeLimit(served);

    // 持久化快照（含正确答案，仅服务端）
    record.questionIds = served.map((s) => s.id).filter((id) => typeof id === 'number');
    record.answers = { served, userAnswers: {}, startedAt, timeLimitSec };
    record.updateTime = Date.now();
    await this.examRepo.save(record);

    return {
      examId,
      examType: record.examType,
      skillName: record.skillName || null,
      questions: this.sanitizeServed(served),
      timeLimitSec,
      startedAt,
    };
  }

  /** 提交考试 — 对齐 POST /api/user/exams/submit
   *  优先按 examId 的服务端快照批改（§24.1 防作弊：答案不经客户端）。
   *  兼容旧调用：无 examId 时回退到按 answers 的题目 ID 直接批改。
   */
  async submitExam(userId: number, data: {
    examId?: number;
    examType: number;
    skillName?: string;
    jobId?: number;
    answers: any;
    questionTimings?: Record<string, number>; // 每题用时(秒)
  }) {
    // ── 路径 A：有 examId，按服务端快照批改 ──
    if (data.examId) {
      return this.submitByRecord(userId, data);
    }

    // ── 路径 B（兼容旧逻辑）：按 answers 的题目 ID 批改 ──
    const questionIds = Object.keys(data.answers).map(Number).filter((id) => !isNaN(id));
    const questions = questionIds.length > 0
      ? await this.questionRepo.find({ where: { id: In(questionIds), status: 1 } })
      : [];

    const totalQuestions = questions.length;
    let correctCount = 0;
    const wrongQuestions: Array<{ question: string; userAnswer: string; correctAnswer: string; type: string }> = [];

    for (const q of questions) {
      const userAnswer = data.answers[q.id];
      const isCorrect = await this.checkAnswer(q.questionType, userAnswer, q.answer, q.title);
      if (isCorrect) correctCount++;
      else wrongQuestions.push({
        question: q.title,
        userAnswer: String(userAnswer ?? ''),
        correctAnswer: JSON.stringify(q.answer),
        type: q.questionType,
      });
    }

    const accuracy = totalQuestions > 0 ? correctCount / totalQuestions : 0;
    const score = Math.round(accuracy * 100);
    const passed = accuracy >= 0.6 ? 1 : 0;

    let wrongAnalysis: Record<string, any> | null = null;
    if (passed === 0 && wrongQuestions.length > 0) {
      try {
        wrongAnalysis = await this.reviewerAgent.analyzeErrors(wrongQuestions, data.skillName || '未知技能') as any;
      } catch (e: any) {
        console.warn('[ExamsService] Error analysis failed:', e.message);
      }
    }

    const exam = await this.examRepo.save({
      userId, examType: data.examType, skillName: data.skillName, jobId: data.jobId,
      answers: data.answers, score, passed, wrongAnalysis, retryCount: 0,
      createTime: Date.now(), updateTime: Date.now(), status: 1,
    });

    // 异步回写每题通过率（不阻塞返回）
    for (const q of questions) {
      this.updatePassRate(q.id).catch(() => {});
    }

    return {
      ...exam,
      summary: { totalQuestions, correctCount, wrongCount: totalQuestions - correctCount },
      wrongAnalysis: wrongAnalysis ? {
        wrongQuestions: wrongAnalysis.weakPoints || [],
        weakPoints: wrongAnalysis.weakPoints || [],
        reinforcementPlan: wrongAnalysis.reinforcementPlan || {},
      } : undefined,
    };
  }

  /** 按已抽题记录批改（§24.1：答案保存在服务端 served 快照） */
  private async submitByRecord(userId: number, data: {
    examId?: number; skillName?: string; answers: any; questionTimings?: Record<string, number>;
  }) {
    const record = await this.examRepo.findOne({ where: { id: data.examId, userId, status: 1 } });
    if (!record) throw new Error('考试不存在');

    const served = (record.answers?.served as any[]) || [];
    const userAnswers = data.answers || {};
    const timings = data.questionTimings || {};

    let correctCount = 0;
    const wrongQuestions: Array<{ question: string; userAnswer: string; correctAnswer: string; type: string }> = [];
    const anomalies: string[] = [];

    for (const q of served) {
      const userAnswer = userAnswers[q.id];
      const isCorrect = await this.checkAnswer(q.questionType, userAnswer, q.answer, q.title);
      if (isCorrect) correctCount++;
      else wrongQuestions.push({
        question: q.title,
        userAnswer: String(userAnswer ?? ''),
        correctAnswer: JSON.stringify(q.answer),
        type: q.questionType,
      });

      // §24.1 答题行为异常检测：用时 < 3 秒视为可疑
      const t = timings[q.id];
      if (typeof t === 'number' && t < 3 && userAnswer !== undefined) {
        anomalies.push(`题 ${q.id} 用时仅 ${t}s`);
      }
    }

    const totalQuestions = served.length;
    const accuracy = totalQuestions > 0 ? correctCount / totalQuestions : 0;
    const score = Math.round(accuracy * 100);
    const passed = accuracy >= 0.6 ? 1 : 0;

    // §24.1 全对且总用时极短 → 标记可疑
    const totalTime = Object.values(timings).reduce((s, v) => s + (Number(v) || 0), 0);
    if (correctCount === totalQuestions && totalQuestions > 0 && totalTime > 0 && totalTime < totalQuestions * 3) {
      anomalies.push('全对且总用时极短');
    }

    // 未通过 → 错题分析闭环（§12.2）
    let wrongAnalysis: Record<string, any> | null = null;
    if (passed === 0 && wrongQuestions.length > 0) {
      try {
        wrongAnalysis = await this.reviewerAgent.analyzeErrors(wrongQuestions, record.skillName || data.skillName || '未知技能') as any;
      } catch (e: any) {
        console.warn('[ExamsService] Error analysis failed:', e.message);
      }
    }

    // 回写批改结果到同一条记录
    record.answers = { ...record.answers, userAnswers, questionTimings: timings, anomalies };
    record.score = score;
    record.passed = passed;
    record.wrongAnalysis = wrongAnalysis;
    record.updateTime = Date.now();
    await this.examRepo.save(record);

    // 异步回写每题通过率（不阻塞返回）
    for (const q of served) {
      this.updatePassRate(q.id).catch(() => {});
    }

    if (anomalies.length > 0) {
      console.warn(`[ExamsService] 考试 ${record.id} 异常行为:`, anomalies.join('; '));
    }

    return {
      ...record,
      summary: { totalQuestions, correctCount, wrongCount: totalQuestions - correctCount },
      anomalyFlagged: anomalies.length > 0,
      wrongAnalysis: wrongAnalysis ? {
        wrongQuestions: wrongAnalysis.weakPoints || [],
        weakPoints: wrongAnalysis.weakPoints || [],
        reinforcementPlan: wrongAnalysis.reinforcementPlan || {},
      } : undefined,
    };
  }

  // ── §24.1 防作弊辅助方法 ──────────────────────────────

  /** Fisher-Yates 随机抽样 */
  private sampleRandom<T>(arr: T[], n: number): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.min(n, copy.length));
  }

  /** 选择题选项乱序 + 重算正确答案索引 */
  private shuffleQuestion(q: ExamQuestion): any {
    const base = {
      id: q.id,
      questionType: q.questionType,
      type: q.questionType,
      title: q.title,
      content: q.content,
      difficulty: q.difficulty,
    };

    if (q.questionType !== 'choice' || !Array.isArray(q.content?.options)) {
      return { ...base, options: q.content?.options, answer: q.answer };
    }

    const options: string[] = q.content.options;
    // 兼容多种 answer 格式：数字索引 / {correct, explanation} / {value} / {index}
    const rawAnswer = q.answer as any;
    let correctIndex: number;
    if (typeof rawAnswer === 'number') {
      correctIndex = rawAnswer;
    } else if (typeof rawAnswer?.correct === 'number') {
      correctIndex = rawAnswer.correct;
    } else if (typeof rawAnswer?.value === 'number') {
      correctIndex = rawAnswer.value;
    } else if (typeof rawAnswer?.index === 'number') {
      correctIndex = rawAnswer.index;
    } else {
      correctIndex = 0;
    }
    const correctValue = options[correctIndex] ?? '';

    // 带原索引打乱
    const indexed = options.map((opt, i) => ({ opt, i }));
    for (let i = indexed.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
    }
    const shuffledOptions = indexed.map((x) => x.opt);
    const newAnswerIndex = shuffledOptions.findIndex((o) => o === correctValue);

    return {
      ...base,
      options: shuffledOptions,
      content: { ...q.content, options: shuffledOptions },
      answer: newAnswerIndex >= 0 ? newAnswerIndex : 0, // 乱序后的正确索引
    };
  }

  /** 下发前端：剔除答案/解析 */
  private sanitizeServed(served: any[]): any[] {
    return served.map((q) => ({
      id: q.id,
      type: q.questionType || q.type,
      title: q.title,
      options: q.options ?? q.content?.options,
      content: q.content,
      difficulty: q.difficulty,
    }));
  }

  /** §24.1 总时限：选择题60s/填空题90s/编程题15min，× 1.5 */
  private calcTimeLimit(served: any[]): number {
    let sec = 0;
    for (const q of served) {
      const type = q.questionType || q.type;
      if (type === 'coding') sec += 15 * 60;
      else if (type === 'fill') sec += 90;
      else if (type === 'essay') sec += 5 * 60;
      else sec += 60;
    }
    return Math.round(sec * 1.5);
  }

  /**
   * 检查答案是否正确
   * - choice/fill：本地精确匹配
   * - coding/essay：AI 批改（60 分及格）
   */
  private async checkAnswer(questionType: string, userAnswer: any, correctAnswer: any, questionTitle?: string): Promise<boolean> {
    if (userAnswer === undefined || userAnswer === null) return false;

    switch (questionType) {
      case 'choice':
        return userAnswer === correctAnswer;
      case 'fill':
        return String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
      case 'coding':
      case 'essay': {
        // 空白答案直接判错
        const userAnsStr = typeof userAnswer === 'string' ? userAnswer.trim() : JSON.stringify(userAnswer);
        if (!userAnsStr) return false;
        try {
          const result = await this.aiGrade(questionTitle || '', userAnsStr, correctAnswer, questionType);
          return result.passed;
        } catch (e: any) {
          console.warn(`[ExamsService] AI 批改失败 (${questionType}):`, e.message);
          return false;
        }
      }
      default:
        return false;
    }
  }

  /**
   * AI 批改编程题/简答题
   * - 编程题：功能实现(70%) + 语法规范(20%) + 代码结构(10%)
   * - 简答题：意思相近可得分，支持同义词
   */
  private async aiGrade(
    question: string,
    userAnswer: string,
    correctAnswer: any,
    questionType: 'coding' | 'essay',
  ): Promise<{ score: number; maxScore: number; passed: boolean; feedback: string }> {
    const correctAnsStr = typeof correctAnswer === 'string'
      ? correctAnswer
      : (correctAnswer?.solution || correctAnswer?.content || JSON.stringify(correctAnswer));

    const prompt = questionType === 'coding'
      ? `你是编程教授，批改学生代码。
题目：${question}
参考答案：${correctAnsStr}
学生答案：${userAnswer}
评分标准：功能实现(70%)+语法规范(20%)+代码结构(10%)
如果完全没有实现功能，给0分。
输出JSON：{"grade": 0-100, "feedback": "给分理由"}`
      : `你是课程专家，批改学生作答。
题目：${question}
参考答案：${correctAnsStr}
学生答案：${userAnswer}
学生答案与参考答案意思相近即可得分。
输出JSON：{"grade": 0-100, "feedback": "给分理由"}`;

    const raw = await this.llmService.chatCompletion(
      [{ role: 'user', content: prompt }],
      { temperature: 0.3, maxTokens: 512 },
    );

    let grade = 0;
    let feedback = 'AI 批改未能解析结果';
    try {
      const parsed = extractJson(raw);
      grade = typeof parsed.grade === 'number' ? parsed.grade : 0;
      feedback = typeof parsed.feedback === 'string' ? parsed.feedback : feedback;
    } catch (e: any) {
      console.warn('[ExamsService] AI 批改 JSON 解析失败，默认 0 分。原始输出:', raw.slice(0, 200));
    }

    return {
      score: grade,
      maxScore: 100,
      passed: grade >= 60,
      feedback,
    };
  }

  /** 获取用户错题本 — 聚合所有考试中的错题 */
  async getWrongAnswers(userId: number, skillName?: string) {
    const where: any = { userId, status: 1 };
    if (skillName) where.skillName = skillName;

    const exams = await this.examRepo.find({
      where,
      order: { createTime: 'DESC' },
    });

    const wrongList: Array<{
      examId: number;
      skillName: string;
      examType: number;
      createTime: number;
      question: string;
      userAnswer: string;
      correctAnswer: string;
      type: string;
    }> = [];

    for (const exam of exams) {
      // 来源1：从 wrongAnalysis 中提取（submitExam 生成的结构化错题分析）
      const weakPoints = exam.wrongAnalysis?.weakPoints || [];
      for (const w of weakPoints) {
        wrongList.push({
          examId: exam.id,
          skillName: exam.skillName || '未知',
          examType: exam.examType,
          createTime: exam.createTime,
          question: w.skill || w.question || '',
          userAnswer: w.userAnswer || '',
          correctAnswer: w.correctAnswer || '',
          type: w.type || 'unknown',
        });
      }

      // 来源2：从 answers.userAnswers 中提取（当 wrongAnalysis 为空时降级）
      if (weakPoints.length === 0 && exam.answers) {
        const served: any[] = exam.answers.served || [];
        const userAnswers: Record<string, any> = exam.answers.userAnswers || {};
        const hasUserAnswers = Object.keys(userAnswers).length > 0;

        if (hasUserAnswers && served.length > 0) {
          for (const q of served) {
            const qId = String(q.id);
            const userAns = userAnswers[qId];
            if (userAns === undefined || userAns === null || userAns === '') continue;

            // 判断是否答错
            let isWrong = false;
            let correctAns = '';
            let userAnsStr = '';

            if (q.type === 'choice' || q.questionType === 'choice') {
              const correctIdx = q.answer ?? q.content?.answer;
              correctAns = q.options?.[correctIdx] || String(correctIdx);
              userAnsStr = q.options?.[userAns] || String(userAns);
              isWrong = Number(userAns) !== Number(correctIdx);
            } else if (q.type === 'coding' || q.questionType === 'coding') {
              // 编程题：answer 里有 solution
              correctAns = q.answer?.solution || q.content?.answer?.solution || '';
              userAnsStr = typeof userAns === 'string' ? userAns : JSON.stringify(userAns);
              // 编程题如果没有 pass 标记则视为错
              isWrong = !exam.passed;
            } else {
              // 其他题型：字符串比较
              correctAns = String(q.answer ?? q.content?.answer ?? '');
              userAnsStr = String(userAns);
              isWrong = userAnsStr.trim() !== correctAns.trim();
            }

            if (isWrong) {
              wrongList.push({
                examId: exam.id,
                skillName: exam.skillName || '未知',
                examType: exam.examType,
                createTime: exam.createTime,
                question: q.title || q.question || q.content?.title || '',
                userAnswer: userAnsStr,
                correctAnswer: correctAns,
                type: q.type || q.questionType || 'unknown',
              });
            }
          }
        } else if (!hasUserAnswers && served.length > 0 && !exam.passed && exam.score !== null && exam.score < 60) {
          // 考试已批改但未通过，且 userAnswers 为空（可能是超时/未答完）
          for (const q of served) {
            const correctIdx = q.answer ?? q.content?.answer;
            const correctAns = q.options?.[correctIdx] || String(correctIdx);
            wrongList.push({
              examId: exam.id,
              skillName: exam.skillName || '未知',
              examType: exam.examType,
              createTime: exam.createTime,
              question: q.title || q.question || q.content?.title || '',
              userAnswer: '（未作答）',
              correctAnswer: correctAns,
              type: q.type || q.questionType || 'unknown',
            });
          }
        }
      }
    }

    // 按技能分组
    const grouped: Record<string, typeof wrongList> = {};
    for (const item of wrongList) {
      const key = item.skillName || '未知';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }

    return {
      total: wrongList.length,
      skills: Object.keys(grouped).map(skill => ({
        skill,
        count: grouped[skill].length,
        items: grouped[skill],
      })),
    };
  }

  // ══════════════════════════════════════════════════════════
  //  功能1：占位符记录模式
  // ══════════════════════════════════════════════════════════

  /**
   * 创建占位符考试记录（score=null, passed=null）
   * 返回 record.id，后续 submitExam 可更新这条记录
   */
  async createPlaceholderRecord(userId: number, data: { examId?: number; examType: number; skillName?: string }): Promise<number> {
    const record = await this.examRepo.save({
      userId,
      examType: data.examType,
      skillName: data.skillName,
      answers: {},
      score: null,
      passed: null,
      retryCount: 0,
      createTime: Date.now(),
      updateTime: Date.now(),
      status: 1,
    });
    return record.id;
  }

  // ══════════════════════════════════════════════════════════
  //  功能2：错题 → 自动补强学习任务
  // ══════════════════════════════════════════════════════════

  /**
   * 从错题分析的 reinforcementPlan 中提取补强任务，自动创建 LearningTask
   */
  async createReinforcementTasks(userId: number, examId: number, wrongAnalysis: any): Promise<void> {
    if (!wrongAnalysis?.reinforcementPlan) return;

    const plan = wrongAnalysis.reinforcementPlan;
    const tasks: Array<{ skill: string; action: string; estimatedMin?: number }> = [];

    // reinforcementPlan 可能是数组或对象，兼容两种结构
    if (Array.isArray(plan)) {
      for (const item of plan) {
        tasks.push({
          skill: item.skill || item.topic || item.name || '未知技能',
          action: item.action || item.description || item.task || '补强学习',
          estimatedMin: item.estimatedMin || item.duration || 30,
        });
      }
    } else if (typeof plan === 'object') {
      for (const [skill, detail] of Object.entries(plan)) {
        const d = detail as any;
        tasks.push({
          skill,
          action: typeof d === 'string' ? d : (d.action || d.description || '补强学习'),
          estimatedMin: typeof d === 'object' ? (d.estimatedMin || d.duration || 30) : 30,
        });
      }
    }

    if (tasks.length === 0) return;

    // 查找用户当前最大 sortOrder，新任务排在末尾
    const maxSort = await this.learningTaskRepo
      .createQueryBuilder('t')
      .select('MAX(t.sortOrder)', 'max')
      .where('t.userId = :userId', { userId })
      .getRawOne();
    let nextSort = (maxSort?.max ?? 0) + 1;

    const today = new Date().toISOString().slice(0, 10);

    for (const t of tasks) {
      await this.learningTaskRepo.save({
        userId,
        planId: 0, // 补强任务无关联计划
        skillName: t.skill,
        taskType: 'side' as const,
        taskStatus: 'pending' as const,
        estimatedMin: t.estimatedMin,
        sortOrder: nextSort++,
        priority: 8, // 补强任务优先级较高
        planDate: today,
        isActive: 1,
        createTime: Date.now(),
        updateTime: Date.now(),
        status: 1,
      });
    }

    console.log(`[ExamsService] 为用户 ${userId} 创建 ${tasks.length} 个补强任务（examId=${examId}）`);
  }

  // ══════════════════════════════════════════════════════════
  //  功能3：考试通过率统计回写
  // ══════════════════════════════════════════════════════════

  /**
   * 统计某题的所有考试记录，计算通过率，回写到 ExamQuestion.passRate
   */
  async updatePassRate(questionId: number): Promise<void> {
    try {
      // 找到所有包含该题目的考试记录
      const records = await this.examRepo
        .createQueryBuilder('r')
        .where('r.status = 1')
        .andWhere('r.score IS NOT NULL')
        .getMany();

      let total = 0;
      let passed = 0;
      for (const r of records) {
        const qIds = r.questionIds || [];
        const served = (r.answers?.served as any[])?.map((s: any) => s.id) || [];
        const containsQuestion = qIds.includes(questionId) || served.includes(questionId);
        if (!containsQuestion) continue;
        total++;
        if (r.passed) passed++;
      }

      if (total === 0) return;

      const passRate = Math.round((passed / total) * 100) / 100; // 0.xx 精度
      await this.questionRepo.update(questionId, { passRate, updateTime: Date.now() });
    } catch (e: any) {
      console.warn(`[ExamsService] updatePassRate(${questionId}) failed:`, e.message);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  功能4：题库统计（Controller 端点对应）
  // ══════════════════════════════════════════════════════════

  /**
   * 题库统计：按技能/题型/难度聚合题目数量、平均通过率
   */
  async getQuestionBankStats(skillName?: string) {
    const where: any = { status: 1 };
    if (skillName) where.skillName = skillName;

    const questions = await this.questionRepo.find({ where });

    // 按技能分组
    const bySkill: Record<string, { total: number; avgPassRate: number; avgDifficulty: number }> = {};
    // 按题型分组
    const byType: Record<string, { total: number; avgPassRate: number }> = {};
    // 按难度分组
    const byDifficulty: Record<number, { total: number; avgPassRate: number }> = {};

    for (const q of questions) {
      const skill = q.skillName || '未分类';
      const type = q.questionType;
      const diff = q.difficulty;
      const pr = q.passRate ?? 0;

      // bySkill
      if (!bySkill[skill]) bySkill[skill] = { total: 0, avgPassRate: 0, avgDifficulty: 0 };
      bySkill[skill].total++;
      bySkill[skill].avgPassRate += pr;
      bySkill[skill].avgDifficulty += diff;

      // byType
      if (!byType[type]) byType[type] = { total: 0, avgPassRate: 0 };
      byType[type].total++;
      byType[type].avgPassRate += pr;

      // byDifficulty
      if (!byDifficulty[diff]) byDifficulty[diff] = { total: 0, avgPassRate: 0 };
      byDifficulty[diff].total++;
      byDifficulty[diff].avgPassRate += pr;
    }

    // 计算平均值
    for (const v of Object.values(bySkill)) {
      v.avgPassRate = v.total > 0 ? Math.round((v.avgPassRate / v.total) * 100) / 100 : 0;
      v.avgDifficulty = v.total > 0 ? Math.round((v.avgDifficulty / v.total) * 10) / 10 : 0;
    }
    for (const v of Object.values(byType)) {
      v.avgPassRate = v.total > 0 ? Math.round((v.avgPassRate / v.total) * 100) / 100 : 0;
    }
    for (const v of Object.values(byDifficulty)) {
      v.avgPassRate = v.total > 0 ? Math.round((v.avgPassRate / v.total) * 100) / 100 : 0;
    }

    return {
      total: questions.length,
      bySkill,
      byType,
      byDifficulty,
    };
  }

  // ── 考试重试调度 ──────────────────────────────

  /** 获取可重试的考试 */
  async getRetryableExams(userId: number) {
    const now = Date.now();
    const exams = await this.examRepo.find({
      where: { userId, status: 1, passed: 0 as any },
      order: { createTime: 'DESC' },
    });
    return exams.filter(e => {
      if (!e.nextRetryTime) return true; // 从未重试过
      return e.nextRetryTime <= now;
    });
  }

  /** 调度重试 */
  async scheduleRetry(examId: number, userId: number) {
    const exam = await this.examRepo.findOne({ where: { id: examId, userId, status: 1 } });
    if (!exam) throw new Error('考试不存在');
    if (exam.passed === 1) throw new Error('已通过的考试无需重试');

    const retryCount = (exam.retryCount || 0) + 1;
    const delayMs = retryCount * 24 * 60 * 60 * 1000; // 指数退避：1天、2天、3天...
    const nextRetryTime = Date.now() + delayMs;

    await this.examRepo.update(examId, { retryCount, nextRetryTime, updateTime: Date.now() });
    return { retryCount, nextRetryTime, canRetryAt: new Date(nextRetryTime).toISOString() };
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ExamRecord, ExamQuestion } from '../../entities/exam.entity';
import { ReviewerAgentService } from '../../services/agents';

/**
 * Exams 服务 — 对齐 Python api/user/exams.py
 */
@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(ExamRecord) private examRepo: Repository<ExamRecord>,
    @InjectRepository(ExamQuestion) private questionRepo: Repository<ExamQuestion>,
    private readonly reviewerAgent: ReviewerAgentService,
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
      const isCorrect = this.checkAnswer(q.questionType, userAnswer, q.answer);
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
      const isCorrect = this.checkAnswer(q.questionType, userAnswer, q.answer);
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

  /** 检查答案是否正确 */
  private checkAnswer(questionType: string, userAnswer: any, correctAnswer: any): boolean {
    if (userAnswer === undefined || userAnswer === null) return false;

    switch (questionType) {
      case 'choice':
        return userAnswer === correctAnswer;
      case 'fill':
        return String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
      case 'coding':
      case 'essay':
        // 编程题/简答题暂不自动批改
        return false;
      default:
        return false;
    }
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
}

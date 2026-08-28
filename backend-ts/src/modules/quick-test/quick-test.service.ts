import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamQuestion, ExamRecord } from '../../entities/exam.entity';
import { Student } from '../../entities/student.entity';
import { LlmService } from '../../services/llm.service';
import { extractJson } from '../../common/json-repair';
import { LearningCommitService } from '../../services/learning-commit.service';
import { EvaluationService } from '../../services/evaluation.service';
import { LearningAssessmentContextService, LearningAssessmentContext } from '../../domains/learning-assessment-context.service';

/**
 * 5分钟速测服务
 *
 * 功能：
 *   - 根据用户意向方向抽 5 道基础题
 *   - 即时评分
 *   - 更新 user_skills_v3（source=exam, trustWeight=1.0）
 */
@Injectable()
export class QuickTestService {
  constructor(
    @InjectRepository(ExamQuestion) private questionRepo: Repository<ExamQuestion>,
    @InjectRepository(ExamRecord) private examRepo: Repository<ExamRecord>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    private llmService: LlmService,
    private learningCommitService: LearningCommitService,
    private evaluationService: EvaluationService,
    private assessmentContext: LearningAssessmentContextService,
  ) {}

  /**
   * 获取速测题目
   */
  async getQuestions(userId: number, direction?: string): Promise<{
    questions: any[];
    skillName: string;
  }> {
    // 获取用户方向
    const student = await this.studentRepo.findOne({ where: { userId, status: 1 } });
    const context = await this.assessmentContext.resolve(userId);
    const skillName = direction || context?.currentAbilityName || student?.interests?.[0] || '通用学习能力';

    // 先从题库找
    const existingQuestions = await this.questionRepo.find({
      where: { skillName, status: 1, examType: 3 },
      take: 5,
    });

    if (existingQuestions.length >= 5) {
      return {
        questions: existingQuestions.map((q) => ({
          id: q.id,
          type: q.questionType,
          title: q.title,
          content: q.content,
          options: q.content?.options,
        })),
        skillName,
      };
    }

    // 题库不够，用 LLM 生成
    const generated = await this.generateQuestions(skillName, context);
    return { questions: generated, skillName };
  }

  /**
   * 提交答案并评分
   */
  async submitAnswers(
    userId: number,
    skillName: string,
    answers: Record<string, any>,
    questions: any[],
  ): Promise<{
    examRecordId: number;
    score: number;
    passed: boolean;
    correctCount: number;
    totalCount: number;
    results: Array<{ questionId: string; correct: boolean; explanation: string }>;
    commit?: any;
    snapshot?: any;
    gitDelta?: any;
    branch?: any;
    matchSummary?: any;
    evaluation?: any;
  }> {
    const now = Date.now();
    let correctCount = 0;
    const results: Array<{ questionId: string; correct: boolean; explanation: string }> = [];

    // 批改答案
    for (const question of questions) {
      const userAnswer = answers[question.id];
      const isCorrect = this.checkAnswer(question.type, userAnswer, question.answer);

      if (isCorrect) correctCount++;

      results.push({
        questionId: question.id,
        correct: isCorrect,
        explanation: question.explanation || '',
      });
    }

    const totalCount = questions.length;
    const score = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    const context = await this.assessmentContext.resolve(userId);
    const passScore = context?.passScore || 70;
    const passed = score >= passScore;

    // 保存考试记录
    const examRecord = await this.examRepo.save({
      userId,
      examType: 3, // 速测
      skillName,
      answers: { questions, userAnswers: answers },
      score,
      passed: passed ? 1 : 0,
      retryCount: 0,
      createTime: now,
      updateTime: now,
      status: 1,
    });

    const masteryPct = passed ? score : Math.round(score * 0.5);
    const git = await this.learningCommitService.commitSkill(userId, undefined, {
      type: passed ? 'quiz_passed' : 'quiz_failed',
      skillName,
      masteryPct,
      source: 'exam',
      trustWeight: passed ? 1.0 : 0.8,
      message: `quick test ${passed ? 'passed' : 'failed'}: ${skillName}`,
      payload: {
        examRecordId: examRecord.id,
        source: 'quick_test',
        score,
        correctCount,
        totalCount,
        passScore,
        domainId: context?.domainId,
        goalType: context?.goalType,
      },
    });
    const evaluation = await this.evaluationService.record({
      userId,
      attemptType: 'quick_test',
      sourceType: 'exam_record',
      sourceId: examRecord.id,
      skillName,
      goal: context?.goalTitle,
      rubricKey: this.assessmentContext.rubricKey(context, 'quick_test'),
      rubricName: context ? `${context.domainName}${context.terminology.assessment || '能力测评'}` : undefined,
      rubricDimensions: context?.radarDimensions.map((dimension) => ({
        key: dimension.id,
        name: dimension.name,
        assessmentModes: context.assessmentModes,
      })),
      rubricWeights: context ? Object.fromEntries(context.radarDimensions.map((dimension) => [dimension.id, dimension.weight])) : undefined,
      passScore,
      score,
      passed,
      confidence: passed ? 0.88 : 0.76,
      evaluatorType: 'objective',
      evaluatorName: 'quick_test_objective_grader',
      summary: `${context?.domainName || '通用'}速测${passed ? '通过' : '未通过'}：${skillName} ${correctCount}/${totalCount}。`,
      evidenceSummary: `${skillName} · ${context?.evidenceTypes?.join('、') || '答题记录'}`,
      evidence: {
        questions,
        answers,
        results,
        score,
        correctCount,
        totalCount,
        passScore,
        domainId: context?.domainId,
        assessmentModes: context?.assessmentModes,
        evidenceTypes: context?.evidenceTypes,
      },
      commitOutcome: git,
      dimensions: this.dimensionsFromGit(git, skillName, score, context),
      metadata: context ? {
        planId: context.planId,
        domainId: context.domainId,
        domainName: context.domainName,
        goalType: context.goalType,
        goalTitle: context.goalTitle,
      } : null,
      nextActions: passed
        ? [{ type: 'learning_path', label: '继续学习路径', skillName }]
        : [{ type: 'review', label: '复盘本次薄弱项', skillName }],
    });

    return {
      examRecordId: examRecord.id,
      score,
      passed,
      correctCount,
      totalCount,
      results,
      commit: git.commit,
      snapshot: git.snapshot,
      gitDelta: git.delta,
      branch: git.branch,
      matchSummary: git.matchSummary,
      evaluation,
    };
  }

  // ── 内部方法 ──────────────────────────────────

  /**
   * 检查答案
   */
  private checkAnswer(questionType: string, userAnswer: any, correctAnswer: any): boolean {
    if (userAnswer === undefined || userAnswer === null) return false;

    switch (questionType) {
      case 'choice':
        return userAnswer === correctAnswer;
      case 'fill':
        return String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
      default:
        return false;
    }
  }

  private dimensionsFromGit(
    git: any,
    fallbackSkill: string,
    fallbackScore: number,
    context: LearningAssessmentContext | null,
  ) {
    const changes = git?.delta?.radarChanges || [];
    if (Array.isArray(changes) && changes.length > 0) {
      return changes.map((change: any) => ({
        name: change.dimension,
        score: Number.isFinite(Number(change.after)) ? Number(change.after) : fallbackScore,
        maxScore: 100,
        trend: Number(change.delta || 0) > 0 ? 'up' : Number(change.delta || 0) < 0 ? 'down' : 'stable',
        detail: `Radar ${change.dimension}: ${change.before ?? 0} -> ${change.after ?? 0}`,
      }));
    }
    const domainDimension = this.assessmentContext.dimensionForSkill(context, fallbackSkill);
    return [{
      key: domainDimension?.id,
      name: domainDimension?.name || fallbackSkill,
      score: fallbackScore,
      maxScore: 100,
      weight: domainDimension?.weight || 1,
      trend: 'stable',
      detail: context ? `${context.domainName} · ${context.assessmentModes.join('、')}` : undefined,
    }];
  }

  /**
   * 使用 LLM 生成题目
   */
  private async generateQuestions(skillName: string, context: LearningAssessmentContext | null): Promise<any[]> {
    const prompt = `请为${context?.domainName || '通用学习'}能力「${skillName}」生成 5 道选择题（适合入门水平速测）。

目标：${context?.goalTitle || '诊断当前基础'}
适用评价方式：${context?.assessmentModes?.join('、') || '客观题测验'}
需要沉淀的证据：${context?.evidenceTypes?.join('、') || '答题正确率与错题原因'}

输出JSON格式：
{
  "questions": [
    {
      "id": "q1",
      "type": "choice",
      "title": "题目描述",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "answer": 0,
      "explanation": "解析"
    }
  ]
}

要求：
1. 题目难度：入门级
2. 每题4个选项
3. answer 是正确选项的索引（0-3）
4. explanation 简短说明为什么选这个

只输出JSON，不要其他文字。`;

    try {
      const result = await this.llmService.chatCompletion([
        { role: 'system', content: `你是${context?.domainName || '跨专业学习'}测评专家，题目必须符合该领域语境，非软件领域不要强行使用代码题。` },
        { role: 'user', content: prompt },
      ], { temperature: 0.5, maxTokens: 1000 });

      const data = extractJson(result);
      return data.questions || [];
    } catch (e: any) {
      console.warn('[QuickTest] Generate questions failed:', e.message);
      return [];
    }
  }
}

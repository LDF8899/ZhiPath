import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamQuestion, ExamRecord } from '../../entities/exam.entity';
import { Student } from '../../entities/student.entity';
import { LlmService } from '../../services/llm.service';
import { extractJson } from '../../common/json-repair';
import { LearningCommitService } from '../../services/learning-commit.service';
import { EvaluationService } from '../../services/evaluation.service';

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
    const skillName = direction || student?.interests?.[0] || 'JavaScript';

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
    const generated = await this.generateQuestions(skillName);
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
    const passed = score >= 70;

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
        passScore: 70,
      },
    });
    const evaluation = await this.evaluationService.record({
      userId,
      attemptType: 'quick_test',
      sourceType: 'exam_record',
      sourceId: examRecord.id,
      skillName,
      score,
      passed,
      confidence: passed ? 0.88 : 0.76,
      evaluatorType: 'objective',
      evaluatorName: 'quick_test_objective_grader',
      summary: `Quick test ${passed ? 'passed' : 'failed'} for ${skillName}: ${correctCount}/${totalCount}.`,
      evidence: { questions, answers, results, score, correctCount, totalCount, passScore: 70 },
      commitOutcome: git,
      dimensions: this.dimensionsFromGit(git, skillName, score),
      nextActions: passed
        ? [{ type: 'learning_path', label: 'Continue learning path', skillName }]
        : [{ type: 'review', label: 'Review quick test misses', skillName }],
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

  private dimensionsFromGit(git: any, fallbackSkill: string, fallbackScore: number) {
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
    return [{ name: fallbackSkill, score: fallbackScore, maxScore: 100, trend: 'stable' }];
  }

  /**
   * 使用 LLM 生成题目
   */
  private async generateQuestions(skillName: string): Promise<any[]> {
    const prompt = `请为技能「${skillName}」生成 5 道选择题（适合入门水平速测）。

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
        { role: 'system', content: '你是出题专家，生成高质量选择题。' },
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

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamQuestion, ExamRecord } from '../../entities/exam.entity';
import { Student } from '../../entities/student.entity';
import { SkillService } from '../../services/skill.service';
import { LlmService } from '../../services/llm.service';
import { extractJson } from '../../common/json-repair';

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
    private skillService: SkillService,
    private llmService: LlmService,
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
    score: number;
    passed: boolean;
    correctCount: number;
    totalCount: number;
    results: Array<{ questionId: string; correct: boolean; explanation: string }>;
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
    const passed = score >= 60;

    // 保存考试记录
    await this.examRepo.save({
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

    // 更新技能掌握度（source=exam, trustWeight=1.0）
    if (passed) {
      await this.skillService.addSkill(userId, skillName, 'exam', 1.0, score);
    } else {
      // 未通过也更新，但掌握度较低
      await this.skillService.addSkill(userId, skillName, 'exam', 0.8, score * 0.5);
    }

    return { score, passed, correctCount, totalCount, results };
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

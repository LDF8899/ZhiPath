import { Injectable } from '@nestjs/common';
import { LlmService } from './llm.service';
import { extractJson } from '../common/json-repair';

/**
 * ReviewerAgent 服务 — 错题分析与内容审查
 *
 * 对齐 CONSTITUTION.md §12 考试系统：
 *   - 错题归类（知识点分类）
 *   - 错因归因（概念不清 vs 粗心 vs 理解偏差）
 *   - 生成针对性补强计划
 */
@Injectable()
export class ReviewerAgentService {
  constructor(private llmService: LlmService) {}

  /**
   * 分析错题
   *
   * @param answers 用户答案
   * @param questions 题目列表
   * @returns 错题分析结果
   */
  async analyzeWrongAnswers(
    answers: Record<string, any>,
    questions: Array<{
      id: string;
      type: string;
      title: string;
      content: any;
      answer: any;
    }>,
  ): Promise<{
    wrongQuestions: Array<{
      questionId: string;
      title: string;
      userAnswer: any;
      correctAnswer: any;
      knowledgePoint: string;
      errorType: 'concept' | 'careless' | 'understanding' | 'unknown';
      explanation: string;
    }>;
    summary: {
      totalQuestions: number;
      correctCount: number;
      wrongCount: number;
      accuracy: number;
      weakPoints: string[];
    };
    reinforcementPlan: {
      skills: Array<{ name: string; priority: number; estimatedMinutes: number }>;
      description: string;
    };
  }> {
    // 1. 批改答案
    const wrongQuestions: Array<{
      questionId: string;
      title: string;
      userAnswer: any;
      correctAnswer: any;
      knowledgePoint: string;
      errorType: 'concept' | 'careless' | 'understanding' | 'unknown';
      explanation: string;
    }> = [];

    for (const question of questions) {
      const userAnswer = answers[question.id];
      const correctAnswer = question.answer;

      if (!this.checkAnswer(question.type, userAnswer, correctAnswer)) {
        // 使用 LLM 分析错因
        const analysis = await this.analyzeSingleWrong(question, userAnswer);

        wrongQuestions.push({
          questionId: question.id,
          title: question.title,
          userAnswer,
          correctAnswer,
          knowledgePoint: analysis.knowledgePoint,
          errorType: analysis.errorType,
          explanation: analysis.explanation,
        });
      }
    }

    const totalQuestions = questions.length;
    const correct = totalQuestions - wrongQuestions.length;
    const accuracy = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;

    // 2. 提取薄弱知识点
    const weakPoints = [...new Set(wrongQuestions.map((w) => w.knowledgePoint))];

    // 3. 生成补强计划
    const reinforcementPlan = await this.generateReinforcementPlan(weakPoints, wrongQuestions);

    return {
      wrongQuestions,
      summary: {
        totalQuestions,
        correctCount: correct,
        wrongCount: wrongQuestions.length,
        accuracy,
        weakPoints,
      },
      reinforcementPlan,
    };
  }

  /**
   * 审查内容质量（通用）
   */
  async reviewContent(
    content: string,
    type: 'lecture' | 'exam' | 'resume',
  ): Promise<{
    score: number;
    issues: Array<{ severity: 'high' | 'medium' | 'low'; description: string }>;
    suggestions: string[];
  }> {
    const prompt = `请审查以下${type === 'lecture' ? '讲义' : type === 'exam' ? '题目' : '简历'}内容的质量。

内容：
${content.substring(0, 2000)}

请从以下维度评分（0-100）并提出改进建议：
1. 准确性
2. 完整性
3. 可读性
4. 专业性

输出JSON格式：
{
  "score": 85,
  "issues": [
    {"severity": "medium", "description": "问题描述"}
  ],
  "suggestions": ["建议1", "建议2"]
}

只输出JSON，不要其他文字。`;

    try {
      const result = await this.llmService.chatCompletion([
        { role: 'system', content: '你是内容质量审查专家。' },
        { role: 'user', content: prompt },
      ], { temperature: 0.3, maxTokens: 500 });

      return extractJson(result);
    } catch (e) {
      console.warn('[ReviewerAgent] Review failed:', e.message);
      return {
        score: 70,
        issues: [],
        suggestions: ['审查服务暂时不可用'],
      };
    }
  }

  // ── 内部方法 ──────────────────────────────────

  /**
   * 检查答案是否正确
   */
  private checkAnswer(questionType: string, userAnswer: any, correctAnswer: any): boolean {
    if (userAnswer === undefined || userAnswer === null) return false;

    switch (questionType) {
      case 'choice':
        return userAnswer === correctAnswer;
      case 'fill':
        return String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
      case 'coding':
        // 编程题需要运行验证，这里简单比较
        return false;
      default:
        return false;
    }
  }

  /**
   * 分析单个错题
   */
  private async analyzeSingleWrong(
    question: any,
    userAnswer: any,
  ): Promise<{
    knowledgePoint: string;
    errorType: 'concept' | 'careless' | 'understanding' | 'unknown';
    explanation: string;
  }> {
    const prompt = `分析以下错题：

题目：${question.title}
题型：${question.type}
题目内容：${JSON.stringify(question.content)}
用户答案：${JSON.stringify(userAnswer)}
正确答案：${JSON.stringify(question.answer)}

请分析：
1. 涉及的知识点（简短名称）
2. 错误原因分类：concept（概念不清）/ careless（粗心）/ understanding（理解偏差）/ unknown
3. 详细解析

输出JSON格式：
{
  "knowledgePoint": "知识点名称",
  "errorType": "concept",
  "explanation": "详细解析"
}

只输出JSON，不要其他文字。`;

    try {
      const result = await this.llmService.chatCompletion([
        { role: 'system', content: '你是错题分析专家。' },
        { role: 'user', content: prompt },
      ], { temperature: 0.3, maxTokens: 300 });

      return extractJson(result);
    } catch (e) {
      console.warn('[ReviewerAgent] Analyze single wrong failed:', e.message);
      return {
        knowledgePoint: '未知',
        errorType: 'unknown',
        explanation: '解析服务暂时不可用',
      };
    }
  }

  /**
   * 生成补强计划
   */
  private async generateReinforcementPlan(
    weakPoints: string[],
    wrongQuestions: Array<{ knowledgePoint: string; errorType: string }>,
  ): Promise<{
    skills: Array<{ name: string; priority: number; estimatedMinutes: number }>;
    description: string;
  }> {
    if (weakPoints.length === 0) {
      return { skills: [], description: '没有明显的薄弱知识点' };
    }

    // 根据错误次数分配优先级
    const pointCounts = new Map<string, number>();
    for (const w of wrongQuestions) {
      pointCounts.set(w.knowledgePoint, (pointCounts.get(w.knowledgePoint) || 0) + 1);
    }

    const skills = Array.from(pointCounts.entries())
      .map(([name, count]) => ({
        name,
        priority: Math.min(10, count * 3),
        estimatedMinutes: 60 + count * 30,
      }))
      .sort((a, b) => b.priority - a.priority);

    const description = `建议重点学习以下 ${skills.length} 个知识点：${skills.map((s) => s.name).join('、')}`;

    return { skills, description };
  }
}

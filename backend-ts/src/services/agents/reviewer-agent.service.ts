import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm.service';
import { extractJson } from '../../common/json-repair';

/**
 * 质量审查 Agent
 *
 * 功能：
 * 1. 审查生成的讲义/题目质量
 * 2. 交叉验证答案正确性
 * 3. 错题分析 + 生成补强计划
 *
 * 场景：
 * - 内容生成后自动审查
 * - 考试后分析错题
 * - 题目质量监控
 */

// ── 审查结果 ──────────────────────────────────

export interface ReviewResult {
  passed: boolean;
  score: number;              // 0-100，质量分
  issues: ReviewIssue[];      // 发现的问题
  suggestions: string[];      // 改进建议
  confidence: number;         // 审查置信度
}

export interface ReviewIssue {
  type: 'format' | 'accuracy' | 'safety' | 'duplicate' | 'quality';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  location?: string;          // 问题位置（如"第3题"、"代码示例2"）
  suggestion: string;         // 修复建议
}

// ── 答案验证 ──────────────────────────────────

export interface AnswerVerification {
  questionIndex: number;
  originalAnswer: string;
  verifiedAnswer: string;
  isCorrect: boolean;
  confidence: number;
  explanation: string;        // 验证说明
}

// ── 错题分析 ──────────────────────────────────

export interface ErrorAnalysis {
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;           // 正确率
  weakPoints: WeakPoint[];    // 薄弱知识点
  errorPatterns: ErrorPattern[];  // 错误模式
  reinforcementPlan: ReinforcementPlan;  // 补强计划
}

export interface WeakPoint {
  skill: string;
  errorCount: number;
  errorRate: number;
  description: string;
}

export interface ErrorPattern {
  pattern: string;            // 错误模式描述
  frequency: number;          // 出现次数
  suggestion: string;         // 纠正建议
}

export interface ReinforcementPlan {
  estimatedDays: number;
  tasks: ReinforcementTask[];
  resources: string[];        // 推荐资源类型
}

export interface ReinforcementTask {
  skill: string;
  taskType: 'review' | 'practice' | 'coding';
  description: string;
  estimatedMinutes: number;
}

@Injectable()
export class ReviewerAgentService {
  constructor(private llmService: LlmService) {}

  /**
   * 审查内容质量
   * @param contentType 内容类型：lecture/quiz/coding
   * @param content 内容（JSON 字符串或 Markdown）
   * @param context 上下文信息（如技能名称、难度等）
   */
  async reviewContent(
    contentType: 'lecture' | 'quiz' | 'coding',
    content: string,
    context?: { skillName?: string; difficulty?: string },
  ): Promise<ReviewResult> {
    const messages = this.buildReviewPrompt(contentType, content, context);
    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.3,
      maxTokens: 3072,
      tier: 'pro',
    });

    return this.parseReviewResult(raw);
  }

  /**
   * 交叉验证题目答案
   * @param questions 题目列表
   * @param skillName 技能名称
   */
  async verifyAnswers(
    questions: Array<{ question: string; options?: string[]; answer: string; type: string }>,
    skillName: string,
  ): Promise<AnswerVerification[]> {
    const messages = this.buildVerifyPrompt(questions, skillName);
    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.2,
      maxTokens: 4096,
      tier: 'pro',
    });

    return this.parseVerifications(raw, questions.length);
  }

  /**
   * 分析错题并生成补强计划
   * @param wrongQuestions 错题列表
   * @param skillName 技能名称
   * @param currentLevel 当前水平
   */
  async analyzeErrors(
    wrongQuestions: Array<{
      question: string;
      userAnswer: string;
      correctAnswer: string;
      type: string;
    }>,
    skillName: string,
    currentLevel: string = 'beginner',
  ): Promise<ErrorAnalysis> {
    const messages = this.buildErrorAnalysisPrompt(wrongQuestions, skillName, currentLevel);
    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.4,
      maxTokens: 4096,
      tier: 'pro',
    });

    return this.parseErrorAnalysis(raw, wrongQuestions.length);
  }

  // ── 审查 Prompt ──────────────────────────────────

  private buildReviewPrompt(
    contentType: string,
    content: string,
    context?: any,
  ): { role: string; content: string }[] {
    const typeDescriptions = {
      lecture: '讲义',
      quiz: '练习题',
      coding: '编程题',
    };

    return [
      {
        role: 'system',
        content: `你是内容质量审查专家，负责审查 ${typeDescriptions[contentType] || contentType} 的质量。

审查维度（5个）：
1. 格式合规：JSON 结构是否正确，字段是否完整
2. 内容准确：技术内容是否正确，有无明显错误
3. 安全性：是否包含有害、不当、或敏感内容
4. 重复检测：内容是否有明显重复
5. 质量评估：内容是否有价值，难度是否合适

输出严格 JSON：
{
  "passed": true,
  "score": 85,
  "issues": [
    {
      "type": "accuracy",
      "severity": "warning",
      "description": "第2题答案可能有误",
      "location": "第2题",
      "suggestion": "建议验证 React useEffect 的依赖数组行为"
    }
  ],
  "suggestions": ["建议增加更多示例", ...],
  "confidence": 0.9
}

severity 说明：
- critical：必须修复（如答案错误、格式严重损坏）
- warning：建议修复（如表述不清、缺少解释）
- info：可选优化（如可以增加更多示例）

只输出 JSON，不要其他文字。`,
      },
      {
        role: 'user',
        content: `请审查以下${typeDescriptions[contentType] || contentType}：
${context?.skillName ? `\n技能名称：${context.skillName}` : ''}
${context?.difficulty ? `\n难度：${context.difficulty}` : ''}

--- 内容 ---
${content.substring(0, 6000)}
--- 结束 ---`,
      },
    ];
  }

  // ── 验证 Prompt ──────────────────────────────────

  private buildVerifyPrompt(
    questions: Array<{ question: string; options?: string[]; answer: string; type: string }>,
    skillName: string,
  ): { role: string; content: string }[] {
    const questionsText = questions
      .map((q, i) => {
        let text = `${i + 1}. [${q.type}] ${q.question}`;
        if (q.options) text += `\n   选项：${q.options.join(' | ')}`;
        text += `\n   给定答案：${q.answer}`;
        return text;
      })
      .join('\n\n');

    return [
      {
        role: 'system',
        content: `你是答案验证专家，负责交叉验证题目的答案是否正确。

任务：逐题验证答案，判断是否正确。

输出严格 JSON 数组：
[
  {
    "questionIndex": 0,
    "originalAnswer": "B",
    "verifiedAnswer": "B",
    "isCorrect": true,
    "confidence": 0.95,
    "explanation": "答案正确，React useEffect 在依赖数组为空时只在挂载时执行一次"
  },
  {
    "questionIndex": 1,
    "originalAnswer": "A",
    "verifiedAnswer": "C",
    "isCorrect": false,
    "confidence": 0.8,
    "explanation": "答案有误，正确答案应该是 C，因为..."
  }
]

注意事项：
- 如果题目或选项描述不清导致无法确定，标记 isCorrect: false 并说明原因
- confidence 反映你对验证结果的把握程度
- 只输出 JSON 数组，不要其他文字`,
      },
      {
        role: 'user',
        content: `请验证以下「${skillName}」题目的答案：

${questionsText}`,
      },
    ];
  }

  // ── 错题分析 Prompt ──────────────────────────────────

  private buildErrorAnalysisPrompt(
    wrongQuestions: Array<{ question: string; userAnswer: string; correctAnswer: string; type: string }>,
    skillName: string,
    currentLevel: string,
  ): { role: string; content: string }[] {
    const errorsText = wrongQuestions
      .map((q, i) => `${i + 1}. [${q.type}] ${q.question}\n   用户答案：${q.userAnswer}\n   正确答案：${q.correctAnswer}`)
      .join('\n\n');

    return [
      {
        role: 'system',
        content: `你是学习诊断专家，负责分析学生错题并生成补强计划。

任务：
1. 分析错题，找出薄弱知识点
2. 识别错误模式（如"概念不清"、"粗心"、"知识盲区"）
3. 生成针对性补强计划

输出严格 JSON：
{
  "totalQuestions": 10,
  "correctCount": 7,
  "wrongCount": 3,
  "accuracy": 0.7,
  "weakPoints": [
    {
      "skill": "useEffect 依赖数组",
      "errorCount": 2,
      "errorRate": 0.67,
      "description": "对 useEffect 的依赖数组机制理解不清"
    }
  ],
  "errorPatterns": [
    {
      "pattern": "混淆 useEffect 的执行时机",
      "frequency": 2,
      "suggestion": "重点复习 useEffect 的依赖数组和清理函数"
    }
  ],
  "reinforcementPlan": {
    "estimatedDays": 2,
    "tasks": [
      {
        "skill": "useEffect 依赖数组",
        "taskType": "review",
        "description": "重新阅读 useEffect 依赖数组相关讲义",
        "estimatedMinutes": 30
      },
      {
        "skill": "useEffect 依赖数组",
        "taskType": "practice",
        "description": "完成 5 道 useEffect 相关练习题",
        "estimatedMinutes": 45
      }
    ],
    "resources": ["讲义", "练习题", "编程题"]
  }
}

只输出 JSON，不要其他文字。`,
      },
      {
        role: 'user',
        content: `请分析以下「${skillName}」的错题（当前水平：${currentLevel}）：

${errorsText}`,
      },
    ];
  }

  // ── 解析函数 ──────────────────────────────────

  private parseReviewResult(raw: string): ReviewResult {
    try {
      const data = extractJson(raw);
      return {
        passed: Boolean(data.passed),
        score: Math.min(100, Math.max(0, Number(data.score) || 0)),
        issues: Array.isArray(data.issues)
          ? data.issues.slice(0, 10).map((i: any) => ({
              type: ['format', 'accuracy', 'safety', 'duplicate', 'quality'].includes(i.type) ? i.type : 'quality',
              severity: ['critical', 'warning', 'info'].includes(i.severity) ? i.severity : 'warning',
              description: String(i.description || '').substring(0, 200),
              location: i.location ? String(i.location).substring(0, 50) : undefined,
              suggestion: String(i.suggestion || '').substring(0, 200),
            }))
          : [],
        suggestions: Array.isArray(data.suggestions)
          ? data.suggestions.slice(0, 5).map((s: any) => String(s).substring(0, 200))
          : [],
        confidence: Math.min(1, Math.max(0, Number(data.confidence) || 0.5)),
      };
    } catch (e) {
      console.error('[ReviewerAgent] JSON parse failed:', e.message);
      return {
        passed: false,
        score: 0,
        issues: [{ type: 'format', severity: 'critical', description: '审查结果解析失败', suggestion: '请重试' }],
        suggestions: [],
        confidence: 0,
      };
    }
  }

  private parseVerifications(raw: string, expectedCount: number): AnswerVerification[] {
    try {
      const data = extractJson(raw);
      if (!Array.isArray(data)) return [];
      return data.slice(0, expectedCount).map((v: any, i: number) => ({
        questionIndex: Number(v.questionIndex) ?? i,
        originalAnswer: String(v.originalAnswer || ''),
        verifiedAnswer: String(v.verifiedAnswer || ''),
        isCorrect: Boolean(v.isCorrect),
        confidence: Math.min(1, Math.max(0, Number(v.confidence) || 0.5)),
        explanation: String(v.explanation || '').substring(0, 300),
      }));
    } catch (e) {
      console.error('[ReviewerAgent] JSON parse failed:', e.message);
      return [];
    }
  }

  private parseErrorAnalysis(raw: string, totalWrong: number): ErrorAnalysis {
    try {
      const data = extractJson(raw);
      return {
        totalQuestions: Number(data.totalQuestions) || 0,
        correctCount: Number(data.correctCount) || 0,
        wrongCount: Number(data.wrongCount) || totalWrong,
        accuracy: Number(data.accuracy) || 0,
        weakPoints: Array.isArray(data.weakPoints)
          ? data.weakPoints.slice(0, 5).map((w: any) => ({
              skill: String(w.skill || '').substring(0, 50),
              errorCount: Number(w.errorCount) || 0,
              errorRate: Number(w.errorRate) || 0,
              description: String(w.description || '').substring(0, 200),
            }))
          : [],
        errorPatterns: Array.isArray(data.errorPatterns)
          ? data.errorPatterns.slice(0, 5).map((p: any) => ({
              pattern: String(p.pattern || '').substring(0, 200),
              frequency: Number(p.frequency) || 0,
              suggestion: String(p.suggestion || '').substring(0, 200),
            }))
          : [],
        reinforcementPlan: this.parseReinforcementPlan(data.reinforcementPlan),
      };
    } catch (e) {
      console.error('[ReviewerAgent] JSON parse failed:', e.message);
      return {
        totalQuestions: 0,
        correctCount: 0,
        wrongCount: totalWrong,
        accuracy: 0,
        weakPoints: [],
        errorPatterns: [],
        reinforcementPlan: { estimatedDays: 1, tasks: [], resources: [] },
      };
    }
  }

  private parseReinforcementPlan(plan: any): ReinforcementPlan {
    if (!plan) return { estimatedDays: 1, tasks: [], resources: [] };
    return {
      estimatedDays: Number(plan.estimatedDays) || 1,
      tasks: Array.isArray(plan.tasks)
        ? plan.tasks.slice(0, 10).map((t: any) => ({
            skill: String(t.skill || '').substring(0, 50),
            taskType: ['review', 'practice', 'coding'].includes(t.taskType) ? t.taskType : 'review',
            description: String(t.description || '').substring(0, 200),
            estimatedMinutes: Number(t.estimatedMinutes) || 30,
          }))
        : [],
      resources: Array.isArray(plan.resources)
        ? plan.resources.slice(0, 5).map((r: any) => String(r))
        : [],
    };
  }
}

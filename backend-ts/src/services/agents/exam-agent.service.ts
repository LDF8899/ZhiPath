import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LlmService } from '../llm.service';
import { extractJson } from '../../common/json-repair';
import { ReviewerAgentService } from './reviewer-agent.service';
import { ExamQuestion as ExamQuestionEntity } from '../../entities/exam.entity';

/**
 * 考试出题 Agent
 *
 * 功能：
 * 1. 生成高质量考试题目
 * 2. 支持多种题型（选择、填空、编程）
 * 3. 答案交叉验证
 * 4. 难度自适应
 *
 * 场景：阶段考试、岗位考试、5分钟速测
 */

// ── 题目类型 ──────────────────────────────────

export interface ExamQuestion {
  index: number;
  type: 'choice' | 'fill' | 'coding';
  difficulty: 'basic' | 'intermediate' | 'advanced';
  question: string;
  options?: string[];          // 选择题选项
  answer: string;              // 正确答案
  explanation: string;         // 解析
  points: number;              // 分值
  timeLimit: number;           // 时间限制（秒）
  knowledgePoint: string;      // 考察的知识点
  confidence: number;          // 置信度
}

// ── 考试配置 ──────────────────────────────────

export interface ExamConfig {
  skillName: string;
  difficulty: 'basic' | 'intermediate' | 'advanced' | 'mixed';
  questionCount: number;
  questionTypes: Array<'choice' | 'fill' | 'coding'>;
  timeLimit?: number;          // 总时间限制（分钟）
  focusPoints?: string[];      // 重点考察的知识点
}

// ── 考试输出 ──────────────────────────────────

export interface ExamData {
  skillName: string;
  difficulty: string;
  totalQuestions: number;
  totalTimeLimit: number;      // 总时间限制（秒）
  passingScore: number;        // 及格分
  questions: ExamQuestion[];
  metadata: {
    generatedAt: string;
    knowledgePoints: string[];  // 覆盖的知识点
    difficultyDistribution: {
      basic: number;
      intermediate: number;
      advanced: number;
    };
  };
}

// ── 速测配置 ──────────────────────────────────

export interface QuickTestConfig {
  direction: string;           // 学习方向（如"前端开发"）
  questionCount: number;       // 题目数量（默认5）
}

@Injectable()
export class ExamAgentService {
  constructor(
    private llmService: LlmService,
    private reviewerAgent: ReviewerAgentService,
    @InjectRepository(ExamQuestionEntity) private questionRepo: Repository<ExamQuestionEntity>,
  ) {}

  /**
   * 生成考试题目
   * @param config 考试配置
   */
  async generateExam(config: ExamConfig): Promise<ExamData> {
    const messages = this.buildExamPrompt(config);
    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.5,
      maxTokens: 8192,
      tier: 'pro',
    });

    const result = this.parseExam(raw, config);
    // 异步入库（不阻塞返回）
    this.saveToBank(result.questions, config).catch(e =>
      console.warn('[ExamAgent] auto-save to bank failed:', e.message)
    );
    return result;
  }

  /**
   * 生成 5 分钟速测题
   * @param config 速测配置
   */
  async generateQuickTest(config: QuickTestConfig): Promise<ExamData> {
    return this.generateExam({
      skillName: config.direction,
      difficulty: 'basic',
      questionCount: config.questionCount || 5,
      questionTypes: ['choice'],
      timeLimit: 5,
    });
  }

  /**
   * 生成阶段考试
   * @param skillName 技能名称
   * @param difficulty 难度
   * @param knowledgePoints 考察的知识点
   */
  async generateStageExam(
    skillName: string,
    difficulty: 'basic' | 'intermediate' | 'advanced',
    knowledgePoints?: string[],
  ): Promise<ExamData> {
    return this.generateExam({
      skillName,
      difficulty,
      questionCount: 20,
      questionTypes: ['choice', 'fill', 'coding'],
      timeLimit: 60,
      focusPoints: knowledgePoints,
    });
  }

  /**
   * 生成岗位考试
   * @param jobTitle 岗位名称
   * @param requiredSkills 必须技能
   * @param difficulty 难度
   */
  async generateJobExam(
    jobTitle: string,
    requiredSkills: string[],
    difficulty: 'intermediate' | 'advanced' = 'intermediate',
  ): Promise<ExamData> {
    const messages = this.buildJobExamPrompt(jobTitle, requiredSkills, difficulty);
    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.5,
      maxTokens: 8192,
      tier: 'pro',
    });

    return this.parseExam(raw, {
      skillName: jobTitle,
      difficulty,
      questionCount: 30,
      questionTypes: ['choice', 'fill', 'coding'],
      timeLimit: 90,
    });
  }

  // ── 考试 Prompt ──────────────────────────────────

  private buildExamPrompt(config: ExamConfig): { role: string; content: string }[] {
    const typeDescriptions = {
      choice: '选择题（4个选项，1个正确答案）',
      fill: '填空题（填写关键代码或概念）',
      coding: '编程题（编写完整代码）',
    };

    const typeRequirements = config.questionTypes
      .map(t => `- ${t}: ${typeDescriptions[t]}`)
      .join('\n');

    return [
      {
        role: 'system',
        content: `你是出题专家，为「${config.skillName}」生成高质量考试题目。

考试配置：
- 技能：${config.skillName}
- 难度：${config.difficulty}
- 题目数量：${config.questionCount} 道
- 题型：${config.questionTypes.join('、')}
${config.focusPoints?.length ? `- 重点知识点：${config.focusPoints.join('、')}` : ''}

题型要求：
${typeRequirements}

每道题必须包含：
- type：题型
- difficulty：难度（basic/intermediate/advanced）
- question：题目描述（清晰明确，无歧义）
- options：选项（仅选择题，4个选项）
- answer：正确答案
- explanation：解析（说明为什么选这个答案）
- points：分值（选择题5分，填空题10分，编程题20分）
- timeLimit：时间限制（秒）（选择题60，填空题90，编程题900）
- knowledgePoint：考察的知识点
- confidence：置信度（0-1）

质量要求：
1. 题目必须有唯一正确答案
2. 选择题干扰选项要有区分度
3. 编程题必须有测试用例
4. 解析要详细说明原理
5. 覆盖不同知识点，避免重复

输出严格 JSON：
{
  "questions": [
    {
      "type": "choice",
      "difficulty": "intermediate",
      "question": "以下关于 React Hooks 的说法，正确的是？",
      "options": ["A. Hooks 可以在条件语句中使用", "B. Hooks 只能在函数组件中使用", "C. 自定义 Hook 必须以 use 开头", "D. useEffect 会在每次渲染后执行"],
      "answer": "B",
      "explanation": "React Hooks 只能在函数组件中使用，不能在类组件中使用。A 错误因为 Hooks 不能在条件语句中使用；C 错误是因为自定义 Hook 建议以 use 开头但不是必须；D 错误是因为 useEffect 可以通过依赖数组控制执行时机。",
      "points": 5,
      "timeLimit": 60,
      "knowledgePoint": "React Hooks 基础",
      "confidence": 0.95
    }
  ]
}

只输出 JSON，不要其他文字。`,
      },
      {
        role: 'user',
        content: `请为「${config.skillName}」生成 ${config.questionCount} 道考试题目。`,
      },
    ];
  }

  // ── 岗位考试 Prompt ──────────────────────────────────

  private buildJobExamPrompt(
    jobTitle: string,
    requiredSkills: string[],
    difficulty: string,
  ): { role: string; content: string }[] {
    return [
      {
        role: 'system',
        content: `你是出题专家，为「${jobTitle}」岗位生成综合考试题目。

岗位必须技能：${requiredSkills.join('、')}
难度：${difficulty}

要求：
1. 题目覆盖所有必须技能
2. 每个技能至少 2 道题
3. 包含综合题（跨技能）
4. 难度分布：基础40%、进阶40%、高级20%

题型分布：
- 选择题：60%（快速考察知识点）
- 填空题：20%（考察关键代码记忆）
- 编程题：20%（考察实际编码能力）

输出格式同上。`,
      },
      {
        role: 'user',
        content: `请为「${jobTitle}」岗位生成考试题目，覆盖以下技能：${requiredSkills.join('、')}`,
      },
    ];
  }

  // ── 解析函数 ──────────────────────────────────

  private parseExam(raw: string, config: ExamConfig): ExamData {
    try {
      const data = extractJson(raw);
      const questions: ExamQuestion[] = Array.isArray(data.questions)
        ? data.questions.slice(0, config.questionCount).map((q: any, i: number) => ({
            index: i + 1,
            type: ['choice', 'fill', 'coding'].includes(q.type) ? q.type : 'choice',
            difficulty: ['basic', 'intermediate', 'advanced'].includes(q.difficulty) ? q.difficulty : 'intermediate',
            question: String(q.question || '').substring(0, 1000),
            options: Array.isArray(q.options) ? q.options.slice(0, 6).map((o: any) => String(o).substring(0, 200)) : undefined,
            answer: String(q.answer || '').substring(0, 500),
            explanation: String(q.explanation || '').substring(0, 1000),
            points: Number(q.points) || 5,
            timeLimit: Number(q.timeLimit) || 60,
            knowledgePoint: String(q.knowledgePoint || '').substring(0, 100),
            confidence: Math.min(1, Math.max(0, Number(q.confidence) || 0.7)),
          }))
        : [];

      // 计算难度分布
      const difficultyDistribution = {
        basic: questions.filter(q => q.difficulty === 'basic').length,
        intermediate: questions.filter(q => q.difficulty === 'intermediate').length,
        advanced: questions.filter(q => q.difficulty === 'advanced').length,
      };

      // 提取覆盖的知识点
      const knowledgePoints = [...new Set(questions.map(q => q.knowledgePoint).filter(Boolean))];

      return {
        skillName: config.skillName,
        difficulty: config.difficulty,
        totalQuestions: questions.length,
        totalTimeLimit: questions.reduce((sum, q) => sum + q.timeLimit, 0),
        passingScore: 60,
        questions,
        metadata: {
          generatedAt: new Date().toISOString(),
          knowledgePoints,
          difficultyDistribution,
        },
      };
    } catch (e) {
      console.error('[ExamAgent] JSON parse failed:', e.message);
      return {
        skillName: config.skillName,
        difficulty: config.difficulty,
        totalQuestions: 0,
        totalTimeLimit: 0,
        passingScore: 60,
        questions: [],
        metadata: {
          generatedAt: new Date().toISOString(),
          knowledgePoints: [],
          difficultyDistribution: { basic: 0, intermediate: 0, advanced: 0 },
        },
      };
    }
  }

  /** 将生成的题目批量写入题库 */
  async saveToBank(questions: ExamQuestion[], config: ExamConfig): Promise<number> {
    let saved = 0;
    for (const q of questions) {
      try {
        const difficultyMap: Record<string, number> = { basic: 1, intermediate: 3, advanced: 5 };
        await this.questionRepo.save({
          examType: 1, // 通用技能
          skillName: config.skillName,
          questionType: q.type,
          title: q.question,
          content: { options: q.options },
          answer: { value: q.answer, explanation: q.explanation },
          difficulty: difficultyMap[q.difficulty] || 3,
          confidenceScore: q.confidence,
          status: 1, // 已上架
          createdBy: 'agent',
          createTime: Date.now(),
          updateTime: Date.now(),
        });
        saved++;
      } catch (e) {
        console.warn(`[ExamAgent] saveToBank failed for question ${q.index}:`, e.message);
      }
    }
    return saved;
  }

  /** 出题质量管线：生成→验证→入库 */
  async qualityPipeline(config: ExamConfig): Promise<ExamData & { warnings?: string[] }> {
    const warnings: string[] = [];

    // Step 1: 生成
    const exam = await this.generateExam(config);

    // Step 2: 答案交叉验证（异步，不阻塞）
    try {
      const verifyResult = await this.reviewerAgent.verifyAnswers(
        exam.questions.map(q => ({
          question: q.question,
          answer: q.answer,
          type: q.type,
        })),
        config.skillName,
      );
      // 从验证结果中提取低置信度或错误答案的警告
      if (Array.isArray(verifyResult)) {
        for (const v of verifyResult) {
          if (!v.isCorrect) {
            warnings.push(`第${v.questionIndex}题答案可能有误：${v.explanation}`);
          } else if (v.confidence < 0.6) {
            warnings.push(`第${v.questionIndex}题答案置信度偏低(${v.confidence})`);
          }
        }
      }
    } catch (e) {
      console.warn('[ExamAgent] verifyAnswers failed:', e.message);
      warnings.push('答案验证未完成');
    }

    // Step 3: 入库
    try {
      const saved = await this.saveToBank(exam.questions, config);
      console.log(`[ExamAgent] ${saved}/${exam.questions.length} questions saved to bank`);
    } catch (e) {
      console.warn('[ExamAgent] saveToBank failed:', e.message);
      warnings.push('题目入库失败');
    }

    return { ...exam, warnings };
  }

  /** 题库统计 */
  async getQuestionBankStats(skillName?: string) {
    const where: any = { status: 1 };
    if (skillName) where.skillName = skillName;

    const questions = await this.questionRepo.find({ where });

    const byType: Record<string, number> = {};
    const byDifficulty: Record<string, number> = {};
    let totalConfidence = 0;
    let totalPassRate = 0;
    let countWithPassRate = 0;

    for (const q of questions) {
      byType[q.questionType] = (byType[q.questionType] || 0) + 1;
      const diffKey = String(q.difficulty);
      byDifficulty[diffKey] = (byDifficulty[diffKey] || 0) + 1;
      totalConfidence += Number(q.confidenceScore) || 0;
      if (q.passRate !== null && q.passRate !== undefined) {
        totalPassRate += Number(q.passRate);
        countWithPassRate++;
      }
    }

    return {
      total: questions.length,
      byType,
      byDifficulty,
      avgConfidence: questions.length > 0 ? +(totalConfidence / questions.length).toFixed(2) : 0,
      avgPassRate: countWithPassRate > 0 ? +(totalPassRate / countWithPassRate).toFixed(1) : null,
    };
  }
}

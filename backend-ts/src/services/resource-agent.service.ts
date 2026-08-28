import { Injectable } from '@nestjs/common';
import { LlmService } from './llm.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { extractJson } from '../common/json-repair';

export interface LearningResourceContext {
  domainId?: string;
  domainName?: string;
  goalType?: string;
  goalTitle?: string;
  terminology?: Record<string, string>;
  assessmentModes?: string[];
  evidenceTypes?: string[];
}

/** Generate learning resources using the path's domain vocabulary and evidence model. */
@Injectable()
export class ResourceAgentService {
  constructor(
    private llmService: LlmService,
    private knowledgeBase: KnowledgeBaseService,
  ) {}

  async generateLecture(
    ability: string,
    difficulty = 'beginner',
    context: LearningResourceContext = {},
  ): Promise<string | null> {
    const domainContext = this.buildDomainContext(context);
    const exampleRequirement = context.domainId === 'software-engineering'
      ? '包含一个完整、可运行并有解释的代码或工程示例'
      : '包含该领域常见的例题、案例、语料或实践示例，不要强行使用代码';
    const prompt = `请为能力项「${ability}」生成一份结构化学习讲义。

难度：${difficulty}
${domainContext}
要求：
1. 使用 Markdown
2. 包含学习目标、核心知识、示例或案例、实践任务、常见误区、复盘问题
3. 内容具体可执行，不要泛泛而谈
4. ${exampleRequirement}
5. 适合 ${difficulty} 水平的学习者
6. 实践任务应产生一种可记录的学习证据

输出结构：
# ${ability}
## 学习目标
## 核心知识
## 示例或案例
## 实践任务
## 常见误区
## 复盘问题`;

    try {
      const result = await this.llmService.chatCompletion(
        [
          {
            role: 'system',
            content: '你是跨学科教育内容设计师，能根据专业领域选择正确的术语、例子和练习方式。直接输出 Markdown，不要添加额外说明。',
          },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.5, maxTokens: 4096, tier: 'pro' },
      );
      await this.knowledgeBase.saveLecture(ability, result, difficulty);
      console.log(`[ResourceAgent] Lecture generated: ${ability}`);
      return result;
    } catch (error: any) {
      console.error(`[ResourceAgent] Lecture generation failed for ${ability}:`, error.message);
      return null;
    }
  }

  async generateQuiz(
    ability: string,
    count = 5,
    difficulty = 'beginner',
    context: LearningResourceContext = {},
  ): Promise<any[] | null> {
    const domainContext = this.buildDomainContext(context);
    const prompt = `请为能力项「${ability}」生成 ${count} 道有诊断价值的选择题。

难度：${difficulty}
${domainContext}
输出严格 JSON 数组：
[
  {
    "question": "题目描述",
    "options": ["选项A", "选项B", "选项C", "选项D"],
    "answer": 0,
    "explanation": "解析说明"
  }
]

要求：
1. 覆盖该能力项的核心知识
2. 干扰项应反映真实常见误区
3. 解析要说明判断依据和思考过程
4. 场景和解析必须符合该专业领域，不要默认使用编程语境
5. 只输出 JSON 数组`;

    try {
      const result = await this.llmService.chatCompletion(
        [
          {
            role: 'system',
            content: '你是跨学科评价设计师，擅长根据领域目标设计有诊断价值的练习。只输出 JSON 数组。',
          },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.5, maxTokens: 2048, tier: 'pro' },
      );
      const questions = this.extractJsonFromLLM(result);
      if (Array.isArray(questions)) {
        await this.knowledgeBase.saveQuiz(ability, questions, difficulty);
        console.log(`[ResourceAgent] Quiz generated: ${ability} (${questions.length} questions)`);
        return questions;
      }
    } catch (error: any) {
      console.error(`[ResourceAgent] Quiz generation failed for ${ability}:`, error.message);
    }
    return null;
  }

  /** Explicit coding resources remain available, but are never implied by a non-software path. */
  async generateCodingProblems(skill: string, count = 2, difficulty = 'beginner'): Promise<any[] | null> {
    const prompt = `请为技能「${skill}」生成 ${count} 道编程练习题。

难度：${difficulty}

输出严格JSON数组格式：
[
  {
    "title": "题目标题",
    "description": "题目描述（Markdown格式）",
    "template": "代码模板（函数签名+注释）",
    "test_cases": [{"input": "输入描述", "expected": "预期输出"}],
    "hint": "解题提示",
    "solution": "参考答案"
  }
]

要求：
1. 题目实际可编码，不是纯理论
2. 代码模板提供函数签名
3. 测试用例覆盖正常和边界情况
4. 只输出JSON数组`;

    try {
      const result = await this.llmService.chatCompletion(
        [
          { role: 'system', content: '你是编程题设计专家，擅长设计有教学价值的编程练习。只输出 JSON 数组。' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.5, maxTokens: 3072, tier: 'pro' },
      );
      const problems = this.extractJsonFromLLM(result);
      if (Array.isArray(problems)) {
        await this.knowledgeBase.saveCoding(skill, problems, difficulty);
        console.log(`[ResourceAgent] Coding problems generated: ${skill} (${problems.length})`);
        return problems;
      }
    } catch (error: any) {
      console.error(`[ResourceAgent] Coding generation failed for ${skill}:`, error.message);
    }
    return null;
  }

  async generateResourcesForPath(
    pathData: Record<string, any>,
  ): Promise<{ generated: number; skipped: number; failed: number }> {
    const phases = pathData.phases || [];
    const stats = { generated: 0, skipped: 0, failed: 0 };
    const context = this.contextFromPathData(pathData);

    for (const phase of phases) {
      const difficulty = this.phaseToDifficulty(phase, phases);
      for (const abilityItem of phase.skills || []) {
        const abilityName = typeof abilityItem === 'string' ? abilityItem : abilityItem.name || '';
        if (!abilityName) continue;
        const existing = await this.knowledgeBase.getContent(abilityName, 'lecture');
        if (existing) {
          stats.skipped++;
          continue;
        }
        try {
          await this.generateLecture(abilityName, difficulty, context);
          await this.generateQuiz(abilityName, 5, difficulty, context);
          stats.generated++;
        } catch (error: any) {
          console.error(`[ResourceAgent] Resource generation failed for ${abilityName}:`, error.message);
          stats.failed++;
        }
      }
    }
    console.log('[ResourceAgent] Resource generation done:', stats);
    return stats;
  }

  contextFromPathData(pathData: Record<string, any>): LearningResourceContext {
    return {
      domainId: pathData?.domainId,
      domainName: pathData?.domainName,
      goalType: pathData?.goalType,
      goalTitle: pathData?.goalTitle,
      terminology: pathData?.terminology,
      assessmentModes: pathData?.assessmentModes,
      evidenceTypes: pathData?.evidenceTypes,
    };
  }

  private buildDomainContext(context: LearningResourceContext): string {
    const lines: string[] = [];
    if (context.domainName || context.domainId) lines.push(`学习领域：${context.domainName || context.domainId}`);
    if (context.goalTitle || context.goalType) lines.push(`学习目标：${context.goalTitle || context.goalType}`);
    if (context.assessmentModes?.length) lines.push(`适用评价方式：${context.assessmentModes.join('、')}`);
    if (context.evidenceTypes?.length) lines.push(`可沉淀证据：${context.evidenceTypes.join('、')}`);
    return lines.length ? `\n领域上下文：\n${lines.join('\n')}\n` : '';
  }

  private extractJsonFromLLM(text: string): any | null {
    try {
      return extractJson(text);
    } catch (error: any) {
      console.error('[ResourceAgent] JSON parse failed:', error.message);
      return null;
    }
  }

  private phaseToDifficulty(phase: any, allPhases: any[]): string {
    const index = allPhases.indexOf(phase);
    const total = allPhases.length;
    if (total <= 1) return 'beginner';
    const ratio = index / (total - 1);
    if (ratio < 0.33) return 'beginner';
    if (ratio < 0.66) return 'intermediate';
    return 'advanced';
  }
}

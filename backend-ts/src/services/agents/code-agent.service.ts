import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm.service';
import { extractJson } from '../../common/json-repair';

/**
 * 代码案例生成 Agent
 *
 * 功能：为技能生成可运行的代码案例
 * 输出：结构化 JSON（代码、注释、运行结果、要点等）
 */

export interface CodeExample {
  title: string;
  description: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  language: string;
  setup: string;
  task: string;
  hint: string;
  solution: string;
  solutionExplanation: string[];
  expectedOutput: string;
  commonMistakes: string[];
  keyPoints: string[];
  relatedConcepts: string[];
}

export interface CodeData {
  skill: string;
  language: string;
  totalExamples: number;
  examples: CodeExample[];
  bestPractices: string[];
  commonMistakes: string[];
}

@Injectable()
export class CodeAgentService {
  constructor(private llmService: LlmService) {}

  /**
   * 生成代码案例
   * @param skillName 技能名称
   * @param language 编程语言
   * @param count 案例数（1-10）
   */
  async generate(
    skillName: string,
    language: string = 'JavaScript',
    count: number = 3,
  ): Promise<CodeData> {
    if (!skillName?.trim()) throw new Error('请提供技能名称');
    if (skillName.length > 50) throw new Error('技能名称太长');
    if (count < 1 || count > 10) count = 3;

    const messages = this.buildPrompt(skillName.trim(), language, count);
    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 6144,
      tier: 'pro',
    });

    return this.parseResponse(raw, skillName.trim(), language, count);
  }

  // ── Prompt 设计 ──────────────────────────────────

  private buildPrompt(skillName: string, language: string, count: number): { role: string; content: string }[] {
    return [
      {
        role: 'system',
        content: `你是编程教练，擅长通过渐进式练习让学生真正掌握代码。为「${skillName}」设计 ${count} 个渐进式代码练习。

## 教学原则
1. **填空式学习**：给学生 80% 的代码，让他们完成关键的 20%。不要给完整代码让学生"看"。
2. **渐进复杂度**：练习 1 照猫画虎 → 练习 2 改变一个条件 → 练习 3 综合运用。
3. **展示错误后果**：每个练习都要说明"如果写错会怎样"。
4. **解释为什么**：solution 部分不是贴答案，而是逐行解释"为什么这样写"。

## 每个练习的结构
- title：标题（15字内）
- description：这个练习要学什么（50-100字）
- difficulty：basic/intermediate/advanced
- language：${language}
- setup：起始代码（完整可运行，包含 TODO 注释标记需要填写的部分，占总代码 80%）
- task：任务描述（明确告诉学生要完成什么，怎么算完成）
- hint：如果卡住了的提示（不要直接给答案）
- solution：完整答案代码（包含 TODO 部分的正确实现）
- solutionExplanation：逐行解释 solution 中的关键部分（3-5 条，每条解释一行代码的意图）
- expectedOutput：运行后的预期输出
- commonMistakes：常见错误（2-3 个，每个包含错误写法和后果）
- keyPoints：要点（2-3 条）
- relatedConcepts：相关概念（2-3 个）

## 渐进要求
- 练习 1（basic）：基础用法，setup 代码最多，task 最简单（改一两行或填一个参数）
- 练习 2（intermediate）：变体应用，减少 setup，增加 task 难度（需要理解原理才能完成）
- 练习 3（advanced）：综合运用，setup 只有框架，task 需要自主实现核心逻辑

另外：bestPractices（3-5条）、commonMistakes（2-3条，总结性）

输出严格JSON：
{"examples":[{"title":"","description":"","difficulty":"basic","language":"","setup":"","task":"","hint":"","solution":"","solutionExplanation":[],"expectedOutput":"","commonMistakes":[],"keyPoints":[],"relatedConcepts":[]}],"bestPractices":[],"commonMistakes":[]}`,
      },
      {
        role: 'user',
        content: `为「${skillName}」生成 ${count} 个 ${language} 代码案例`,
      },
    ];
  }

  // ── 解析输出 ──────────────────────────────────

  private parseResponse(raw: string, skillName: string, language: string, count: number): CodeData {
    try {
      const data = extractJson(raw);
      const examples: CodeExample[] = Array.isArray(data.examples)
        ? data.examples.slice(0, count).map((item: any) => ({
            title: String(item.title || '').substring(0, 30),
            description: String(item.description || '').substring(0, 200),
            difficulty: ['basic', 'intermediate', 'advanced'].includes(item.difficulty)
              ? item.difficulty
              : 'intermediate',
            language: String(item.language || language),
            setup: String(item.setup || ''),
            task: String(item.task || ''),
            hint: String(item.hint || ''),
            solution: String(item.solution || ''),
            solutionExplanation: Array.isArray(item.solutionExplanation)
              ? item.solutionExplanation.slice(0, 5).map((e: any) => String(e))
              : [],
            expectedOutput: String(item.expectedOutput || ''),
            commonMistakes: Array.isArray(item.commonMistakes)
              ? item.commonMistakes.slice(0, 3).map((m: any) => String(m))
              : [],
            keyPoints: Array.isArray(item.keyPoints)
              ? item.keyPoints.slice(0, 3).map((p: any) => String(p))
              : [],
            relatedConcepts: Array.isArray(item.relatedConcepts)
              ? item.relatedConcepts.slice(0, 3).map((c: any) => String(c))
              : [],
          }))
        : [];

      return {
        skill: skillName,
        language,
        totalExamples: examples.length,
        examples,
        bestPractices: Array.isArray(data.bestPractices)
          ? data.bestPractices.slice(0, 5).map((p: any) => String(p))
          : [],
        commonMistakes: Array.isArray(data.commonMistakes)
          ? data.commonMistakes.slice(0, 3).map((m: any) => String(m))
          : [],
      };
    } catch (e) {
      console.error('[CodeAgent] JSON parse failed:', e.message);
      return {
        skill: skillName,
        language,
        totalExamples: 0,
        examples: [],
        bestPractices: [],
        commonMistakes: ['生成失败'],
      };
    }
  }
}

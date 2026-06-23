import { Injectable } from '@nestjs/common';
import { LlmService } from './llm.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { extractJson } from '../common/json-repair';

/**
 * 资源生成 Agent — 对齐 Python agents/resource_agent.py
 *
 * 为技能点生成多模态学习资源：讲义（Markdown）+ 选择题 + 编程题
 * 存储位置：MongoDB knowledge_base 集合（全平台复用）
 */
@Injectable()
export class ResourceAgentService {
  constructor(
    private llmService: LlmService,
    private knowledgeBase: KnowledgeBaseService,
  ) {}

  /** 为技能点生成 Markdown 讲义 — 对齐 Python generate_lecture() */
  async generateLecture(skill: string, difficulty = 'beginner'): Promise<string | null> {
    const prompt = `请为技能「${skill}」生成一份结构化的学习讲义。

难度：${difficulty}

要求：
1. 用 Markdown 格式
2. 包含：概念介绍、核心知识点、代码示例、常见误区
3. 内容要具体实用，不要泛泛而谈
4. 代码示例要完整可运行
5. 适合${difficulty}水平的学习者

输出格式：
# ${skill}

## 概念介绍
...

## 核心知识点
### 1. ...
...

## 代码示例
\`\`\`代码
...
\`\`\`

## 常见误区
...

## 小结
...`;

    try {
      const result = await this.llmService.chatCompletion(
        [
          { role: 'system', content: '你是技术教育专家，擅长写清晰易懂的技术讲义。直接输出 Markdown 内容，不要加额外说明。' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.5, maxTokens: 4096, tier: 'pro' },
      );

      await this.knowledgeBase.saveLecture(skill, result, difficulty);
      console.log(`[ResourceAgent] Lecture generated: ${skill}`);
      return result;
    } catch (e) {
      console.error(`[ResourceAgent] Lecture generation failed for ${skill}:`, e.message);
      return null;
    }
  }

  /** 为技能点生成选择题 — 对齐 Python generate_quiz() */
  async generateQuiz(skill: string, count = 5, difficulty = 'beginner'): Promise<any[] | null> {
    const prompt = `请为技能「${skill}」生成 ${count} 道选择题。

难度：${difficulty}

输出严格JSON数组格式：
[
  {
    "question": "题目描述",
    "options": ["选项A", "选项B", "选项C", "选项D"],
    "answer": 0,
    "explanation": "解析说明为什么选这个"
  }
]

要求：
1. 题目要覆盖该技能的核心知识点
2. 选项要有迷惑性，不能太明显
3. 解析要清楚说明原理
4. 只输出JSON数组，不要其他文字`;

    try {
      const result = await this.llmService.chatCompletion(
        [
          { role: 'system', content: '你是出题专家，擅长设计有深度的选择题。只输出 JSON 数组。' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.5, maxTokens: 2048, tier: 'pro' },
      );

      const questions = this.extractJsonFromLLM(result);
      if (questions && Array.isArray(questions)) {
        await this.knowledgeBase.saveQuiz(skill, questions, difficulty);
        console.log(`[ResourceAgent] Quiz generated: ${skill} (${questions.length} questions)`);
        return questions;
      }
    } catch (e) {
      console.error(`[ResourceAgent] Quiz generation failed for ${skill}:`, e.message);
    }
    return null;
  }

  /** 为技能点生成编程题 — 对齐 Python generate_coding_problems() */
  async generateCodingProblems(skill: string, count = 2, difficulty = 'beginner'): Promise<any[] | null> {
    const prompt = `请为技能「${skill}」生成 ${count} 道编程练习题。

难度：${difficulty}

输出严格JSON数组格式：
[
  {
    "title": "题目标题",
    "description": "题目描述（Markdown格式）",
    "template": "代码模板（函数签名+注释）",
    "test_cases": [
      {"input": "输入描述", "expected": "预期输出"}
    ],
    "hint": "解题提示",
    "solution": "参考答案"
  }
]

要求：
1. 题目要实际可编码，不是纯理论
2. 代码模板要给好函数签名
3. 测试用例要覆盖正常和边界情况
4. 只输出JSON数组，不要其他文字`;

    try {
      const result = await this.llmService.chatCompletion(
        [
          { role: 'system', content: '你是编程题设计专家，擅长设计有教学价值的编程练习。只输出 JSON 数组。' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.5, maxTokens: 3072, tier: 'pro' },
      );

      const problems = this.extractJsonFromLLM(result);
      if (problems && Array.isArray(problems)) {
        await this.knowledgeBase.saveCoding(skill, problems, difficulty);
        console.log(`[ResourceAgent] Coding problems generated: ${skill} (${problems.length})`);
        return problems;
      }
    } catch (e) {
      console.error(`[ResourceAgent] Coding generation failed for ${skill}:`, e.message);
    }
    return null;
  }

  /** 为学习路径中的所有技能点生成资源 — 对齐 Python generate_resources_for_path() */
  async generateResourcesForPath(pathData: Record<string, any>): Promise<{ generated: number; skipped: number; failed: number }> {
    const phases = pathData.phases || [];
    const stats = { generated: 0, skipped: 0, failed: 0 };

    for (const phase of phases) {
      const skills = phase.skills || [];
      const difficulty = this.phaseToDifficulty(phase, phases);

      for (const skillItem of skills) {
        const skillName = typeof skillItem === 'string' ? skillItem : skillItem.name || '';
        if (!skillName) continue;

        // 跳过已生成的
        const existing = await this.knowledgeBase.getContent(skillName, 'lecture');
        if (existing) {
          stats.skipped++;
          continue;
        }

        try {
          await this.generateLecture(skillName, difficulty);
          await this.generateQuiz(skillName, 5, difficulty);
          stats.generated++;
        } catch (e) {
          console.error(`[ResourceAgent] Resource generation failed for ${skillName}:`, e.message);
          stats.failed++;
        }
      }
    }

    console.log(`[ResourceAgent] Resource generation done:`, stats);
    return stats;
  }

  // ── 工具函数 ──

  /** 从 LLM 回复中提取 JSON — 使用公共 json-repair 工具 */
  private extractJsonFromLLM(text: string): any | null {
    try {
      return extractJson(text);
    } catch (e) {
      console.error('[ResourceAgent] JSON parse failed:', e.message);
      return null;
    }
  }

  /** 根据阶段推断难度级别 — 对齐 Python _phase_to_difficulty() */
  private phaseToDifficulty(phase: any, allPhases: any[]): string {
    const idx = allPhases.indexOf(phase);
    const total = allPhases.length;
    if (total <= 1) return 'beginner';
    const ratio = idx / (total - 1);
    if (ratio < 0.33) return 'beginner';
    if (ratio < 0.66) return 'intermediate';
    return 'advanced';
  }
}

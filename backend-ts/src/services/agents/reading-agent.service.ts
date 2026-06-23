import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm.service';
import { extractJson } from '../../common/json-repair';

/**
 * 拓展阅读生成 Agent
 *
 * 功能：为技能生成多篇拓展阅读材料
 * 输出：结构化 JSON（标题、摘要、关键概念、难度、来源等）
 */

export interface ReadingItem {
  title: string;
  type: 'why' | 'practice' | 'deep' | 'compare';
  content: string;
  keyConcepts: string[];
  difficulty: 'basic' | 'intermediate' | 'advanced';
  readTime: string;
  relatedTopics: string[];
  questions: string[];
}

export interface ReadingData {
  skill: string;
  totalItems: number;
  items: ReadingItem[];
  studyAdvice: string;
}

@Injectable()
export class ReadingAgentService {
  constructor(private llmService: LlmService) {}

  /**
   * 生成拓展阅读
   * @param skillName 技能名称
   * @param count 篇数（1-10）
   * @param focus 重点方向（可选）
   */
  async generate(skillName: string, count: number = 5, focus?: string): Promise<ReadingData> {
    if (!skillName?.trim()) throw new Error('请提供技能名称');
    if (skillName.length > 50) throw new Error('技能名称太长');
    if (count < 1 || count > 10) count = 5;

    const messages = this.buildPrompt(skillName.trim(), count, focus);
    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 4096,
      tier: 'pro',
    });

    return this.parseResponse(raw, skillName.trim(), count);
  }

  // ── Prompt 设计 ──────────────────────────────────

  private buildPrompt(skillName: string, count: number, focus?: string): { role: string; content: string }[] {
    return [
      {
        role: 'system',
        content: `你是技术写作者，擅长写出让人愿意读下去的深度技术文章。为「${skillName}」写 ${count} 篇深度短文。

## 写作原则
1. **不要写摘要，写文章**。每篇是一篇 800-1200 字的完整短文，有开头、展开、结尾。
2. **开头要抓人**。用一个真实的故事、反直觉的事实、或一个具体的问题开头。不要用"本文将介绍..."。
3. **有观点，有论据**。不要罗列知识点，要有一个明确的观点，然后用代码、数据或案例来支撑。
4. **连接实际工作**。每篇文章都要回答"这在实际工作中有什么用"。
5. **结尾留思考**。用一个开放性问题结尾，让读者带着问题离开。

## 每篇文章的结构
- title：标题（20字内，要有吸引力，可以用问句或悬念）
- type：文章类型（"why"=为什么这样设计 / "practice"=实战案例 / "deep"=深度原理 / "compare"=方案对比）
- content：正文（800-1200 字的 Markdown 格式完整文章，不是摘要）
- keyConcepts：关键概念（3-5 个，每个 5-10 字）
- difficulty：难度（basic/intermediate/advanced）
- readTime：阅读时长
- relatedTopics：相关知识点（2-3 个）
- questions：读后思考题（2-3 个，开放性问题，没有标准答案）

## 内容多样性要求
${count} 篇文章要覆盖不同类型，不要全是同一种类型。建议搭配：
- 至少 1 篇 "why" 类型（解释设计决策或技术选型的原因）
- 至少 1 篇 "practice" 类型（一个完整的实战 walkthrough）
- 其余可以是 "deep" 或 "compare" 类型

另外：studyAdvice 学习建议（100-150 字，针对这个技能的具体学习路径建议，不要泛泛而谈）

输出严格JSON：
{"items":[{"title":"","type":"why","content":"","keyConcepts":[],"difficulty":"basic","readTime":"","relatedTopics":[],"questions":[]}],"studyAdvice":""}`,
      },
      {
        role: 'user',
        content: `生成「${skillName}」${count} 篇阅读${focus ? `\n重点：${focus}` : ''}`,
      },
    ];
  }

  // ── 解析输出 ──────────────────────────────────

  private parseResponse(raw: string, skillName: string, count: number): ReadingData {
    try {
      const data = extractJson(raw);
      const items: ReadingItem[] = Array.isArray(data.items)
        ? data.items.slice(0, count).map((item: any) => ({
            title: String(item.title || '').substring(0, 40),
            type: ['why', 'practice', 'deep', 'compare'].includes(item.type) ? item.type : 'why',
            content: String(item.content || ''),
            keyConcepts: Array.isArray(item.keyConcepts)
              ? item.keyConcepts.slice(0, 5).map((c: any) => String(c).substring(0, 20))
              : [],
            difficulty: ['basic', 'intermediate', 'advanced'].includes(item.difficulty)
              ? item.difficulty
              : 'intermediate',
            readTime: String(item.readTime || '10分钟'),
            relatedTopics: Array.isArray(item.relatedTopics)
              ? item.relatedTopics.slice(0, 3).map((t: any) => String(t))
              : [],
            questions: Array.isArray(item.questions)
              ? item.questions.slice(0, 3).map((q: any) => String(q))
              : [],
          }))
        : [];

      return {
        skill: skillName,
        totalItems: items.length,
        items,
        studyAdvice: String(data.studyAdvice || ''),
      };
    } catch (e) {
      console.error('[ReadingAgent] JSON parse failed:', e.message);
      return { skill: skillName, totalItems: 0, items: [], studyAdvice: '生成失败' };
    }
  }
}

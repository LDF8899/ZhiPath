import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm.service';
import { extractJson } from '../../common/json-repair';

/**
 * 资讯生成 Agent
 *
 * 功能：
 * 1. 生成技术趋势分析
 * 2. 资讯摘要和标签提取
 * 3. 个性化资讯推荐
 *
 * 场景：行业资讯页面、技术趋势周报
 */

// ── 资讯类型 ──────────────────────────────────

export interface NewsArticle {
  title: string;
  summary: string;
  content: string;
  category: 'industry' | 'tech' | 'recruit';
  tags: string[];
  skills: string[];          // 关联的技能标签
  source: string;
  sourceUrl?: string;
  publishedAt: string;
  readTime: number;          // 预估阅读时间（分钟）
  difficulty: 'basic' | 'intermediate' | 'advanced';
}

// ── 趋势分析 ──────────────────────────────────

export interface TechTrend {
  title: string;
  summary: string;
  trends: TrendItem[];
  hotSkills: HotSkill[];
  predictions: string[];
  generatedAt: string;
}

export interface TrendItem {
  name: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  relatedSkills: string[];
  direction: 'rising' | 'stable' | 'declining';
}

export interface HotSkill {
  name: string;
  demandChange: number;      // 需求变化百分比
  averageSalary: string;
  relatedJobs: number;       // 相关岗位数
  learningDifficulty: 'easy' | 'medium' | 'hard';
}

// ── 个性化推荐 ──────────────────────────────────

export interface PersonalizedNews {
  articles: NewsArticle[];
  reason: string;            // 推荐理由
  matchScore: number;        // 与用户技能的匹配度
}

@Injectable()
export class NewsAgentService {
  constructor(private llmService: LlmService) {}

  /**
   * 生成技术趋势分析
   * @param skills 关注的技能领域
   * @param period 时间范围（week/month）
   */
  async generateTrendAnalysis(
    skills: string[],
    period: 'week' | 'month' = 'week',
  ): Promise<TechTrend> {
    const messages = this.buildTrendPrompt(skills, period);
    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.6,
      maxTokens: 4096,
      tier: 'pro',
    });

    return this.parseTrend(raw);
  }

  /**
   * 生成资讯摘要
   * @param articles 原始资讯列表
   */
  async generateSummaries(
    articles: Array<{ title: string; content: string; source: string }>,
  ): Promise<NewsArticle[]> {
    const messages = this.buildSummaryPrompt(articles);
    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.4,
      maxTokens: 4096,
      tier: 'flash',
    });

    return this.parseSummaries(raw, articles);
  }

  /**
   * 提取资讯标签
   * @param title 标题
   * @param content 内容
   */
  async extractTags(title: string, content: string): Promise<{ tags: string[]; skills: string[]; category: string }> {
    const messages = [
      {
        role: 'system',
        content: `你是标签提取专家，从资讯中提取标签和关联技能。

输出严格 JSON：
{
  "tags": ["React", "前端框架", "性能优化"],
  "skills": ["React", "JavaScript"],
  "category": "tech"
}

category 说明：
- industry：行业动态
- tech：技术文章
- recruit：招聘信息

只输出 JSON，不要其他文字。`,
      },
      {
        role: 'user',
        content: `请提取以下资讯的标签：

标题：${title}
内容：${content.substring(0, 1000)}`,
      },
    ];

    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.3,
      maxTokens: 512,
      tier: 'flash',
    });

    try {
      const data = extractJson(raw);
      return {
        tags: Array.isArray(data.tags) ? data.tags.slice(0, 10).map((t: any) => String(t)) : [],
        skills: Array.isArray(data.skills) ? data.skills.slice(0, 10).map((s: any) => String(s)) : [],
        category: ['industry', 'tech', 'recruit'].includes(data.category) ? data.category : 'tech',
      };
    } catch (e) {
      console.error('[NewsAgent] JSON parse failed:', e.message);
      return { tags: [], skills: [], category: 'tech' };
    }
  }

  /**
   * 个性化推荐资讯
   * @param userSkills 用户技能
   * @param targetJob 目标岗位
   * @param articles 候选资讯
   */
  async recommendNews(
    userSkills: string[],
    targetJob: string,
    articles: NewsArticle[],
  ): Promise<PersonalizedNews[]> {
    const messages = [
      {
        role: 'system',
        content: `你是资讯推荐专家，根据用户画像推荐最相关的资讯。

推荐原则：
1. 与用户技能相关的优先
2. 与目标岗位相关的优先
3. 技术深度匹配用户水平
4. 时效性新的优先

输出严格 JSON 数组：
[
  {
    "articleIndex": 0,
    "reason": "这篇关于 React 性能优化的文章与你当前学习的 React 技能高度相关",
    "matchScore": 95
  }
]

只输出 JSON 数组，不要其他文字。`,
      },
      {
        role: 'user',
        content: `请为以下用户推荐资讯：

用户技能：${userSkills.join('、')}
目标岗位：${targetJob}

候选资讯：
${articles.map((a, i) => `${i}. [${a.category}] ${a.title}\n   标签：${a.tags.join('、')}\n   摘要：${a.summary.substring(0, 100)}`).join('\n')}`,
      },
    ];

    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.4,
      maxTokens: 2048,
      tier: 'flash',
    });

    try {
      const recommendations = extractJson(raw);
      if (!Array.isArray(recommendations)) return [];

      return recommendations
        .filter((r: any) => r.articleIndex >= 0 && r.articleIndex < articles.length)
        .map((r: any) => ({
          articles: [articles[r.articleIndex]],
          reason: String(r.reason || '').substring(0, 200),
          matchScore: Math.min(100, Math.max(0, Number(r.matchScore) || 50)),
        }))
        .sort((a: any, b: any) => b.matchScore - a.matchScore);
    } catch (e) {
      console.error('[NewsAgent] JSON parse failed:', e.message);
      return articles.slice(0, 5).map(a => ({
        articles: [a],
        reason: '推荐阅读',
        matchScore: 50,
      }));
    }
  }

  // ── Trend Prompt ──────────────────────────────────

  private buildTrendPrompt(skills: string[], period: string): { role: string; content: string }[] {
    const skillsList = Array.isArray(skills) ? skills : [];
    return [
      {
        role: 'system',
        content: `你是技术趋势分析师，分析${period === 'week' ? '本周' : '本月'}的技术趋势。

关注领域：${skillsList.join('、') || '前端开发、后端开发、AI'}

分析维度：
1. 技术趋势（哪些技术在上升/下降）
2. 热门技能（市场需求变化）
3. 行业预测（未来发展方向）

输出严格 JSON：
{
  "title": "本周技术趋势（2026年6月第2周）",
  "summary": "一句话总结（50字）",
  "trends": [
    {
      "name": "AI 辅助编程",
      "description": "AI 编程工具持续升温...",
      "impact": "high",
      "relatedSkills": ["GitHub Copilot", "Cursor"],
      "direction": "rising"
    }
  ],
  "hotSkills": [
    {
      "name": "React",
      "demandChange": 15,
      "averageSalary": "20k-35k",
      "relatedJobs": 5000,
      "learningDifficulty": "medium"
    }
  ],
  "predictions": [
    "AI 将深度融入前端开发流程",
    "TypeScript 将成为前端标配"
  ],
  "generatedAt": "2026-06-13"
}

只输出 JSON，不要其他文字。`,
      },
      {
        role: 'user',
        content: `请分析${period === 'week' ? '本周' : '本月'}的技术趋势，重点关注：${skillsList.join('、') || '前端开发、后端开发、AI'}`,
      },
    ];
  }

  // ── Summary Prompt ──────────────────────────────────

  private buildSummaryPrompt(
    articles: Array<{ title: string; content: string; source: string }>,
  ): { role: string; content: string }[] {
    return [
      {
        role: 'system',
        content: `你是资讯摘要专家，为每篇资讯生成简洁的摘要和标签。

每篇资讯需要：
- summary：摘要（100-150字，概括核心内容）
- tags：标签（3-5个）
- skills：关联技能（如有）
- category：分类（industry/tech/recruit）
- readTime：预估阅读时间（分钟）
- difficulty：难度（basic/intermediate/advanced）

输出严格 JSON 数组：
[
  {
    "index": 0,
    "summary": "...",
    "tags": ["React", "性能优化"],
    "skills": ["React"],
    "category": "tech",
    "readTime": 5,
    "difficulty": "intermediate"
  }
]

只输出 JSON 数组，不要其他文字。`,
      },
      {
        role: 'user',
        content: `请为以下 ${articles.length} 篇资讯生成摘要：

${articles.map((a, i) => `${i}. [${a.source}] ${a.title}\n   内容：${a.content.substring(0, 500)}`).join('\n\n')}`,
      },
    ];
  }

  // ── 解析函数 ──────────────────────────────────

  private parseTrend(raw: string): TechTrend {
    try {
      const data = extractJson(raw);
      return {
        title: String(data.title || '技术趋势分析').substring(0, 100),
        summary: String(data.summary || '').substring(0, 500),
        trends: Array.isArray(data.trends)
          ? data.trends.slice(0, 10).map((t: any) => ({
              name: String(t.name || '').substring(0, 100),
              description: String(t.description || '').substring(0, 500),
              impact: ['high', 'medium', 'low'].includes(t.impact) ? t.impact : 'medium',
              relatedSkills: Array.isArray(t.relatedSkills) ? t.relatedSkills.map((s: any) => String(s)) : [],
              direction: ['rising', 'stable', 'declining'].includes(t.direction) ? t.direction : 'stable',
            }))
          : [],
        hotSkills: Array.isArray(data.hotSkills)
          ? data.hotSkills.slice(0, 10).map((s: any) => ({
              name: String(s.name || '').substring(0, 100),
              demandChange: Number(s.demandChange) || 0,
              averageSalary: String(s.averageSalary || '').substring(0, 50),
              relatedJobs: Number(s.relatedJobs) || 0,
              learningDifficulty: ['easy', 'medium', 'hard'].includes(s.learningDifficulty) ? s.learningDifficulty : 'medium',
            }))
          : [],
        predictions: Array.isArray(data.predictions)
          ? data.predictions.slice(0, 5).map((p: any) => String(p).substring(0, 200))
          : [],
        generatedAt: String(data.generatedAt || new Date().toISOString().split('T')[0]),
      };
    } catch (e) {
      console.error('[NewsAgent] JSON parse failed:', e.message);
      return {
        title: '技术趋势分析',
        summary: '趋势分析生成中...',
        trends: [],
        hotSkills: [],
        predictions: [],
        generatedAt: new Date().toISOString().split('T')[0],
      };
    }
  }

  private parseSummaries(
    raw: string,
    originalArticles: Array<{ title: string; content: string; source: string }>,
  ): NewsArticle[] {
    try {
      const summaries = extractJson(raw);
      if (!Array.isArray(summaries)) return [];

      return summaries.map((s: any, i: number) => {
        const original = originalArticles[s.index ?? i];
        return {
          title: original?.title || '',
          summary: String(s.summary || '').substring(0, 500),
          content: original?.content || '',
          category: ['industry', 'tech', 'recruit'].includes(s.category) ? s.category : 'tech',
          tags: Array.isArray(s.tags) ? s.tags.slice(0, 10).map((t: any) => String(t)) : [],
          skills: Array.isArray(s.skills) ? s.skills.slice(0, 10).map((sk: any) => String(sk)) : [],
          source: original?.source || '',
          publishedAt: new Date().toISOString(),
          readTime: Number(s.readTime) || 5,
          difficulty: ['basic', 'intermediate', 'advanced'].includes(s.difficulty) ? s.difficulty : 'intermediate',
        };
      });
    } catch (e) {
      console.error('[NewsAgent] JSON parse failed:', e.message);
      return originalArticles.map(a => ({
        title: a.title,
        summary: a.content.substring(0, 200),
        content: a.content,
        category: 'tech' as const,
        tags: [],
        skills: [],
        source: a.source,
        publishedAt: new Date().toISOString(),
        readTime: 5,
        difficulty: 'intermediate' as const,
      }));
    }
  }

}

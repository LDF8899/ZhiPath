import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from './llm.service';
import { SearchStackService } from './search-stack.service';
import { extractJson } from '../common/json-repair';

/**
 * 在线岗位卡片（来自联网搜索/LLM 生成，非本地库）
 */
export interface OnlineJobCard {
  id: number;
  title: string;
  company: string;
  location?: string;
  salaryRange?: string;
  requiredSkills: string[];
  matchScore: number;
  source: 'online';
  origin: 'web' | 'ai_generated';
  url: string;
  snippet?: string;
  host?: string;
}

@Injectable()
export class JobSearchService {
  private readonly logger = new Logger(JobSearchService.name);
  private readonly cacheTtlMs = 15 * 60 * 1000;
  private readonly cache = new Map<string, { expiresAt: number; value: OnlineJobCard[] }>();

  constructor(
    private llm: LlmService,
    private searchStack: SearchStackService,
  ) {}

  /**
   * 在线搜索 + LLM 兜底生成
   * 策略：search-stack 搜索 → LLM 提取 → 失败则 LLM 直接生成
   */
  async search(keyword: string, userSkills: string[] = []): Promise<OnlineJobCard[]> {
    const cleanKeyword = (keyword || 'IT').trim();
    const cacheKey = this.getCacheKey(cleanKeyword, userSkills);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return this.cloneCards(cached.value);
    }

    // ── 路径 A：search-stack 搜索 + LLM 提取 ──
    try {
      const results = await this.searchStack.search(
        `${cleanKeyword} 招聘`,
        { count: 8 },
      );
      if (results.length > 0) {
        const cards = await this.extractJobsFromResults(results, cleanKeyword, userSkills);
        if (cards.length >= 2) {
          this.logger.log(`[JobSearch] search-stack → ${cards.length} jobs`);
          this.storeCache(cacheKey, cards);
          return this.cloneCards(cards);
        }
      }
    } catch (e: any) {
      this.logger.warn(`[JobSearch] search-stack failed: ${e.message}`);
    }

    // ── 路径 B：LLM 直接生成 ──
    const generated = await this.generateJobsWithLLM(cleanKeyword, userSkills);
    this.storeCache(cacheKey, generated);
    return this.cloneCards(generated);
  }

  /** 从 search-stack 搜索结果中 LLM 提取结构化岗位 */
  private getCacheKey(keyword: string, userSkills: string[]): string {
    const skills = [...new Set(userSkills.map((skill) => skill.trim().toLowerCase()).filter(Boolean))]
      .sort()
      .join(',');
    return `${keyword.trim().toLowerCase()}|${skills}`;
  }

  private storeCache(key: string, value: OnlineJobCard[]): void {
    this.cache.set(key, { expiresAt: Date.now() + this.cacheTtlMs, value: this.cloneCards(value) });
    if (this.cache.size <= 100) return;

    const now = Date.now();
    for (const [cacheKey, cached] of this.cache.entries()) {
      if (cached.expiresAt <= now || this.cache.size > 100) {
        this.cache.delete(cacheKey);
      }
    }
  }

  private cloneCards(cards: OnlineJobCard[]): OnlineJobCard[] {
    return cards.map((card) => ({
      ...card,
      requiredSkills: [...(card.requiredSkills || [])],
    }));
  }

  private async extractJobsFromResults(
    results: { title: string; url: string; snippet: string }[],
    keyword: string,
    userSkills: string[],
  ): Promise<OnlineJobCard[]> {
    const corpus = results
      .map((r, i) => `[${i}] ${r.title}\nURL: ${r.url}\n摘要: ${(r.snippet || '').slice(0, 200)}`)
      .join('\n\n');

    const prompt = `从搜索结果提取真实招聘岗位，忽略列表页和导航页。

关键词：${keyword}  用户技能：${userSkills.join(', ') || '不限'}

搜索结果：${corpus}

输出 JSON：[{"title":"岗位名","company":"公司","location":"城市","salaryRange":"15-25K","requiredSkills":["技能"],"url":"URL"}]`;

    return this.callLLM(prompt, userSkills, results);
  }

  /** LLM 直接生成岗位推荐 */
  private async generateJobsWithLLM(
    keyword: string,
    userSkills: string[],
  ): Promise<OnlineJobCard[]> {
    const skillHint = userSkills.length > 0
      ? `候选人技能：${userSkills.join('、')}。优先推荐匹配这些技能的岗位。`
      : '';

    const prompt = `你是资深 IT 招聘顾问。根据2024-2026年中国IT招聘市场真实情况，生成${keyword}方向的高质量岗位推荐（15条）。

${skillHint}

要求：真实公司名+2026年行情薪资+多城市（北京/上海/深圳/杭州/成都/广州）+多级别（初级/中级/高级）

输出 JSON：[{"title":"前端开发工程师","company":"字节跳动","location":"北京","salaryRange":"20-40K·15薪","requiredSkills":["React","TypeScript"],"description":"负责抖音电商前端架构开发"}]

只输出 JSON 数组。`;

    const cards = await this.callLLM(prompt, userSkills, []);
    if (cards.length > 0) {
      this.logger.log(`[JobSearch] LLM generated ${cards.length} jobs`);
    }
    return cards;
  }

  /** 调用 LLM + 构建 OnlineJobCard */
  private async callLLM(
    prompt: string,
    userSkills: string[],
    searchResults: { title: string; url: string; snippet: string }[],
  ): Promise<OnlineJobCard[]> {
    try {
      const text = await this.llm.chatCompletion(
        [{ role: 'user', content: prompt }],
        { temperature: 0.4, maxTokens: 3000 },
      );

      let arr: any = [];
      try {
        arr = extractJson(text);
        if (!Array.isArray(arr)) {
          const obj = arr as Record<string, any>;
          arr = (obj?.data || obj?.jobs || obj?.result || obj?.list || []) as any[];
        }
      } catch {
        const cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1');
        const m = cleaned.match(/\[[\s\S]*\]/);
        if (m) {
          try { arr = JSON.parse(m[0]); } catch {
            try { arr = JSON.parse(m[0].replace(/,\s*([\]])/g, '$1')); } catch {}
          }
        }
      }

      if (!Array.isArray(arr) || arr.length === 0) return [];

      const userSkillLower = userSkills.map((s) => s.toLowerCase());

      return arr.slice(0, 20).map((j: any, i: number) => {
        const reqSkills: string[] = Array.isArray(j.requiredSkills) ? j.requiredSkills : [];
        const matchedCount = reqSkills.filter((s) =>
          userSkillLower.some((u) =>
            String(s).toLowerCase().includes(u) || u.includes(String(s).toLowerCase()),
          ),
        ).length;
        const matchScore = reqSkills.length > 0
          ? Math.round((matchedCount / reqSkills.length) * 100)
          : 50;
        const url = j.url || (searchResults[i]?.url || '');
        let host = '';
        if (url) {
          try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
        }

        return {
          id: -(2000 + i),
          title: String(j.title || '').slice(0, 80),
          company: String(j.company || '').slice(0, 80),
          location: j.location || '',
          salaryRange: j.salaryRange || '面议',
          requiredSkills: reqSkills.slice(0, 10),
          matchScore,
          source: 'online' as const,
          origin: searchResults.length > 0 ? 'web' as const : 'ai_generated' as const,
          url,
          snippet: j.description || j.snippet || (searchResults[i]?.snippet || '').slice(0, 200),
          host,
        };
      });
    } catch (e: any) {
      this.logger.warn(`[JobSearch] LLM failed: ${e.message}`);
      return [];
    }
  }
}

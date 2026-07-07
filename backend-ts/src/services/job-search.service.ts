import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';
import { extractJson } from '../common/json-repair';

/**
 * 在线岗位卡片（来自联网搜索，非本地库）
 *
 * 设计目标：当本地 job_positions_v3 无合适结果或最高匹配度过低时，
 * 用 SearXNG 检索招聘平台公开页面，再用 LLM 抽取结构化岗位信息。
 */
export interface OnlineJobCard {
  /** 负数 id，区别于本地岗位（正数） */
  id: number;
  title: string;
  company: string;
  location?: string;
  salaryRange?: string;
  requiredSkills: string[];
  matchScore: number;
  source: 'online';
  /** 招聘详情/原页面 URL，点击直接新窗口打开 */
  url: string;
  /** SearXNG 摘要片段 */
  snippet?: string;
  /** 来源招聘平台域名 */
  host?: string;
}

interface SearxngResult {
  title: string;
  url: string;
  content: string;
}

@Injectable()
export class JobSearchService {
  private readonly logger = new Logger(JobSearchService.name);
  private readonly searxngUrl: string;
  /** 优先抓取的招聘平台域名（site: 限定） */
  private static readonly JOB_SITES =
    'lagou.com OR zhipin.com OR liepin.com OR 51job.com OR jobs.zhaopin.com OR nowcoder.com';

  constructor(
    private config: ConfigService,
    private llm: LlmService,
  ) {
    this.searxngUrl = this.config.get('SEARXNG_URL', 'http://127.0.0.1:8080');
  }

  /**
   * 在线搜索岗位（兜底入口）
   * @param keyword 方向/技术关键词（前端/后端/Python/...）
   * @param userSkills 用户已有的技能，用于离线估算匹配度
   */
  async search(keyword: string, userSkills: string[] = []): Promise<OnlineJobCard[]> {
    const query = `${keyword || 'IT'} 招聘 (${JobSearchService.JOB_SITES})`;
    try {
      const results = await this.searxngSearch(query);
      if (results.length === 0) {
        this.logger.warn('[JobSearch] SearXNG 返回空结果，可能是上游搜索引擎不可用');
        return [];
      }
      return await this.extractJobsWithLLM(results, keyword, userSkills);
    } catch (e: any) {
      this.logger.warn(`[JobSearch] search failed: ${e.message}`);
      return [];
    }
  }

  /** 调用 SearXNG JSON API */
  private async searxngSearch(query: string): Promise<SearxngResult[]> {
    const url = `${this.searxngUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general&language=zh`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          'Accept': 'application/json',
        },
      });
      clearTimeout(timer);
      if (!res.ok) return [];
      const data: any = await res.json();
      return (data.results || []).slice(0, 12).map((r: any) => ({
        title: r.title || '',
        url: r.url || '',
        content: r.content || '',
      }));
    } catch (e: any) {
      clearTimeout(timer);
      this.logger.warn(`[JobSearch] searxng timeout/error: ${e.message}`);
      return [];
    }
  }

  /** 用 LLM 从搜索结果抽取岗位结构 */
  private async extractJobsWithLLM(
    results: SearxngResult[],
    keyword: string,
    userSkills: string[],
  ): Promise<OnlineJobCard[]> {
    const corpus = results
      .map((r, i) => `[${i}] ${r.title}\nURL: ${r.url}\n摘要: ${(r.content || '').slice(0, 250)}`)
      .join('\n\n');

    const prompt = `你是招聘数据抽取助手。下面是搜索引擎返回的 ${keyword || 'IT'} 招聘相关网页列表。
请从中提取出最多 5 个真实的招聘岗位信息，忽略不相关的网页（如新闻、广告、公司主页）。

用户已有技能：${userSkills.join(', ') || '未指定'}

网页列表：
${corpus}

输出 JSON 数组，每条形如：
[{"title":"岗位名","company":"公司名","location":"城市","salaryRange":"如 15-25K","requiredSkills":["技能1","技能2"],"snippet":"来源摘要"}]

要求：
1. 只输出标准 JSON 数组，不要任何解释文字。
2. 没有的信息可省略（不要写 null）。
3. 同一个公司多个岗位只保留一条最相关的。`;

    try {
      const text = await this.llm.chatCompletion(
        [{ role: 'user', content: prompt }],
        { temperature: 0.2, maxTokens: 1500 },
      );

      let arr: any = null;
      try {
        arr = extractJson(text);
        // extractJson 对对象有效，对数组可能返回了非预期形式
        if (!Array.isArray(arr)) {
          // 可能是 {data: [...]} 或 {jobs: [...]} 之类的包装
          arr = arr?.data || arr?.jobs || arr?.result || [];
        }
      } catch (e: any) {
        this.logger.warn(`[JobSearch] extractJson 失败: ${e.message}, raw=${text.slice(0, 300)}`);
        // 兜底：先剥 markdown 代码块，再抓第一个完整 [...] 片段
        let cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1');
        const m = cleaned.match(/\[[\s\S]*\]/);
        if (!m) {
          this.logger.warn(`[JobSearch] LLM 输出无法解析为 JSON, raw=${text.slice(0, 200)}`);
          return [];
        }
        try {
          arr = JSON.parse(m[0]);
        } catch (e2: any) {
          // 移除尾部中文逗号等
          try {
            const trimmed = m[0].replace(/,\s*([\]])/g, '$1');
            arr = JSON.parse(trimmed);
          } catch (e3: any) {
            this.logger.warn(`[JobSearch] 兜底解析仍失败: ${e3.message}, bracket=${m[0].slice(0, 200)}`);
            return [];
          }
        }
      }
      if (!Array.isArray(arr)) {
        this.logger.warn('[JobSearch] LLM 输出不是数组');
        return [];
      }

      return arr.slice(0, 5).map((j: any, i: number) => {
        const reqSkills: string[] = Array.isArray(j.requiredSkills) ? j.requiredSkills : [];
        const matched = reqSkills.filter((s) =>
          userSkills.some((u) => u.toLowerCase() === String(s).toLowerCase()),
        );
        const total = reqSkills.length || 1;
        const matchScore = reqSkills.length > 0
          ? Math.round((matched.length / total) * 100)
          : 50; // 无 requiredSkills 信息时给个中性分

        const url: string = j.snippet ? results[i]?.url || '' : results[i]?.url || '';
        let host = '';
        try { host = new URL(url || results[i]?.url || '').hostname; } catch {}

        return {
          id: -(1000 + i), // 负数 id 表示在线来源
          title: String(j.title || '').slice(0, 80),
          company: String(j.company || '').slice(0, 80),
          location: j.location || '',
          salaryRange: j.salaryRange || '面议',
          requiredSkills: reqSkills.slice(0, 8),
          matchScore,
          source: 'online' as const,
          url: url || results[i]?.url || '',
          snippet: String(j.snippet || results[i]?.content || '').slice(0, 200),
          host,
        };
      });
    } catch (e: any) {
      this.logger.warn(`[JobSearch] LLM extract failed: ${e.message}`);
      return [];
    }
  }
}
import { Injectable, Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../database/redis.module';
import { News } from '../entities/news.entity';
import { LlmService } from './llm.service';
import { extractJson } from '../common/json-repair';

/**
 * 资讯采集服务 — 业务深度设计 §20.2 SearXNG 采集流程
 *
 *   定时触发 → 构造关键词 → 调 SearXNG → 去重(Redis SET) → LLM 摘要+标签 → 存 news_v3
 *
 * SearXNG / Redis 不可用时静默降级，不抛错。
 */
@Injectable()
export class NewsCrawlService {
  private readonly searxngUrl: string;
  private readonly DEDUP_KEY = 'news:crawled_urls';

  /** 默认采集关键词（§20.1 行业动态） */
  private readonly DEFAULT_KEYWORDS = [
    '前端开发', '后端开发', 'TypeScript', 'React', '人工智能', '大模型', '云原生', 'Kubernetes',
  ];

  constructor(
    @InjectRepository(News) private newsRepo: Repository<News>,
    @Optional() @Inject(REDIS_CLIENT) private redis: Redis | null,
    private config: ConfigService,
    private llm: LlmService,
  ) {
    this.searxngUrl = this.config.get('SEARXNG_URL', 'http://127.0.0.1:8080');
  }

  /**
   * 执行一轮采集。
   * @param keywords 关键词列表（默认用内置）
   * @param perKeyword 每个关键词最多入库条数
   */
  async crawl(keywords?: string[], perKeyword = 3): Promise<{
    keywords: number;
    fetched: number;
    inserted: number;
    skipped: number;
  }> {
    const kws = keywords?.length ? keywords : this.DEFAULT_KEYWORDS;
    const stats = { keywords: kws.length, fetched: 0, inserted: 0, skipped: 0 };

    for (const kw of kws) {
      const results = await this.searxngSearch(kw);
      stats.fetched += results.length;

      let inserted = 0;
      for (const r of results) {
        if (inserted >= perKeyword) break;
        if (!r.url || !r.title) continue;

        // 去重：Redis SET 记录已抓取 URL
        if (await this.isDuplicate(r.url)) {
          stats.skipped++;
          continue;
        }

        // LLM 生成摘要 + 标签
        const enriched = await this.enrich(r.title, r.content || '');

        await this.newsRepo.save({
          title: r.title.slice(0, 500),
          content: (r.content || '').slice(0, 5000),
          summary: enriched.summary,
          type: 'industry',
          tags: enriched.tags,
          source: 'searxng',
          sourceUrl: r.url.slice(0, 1000),
          publishTime: Date.now(),
          createTime: Date.now(),
          updateTime: Date.now(),
          status: 1,
        });
        await this.markCrawled(r.url);
        inserted++;
        stats.inserted++;
      }
    }

    console.log(`[NewsCrawl] done: ${JSON.stringify(stats)}`);
    return stats;
  }

  // ── 内部方法 ──────────────────────────────────

  /** 调用 SearXNG JSON API */
  private async searxngSearch(query: string): Promise<Array<{ title: string; url: string; content: string }>> {
    try {
      const url = `${this.searxngUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general&language=zh`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return [];
      const data: any = await res.json();
      return (data.results || []).map((r: any) => ({
        title: r.title || '',
        url: r.url || '',
        content: r.content || '',
      }));
    } catch (e: any) {
      console.warn(`[NewsCrawl] searxng search "${query}" failed:`, e.message);
      return [];
    }
  }

  /** URL 去重检测 */
  private async isDuplicate(url: string): Promise<boolean> {
    if (this.redis) {
      try {
        return (await this.redis.sismember(this.DEDUP_KEY, url)) === 1;
      } catch (e: any) { console.warn('[NewsCrawl] Redis sismember failed, falling through to DB:', e.message); }
    }
    // Redis 不可用 → 退化为 DB 查询
    const existing = await this.newsRepo.findOne({ where: { sourceUrl: url } });
    return !!existing;
  }

  /** 标记 URL 已抓取 */
  private async markCrawled(url: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.sadd(this.DEDUP_KEY, url);
    } catch (e: any) { console.warn('[NewsCrawl] Redis sadd failed:', e.message); }
  }

  /** LLM 生成摘要 + 技能标签 */
  private async enrich(title: string, content: string): Promise<{ summary: string; tags: string[] }> {
    const prompt = `根据以下资讯标题和摘录，生成一段不超过 80 字的中文摘要，并提取最多 5 个技术标签。

标题：${title}
摘录：${content.slice(0, 500)}

只输出 JSON：{"summary":"...","tags":["React","前端"]}`;

    try {
      const result = await this.llm.chatCompletion(
        [
          { role: 'system', content: '你是技术资讯编辑，输出简洁准确的摘要和标签。' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.3, maxTokens: 300 },
      );

      const parsed = extractJson(result);
      return {
        summary: (parsed.summary || title).slice(0, 1000),
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
      };
    } catch (e: any) {
      // LLM 失败 → 用标题兜底
      return { summary: title.slice(0, 200), tags: [] };
    }
  }
}

import { Injectable, Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../database/redis.module';
import { News } from '../entities/news.entity';
import { LlmService } from './llm.service';
import { extractJson } from '../common/json-repair';

type NewsType = 'industry' | 'tech' | 'recruit';

interface RawNewsItem {
  title: string;
  url: string;
  content: string;
  source: string;
  publishTime?: number;
  type?: NewsType;
}

interface CrawlStats {
  keywords: number;
  sources: number;
  fetched: number;
  inserted: number;
  skipped: number;
  failedSources: string[];
}

/**
 * AI news crawler.
 *
 * Mature flow:
 *   RSS/feed sources -> SearXNG fallback -> AI-domain filter -> Redis/DB dedupe
 *   -> LLM summary/tags -> news_v3
 */
@Injectable()
export class NewsCrawlService {
  private readonly searxngUrls: string[];
  private readonly searxngEngines: string;
  private readonly DEDUP_KEY = 'news:crawled_urls';

  private readonly DEFAULT_KEYWORDS = [
    '人工智能 最新 新闻',
    '大模型 最新 发布',
    'AI Agent 最新',
    '生成式 AI 最新',
    'OpenAI Anthropic Google DeepSeek 最新',
  ];

  private readonly RSS_SOURCES: Array<{ name: string; url: string; type: NewsType }> = [
    {
      name: 'Google News AI',
      url: 'https://news.google.com/rss/search?q=artificial%20intelligence%20OR%20large%20language%20model%20OR%20generative%20AI&hl=zh-CN&gl=US&ceid=US:zh-Hans',
      type: 'industry',
    },
    { name: 'OpenAI News', url: 'https://openai.com/news/rss.xml', type: 'tech' },
    { name: 'Google Research', url: 'https://research.google/blog/rss/', type: 'tech' },
    { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml', type: 'tech' },
    { name: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', type: 'industry' },
  ];

  private readonly AI_KEYWORDS = [
    'ai', 'artificial intelligence', 'machine learning', 'deep learning',
    'large language model', 'llm', 'generative', 'openai', 'anthropic',
    'deepseek', 'gemini', 'claude', 'gpt', 'agent', 'copilot', 'nvidia',
    '人工智能', '机器学习', '深度学习', '大模型', '生成式', '智能体',
    '多模态', '推理模型', '模型发布', '算力', '芯片',
  ];

  constructor(
    @InjectRepository(News) private newsRepo: Repository<News>,
    @Optional() @Inject(REDIS_CLIENT) private redis: Redis | null,
    private config: ConfigService,
    private llm: LlmService,
  ) {
    this.searxngUrls = [
      this.config.get('NEWS_SEARXNG_URL', ''),
      this.config.get('SEARXNG_EXTERNAL_URL', ''),
      this.config.get('SEARXNG_URL', 'http://127.0.0.1:8080'),
    ]
      .flatMap((value) => String(value || '').split(','))
      .map((value) => value.trim().replace(/\/$/, ''))
      .filter(Boolean)
      .filter((value, index, arr) => arr.indexOf(value) === index);
    this.searxngEngines = this.config.get('NEWS_SEARXNG_ENGINES', 'bing,baidu');
  }

  async crawl(keywords?: string[], perKeyword = 3): Promise<CrawlStats> {
    const kws = keywords?.length ? keywords : this.DEFAULT_KEYWORDS;
    const stats: CrawlStats = {
      keywords: kws.length,
      sources: this.RSS_SOURCES.length,
      fetched: 0,
      inserted: 0,
      skipped: 0,
      failedSources: [],
    };

    const candidates = await this.collectCandidates(kws, stats);
    const ordered = this.rankAndDedupeCandidates(candidates);

    const maxInsert = Math.max(1, Math.min(30, kws.length * perKeyword));
    for (const item of ordered) {
      if (stats.inserted >= maxInsert) break;
      if (!item.url || !item.title || !this.isAiRelevant(item)) {
        stats.skipped++;
        continue;
      }
      if (await this.isDuplicate(item.url, item.title)) {
        stats.skipped++;
        continue;
      }

      const enriched = await this.enrich(item);
      const now = Date.now();
      await this.newsRepo.save({
        title: item.title.slice(0, 500),
        content: this.cleanText(item.content).slice(0, 5000),
        summary: enriched.summary,
        type: enriched.type || item.type || 'industry',
        tags: enriched.tags,
        source: item.source.slice(0, 100),
        sourceUrl: item.url.slice(0, 1000),
        publishTime: item.publishTime || now,
        createTime: now,
        updateTime: now,
        status: 1,
      });
      await this.markCrawled(item.url);
      stats.inserted++;
    }

    console.log(`[NewsCrawl] done: ${JSON.stringify(stats)}`);
    return stats;
  }

  private async collectCandidates(kws: string[], stats: CrawlStats): Promise<RawNewsItem[]> {
    const all: RawNewsItem[] = [];

    const feedResults = await Promise.allSettled(this.RSS_SOURCES.map(async (source) => ({
      source,
      items: await this.fetchRssSource(source),
    })));
    for (const result of feedResults) {
      if (result.status === 'fulfilled') {
        stats.fetched += result.value.items.length;
        all.push(...result.value.items);
      } else {
        const idx = feedResults.indexOf(result);
        const sourceName = this.RSS_SOURCES[idx]?.name || 'unknown';
        stats.failedSources.push(sourceName);
        console.warn(`[NewsCrawl] feed "${sourceName}" failed:`, result.reason?.message || result.reason);
      }
    }

    const searchResults = await Promise.all(kws.map((kw) => this.searxngSearch(kw)));
    for (const items of searchResults) {
      stats.fetched += items.length;
      all.push(...items);
    }

    return all;
  }

  private async fetchRssSource(source: { name: string; url: string; type: NewsType }): Promise<RawNewsItem[]> {
    const xml = await this.fetchText(source.url, 15000);
    const rssItems = this.extractBlocks(xml, 'item').map((block) => ({
      title: this.extractTag(block, 'title'),
      url: this.normalizeUrl(this.extractTag(block, 'link') || this.extractTag(block, 'guid')),
      content: this.extractTag(block, 'description') || this.extractTag(block, 'content:encoded'),
      source: source.name,
      publishTime: this.parseDate(this.extractTag(block, 'pubDate')),
      type: source.type,
    }));

    const atomItems = this.extractBlocks(xml, 'entry').map((block) => ({
      title: this.extractTag(block, 'title'),
      url: this.normalizeUrl(this.extractAtomLink(block) || this.extractTag(block, 'id')),
      content: this.extractTag(block, 'summary') || this.extractTag(block, 'content'),
      source: source.name,
      publishTime: this.parseDate(this.extractTag(block, 'published') || this.extractTag(block, 'updated')),
      type: source.type,
    }));

    return [...rssItems, ...atomItems]
      .map((item) => ({
        ...item,
        title: this.cleanText(item.title),
        content: this.cleanText(item.content),
      }))
      .filter((item) => item.title && item.url)
      .slice(0, 20);
  }

  private async searxngSearch(keyword: string): Promise<RawNewsItem[]> {
    const query = `${keyword} AI 人工智能 新闻 发布`;
    for (const baseUrl of this.searxngUrls) {
      const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general&language=zh&engines=${encodeURIComponent(this.searxngEngines)}`;
      try {
        const text = await this.fetchText(url, 12000);
        const data: any = JSON.parse(text);
        const results = (data.results || []).slice(0, 10).map((r: any) => ({
          title: this.cleanText(r.title || ''),
          url: this.normalizeUrl(r.url || ''),
          content: this.cleanText(r.content || ''),
          source: `searxng:${this.hostLabel(baseUrl)}`,
          publishTime: Date.now(),
          type: 'industry' as NewsType,
        }));
        if (results.length > 0) return results;
        console.warn(`[NewsCrawl] searxng "${keyword}" returned 0 results from ${baseUrl}; unresponsive=${JSON.stringify(data.unresponsive_engines || [])}`);
      } catch (e: any) {
        console.warn(`[NewsCrawl] searxng "${keyword}" failed from ${baseUrl}:`, e.message);
      }
    }
    return [];
  }

  private async fetchText(url: string, timeoutMs: number): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ZhiPathNewsBot/1.0',
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  private rankAndDedupeCandidates(items: RawNewsItem[]): RawNewsItem[] {
    const seen = new Set<string>();
    const scored = items
      .filter((item) => item.title && item.url)
      .map((item) => ({
        item,
        score: this.relevanceScore(item) + Math.min(5, Math.max(0, (item.publishTime || 0) / Date.now())),
      }))
      .sort((a, b) => b.score - a.score);

    const result: RawNewsItem[] = [];
    for (const { item } of scored) {
      const key = this.dedupeKey(item.url) || this.norm(item.title);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
    return result;
  }

  private async isDuplicate(url: string, title: string): Promise<boolean> {
    const key = this.dedupeKey(url);
    if (this.redis && key) {
      try {
        if ((await this.redis.sismember(this.DEDUP_KEY, key)) === 1) return true;
      } catch (e: any) {
        console.warn('[NewsCrawl] Redis sismember failed, falling through to DB:', e.message);
      }
    }
    const existingByUrl = await this.newsRepo.findOne({ where: { sourceUrl: url } });
    if (existingByUrl) return true;
    const existingByTitle = await this.newsRepo
      .createQueryBuilder('n')
      .where('n.status = 1')
      .andWhere('LOWER(n.title) = :title', { title: this.norm(title) })
      .getOne();
    return !!existingByTitle;
  }

  private async markCrawled(url: string): Promise<void> {
    if (!this.redis) return;
    const key = this.dedupeKey(url);
    if (!key) return;
    try {
      await this.redis.sadd(this.DEDUP_KEY, key);
    } catch (e: any) {
      console.warn('[NewsCrawl] Redis sadd failed:', e.message);
    }
  }

  private async enrich(item: RawNewsItem): Promise<{ summary: string; tags: string[]; type: NewsType }> {
    const fallbackSummary = this.fallbackSummary(item);
    const prompt = `请把下面的 AI 领域资讯整理为用户可读卡片。

标题：${item.title}
来源：${item.source}
摘录：${item.content.slice(0, 1200)}

只输出 JSON：
{"summary":"80-120字中文摘要，说明发生了什么以及对学习/就业的意义","tags":["AI","大模型"],"type":"industry|tech|recruit"}

要求：
1. 不编造标题和来源之外的具体数字。
2. tags 最多 5 个。
3. type 只能是 industry、tech、recruit。`;

    try {
      const result = await this.llm.chatCompletion(
        [
          { role: 'system', content: '你是 AI 技术资讯编辑，只输出严格 JSON。' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.2, maxTokens: 500, tier: 'flash' },
      );
      const parsed = extractJson(result);
      const type = ['industry', 'tech', 'recruit'].includes(parsed.type) ? parsed.type : item.type || 'industry';
      return {
        summary: String(parsed.summary || fallbackSummary).slice(0, 1000),
        tags: Array.isArray(parsed.tags) ? parsed.tags.map((t: any) => String(t)).filter(Boolean).slice(0, 5) : this.inferTags(item),
        type,
      };
    } catch (e: any) {
      console.warn('[NewsCrawl] enrich failed:', e.message);
      return {
        summary: fallbackSummary,
        tags: this.inferTags(item),
        type: item.type || 'industry',
      };
    }
  }

  private isAiRelevant(item: RawNewsItem): boolean {
    return this.relevanceScore(item) > 0;
  }

  private relevanceScore(item: RawNewsItem): number {
    const text = this.norm(`${item.title} ${item.content}`);
    return this.AI_KEYWORDS.reduce((score, keyword) => score + (text.includes(this.norm(keyword)) ? 1 : 0), 0);
  }

  private inferTags(item: RawNewsItem): string[] {
    const tags: string[] = [];
    const text = this.norm(`${item.title} ${item.content}`);
    const candidates = [
      ['OpenAI', 'openai'], ['DeepSeek', 'deepseek'], ['Claude', 'claude'], ['Gemini', 'gemini'],
      ['GPT', 'gpt'], ['AI Agent', 'agent'], ['大模型', '大模型'], ['多模态', '多模态'],
      ['机器学习', 'machine learning'], ['NVIDIA', 'nvidia'],
    ];
    for (const [label, key] of candidates) {
      if (text.includes(this.norm(key)) && !tags.includes(label)) tags.push(label);
    }
    if (!tags.length) tags.push('AI');
    return tags.slice(0, 5);
  }

  private fallbackSummary(item: RawNewsItem): string {
    const body = this.cleanText(item.content || '').slice(0, 180);
    if (body) return body;
    return `AI 领域最新动态：${item.title}`.slice(0, 220);
  }

  private extractBlocks(xml: string, tag: string): string[] {
    const re = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, 'gi');
    return xml.match(re) || [];
  }

  private extractTag(xml: string, tag: string): string {
    const safeTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`<${safeTag}\\b[^>]*>([\\s\\S]*?)<\\/${safeTag}>`, 'i');
    const match = xml.match(re);
    return match ? this.decodeEntities(match[1]) : '';
  }

  private extractAtomLink(xml: string): string {
    const alternate = xml.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i);
    if (alternate) return this.decodeEntities(alternate[1]);
    const anyLink = xml.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
    return anyLink ? this.decodeEntities(anyLink[1]) : '';
  }

  private parseDate(input: string): number | undefined {
    if (!input) return undefined;
    const value = Date.parse(this.cleanText(input));
    return Number.isFinite(value) ? value : undefined;
  }

  private cleanText(input: string): string {
    return this.decodeEntities(String(input || ''))
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private decodeEntities(input: string): string {
    return String(input || '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  }

  private normalizeUrl(url: string): string {
    const cleaned = this.decodeEntities(String(url || '').trim());
    if (!cleaned) return '';
    try {
      const u = new URL(cleaned);
      u.hash = '';
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((p) => u.searchParams.delete(p));
      return u.toString();
    } catch {
      return cleaned;
    }
  }

  private hostLabel(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return 'local';
    }
  }

  private dedupeKey(url: string): string {
    try {
      const u = new URL(url);
      u.hash = '';
      return `${u.hostname}${u.pathname}`.toLowerCase().replace(/\/$/, '');
    } catch {
      return this.norm(url);
    }
  }

  private norm(input: string): string {
    return String(input || '').toLowerCase().trim();
  }
}

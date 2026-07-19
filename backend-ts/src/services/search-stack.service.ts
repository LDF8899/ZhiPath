import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * search-stack 客户端 — 对接 search-proxy API
 *
 * 两个核心能力：
 * - /search: 多引擎搜索（Tavily → Serper → SearXNG fallback）
 * - /fetch:  Browserless 无头 Chrome 抓取网页全文（反反爬、JS 渲染）
 *
 * 环境变量：
 *   SEARCH_STACK_URL=http://127.0.0.1:17080
 *   SEARCH_STACK_API_KEY=your-api-key
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

export interface SearchResponse {
  query: string;
  count: number;
  cached: boolean;
  provider: string;
  results: SearchResult[];
}

export interface FetchResult {
  cached: boolean;
  url: string;
  status_code: number;
  render: boolean;
  title: string;
  text: string;
  needs_login?: boolean;
}

@Injectable()
export class SearchStackService {
  private readonly logger = new Logger(SearchStackService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly enabled: boolean;

  constructor(private config: ConfigService) {
    this.baseUrl = this.config.get('SEARCH_STACK_URL', 'http://127.0.0.1:17080');
    this.apiKey = this.config.get('SEARCH_STACK_API_KEY', '566eedeec95fe68b9a1e17be6f1d09b1');
    this.enabled = this.baseUrl.length > 0;
  }

  /**
   * 搜索（走 search-stack 多引擎 fallback）
   */
  async search(
    query: string,
    options: { count?: number; provider?: string; enrich?: boolean } = {},
  ): Promise<SearchResult[]> {
    if (!this.enabled) return [];

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);

      const res = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({
          query,
          count: options.count || 5,
          provider: options.provider || undefined,
          enrich: options.enrich || false,
          max_chars: 8000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      if (!res.ok) return [];

      const data: SearchResponse = await res.json();
      return data.results || [];
    } catch (e: any) {
      this.logger.warn(`[SearchStack] search failed: ${e.message}`);
      return [];
    }
  }

  /**
   * 搜索 + 抓取全文（enrich=true）
   * 搜索后自动用 Browserless 抓取每条结果的完整页面正文
   */
  async searchWithEnrich(
    query: string,
    count = 5,
  ): Promise<SearchResult[]> {
    return this.search(query, { count, enrich: true });
  }

  /**
   * 抓取单个 URL 的完整正文
   * 使用 Browserless 无头 Chrome，Stealth 模式绕过反爬
   */
  async fetch(url: string, render = true): Promise<FetchResult | null> {
    if (!this.enabled) return null;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${this.baseUrl}/fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({
          url,
          render,
          max_chars: 20000,
          timeout: 25,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      if (!res.ok) return null;

      const data: FetchResult = await res.json();
      if (data.needs_login) {
        this.logger.warn(`[SearchStack] ${url} requires login`);
      }
      return data;
    } catch (e: any) {
      this.logger.warn(`[SearchStack] fetch failed for ${url}: ${e.message}`);
      return null;
    }
  }

  /**
   * 抓取页面并用 LLM 提取 JD 结构化信息
   * @param url 岗位详情页 URL
   * @param llmService LLM 服务（由调用方注入）
   */
  async fetchAndExtractJD(
    url: string,
    llmService: any, // LlmService — 避免循环依赖
  ): Promise<{
    title: string;
    company: string;
    location: string;
    salary: string;
    skills: string[];
    description: string;
  } | null> {
    const fetched = await this.fetch(url);
    if (!fetched || !fetched.text) return null;

    const text = fetched.text.substring(0, 8000);
    const prompt = `从以下网页正文中提取招聘岗位信息：

${text}

输出 JSON：{"title":"岗位名","company":"公司","location":"城市","salary":"薪资","skills":["技能"],"description":"岗位描述(100字)"}
只输出 JSON，不要其他文字。`;

    try {
      const raw = await llmService.chatCompletion(
        [{ role: 'user', content: prompt }],
        { temperature: 0.1, maxTokens: 1000, tier: 'flash' },
      );

      // 简单 JSON 提取
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return null;
      return JSON.parse(match[0]);
    } catch (e: any) {
      this.logger.warn(`[SearchStack] JD extraction failed: ${e.message}`);
      return null;
    }
  }
}

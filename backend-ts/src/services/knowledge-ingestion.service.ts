import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { KnowledgeIngestionTask, KnowledgeIngestionSourceKind, KnowledgeIngestionStatus } from '../entities/knowledge-ingestion-task.entity';
import { News } from '../entities/news.entity';
import { EvidenceRagService, EvidenceSourceType } from './evidence-rag.service';
import { NewsCrawlService } from './news-crawl.service';
import { SearchStackService } from './search-stack.service';
import { KnowledgeCuratorAgentService } from './agents/knowledge-curator-agent.service';
import { KnowledgeInspectorAgentService } from './agents/knowledge-inspector-agent.service';

export interface KnowledgeUploadInput {
  title?: string;
  content: string;
  sourceName?: string;
  sourceUrl?: string;
  skillTags?: string[];
}

export interface KnowledgeUrlInput {
  url: string;
  title?: string;
  skillTags?: string[];
}

export interface KnowledgeNewsRefreshInput {
  keywords?: string[];
  limit?: number;
}

export interface KnowledgeNewsRefreshResult {
  stats: Record<string, any>;
  tasks: KnowledgeIngestionTask[];
  totalTasks: number;
  ingested: number;
  rejected: number;
  failed: number;
}

@Injectable()
export class KnowledgeIngestionService {
  private ensurePromise: Promise<void> | null = null;

  constructor(
    @InjectRepository(KnowledgeIngestionTask)
    private readonly taskRepo: Repository<KnowledgeIngestionTask>,
    @InjectRepository(News)
    private readonly newsRepo: Repository<News>,
    private readonly dataSource: DataSource,
    private readonly evidenceRag: EvidenceRagService,
    private readonly newsCrawl: NewsCrawlService,
    private readonly searchStack: SearchStackService,
    private readonly curator: KnowledgeCuratorAgentService,
    private readonly inspector: KnowledgeInspectorAgentService,
  ) {}

  async createUploadTask(userId: number, input: KnowledgeUploadInput): Promise<KnowledgeIngestionTask> {
    await this.ensureTable();
    const now = Date.now();
    const task = await this.taskRepo.save({
      taskId: this.createTaskId('upload'),
      userId,
      sourceKind: 'upload_text',
      ingestionStatus: 'pending',
      title: this.safeTitle(input.title || this.inferTitle(input.content) || '上传资料'),
      sourceName: input.sourceName || null,
      sourceUrl: input.sourceUrl || null,
      rawText: String(input.content || '').slice(0, 50000),
      cleanedText: null,
      summary: null,
      skillTags: this.normalizeTags(input.skillTags),
      chunkPreview: null,
      curatorResult: null,
      inspectionResult: null,
      ingestedChunkIds: null,
      failureReason: null,
      createTime: now,
      updateTime: now,
      status: 1,
    });
    return this.processTask(task.taskId, userId);
  }

  async createUrlTask(userId: number, input: KnowledgeUrlInput): Promise<KnowledgeIngestionTask> {
    await this.ensureTable();
    const fetched = await this.fetchUrl(input.url);
    const now = Date.now();
    const task: KnowledgeIngestionTask = await this.taskRepo.save({
      taskId: this.createTaskId('url'),
      userId,
      sourceKind: 'url',
      ingestionStatus: 'pending',
      title: this.safeTitle(input.title || fetched.title || input.url),
      sourceName: fetched.sourceName || this.hostLabel(input.url),
      sourceUrl: input.url,
      rawText: fetched.text || '',
      cleanedText: null,
      summary: null,
      skillTags: this.normalizeTags(input.skillTags),
      chunkPreview: null,
      curatorResult: null,
      inspectionResult: null,
      ingestedChunkIds: null,
      failureReason: fetched.text ? null : '网页正文抓取失败，请粘贴正文后重试。',
      createTime: now,
      updateTime: now,
      status: 1,
    });
    if (!fetched.text) {
      task.ingestionStatus = 'failed';
      task.updateTime = Date.now();
      return this.taskRepo.save(task);
    }
    return this.processTask(task.taskId, userId);
  }

  async refreshNews(userId: number, input: KnowledgeNewsRefreshInput = {}): Promise<KnowledgeNewsRefreshResult> {
    await this.ensureTable();
    const before = Date.now();
    const limit = Math.max(1, Math.min(8, Number(input.limit) || 5));
    const stats = await this.newsCrawl.crawl(input.keywords?.length ? input.keywords : undefined, Math.max(1, Math.ceil(limit / Math.max(1, input.keywords?.length || 3))));
    const newsItems = await this.newsRepo.find({
      where: { status: 1 },
      order: { createTime: 'DESC' },
      take: limit,
    });

    const tasks: KnowledgeIngestionTask[] = [];
    for (const item of newsItems.filter((n) => Number(n.createTime || 0) >= before - 60000).slice(0, limit)) {
      const existing = await this.taskRepo.findOne({ where: { userId, sourceKind: 'news_auto', sourceUrl: item.sourceUrl, status: 1 } as any });
      if (existing) continue;
      const task = await this.createNewsTask(userId, item, 'news_auto');
      tasks.push(task);
    }

    return {
      stats: stats as any,
      tasks,
      totalTasks: tasks.length,
      ingested: tasks.filter((t) => t.ingestionStatus === 'ingested').length,
      rejected: tasks.filter((t) => t.ingestionStatus === 'rejected').length,
      failed: tasks.filter((t) => t.ingestionStatus === 'failed').length,
    };
  }

  async createNewsTask(userId: number, news: News, sourceKind: KnowledgeIngestionSourceKind = 'news_manual'): Promise<KnowledgeIngestionTask> {
    await this.ensureTable();
    const text = [
      news.title,
      news.summary ? `摘要：${news.summary}` : '',
      news.content ? `正文：${news.content}` : '',
      news.source ? `来源：${news.source}` : '',
      news.sourceUrl ? `链接：${news.sourceUrl}` : '',
    ].filter(Boolean).join('\n');
    const now = Date.now();
    const task = await this.taskRepo.save({
      taskId: this.createTaskId('news'),
      userId,
      sourceKind,
      ingestionStatus: 'pending',
      title: this.safeTitle(news.title || '资讯资料'),
      sourceName: news.source || null,
      sourceUrl: news.sourceUrl || null,
      rawText: text.slice(0, 50000),
      cleanedText: null,
      summary: null,
      skillTags: this.normalizeTags(news.tags || []),
      chunkPreview: null,
      curatorResult: null,
      inspectionResult: null,
      ingestedChunkIds: null,
      failureReason: null,
      createTime: now,
      updateTime: now,
      status: 1,
    });
    return this.processTask(task.taskId, userId);
  }

  async processTask(taskId: string, userId?: number): Promise<KnowledgeIngestionTask> {
    await this.ensureTable();
    const task = await this.taskRepo.findOne({ where: userId ? { taskId, userId, status: 1 } : { taskId, status: 1 } as any });
    if (!task) throw new Error('入库任务不存在');

    try {
      task.ingestionStatus = 'cleaning';
      task.updateTime = Date.now();
      await this.taskRepo.save(task);

      const curated = await this.curator.clean({
        title: task.title,
        rawText: task.rawText || '',
        sourceName: task.sourceName || undefined,
        sourceUrl: task.sourceUrl || undefined,
        sourceKind: task.sourceKind,
        skillTags: task.skillTags || [],
      });
      task.title = this.safeTitle(curated.title || task.title);
      task.sourceName = curated.sourceName || task.sourceName || null;
      task.sourceUrl = curated.sourceUrl || task.sourceUrl || null;
      task.cleanedText = curated.cleanedText;
      task.summary = curated.summary;
      task.skillTags = curated.skillTags;
      task.chunkPreview = this.curator.buildChunkPreview(curated.cleanedText, curated.skillTags);
      task.curatorResult = curated as any;
      task.ingestionStatus = 'inspecting';
      task.updateTime = Date.now();
      await this.taskRepo.save(task);

      const inspection = await this.inspector.inspect(task.userId, {
        sourceKind: task.sourceKind,
        rawText: task.rawText || '',
        curated,
      });
      task.inspectionResult = inspection as any;
      task.ingestionStatus = inspection.passed ? 'approved' : 'rejected';
      task.failureReason = inspection.passed ? null : this.issueSummary(inspection.issues) || '质检未通过';
      task.updateTime = Date.now();
      await this.taskRepo.save(task);

      if (!inspection.passed) return task;
      return this.approveAndIngest(task);
    } catch (e: any) {
      task.ingestionStatus = 'failed';
      task.failureReason = e.message || '入库任务失败';
      task.updateTime = Date.now();
      return this.taskRepo.save(task);
    }
  }

  async approveAndIngest(task: KnowledgeIngestionTask): Promise<KnowledgeIngestionTask> {
    const sourceType = this.toEvidenceSourceType(task.sourceKind);
    const confidence = Math.max(0.55, Math.min(0.98, Number(task.inspectionResult?.score || 80) / 100));
    const content = [
      task.sourceName ? `来源：${task.sourceName}` : '',
      task.sourceUrl ? `链接：${task.sourceUrl}` : '',
      task.summary ? `摘要：${task.summary}` : '',
      task.cleanedText || '',
    ].filter(Boolean).join('\n');

    const chunks = await this.evidenceRag.ingest(task.userId, {
      sourceType,
      sourceId: `${sourceType}:${task.taskId}`,
      title: task.title,
      content,
      skillTags: task.skillTags || [],
      confidence,
      visibility: sourceType === 'news_article' || sourceType === 'domain_doc' ? 'school_aggregate' : 'private',
    });
    task.ingestionStatus = 'ingested';
    task.ingestedChunkIds = chunks.map((chunk) => Number(chunk.id));
    task.updateTime = Date.now();
    task.failureReason = null;
    return this.taskRepo.save(task);
  }

  async listTasks(userId: number, filters: { status?: string; limit?: number } = {}): Promise<KnowledgeIngestionTask[]> {
    await this.ensureTable();
    const where: any = { userId, status: 1 };
    if (filters.status) where.ingestionStatus = filters.status;
    return this.taskRepo.find({
      where,
      order: { createTime: 'DESC' },
      take: Math.max(1, Math.min(100, Number(filters.limit) || 20)),
    });
  }

  async getTask(userId: number, taskId: string): Promise<KnowledgeIngestionTask | null> {
    await this.ensureTable();
    return this.taskRepo.findOne({ where: { userId, taskId, status: 1 } });
  }

  private async fetchUrl(url: string): Promise<{ title: string; text: string; sourceName: string }> {
    const cleanUrl = String(url || '').trim();
    if (!/^https?:\/\//i.test(cleanUrl)) return { title: '', text: '', sourceName: '' };
    const fetched = await this.searchStack.fetch(cleanUrl, true).catch(() => null);
    if (fetched?.text) {
      return { title: fetched.title || cleanUrl, text: fetched.text.slice(0, 50000), sourceName: this.hostLabel(cleanUrl) };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(cleanUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 ZhiPathKnowledgeBot/1.0', Accept: 'text/html,text/plain,application/json,*/*' },
      });
      if (!res.ok) return { title: '', text: '', sourceName: this.hostLabel(cleanUrl) };
      const html = await res.text();
      const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || cleanUrl).replace(/\s+/g, ' ').trim();
      const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return { title, text: text.slice(0, 50000), sourceName: this.hostLabel(cleanUrl) };
    } catch {
      return { title: '', text: '', sourceName: this.hostLabel(cleanUrl) };
    } finally {
      clearTimeout(timer);
    }
  }

  private ensureTable(): Promise<void> {
    if (!this.ensurePromise) {
      this.ensurePromise = this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS knowledge_ingestion_tasks (
          id BIGINT NOT NULL AUTO_INCREMENT,
          status TINYINT NOT NULL DEFAULT 1,
          create_time BIGINT NULL,
          update_time BIGINT NULL,
          task_id VARCHAR(64) NOT NULL,
          user_id BIGINT NOT NULL,
          source_kind VARCHAR(30) NOT NULL,
          ingestion_status VARCHAR(30) NOT NULL DEFAULT 'pending',
          title VARCHAR(220) NOT NULL,
          source_url VARCHAR(1000) NULL,
          source_name VARCHAR(160) NULL,
          raw_text MEDIUMTEXT NULL,
          cleaned_text MEDIUMTEXT NULL,
          summary TEXT NULL,
          skill_tags JSON NULL,
          chunk_preview JSON NULL,
          curator_result JSON NULL,
          inspection_result JSON NULL,
          ingested_chunk_ids JSON NULL,
          failure_reason TEXT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uk_knowledge_ingestion_task_id (task_id),
          KEY idx_knowledge_ingestion_user_time (user_id, create_time),
          KEY idx_knowledge_ingestion_status (user_id, ingestion_status, create_time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `).then(() => undefined).catch((e: any) => {
        this.ensurePromise = null;
        throw e;
      });
    }
    return this.ensurePromise;
  }

  private toEvidenceSourceType(sourceKind: KnowledgeIngestionSourceKind): EvidenceSourceType {
    if (sourceKind.startsWith('news')) return 'news_article';
    if (sourceKind === 'url') return 'domain_doc';
    return 'knowledge_upload';
  }

  private createTaskId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private normalizeTags(tags?: string[] | null): string[] {
    return [...new Set((tags || []).map((tag) => String(tag || '').trim()).filter((tag) => tag.length >= 2 && tag.length <= 30))].slice(0, 12);
  }

  private safeTitle(title: string): string {
    return String(title || '知识库资料').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) || '知识库资料';
  }

  private inferTitle(content: string): string {
    return String(content || '').split(/\r?\n/).map((line) => line.trim()).find(Boolean)?.slice(0, 80) || '';
  }

  private hostLabel(url: string): string {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
  }

  private issueSummary(issues: Array<{ description?: string }> = []): string {
    return issues.map((issue) => issue.description).filter(Boolean).slice(0, 3).join('；');
  }
}

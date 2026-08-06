import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import OpenAI from 'openai';
import { EvidenceChunk } from '../entities/evidence-chunk.entity';
import { ChromaService } from './chroma.service';

export type EvidenceSourceType =
  | 'project'
  | 'file_qa'
  | 'evaluation'
  | 'learning_commit'
  | 'agent_output'
  | 'resume';

export interface IngestEvidenceInput {
  sourceType: EvidenceSourceType;
  sourceId: string;
  title: string;
  content: string;
  skillTags?: string[];
  jobTargetId?: number | null;
  confidence?: number;
  visibility?: 'private' | 'school_aggregate';
}

export interface EvidenceSearchItem {
  chunkId: number;
  sourceType: string;
  sourceId: string;
  title: string;
  snippet: string;
  skillTags: string[];
  score: number;
  confidence: number;
  createdAt: number;
  vectorStatus: string;
}

/** 证据类型可信度（方案 §6.5） */
const SOURCE_CONFIDENCE: Record<string, number> = {
  evaluation: 0.95,
  project: 0.85,
  learning_commit: 0.75,
  file_qa: 0.70,
  agent_output: 0.65,
  resume: 0.60,
};

/** 分块参数（方案 §6.4）：800-1200 中文字，重叠 100 字 */
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 100;

/**
 * Evidence RAG 服务 — 个人证据召回闭环（P0）
 *
 * 对齐《ZhiPath_Evidence_RAG_可落地评测方案》：
 *   - ingest：切 chunk → 去重 → 写 MySQL（可审计索引）→ 向量化写 Chroma
 *   - search：向量召回 + 规则过滤 + 重排；Chroma/embedding 不可用时
 *     MySQL LIKE + skillTags 关键词召回降级（方案 §11.3）
 *   - buildContext：生成可放进 LLM prompt 的短上下文
 *
 * 权限：所有检索强制按 userId 过滤（方案 §11.2）。
 */
@Injectable()
export class EvidenceRagService {
  private readonly logger = new Logger(EvidenceRagService.name);
  private embeddingClient: OpenAI | null = null;
  private embeddingModel = '';
  private embeddingProvider = 'off';
  private embeddingDimensions = 384;

  constructor(
    @InjectRepository(EvidenceChunk) private chunkRepo: Repository<EvidenceChunk>,
    private chroma: ChromaService,
    private config: ConfigService,
  ) {
    const provider = this.config.get('EMBEDDING_PROVIDER', 'off');
    const baseUrl = this.config.get('EMBEDDING_BASE_URL', '');
    const apiKey = this.config.get('EMBEDDING_API_KEY', 'embedding');
    this.embeddingProvider = String(provider || 'off').toLowerCase();
    this.embeddingModel = this.config.get('EMBEDDING_MODEL', 'nomic-embed-text');
    this.embeddingDimensions = Number(this.config.get('EMBEDDING_DIMENSIONS', 384));
    if (!['off', 'hash', 'local'].includes(this.embeddingProvider) && baseUrl) {
      this.embeddingClient = new OpenAI({ baseURL: baseUrl, apiKey, timeout: 10000 });
    }
  }

  // ── 入库 ──────────────────────────────────

  /**
   * 入库：切 chunk → 去重 → MySQL → Chroma（失败降级，不阻塞主流程）
   * @returns 生成的 chunk 列表
   */
  async ingest(userId: number, input: IngestEvidenceInput): Promise<EvidenceChunk[]> {
    const content = (input.content || '').trim();
    if (!content) return [];
    const chunks = this.splitChunks(content);
    const confidence = input.confidence ?? SOURCE_CONFIDENCE[input.sourceType] ?? 0.7;
    const saved: EvidenceChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const contentHash = createHash('md5').update(chunks[i]).digest('hex');
      // 去重：同用户 + 同来源 + 同 hash → 只更新 updatedAt
      const existing = await this.chunkRepo.findOne({
        where: {
          userId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          contentHash,
          status: 1,
        },
      });
      if (existing) {
        existing.updateTime = Date.now();
        await this.chunkRepo.save(existing);
        saved.push(existing);
        continue;
      }

      const chunk = await this.chunkRepo.save({
        userId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        chunkIndex: i,
        title: input.title,
        content: chunks[i],
        contentHash,
        skillTags: input.skillTags || [],
        jobTargetId: input.jobTargetId ?? null,
        confidence,
        visibility: input.visibility || 'private',
        vectorStatus: 'pending',
        createTime: Date.now(),
        updateTime: Date.now(),
        status: 1,
      });

      // 向量化 + 写 Chroma（失败标记 failed，不影响保存成功）
      const indexed = await this.indexVector(userId, chunk);
      chunk.vectorStatus = indexed ? 'indexed' : 'failed';
      await this.chunkRepo.save(chunk);
      saved.push(chunk);
    }

    return saved;
  }

  /** 向量化并写入 Chroma；embedding 不可用或写入失败返回 false */
  private async indexVector(userId: number, chunk: EvidenceChunk): Promise<boolean> {
    if (!this.chroma.enabled) return false;
    try {
      const text = `${chunk.title}\n${chunk.content}`;
      const embedding = await this.embed(text);
      if (!embedding) return false;
      return await this.chroma.upsert(userId, chunk.id, text, embedding, {
        chunkId: String(chunk.id),
        sourceType: chunk.sourceType,
        sourceId: chunk.sourceId,
        title: chunk.title,
        skillTags: (chunk.skillTags || []).join(','),
        jobTargetId: chunk.jobTargetId ? String(chunk.jobTargetId) : '',
        visibility: chunk.visibility,
        createdAt: String(chunk.createTime || Date.now()),
      });
    } catch (e) {
      this.logger.warn(`[EvidenceRag] indexVector failed: ${e.message}`);
      return false;
    }
  }

  // ── 检索 ──────────────────────────────────

  /**
   * 检索个人证据（向量召回 + 规则重排；降级关键词召回）
   */
  async search(
    userId: number,
    query: string,
    opts: { skill?: string; sourceType?: string; jobTargetId?: number; limit?: number } = {},
  ): Promise<EvidenceSearchItem[]> {
    const limit = Math.max(1, Math.min(10, opts.limit || 5));
    const queryText = (query || '').trim();

    // 1. 尝试向量召回（Chroma + embedding 均可用时）
    let vectorHits: Array<{ chunkId: number; score: number }> = [];
    if (this.embeddingProvider !== 'off' && this.chroma.enabled && queryText) {
      try {
        const embedding = await this.embed(queryText);
        if (embedding) {
          const hits = await this.chroma.query(userId, embedding, 12, opts.sourceType ? { sourceType: opts.sourceType } : undefined);
          vectorHits = hits
            .filter((h) => /^\d+$/.test(h.id))
            .map((h) => ({ chunkId: Number(h.id), score: h.score }));
        }
      } catch (e) {
        this.logger.warn(`[EvidenceRag] vector search failed, fallback to keyword: ${e.message}`);
      }
    }

    // 2. MySQL 取候选 chunk（向量命中 + 关键词兜底）
    const where: Record<string, any> = { userId, status: 1 };
    if (opts.sourceType) where.sourceType = opts.sourceType;
    const candidates = await this.chunkRepo.find({ where, order: { createTime: 'DESC' }, take: 500 });

    const vectorScoreMap = new Map(vectorHits.map((h) => [h.chunkId, h.score]));
    const vectorHitIds = new Set(vectorHits.map((h) => h.chunkId));
    const queryTokens = this.tokenize(queryText);
    const skill = (opts.skill || '').trim().toLowerCase();

    // 3. 打分重排（方案 §6.5：向量 50% + 技能 20% + 岗位 15% + 类型可信度 10% + 新鲜度 5%）
    const scored = candidates.map((c) => {
      const vectorScore = vectorScoreMap.get(c.id) ?? 0;
      // 关键词命中（降级路径的主要信号）
      const contentLower = c.content.toLowerCase();
      const titleLower = c.title.toLowerCase();
      const kwHits = queryTokens.filter((t) => contentLower.includes(t) || titleLower.includes(t)).length;
      const kwScore = queryTokens.length > 0 ? Math.min(1, kwHits / queryTokens.length) : 0;
      const skillHit = skill && (c.skillTags || []).some((t) => t.toLowerCase().includes(skill));
      const jobHit = opts.jobTargetId && c.jobTargetId === opts.jobTargetId ? 1 : 0;
      const typeScore = SOURCE_CONFIDENCE[c.sourceType] ?? 0.7;
      const freshness = c.createTime
        ? Math.max(0, 1 - (Date.now() - Number(c.createTime)) / (180 * 86400000))
        : 0.5;

      let score: number;
      if (vectorHits.length > 0) {
        score =
          0.5 * vectorScore +
          0.2 * (skillHit ? 1 : 0) +
          0.15 * jobHit +
          0.1 * typeScore +
          0.05 * freshness;
      } else {
        // 关键词降级：仅保留有一定命中或技能匹配的
        score =
          0.6 * kwScore +
          0.2 * (skillHit ? 1 : 0) +
          0.1 * jobHit +
          0.1 * typeScore;
        if (score <= 0.15 && !vectorHitIds.has(c.id)) return null;
      }
      return {
        chunkId: Number(c.id),
        sourceType: c.sourceType,
        sourceId: c.sourceId,
        title: c.title,
        snippet: this.snippet(c.content, queryText),
        skillTags: c.skillTags || [],
        score: Math.round(score * 100) / 100,
        confidence: Number(c.confidence),
        createdAt: Number(c.createTime || 0),
        vectorStatus: c.vectorStatus,
      };
    });

    return scored
      .filter((x): x is EvidenceSearchItem => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /** 生成可放进 LLM prompt 的短上下文 */
  buildContext(items: EvidenceSearchItem[], maxChars = 2000): string {
    if (!items.length) return '';
    let context = '';
    for (const item of items) {
      const block = `[证据#${item.chunkId} 类型:${item.sourceType} 标题:${item.title}]\n${item.snippet}\n`;
      if (context.length + block.length > maxChars) break;
      context += block + '\n';
    }
    return context.trim();
  }

  /** 从学生历史项目重建索引（补历史数据 / Chroma 丢失恢复） */
  async reindexFromProjects(userId: number, projects: Array<Record<string, any>>): Promise<number> {
    let count = 0;
    for (const p of projects || []) {
      const name = p.name || p.projectName || '';
      const content = [name, p.description || p.desc || '', ...(p.highlights || [])]
        .filter(Boolean)
        .join('\n');
      if (!content.trim()) continue;
      const saved = await this.ingest(userId, {
        sourceType: 'project',
        sourceId: `project:${name}`,
        title: `项目证据：${name}`,
        content,
        skillTags: p.tech || p.techStack || p.skills || [],
      });
      count += saved.length;
    }
    return count;
  }

  /** 证据索引状态汇总（供 Projects 页展示已索引/待索引/失败） */
  async getSummary(userId: number): Promise<{
    total: number;
    byStatus: Record<string, number>;
    bySource: Array<{ sourceId: string; sourceType: string; title: string; vectorStatus: string; chunkCount: number }>;
  }> {
    const chunks = await this.chunkRepo.find({ where: { userId, status: 1 }, order: { createTime: 'DESC' }, take: 1000 });
    const byStatus: Record<string, number> = { pending: 0, indexed: 0, failed: 0 };
    const bySourceMap = new Map<string, { sourceId: string; sourceType: string; title: string; vectorStatus: string; chunkCount: number }>();
    for (const c of chunks) {
      byStatus[c.vectorStatus] = (byStatus[c.vectorStatus] || 0) + 1;
      const cur = bySourceMap.get(c.sourceId) || {
        sourceId: c.sourceId,
        sourceType: c.sourceType,
        title: c.title,
        vectorStatus: c.vectorStatus,
        chunkCount: 0,
      };
      cur.chunkCount++;
      // 取最新状态（按 createTime DESC 遍历，首个即最新）
      if (!bySourceMap.has(c.sourceId)) {
        cur.vectorStatus = c.vectorStatus;
        bySourceMap.set(c.sourceId, cur);
      }
    }
    return {
      total: chunks.length,
      byStatus,
      bySource: [...bySourceMap.values()].slice(0, 200),
    };
  }

  // ── 工具方法 ──────────────────────────────

  /** 简单切分：800-1200 字，重叠 100 字 */
  splitChunks(content: string): string[] {
    const text = content.trim();
    if (text.length <= CHUNK_SIZE + CHUNK_OVERLAP) return [text];
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + CHUNK_SIZE, text.length);
      chunks.push(text.slice(start, end));
      if (end >= text.length) break;
      start = end - CHUNK_OVERLAP;
    }
    return chunks;
  }

  /** 检索摘要：优先定位 query 命中片段 */
  private snippet(content: string, query: string): string {
    const q = query.trim();
    const idx = q && content.toLowerCase().includes(q.toLowerCase())
      ? content.toLowerCase().indexOf(q.toLowerCase())
      : -1;
    const start = idx > 120 ? idx - 60 : 0;
    return content.slice(start, start + 180) + (content.length > start + 180 ? '…' : '');
  }

  private tokenize(text: string): string[] {
    if (!text) return [];
    // 中文按 2-gram 切分 + 英文单词
    const tokens: string[] = [];
    const cjk = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];
    for (const seg of cjk) {
      for (let i = 0; i < seg.length - 1; i++) tokens.push(seg.slice(i, i + 2));
    }
    tokens.push(...(text.match(/[a-zA-Z0-9_+#.-]{2,}/g) || []).map((t) => t.toLowerCase()));
    return [...new Set(tokens)];
  }

  private async embed(text: string): Promise<number[] | null> {
    if (['hash', 'local'].includes(this.embeddingProvider)) {
      return this.hashEmbedding(text);
    }
    if (!this.embeddingClient) return null;
    const res = await this.embeddingClient.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });
    return res.data?.[0]?.embedding || null;
  }

  /**
   * Local deterministic embedding used when no embedding model is available.
   * It is lexical, not model-semantic, but it lets Chroma handle vector indexing,
   * filtering and ranking without blocking the Evidence RAG workflow.
   */
  private hashEmbedding(text: string): number[] {
    const dim = Math.max(64, Math.min(2048, this.embeddingDimensions || 384));
    const vector = new Array(dim).fill(0);
    const tokens = this.tokenize(text);
    const source = tokens.length ? tokens : [text.toLowerCase().slice(0, 64)];
    for (const token of source) {
      const hash = createHash('md5').update(token).digest();
      const index = hash.readUInt32BE(0) % dim;
      const sign = hash[4] % 2 === 0 ? 1 : -1;
      vector[index] += sign;
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => Math.round((value / norm) * 1_000_000) / 1_000_000);
  }
}

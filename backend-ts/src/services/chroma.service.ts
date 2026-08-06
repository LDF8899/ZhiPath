import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChromaQueryResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
}

/**
 * Chroma 向量库客户端 — Evidence RAG P0
 *
 * 职责：
 *   - upsert：写入向量
 *   - query：向量召回
 *   - deleteBySource：按来源删除（后续用于重建/删除索引）
 *
 * 降级策略（方案 §11.3）：
 *   - CHROMA_URL 未配置或请求失败 → 全部方法静默返回空/失败标记，
 *     由 EvidenceRagService 走 MySQL 关键词召回，不阻塞主流程。
 */
@Injectable()
export class ChromaService {
  private readonly logger = new Logger(ChromaService.name);
  private readonly baseUrl: string;
  private readonly collectionName: string;
  private readonly timeoutMs: number;
  private collectionIdPromise: Promise<string | null> | null = null;

  constructor(private config: ConfigService) {
    this.baseUrl = (this.config.get('CHROMA_URL', '') || '').replace(/\/+$/, '');
    this.collectionName = this.config.get('CHROMA_COLLECTION', 'zhipath_user_evidence');
    this.timeoutMs = Number(this.config.get('CHROMA_TIMEOUT_MS', 3000));
  }

  get enabled(): boolean {
    return Boolean(this.baseUrl);
  }

  /** 写入向量（embedding 由调用方传入） */
  async upsert(
    userId: number,
    chunkId: number,
    text: string,
    embedding: number[],
    metadata: Record<string, any>,
  ): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const collectionId = await this.getCollectionId();
      if (!collectionId) return false;
      const res = await fetch(`${this.baseUrl}/api/v1/collections/${collectionId}/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          ids: [String(chunkId)],
          embeddings: [embedding],
          documents: [text],
          metadatas: [{ ...metadata, userId: String(userId) }],
        }),
      });
      if (!res.ok) {
        this.logger.warn(`[Chroma] upsert failed: ${res.status} ${res.statusText}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(`[Chroma] upsert error: ${e.message}`);
      return false;
    }
  }

  /** 向量召回 topK */
  async query(
    userId: number,
    embedding: number[],
    topK: number,
    where?: Record<string, any>,
  ): Promise<ChromaQueryResult[]> {
    if (!this.enabled) return [];
    try {
      const collectionId = await this.getCollectionId();
      if (!collectionId) return [];
      const filter: Record<string, any> = { userId: String(userId) };
      if (where?.sourceType) filter.sourceType = where.sourceType;
      const res = await fetch(`${this.baseUrl}/api/v1/collections/${collectionId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          query_embeddings: [embedding],
          n_results: topK,
          where: filter,
        }),
      });
      if (!res.ok) {
        this.logger.warn(`[Chroma] query failed: ${res.status} ${res.statusText}`);
        return [];
      }
      const data = await res.json();
      const ids: string[] = data.ids?.[0] || [];
      const distances: number[] = data.distances?.[0] || [];
      const metadatas: Record<string, any>[] = data.metadatas?.[0] || [];
      return ids.map((id, i) => {
        const distance = Number(distances[i] ?? 1);
        return {
          id,
          score: distance <= 0 ? 1 : Math.max(0, Math.min(1, 1 / (1 + distance))),
          metadata: metadatas[i] || {},
        };
      });
    } catch (e) {
      this.logger.warn(`[Chroma] query error: ${e.message}`);
      return [];
    }
  }

  /** 按来源删除向量（重建/删除索引用） */
  async deleteBySource(userId: number, sourceId: string): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const collectionId = await this.getCollectionId();
      if (!collectionId) return false;
      const res = await fetch(`${this.baseUrl}/api/v1/collections/${collectionId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          where: { $and: [{ userId: String(userId) }, { sourceId }] },
        }),
      });
      return res.ok;
    } catch (e) {
      this.logger.warn(`[Chroma] deleteBySource error: ${e.message}`);
      return false;
    }
  }

  private async getCollectionId(): Promise<string | null> {
    if (!this.enabled) return null;
    if (!this.collectionIdPromise) {
      this.collectionIdPromise = this.resolveCollectionId();
    }
    return this.collectionIdPromise;
  }

  private async resolveCollectionId(): Promise<string | null> {
    const existing = await this.fetchCollectionByName();
    if (existing?.id) return existing.id;
    const created = await this.createCollection();
    return created?.id || null;
  }

  private async fetchCollectionByName(): Promise<{ id: string } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/collections/${encodeURIComponent(this.collectionName)}`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        this.logger.warn(`[Chroma] get collection failed: ${res.status} ${res.statusText}`);
        return null;
      }
      return (await res.json()) as { id: string };
    } catch (e) {
      this.logger.warn(`[Chroma] get collection error: ${e.message}`);
      return null;
    }
  }

  private async createCollection(): Promise<{ id: string } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          name: this.collectionName,
          metadata: { description: 'ZhiPath user evidence chunks' },
        }),
      });
      if (!res.ok) {
        this.logger.warn(`[Chroma] create collection failed: ${res.status} ${res.statusText}`);
        return this.fetchCollectionByName();
      }
      return (await res.json()) as { id: string };
    } catch (e) {
      this.logger.warn(`[Chroma] create collection error: ${e.message}`);
      return null;
    }
  }
}

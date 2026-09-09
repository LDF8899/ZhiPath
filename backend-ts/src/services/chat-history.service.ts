import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { REDIS_CLIENT } from '../database/redis.module';
import Redis from 'ioredis';

/**
 * 对话历史服务 — 对齐 Python services/chat_history.py
 *
 * Redis 热缓存（最近20条，TTL 24h）+ MongoDB 冷存储（全量持久化）
 */
@Injectable()
export class ChatHistoryService implements OnModuleInit {
  private readonly REDIS_TTL = 86400;       // 24小时
  private readonly REDIS_MAX_MESSAGES = 20; // Redis 中保留的最近消息数

  constructor(
    @Inject(REDIS_CLIENT) private redis: Redis,
    @InjectConnection() private mongoConnection: Connection,
  ) {}

  /** 获取 MongoDB Db 实例 */
  getDb() {
    if (!this.mongoConnection.db) {
      throw new Error('MongoDB connection not established');
    }
    return this.mongoConnection.db;
  }

  private redisKey(userId: number, sessionId: string, tenantId = 1): string {
    return `chat:${tenantId}:${userId}:${sessionId}`;
  }

  private mongoFilter(userId: number, sessionId: string, tenantId = 1) {
    return { tenantId, user_id: String(userId), session_id: sessionId };
  }

  private get chatCollection() {
    return this.mongoConnection.db!.collection('chat_sessions');
  }

  async onModuleInit() {
    await this.chatCollection.createIndexes([
      { key: { tenantId: 1, user_id: 1, session_id: 1 }, unique: true, name: 'uq_chat_tenant_user_session' },
      { key: { tenantId: 1, user_id: 1, updated_at: -1 }, name: 'idx_chat_tenant_user_updated' },
    ]).catch((error) => console.warn('[ChatHistoryService] index initialization failed:', error.message));
  }

  /** 获取对话历史 — Redis 优先，回退 MongoDB */
  async getHistory(userId: number, sessionId: string, tenantId = 1): Promise<any[]> {
    // 1. 尝试 Redis
    try {
      const raw = await this.redis.get(this.redisKey(userId, sessionId, tenantId));
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('[ChatHistory] Redis read failed:', e.message);
    }

    // 2. 回退 MongoDB
    try {
      const doc = await this.chatCollection.findOne({
        ...this.mongoFilter(userId, sessionId, tenantId),
      });
      if (doc?.messages) {
        // 回填 Redis
        const recent = doc.messages.slice(-this.REDIS_MAX_MESSAGES);
        await this.saveToRedis(userId, sessionId, recent, tenantId);
        return doc.messages;
      }
    } catch (e) {
      console.warn('[ChatHistory] MongoDB read failed:', e.message);
    }

    return [];
  }

  /** 分页读取会话摘要；控制器不再直接访问 Mongo collection。 */
  async listSessions(userId: number, tenantId = 1, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const filter = { user_id: String(userId), tenantId };
    const [items, total] = await Promise.all([
      this.chatCollection.find(filter).sort({ updated_at: -1, created_at: -1 }).skip((safePage - 1) * safeSize).limit(safeSize).toArray(),
      this.chatCollection.countDocuments(filter),
    ]);
    return {
      items: items.map((item: any) => ({ ...item, _id: item._id?.toString() })),
      pageInfo: { page: safePage, pageSize: safeSize, total, hasNextPage: safePage * safeSize < total },
    };
  }

  async getSession(userId: number, sessionId: string, tenantId = 1) {
    const item = await this.chatCollection.findOne(this.mongoFilter(userId, sessionId, tenantId));
    return item ? { ...item, _id: item._id?.toString() } : null;
  }

  async deleteSession(userId: number, sessionId: string, tenantId = 1) {
    const result = await this.chatCollection.deleteOne(this.mongoFilter(userId, sessionId, tenantId));
    await this.clearSession(userId, sessionId, tenantId);
    return result.deletedCount || 0;
  }

  /** 保存一条消息到 Redis + MongoDB */
  async saveMessage(
    userId: number,
    sessionId: string,
    role: string,
    content: string,
    meta: { agent?: string; pageContext?: string; actions?: any[] } = {},
    tenantId = 1,
    clientApp = 'legacy',
  ) {
    const now = Date.now();
    const messageId = `${role}-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const message = {
      id: messageId,
      message_id: messageId,
      role,
      content,
      agent: meta.agent || '',
      timestamp: now,
      ...(meta.actions !== undefined ? { actions: meta.actions } : {}),
    };

    // 1. 追加到 Redis
    try {
      const key = this.redisKey(userId, sessionId, tenantId);
      const raw = await this.redis.get(key);
      const messages = raw ? JSON.parse(raw) : [];
      messages.push(message);
      const toStore = messages.slice(-this.REDIS_MAX_MESSAGES);
      await this.redis.setex(key, this.REDIS_TTL, JSON.stringify(toStore));
    } catch (e) {
      console.warn('[ChatHistory] Redis write failed:', e.message);
    }

    // 2. 持久化到 MongoDB
    try {
      await this.chatCollection.updateOne(
        this.mongoFilter(userId, sessionId, tenantId),
        {
          $push: { messages: message } as any,
          $set: {
            schemaVersion: 1,
            tenantId,
            clientApp,
            updated_at: now,
            last_message: this.compactMessage(content),
            last_role: role,
            ...(role === 'assistant' && meta.agent ? { last_agent: meta.agent } : {}),
          },
          $inc: { message_count: 1 },
          $setOnInsert: {
            created_at: now,
            title: this.buildTitle(content),
            page_context: meta.pageContext || '',
          },
        },
        { upsert: true },
      );
    } catch (e) {
      console.warn('[ChatHistory] MongoDB write failed:', e.message);
    }

    return message;
  }

  /** 清除会话的 Redis 缓存 */
  async clearSession(userId: number, sessionId: string, tenantId = 1) {
    try {
      await this.redis.del(this.redisKey(userId, sessionId, tenantId));
    } catch (e) {
      console.warn('[ChatHistory] Redis delete failed:', e.message);
    }
  }

  /** 将消息列表写入 Redis */
  private async saveToRedis(userId: number, sessionId: string, messages: any[], tenantId = 1) {
    try {
      const key = this.redisKey(userId, sessionId, tenantId);
      await this.redis.setex(key, this.REDIS_TTL, JSON.stringify(messages));
    } catch (e) {
      console.warn('[ChatHistory] Redis write failed:', e.message);
    }
  }

  private buildTitle(content: string): string {
    const text = this.compactMessage(content, 36);
    return text || '新的对话';
  }

  private compactMessage(content: string, maxLen = 80): string {
    const text = String(content || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLen) return text;
    return `${text.slice(0, maxLen)}...`;
  }
}

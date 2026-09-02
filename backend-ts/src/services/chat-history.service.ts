import { Injectable, Inject } from '@nestjs/common';
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
export class ChatHistoryService {
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

  private redisKey(userId: number, sessionId: string): string {
    return `chat:${userId}:${sessionId}`;
  }

  private get chatCollection() {
    return this.mongoConnection.db!.collection('chat_sessions');
  }

  /** 获取对话历史 — Redis 优先，回退 MongoDB */
  async getHistory(userId: number, sessionId: string): Promise<any[]> {
    // 1. 尝试 Redis
    try {
      const raw = await this.redis.get(this.redisKey(userId, sessionId));
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('[ChatHistory] Redis read failed:', e.message);
    }

    // 2. 回退 MongoDB
    try {
      const doc = await this.chatCollection.findOne({
        user_id: String(userId),
        session_id: sessionId,
      });
      if (doc?.messages) {
        // 回填 Redis
        const recent = doc.messages.slice(-this.REDIS_MAX_MESSAGES);
        await this.saveToRedis(userId, sessionId, recent);
        return doc.messages;
      }
    } catch (e) {
      console.warn('[ChatHistory] MongoDB read failed:', e.message);
    }

    return [];
  }

  /** 保存一条消息到 Redis + MongoDB */
  async saveMessage(
    userId: number,
    sessionId: string,
    role: string,
    content: string,
    meta: { agent?: string; pageContext?: string; actions?: any[] } = {},
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
      const key = this.redisKey(userId, sessionId);
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
        { user_id: String(userId), session_id: sessionId },
        {
          $push: { messages: message } as any,
          $set: {
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
  async clearSession(userId: number, sessionId: string) {
    try {
      await this.redis.del(this.redisKey(userId, sessionId));
    } catch (e) {
      console.warn('[ChatHistory] Redis delete failed:', e.message);
    }
  }

  /** 将消息列表写入 Redis */
  private async saveToRedis(userId: number, sessionId: string, messages: any[]) {
    try {
      const key = this.redisKey(userId, sessionId);
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

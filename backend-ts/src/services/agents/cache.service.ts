import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * 智能体缓存服务
 *
 * 功能：
 * 1. 缓存智能体生成结果，避免重复调用 LLM
 * 2. 支持 TTL 过期
 * 3. 支持按类型+参数哈希缓存
 *
 * 场景：相同输入的讲义/考试/路径生成直接返回缓存
 */

interface CacheOptions {
  ttl?: number;           // 过期时间（秒），默认 1 小时
  prefix?: string;        // 缓存前缀
}

@Injectable()
export class AgentCacheService {
  private redis: Redis | null = null;
  private memoryCache = new Map<string, { data: any; expires: number }>();

  constructor() {
    // 尝试连接 Redis，失败则使用内存缓存
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // 不重试
        lazyConnect: true,
      });

      this.redis.connect().catch(() => {
        console.warn('[AgentCache] Redis 连接失败，使用内存缓存');
        this.redis = null;
      });
    } catch {
      console.warn('[AgentCache] Redis 初始化失败，使用内存缓存');
      this.redis = null;
    }
  }

  /**
   * 获取缓存
   * @param key 缓存键
   * @returns 缓存值或 null
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // 优先 Redis
      if (this.redis) {
        const data = await this.redis.get(key);
        if (data) return JSON.parse(data);
      }

      // 降级到内存缓存
      const cached = this.memoryCache.get(key);
      if (cached && cached.expires > Date.now()) {
        return cached.data as T;
      }

      // 过期清理
      if (cached && cached.expires <= Date.now()) {
        this.memoryCache.delete(key);
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * 设置缓存
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 过期时间（秒）
   */
  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      const data = JSON.stringify(value);

      // 优先 Redis
      if (this.redis) {
        await this.redis.setex(key, ttl, data);
      }

      // 同时写入内存缓存（降级备用）
      this.memoryCache.set(key, {
        data: value,
        expires: Date.now() + ttl * 1000,
      });

      // 清理过期内存缓存（保留最近 1000 条）
      if (this.memoryCache.size > 1000) {
        const now = Date.now();
        for (const [k, v] of this.memoryCache.entries()) {
          if (v.expires <= now) this.memoryCache.delete(k);
        }
      }
    } catch (e) {
      console.warn('[AgentCache] 写入缓存失败:', e.message);
    }
  }

  /**
   * 删除缓存
   * @param key 缓存键
   */
  async del(key: string): Promise<void> {
    try {
      if (this.redis) await this.redis.del(key);
      this.memoryCache.delete(key);
    } catch (e: any) {
      console.warn('[Cache] del failed:', e.message);
    }
  }

  /**
   * 按模式删除缓存
   * @param pattern 模式（如 "agent:lecture:*"）
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      if (this.redis) {
        const keys = await this.redis.keys(pattern);
        if (keys.length) await this.redis.del(...keys);
      }

      // 内存缓存按前缀清理
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(pattern.replace('*', ''))) {
          this.memoryCache.delete(key);
        }
      }
    } catch (e: any) {
      console.warn('[Cache] delPattern failed:', e.message);
    }
  }

  /**
   * 生成缓存键
   * @param agent 智能体名称
   * @param action 动作
   * @param params 参数（会被哈希）
   */
  generateKey(agent: string, action: string, params: Record<string, any>): string {
    const paramsHash = this.hashParams(params);
    return `agent:${agent}:${action}:${paramsHash}`;
  }

  /**
   * 参数哈希（简单实现）
   */
  private hashParams(params: Record<string, any>): string {
    const str = JSON.stringify(params, Object.keys(params).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为 32 位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 带缓存的执行
   * @param agent 智能体名称
   * @param action 动作
   * @param params 参数
   * @param fn 执行函数
   * @param ttl 缓存时间（秒）
   */
  async wrap<T>(
    agent: string,
    action: string,
    params: Record<string, any>,
    fn: () => Promise<T>,
    ttl: number = 3600,
  ): Promise<T> {
    const key = this.generateKey(agent, action, params);

    // 尝试获取缓存
    const cached = await this.get<T>(key);
    if (cached) {
      console.log(`[AgentCache] 命中缓存: ${agent}.${action}`);
      return cached;
    }

    // 执行函数
    const result = await fn();

    // 写入缓存
    await this.set(key, result, ttl);

    return result;
  }
}

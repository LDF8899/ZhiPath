import { Injectable, Inject } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../database/redis.module';

/**
 * 用户画像服务 — 对齐 Python services/user_profile.py
 *
 * MongoDB user_profiles 集合
 * 支持增量 merge（不覆盖已有数据）和版本号管理
 * Redis 活跃用户标记（供定时任务扫描）
 */
@Injectable()
export class ProfileService {
  private readonly ACTIVE_USERS_KEY = 'active_users';
  private readonly ACTIVE_USER_TTL = 86400; // 24h

  constructor(
    @InjectConnection() private mongoConnection: Connection,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  private get collection() {
    return this.mongoConnection.db!.collection('user_profiles');
  }

  /** 获取完整用户画像 */
  async getProfile(userId: number): Promise<any | null> {
    const doc = await this.collection.findOne({ user_id: String(userId) });
    if (doc) {
      (doc as any)._id = doc._id?.toString();
    }
    return doc || null;
  }

  /** 轻量查询：只返回画像版本号 */
  async getProfileVersion(userId: number): Promise<number> {
    const doc = await this.collection.findOne(
      { user_id: String(userId) },
      { projection: { version: 1 } },
    );
    return doc?.version || 0;
  }

  /** 保存/完整更新用户画像 */
  async saveProfile(userId: number, profileData: Record<string, any>) {
    const now = Date.now();
    await this.collection.updateOne(
      { user_id: String(userId) },
      {
        $set: { profile_data: profileData, updated_at: now },
        $setOnInsert: { created_at: now, version: 1 },
      },
      { upsert: true },
    );
  }

  /** 增量 merge 画像数据（不覆盖已有数据） */
  async mergeProfileDelta(userId: number, delta: Record<string, any>, source = 'unknown') {
    const now = Date.now();
    const filter = { user_id: String(userId) };

    // 确保文档存在
    await this.collection.updateOne(
      filter,
      { $setOnInsert: { created_at: now, version: 0 } },
      { upsert: true },
    );

    // 追加技能（去重）
    if (delta.skills_to_add?.length) {
      const existing = await this.collection.findOne(filter, { projection: { skills: 1 } });
      const existingNames = new Set((existing?.skills || []).map((s: any) => s.name));
      const newSkills = delta.skills_to_add
        .filter((s: any) => !existingNames.has(s.name))
        .map((s: any) => ({
          name: s.name,
          level: s.level || '入门',
          source,
          updated_at: now,
        }));
      if (newSkills.length) {
        await this.collection.updateOne(filter, { $push: { skills: { $each: newSkills } } as any });
      }
    }

    // 追加聊天洞察
    if (delta.chat_insights_to_add?.length) {
      const insights = delta.chat_insights_to_add.map((c: string) => ({
        content: c,
        source,
        extracted_at: now,
      }));
      await this.collection.updateOne(filter, { $push: { chat_insights: { $each: insights } } as any });
    }

    // 追加兴趣
    if (delta.interests_to_add?.length) {
      await this.collection.updateOne(filter, {
        $addToSet: { 'traits.interests': { $each: delta.interests_to_add } } as any,
      });
    }

    // 追加强项
    if (delta.strengths_to_add?.length) {
      await this.collection.updateOne(filter, {
        $addToSet: { 'traits.strengths': { $each: delta.strengths_to_add } } as any,
      });
    }

    // 追加弱项
    if (delta.weaknesses_to_add?.length) {
      await this.collection.updateOne(filter, {
        $addToSet: { 'traits.weaknesses': { $each: delta.weaknesses_to_add } } as any,
      });
    }

    // 更新目标（覆盖写）
    if (delta.goals_to_update) {
      const goalsUpdate: Record<string, any> = {};
      for (const [k, v] of Object.entries(delta.goals_to_update)) {
        goalsUpdate[`goals.${k}`] = v;
      }
      await this.collection.updateOne(filter, { $set: goalsUpdate });
    }

    // 更新基础信息（覆盖写）
    if (delta.basic_to_update) {
      const basicUpdate: Record<string, any> = {};
      for (const [k, v] of Object.entries(delta.basic_to_update)) {
        basicUpdate[`basic.${k}`] = v;
      }
      await this.collection.updateOne(filter, { $set: basicUpdate });
    }

    // 版本号 +1
    await this.collection.updateOne(filter, {
      $inc: { version: 1 },
      $set: { updated_at: now },
    });
  }

  /** 更新目标岗位 */
  async updateTargetJob(userId: number, jobId: number, jobTitle: string) {
    const now = Date.now();
    await this.collection.updateOne(
      { user_id: String(userId) },
      {
        $set: {
          'goals.target_job_id': jobId,
          'goals.target_job_title': jobTitle,
          updated_at: now,
        },
        $setOnInsert: { created_at: now, version: 1 },
      },
      { upsert: true },
    );
  }

  /** 追加学习历史记录 */
  async addLearningHistory(userId: number, record: Record<string, any>) {
    const now = Date.now();
    record.timestamp = now;
    await this.collection.updateOne(
      { user_id: String(userId) },
      {
        $push: { learning_history: record } as any,
        $set: { updated_at: now },
        $setOnInsert: { created_at: now, version: 1 },
      },
      { upsert: true },
    );
  }

  /** 从 MySQL 同步基础信息到 MongoDB 画像 */
  async syncBasicFromMySQL(userId: number, basic: Record<string, any>) {
    const now = Date.now();
    await this.collection.updateOne(
      { user_id: String(userId) },
      {
        $set: { basic, updated_at: now },
        $setOnInsert: { created_at: now, version: 1 },
      },
      { upsert: true },
    );
  }

  /** 标记用户有新消息（Redis Set） — 对齐 Python mark_user_active() */
  async markUserActive(userId: number) {
    try {
      await this.redis.sadd(this.ACTIVE_USERS_KEY, String(userId));
    } catch (e) {
      console.warn('[ProfileService] markUserActive failed:', e.message);
    }
  }

  /** 获取所有有新消息的用户 ID — 对齐 Python get_active_user_ids() */
  async getActiveUserIds(): Promise<string[]> {
    try {
      return await this.redis.smembers(this.ACTIVE_USERS_KEY);
    } catch (e) {
      console.warn('[ProfileService] getActiveUserIds failed:', e.message);
      return [];
    }
  }

  /** 清除已处理的活跃用户标记 — 对齐 Python clear_active_users() */
  async clearActiveUsers(userIds: string[]) {
    if (!userIds.length) return;
    try {
      await this.redis.srem(this.ACTIVE_USERS_KEY, ...userIds);
    } catch (e) {
      console.warn('[ProfileService] clearActiveUsers failed:', e.message);
    }
  }

  /** 完整替换用户技能列表 */
  async updateSkills(userId: number, skills: Array<Record<string, any>>) {
    const now = Date.now();
    for (const s of skills) {
      if (!s.source) s.source = 'manual';
      if (!s.updated_at) s.updated_at = now;
    }
    await this.collection.updateOne(
      { user_id: String(userId) },
      {
        $set: { skills, updated_at: now },
        $setOnInsert: { created_at: now, version: 1 },
      },
      { upsert: true },
    );
  }
}

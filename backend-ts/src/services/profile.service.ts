import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../database/redis.module';
import { Student } from '../entities/student.entity';

/**
 * 用户画像服务 — 对齐 Python services/user_profile.py
 *
 * MongoDB user_profiles 集合
 * 支持增量 merge（不覆盖已有数据）和版本号管理
 * Redis 活跃用户标记（供定时任务扫描）
 */
@Injectable()
export class ProfileService implements OnModuleInit {
  private readonly ACTIVE_USERS_KEY = 'active_users';
  private readonly ACTIVE_USER_TTL = 86400; // 24h

  constructor(
    @InjectConnection() private mongoConnection: Connection,
    @Inject(REDIS_CLIENT) private redis: Redis,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
  ) {}

  private get collection() {
    return this.mongoConnection.db!.collection('user_profiles');
  }

  private filter(userId: number, tenantId = 1) { return { user_id: String(userId), tenantId }; }

  async onModuleInit() {
    await this.collection.createIndexes([
      { key: { tenantId: 1, user_id: 1 }, unique: true, name: 'uq_user_profiles_tenant_user' },
      { key: { tenantId: 1, updated_at: -1 }, name: 'idx_user_profiles_tenant_updated' },
    ]).catch((error) => console.warn('[ProfileService] index initialization failed:', error.message));
  }

  /** 获取完整用户画像 */
  async getProfile(userId: number, tenantId = 1): Promise<any | null> {
    // MySQL is the authoritative source for structured profile fields. Mongo
    // is only a compatibility/read model for extended traits and chat memory.
    const [student, doc] = await Promise.all([
      this.studentRepo.findOne({ where: { userId, tenantId, status: 1 } }),
      this.collection.findOne(this.filter(userId, tenantId)),
    ]);
    if (!doc && !student) return null;
    const result: any = doc ? { ...doc, _id: doc._id?.toString() } : { user_id: String(userId), tenantId };
    const meta = student?.profileMeta || {};
    result.skills = student?.skills ?? result.skills ?? [];
    result.projects = student?.projects ?? result.projects ?? [];
    result.basic = {
      ...(result.basic || {}),
      ...(student ? {
        name: student.name || '', school: student.school || '', major: student.major || '',
        grade: student.grade || '', dailyHours: student.dailyHours || null,
      } : {}),
    };
    result.traits = result.traits || meta.traits || {};
    result.goals = result.goals || meta.goals || {};
    result.chat_insights = result.chat_insights || meta.chat_insights || [];
    result.version = Math.max(Number(result.version || 0), Number(student?.updateTime || 0));
    return result;
  }

  /** 轻量查询：只返回画像版本号 */
  async getProfileVersion(userId: number, tenantId = 1): Promise<number> {
    const doc = await this.collection.findOne(
      this.filter(userId, tenantId),
      { projection: { version: 1 } },
    );
    return doc?.version || 0;
  }

  /** 保存/完整更新用户画像 */
  async saveProfile(userId: number, profileData: Record<string, any>, tenantId = 1, clientApp = 'legacy') {
    const now = Date.now();
    // Commit structured fields first. A Mongo outage must not lose the
    // profile update or make the API report a false failure.
    await this.syncStudentCore(userId, profileData, tenantId);
    try {
      await this.collection.updateOne(
        this.filter(userId, tenantId),
        {
          $set: { profile_data: profileData, updated_at: now, schemaVersion: 1, tenantId, clientApp },
          $setOnInsert: { created_at: now, version: 1 },
        },
        { upsert: true },
      );
    } catch (error: any) {
      console.warn('[ProfileService] Mongo compatibility write failed after MySQL commit:', error.message);
    }
  }

  /** 增量 merge 画像数据（不覆盖已有数据） */
  async mergeProfileDelta(userId: number, delta: Record<string, any>, source = 'unknown', tenantId = 1, clientApp = 'legacy') {
    const now = Date.now();
    const filter = this.filter(userId, tenantId);

    // 确保文档存在
    await this.collection.updateOne(
      filter,
      { $setOnInsert: { created_at: now, version: 0, schemaVersion: 1, tenantId, clientApp } },
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

    const student = await this.studentRepo.findOne({ where: { userId, tenantId, status: 1 } });
    if (student) {
      const current = student.profileMeta || {};
      const next: Record<string, any> = { ...current };
      if (delta.goals_to_update) next.goals = { ...(current.goals || {}), ...delta.goals_to_update };
      if (delta.basic_to_update) next.basic = { ...(current.basic || {}), ...delta.basic_to_update };
      if (delta.chat_insights_to_add?.length) next.chat_insights = [...(current.chat_insights || []), ...delta.chat_insights_to_add];
      if (delta.interests_to_add?.length) next.interests = Array.from(new Set([...(current.interests || []), ...delta.interests_to_add]));
      if (delta.strengths_to_add?.length) next.strengths = Array.from(new Set([...(current.strengths || []), ...delta.strengths_to_add]));
      if (delta.weaknesses_to_add?.length) next.weaknesses = Array.from(new Set([...(current.weaknesses || []), ...delta.weaknesses_to_add]));
      await this.studentRepo.update(student.id, { profileMeta: next, updateTime: now });
    }
  }

  /** 更新目标岗位 */
  async updateTargetJob(userId: number, jobId: number, jobTitle: string, tenantId = 1, clientApp = 'legacy') {
    const now = Date.now();
    await this.collection.updateOne(
      this.filter(userId, tenantId),
      {
        $set: {
          'goals.target_job_id': jobId,
          'goals.target_job_title': jobTitle,
          updated_at: now, schemaVersion: 1, tenantId, clientApp,
        },
        $setOnInsert: { created_at: now, version: 1 },
      },
      { upsert: true },
    );
    await this.studentRepo.update({ userId, tenantId, status: 1 }, { targetJobId: jobId, updateTime: now });
  }

  /** 追加学习历史记录 */
  async addLearningHistory(userId: number, record: Record<string, any>, tenantId = 1, clientApp = 'legacy') {
    const now = Date.now();
    record.timestamp = now;
    await this.collection.updateOne(
      this.filter(userId, tenantId),
      {
        $push: { learning_history: record } as any,
        $set: { updated_at: now, schemaVersion: 1, tenantId, clientApp },
        $setOnInsert: { created_at: now, version: 1 },
      },
      { upsert: true },
    );
  }

  /** 从 MySQL 同步基础信息到 MongoDB 画像 */
  /** Add a project evidence entry to the Mongo profile for match scoring and long-term memory. */
  async addProjectEvidence(userId: number, project: Record<string, any>, tenantId = 1, clientApp = 'legacy') {
    const now = Date.now();
    const tech = Array.isArray(project.tech)
      ? project.tech
      : Array.isArray(project.techStack)
        ? project.techStack
        : [];
    const normalized = {
      ...project,
      tech,
      techStack: tech,
      source: project.source || 'project',
      saved_at: project.saved_at || now,
    };
    await this.collection.updateOne(
      this.filter(userId, tenantId),
      {
        $push: { projects: normalized } as any,
        $set: { updated_at: now, schemaVersion: 1, tenantId, clientApp },
        $setOnInsert: { created_at: now, version: 1 },
        $inc: { version: 1 },
      },
      { upsert: true },
    );
    const student = await this.studentRepo.findOne({ where: { userId, tenantId, status: 1 } });
    if (student) {
      await this.studentRepo.update(student.id, {
        projects: [...(student.projects || []), normalized],
        updateTime: now,
      });
    }
  }

  async syncBasicFromMySQL(userId: number, basic: Record<string, any>, tenantId = 1, clientApp = 'legacy') {
    const now = Date.now();
    await this.studentRepo.update({ userId, tenantId, status: 1 }, {
      ...(basic.school !== undefined ? { school: basic.school } : {}),
      ...(basic.major !== undefined ? { major: basic.major } : {}),
      ...(basic.grade !== undefined ? { grade: basic.grade } : {}),
      ...(basic.dailyHours !== undefined ? { dailyHours: basic.dailyHours } : {}),
      updateTime: now,
    });
    try {
      await this.collection.updateOne(
        this.filter(userId, tenantId),
        {
          $set: { basic, updated_at: now, schemaVersion: 1, tenantId, clientApp },
          $setOnInsert: { created_at: now, version: 1 },
        },
        { upsert: true },
      );
    } catch (error: any) {
      console.warn('[ProfileService] Mongo compatibility write failed after MySQL basic update:', error.message);
    }
  }

  /** 标记用户有新消息（Redis Set） — 对齐 Python mark_user_active() */
  async markUserActive(userId: number, tenantId = 1) {
    try {
      await this.redis.sadd(this.ACTIVE_USERS_KEY, `${tenantId}:${userId}`);
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
  async updateSkills(userId: number, skills: Array<Record<string, any>>, tenantId = 1, clientApp = 'legacy') {
    const now = Date.now();
    for (const s of skills) {
      if (!s.source) s.source = 'manual';
      if (!s.updated_at) s.updated_at = now;
    }
    await this.studentRepo.update({ userId, tenantId, status: 1 }, { skills, updateTime: now });
    try {
      await this.collection.updateOne(
        this.filter(userId, tenantId),
        {
          $set: { skills, updated_at: now, schemaVersion: 1, tenantId, clientApp },
          $setOnInsert: { created_at: now, version: 1 },
        },
        { upsert: true },
      );
    } catch (error: any) {
      console.warn('[ProfileService] Mongo compatibility write failed after MySQL skill update:', error.message);
    }
  }

  /** Copy profile core fields into the MySQL fact table. Mongo is retained as a
   * compatibility/read model and is never the only place a core field lives. */
  private async syncStudentCore(userId: number, profileData: Record<string, any>, tenantId: number) {
    const basic = profileData.basic || profileData;
    const update: Partial<Student> = {};
    for (const field of ['name', 'school', 'major', 'grade', 'phone', 'email', 'studentNo', 'githubUsername', 'selfIntro'] as const) {
      if (basic[field] !== undefined) (update as any)[field] = basic[field];
    }
    if (basic.dailyHours !== undefined) update.dailyHours = Number(basic.dailyHours) || null;
    if (profileData.skills !== undefined) update.skills = profileData.skills;
    if (profileData.projects !== undefined) update.projects = profileData.projects;
    if (profileData.interests !== undefined) update.interests = profileData.interests;
    if (Object.keys(update).length) {
      await this.studentRepo.update({ userId, tenantId, status: 1 }, { ...update, updateTime: Date.now() });
    }
    const meta = profileData.traits || profileData.goals || profileData.chat_insights
      ? { traits: profileData.traits || {}, goals: profileData.goals || {}, chat_insights: profileData.chat_insights || [] }
      : null;
    if (meta) await this.studentRepo.update({ userId, tenantId, status: 1 }, { profileMeta: meta, updateTime: Date.now() });
  }
}

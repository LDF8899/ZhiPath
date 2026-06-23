import { Injectable, Inject, Optional } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../database/redis.module';
import { LearningPlan } from '../entities/learning.entity';
import { LearningTask } from '../entities/learning-tasks.entity';

/**
 * 学习进度三层存储服务 — 业务深度设计 §17
 *
 *   热数据（Redis，TTL 24h）：
 *     当前正在学习的技能点、讲义阅读位置、今日学习时长（实时累计）、今日任务完成状态
 *   温数据（MongoDB learning_sessions 集合，保留 90 天）：
 *     每日学习会话、每个技能点进度、阅读位置、答题记录
 *   冷数据（MySQL learning_plans_v3）：
 *     路径整体结构、当前阶段、各阶段完成状态（永久）
 *
 *   §17.2 进度恢复：Redis → MongoDB → MySQL 逐层降级
 *
 * 所有 Redis 操作在客户端不可用时静默降级，不阻塞主流程。
 */
@Injectable()
export class LearningProgressService {
  private readonly HOT_TTL = 86400; // 24h
  private readonly WARM_DAYS = 90;
  private readonly mongoCollection = 'learning_sessions';

  constructor(
    @Optional() @Inject(REDIS_CLIENT) private redis: Redis | null,
    @InjectConnection() private mongo: Connection,
    @InjectRepository(LearningPlan) private planRepo: Repository<LearningPlan>,
    @InjectRepository(LearningTask) private taskRepo: Repository<LearningTask>,
  ) {}

  private hotKey(userId: number): string {
    const today = new Date().toISOString().slice(0, 10);
    return `learn:hot:${userId}:${today}`;
  }

  // ── 热层（Redis）写入 ──────────────────────────────

  /** 更新当前正在学习的技能点 + 阅读位置 */
  async setCurrentSkill(userId: number, skillName: string, lecturePosition = 0): Promise<void> {
    if (!this.redis) return;
    try {
      const key = this.hotKey(userId);
      await this.redis.hset(key, {
        currentSkill: skillName,
        lecturePosition: String(lecturePosition),
        updatedAt: String(Date.now()),
      });
      await this.redis.expire(key, this.HOT_TTL);
    } catch (e: any) {
      console.warn('[LearningProgress] setCurrentSkill failed:', e.message);
    }
  }

  /** 累计今日学习时长（毫秒增量） */
  async addStudyTime(userId: number, deltaMs: number): Promise<void> {
    if (!this.redis || deltaMs <= 0) return;
    try {
      const key = this.hotKey(userId);
      await this.redis.hincrby(key, 'studyMs', Math.round(deltaMs));
      await this.redis.expire(key, this.HOT_TTL);
    } catch (e: any) {
      console.warn('[LearningProgress] addStudyTime failed:', e.message);
    }
  }

  /** 标记今日某任务状态 */
  async setTaskStatus(userId: number, taskId: number, taskStatus: string): Promise<void> {
    if (!this.redis) return;
    try {
      const key = this.hotKey(userId);
      await this.redis.hset(key, `task:${taskId}`, taskStatus);
      await this.redis.expire(key, this.HOT_TTL);
    } catch (e: any) {
      console.warn('[LearningProgress] setTaskStatus failed:', e.message);
    }
  }

  /** 读取今日热数据（原始 hash） */
  async getHot(userId: number): Promise<Record<string, string> | null> {
    if (!this.redis) return null;
    try {
      const data = await this.redis.hgetall(this.hotKey(userId));
      return data && Object.keys(data).length > 0 ? data : null;
    } catch (e: any) {
      console.warn('[LearningProgress] getHot failed:', e.message);
      return null;
    }
  }

  // ── 温层（MongoDB）归档 ──────────────────────────────

  /**
   * 将今日热数据归档到 MongoDB learning_sessions（温层，90 天）。
   * 通常在会话结束或定时任务调用。
   */
  async archiveToWarm(userId: number, planId?: number): Promise<boolean> {
    const hot = await this.getHot(userId);
    if (!hot) return false;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const collection = this.mongo.db!.collection(this.mongoCollection);

      const tasks: Record<string, string> = {};
      for (const [k, v] of Object.entries(hot)) {
        if (k.startsWith('task:')) tasks[k.slice(5)] = v;
      }

      await collection.updateOne(
        { user_id: String(userId), date: today },
        {
          $set: {
            user_id: String(userId),
            plan_id: planId ? String(planId) : (hot.planId || null),
            date: today,
            current_skill: hot.currentSkill || null,
            lecture_position: Number(hot.lecturePosition) || 0,
            total_duration_ms: Number(hot.studyMs) || 0,
            tasks,
            archived_at: Date.now(),
            expire_at: new Date(Date.now() + this.WARM_DAYS * 86400000),
          },
        },
        { upsert: true },
      );
      return true;
    } catch (e: any) {
      console.warn('[LearningProgress] archiveToWarm failed:', e.message);
      return false;
    }
  }

  /** 从 MongoDB 温层读取某日会话 */
  private async getWarm(userId: number, date: string): Promise<any | null> {
    try {
      const collection = this.mongo.db!.collection(this.mongoCollection);
      return await collection.findOne({ user_id: String(userId), date });
    } catch (e: any) {
      console.warn('[LearningProgress] getWarm failed:', e.message);
      return null;
    }
  }

  // ── §17.2 进度恢复：Redis → MongoDB → MySQL ──────────

  /**
   * 恢复用户学习进度。优先级：
   *   1. Redis 热数据（秒级，今日）
   *   2. MongoDB 温层（今日会话）
   *   3. MySQL 冷层（路径结构 + 当前阶段 + 今日任务）
   */
  async restoreProgress(userId: number, planId?: number): Promise<{
    source: 'hot' | 'warm' | 'cold' | 'empty';
    currentSkill: string | null;
    lecturePosition: number;
    todayStudyMs: number;
    taskStatuses: Record<string, string>;
    plan: { id: number; currentPhase: number; planName: string } | null;
  }> {
    const today = new Date().toISOString().slice(0, 10);

    // 冷层：路径结构（始终读取，作为 fallback 基础）
    const plan = await this.planRepo.findOne({
      where: planId ? { id: planId, status: 1 } : { userId, status: 1 },
      order: { createTime: 'DESC' },
    });
    const coldPlan = plan
      ? { id: plan.id, currentPhase: plan.currentPhase || 0, planName: plan.planName }
      : null;

    // 1. 热层
    const hot = await this.getHot(userId);
    if (hot) {
      const taskStatuses: Record<string, string> = {};
      for (const [k, v] of Object.entries(hot)) {
        if (k.startsWith('task:')) taskStatuses[k.slice(5)] = v;
      }
      return {
        source: 'hot',
        currentSkill: hot.currentSkill || null,
        lecturePosition: Number(hot.lecturePosition) || 0,
        todayStudyMs: Number(hot.studyMs) || 0,
        taskStatuses,
        plan: coldPlan,
      };
    }

    // 2. 温层
    const warm = await this.getWarm(userId, today);
    if (warm) {
      return {
        source: 'warm',
        currentSkill: warm.current_skill || null,
        lecturePosition: Number(warm.lecture_position) || 0,
        todayStudyMs: Number(warm.total_duration_ms) || 0,
        taskStatuses: warm.tasks || {},
        plan: coldPlan,
      };
    }

    // 3. 冷层：用 MySQL 今日任务状态兜底
    if (coldPlan) {
      const tasks = await this.taskRepo.find({
        where: { userId, planId: coldPlan.id, planDate: today, isActive: 1 },
      });
      const taskStatuses: Record<string, string> = {};
      for (const t of tasks) taskStatuses[String(t.id)] = t.taskStatus;
      return {
        source: 'cold',
        currentSkill: null,
        lecturePosition: 0,
        todayStudyMs: 0,
        taskStatuses,
        plan: coldPlan,
      };
    }

    return {
      source: 'empty',
      currentSkill: null,
      lecturePosition: 0,
      todayStudyMs: 0,
      taskStatuses: {},
      plan: null,
    };
  }
}

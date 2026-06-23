import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningSession } from '../entities/learning-sessions.entity';
import { LearningTask } from '../entities/learning-tasks.entity';
import { LearningPlan } from '../entities/learning.entity';
import { SkillService } from './skill.service';

/**
 * LearningSession 服务 — Git Commit 模型
 *
 * 对齐 CONSTITUTION.md §11 + §17.1：
 *   - 每次学习 = 一次 commit
 *   - 记录技能变化（before/after）
 *   - 记录匹配度变化
 *   - 支持回退（git reset）
 *   - 支持对比（git diff）
 */
@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(LearningSession) private sessionRepo: Repository<LearningSession>,
    @InjectRepository(LearningTask) private taskRepo: Repository<LearningTask>,
    @InjectRepository(LearningPlan) private planRepo: Repository<LearningPlan>,
    private skillService: SkillService,
  ) {}

  /**
   * 开始学习会话
   */
  async startSession(userId: number, planId?: number): Promise<LearningSession> {
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);

    // 检查是否已有今日会话
    const existing = await this.sessionRepo.findOne({
      where: { userId, sessionDate: today, status: 1 },
      order: { createTime: 'DESC' },
    });

    if (existing && !existing.endedAt) {
      return existing; // 返回未结束的会话
    }

    // 获取当前技能快照
    const skills = await this.skillService.getEffectiveSkills(userId);
    const skillSnapshot = skills.map((s) => ({
      name: s.name,
      masteryPct: s.masteryPct,
    }));

    return this.sessionRepo.save({
      userId,
      planId: planId || null,
      sessionDate: today,
      startedAt: now,
      endedAt: null,
      totalDurationMs: 0,
      tasksSnapshot: { skills: skillSnapshot },
      skillChanges: [],
      matchScoreBefore: null,
      matchScoreAfter: null,
      createTime: now,
      updateTime: now,
      status: 1,
    });
  }

  /**
   * 记录学习进度（任务完成时调用）
   */
  async recordProgress(
    sessionId: number,
    taskId: number,
    skillName: string,
    masteryBefore: number,
    masteryAfter: number,
  ): Promise<void> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, status: 1 } });
    if (!session) return;

    const now = Date.now();
    const changes = session.skillChanges || [];

    // 更新技能变化记录
    const existingChange = changes.find((c) => c.name === skillName);
    if (existingChange) {
      existingChange.after = masteryAfter;
    } else {
      changes.push({ name: skillName, before: masteryBefore, after: masteryAfter });
    }

    // 更新任务快照
    const tasksSnapshot = session.tasksSnapshot || {};
    const completedTasks = tasksSnapshot.completedTasks || [];
    if (!completedTasks.includes(taskId)) {
      completedTasks.push(taskId);
    }

    await this.sessionRepo.update(session.id, {
      skillChanges: changes,
      tasksSnapshot: { ...tasksSnapshot, completedTasks },
      updateTime: now,
    });
  }

  /**
   * 结束学习会话
   */
  async endSession(sessionId: number): Promise<LearningSession> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, status: 1 } });
    if (!session) throw new Error('会话不存在');

    const now = Date.now();
    const durationMs = session.startedAt ? now - session.startedAt : 0;

    // 获取结束时的技能快照
    const skills = await this.skillService.getEffectiveSkills(session.userId);
    const tasksSnapshot = session.tasksSnapshot || {};
    tasksSnapshot.skillsEnd = skills.map((s) => ({
      name: s.name,
      masteryPct: s.masteryPct,
    }));

    await this.sessionRepo.update(session.id, {
      endedAt: now,
      totalDurationMs: durationMs,
      tasksSnapshot,
      updateTime: now,
    });

    return this.sessionRepo.findOne({ where: { id: sessionId } }) as Promise<LearningSession>;
  }

  /**
   * 获取学习历史（git log）
   */
  async getHistory(userId: number, page = 1, pageSize = 20): Promise<{ sessions: LearningSession[]; total: number }> {
    const skip = (page - 1) * pageSize;
    const [sessions, total] = await this.sessionRepo.findAndCount({
      where: { userId, status: 1 },
      order: { sessionDate: 'DESC', createTime: 'DESC' },
      skip,
      take: pageSize,
    });

    return { sessions, total };
  }

  /**
   * 获取学习统计
   */
  async getStats(userId: number): Promise<{
    totalSessions: number;
    totalDurationHours: number;
    totalSkillsImproved: number;
    streakDays: number;
    avgSessionMinutes: number;
  }> {
    const sessions = await this.sessionRepo.find({
      where: { userId, status: 1 },
      order: { sessionDate: 'DESC' },
    });

    const totalSessions = sessions.length;
    const totalDurationMs = sessions.reduce((sum, s) => sum + (Number(s.totalDurationMs) || 0), 0);
    const totalDurationHours = Math.round((totalDurationMs / 3600000) * 10) / 10;

    // 统计技能提升次数
    let totalSkillsImproved = 0;
    for (const s of sessions) {
      if (s.skillChanges?.length) {
        totalSkillsImproved += s.skillChanges.filter((c) => c.after > c.before).length;
      }
    }

    // 计算连续学习天数
    const uniqueDates = [...new Set(sessions.map((s) => s.sessionDate))].sort().reverse();
    let streakDays = 0;
    const today = new Date().toISOString().slice(0, 10);
    let checkDate = today;

    for (const date of uniqueDates) {
      if (date === checkDate) {
        streakDays++;
        const d = new Date(checkDate);
        d.setDate(d.getDate() - 1);
        checkDate = d.toISOString().slice(0, 10);
      } else {
        break;
      }
    }

    const avgSessionMinutes = totalSessions > 0
      ? Math.round((totalDurationMs / totalSessions / 60000) * 10) / 10
      : 0;

    return {
      totalSessions,
      totalDurationHours,
      totalSkillsImproved,
      streakDays,
      avgSessionMinutes,
    };
  }

  /**
   * 对比两个日期的技能变化（git diff）
   */
  async diff(
    userId: number,
    dateA: string,
    dateB: string,
  ): Promise<{
    dateA: string;
    dateB: string;
    changes: Array<{ skill: string; before: number; after: number; delta: number }>;
  }> {
    // 获取 dateA 的会话
    const sessionA = await this.sessionRepo.findOne({
      where: { userId, sessionDate: dateA, status: 1 },
      order: { createTime: 'DESC' },
    });

    // 获取 dateB 的会话
    const sessionB = await this.sessionRepo.findOne({
      where: { userId, sessionDate: dateB, status: 1 },
      order: { createTime: 'DESC' },
    });

    const skillsA: any[] = sessionA?.tasksSnapshot?.skillsEnd || sessionA?.tasksSnapshot?.skills || [];
    const skillsB: any[] = sessionB?.tasksSnapshot?.skillsEnd || sessionB?.tasksSnapshot?.skills || [];

    const skillMapA = new Map<string, number>(skillsA.map((s: any) => [s.name, Number(s.masteryPct) || 0]));
    const skillMapB = new Map<string, number>(skillsB.map((s: any) => [s.name, Number(s.masteryPct) || 0]));

    const allSkills = new Set<string>([...skillMapA.keys(), ...skillMapB.keys()]);
    const changes: Array<{ skill: string; before: number; after: number; delta: number }> = [];

    for (const skill of allSkills) {
      const before = skillMapA.get(skill) || 0;
      const after = skillMapB.get(skill) || 0;
      const delta = after - before;

      if (Math.abs(delta) > 0.01) {
        changes.push({ skill, before, after, delta: Math.round(delta * 100) / 100 });
      }
    }

    // 按变化幅度降序排序
    changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    return { dateA, dateB, changes };
  }

  /**
   * 回退到目标日期（git reset）
   */
  async rollback(
    userId: number,
    targetDate: string,
  ): Promise<{ success: boolean; restoredSkills: number }> {
    // 获取目标日期的会话
    const session = await this.sessionRepo.findOne({
      where: { userId, sessionDate: targetDate, status: 1 },
      order: { createTime: 'DESC' },
    });

    if (!session?.tasksSnapshot?.skills) {
      return { success: false, restoredSkills: 0 };
    }

    const targetSkills = session.tasksSnapshot.skills;
    let restored = 0;

    for (const skill of targetSkills) {
      const current = await this.skillService.getSkill(userId, skill.name);
      if (current && Math.abs(Number(current.masteryPct) - skill.masteryPct) > 0.01) {
        await this.skillService.setMastery(userId, skill.name, skill.masteryPct);
        restored++;
      }
    }

    return { success: true, restoredSkills: restored };
  }
}

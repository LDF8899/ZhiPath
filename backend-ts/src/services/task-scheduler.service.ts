import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningPlan } from '../entities/learning.entity';
import { LearningTask } from '../entities/learning-tasks.entity';
import { Student } from '../entities/student.entity';
import { SkillService } from './skill.service';

/**
 * TaskScheduler — 学习任务调度服务
 *
 * 对齐 CONSTITUTION.md 附录D.1 学习任务调度：
 *   - 8 态 FSM：pending → in_progress → lecture_done → practice_done → code_done → exam_done → done/skipped
 *   - 按每日时长动态分配任务
 *   - 支持学习速度检测和日程调整
 */
@Injectable()
export class TaskSchedulerService {
  // 任务状态机：合法的状态转换
  private readonly STATE_TRANSITIONS: Record<string, string[]> = {
    pending: ['in_progress', 'skipped'],
    in_progress: ['lecture_done', 'skipped'],
    lecture_done: ['practice_done', 'skipped'],
    practice_done: ['code_done', 'skipped'],
    code_done: ['exam_done', 'skipped'],
    exam_done: ['done'],
    skipped: [],
    done: [],
  };

  constructor(
    @InjectRepository(LearningPlan) private planRepo: Repository<LearningPlan>,
    @InjectRepository(LearningTask) private taskRepo: Repository<LearningTask>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    private skillService: SkillService,
  ) {}

  /**
   * 获取今日任务列表
   *
   * @param userId 用户ID
   * @param planId 计划ID（可选，不传则取最新计划）
   */
  async getTodayTasks(
    userId: number,
    planId?: number,
  ): Promise<{
    planId: number;
    planName: string;
    mainTasks: LearningTask[];
    sideTasks: LearningTask[];
    totalEstimatedMin: number;
    completedMin: number;
    progressPct: number;
  }> {
    const today = new Date().toISOString().slice(0, 10);

    // 1. 获取计划
    let plan: LearningPlan | null = null;
    if (planId) {
      plan = await this.planRepo.findOne({ where: { id: planId, userId, status: 1 } });
    } else {
      plan = await this.planRepo.findOne({
        where: { userId, status: 1 },
        order: { planType: 'ASC', createTime: 'DESC' },
      });
    }

    if (!plan) {
      return {
        planId: 0,
        planName: '',
        mainTasks: [],
        sideTasks: [],
        totalEstimatedMin: 0,
        completedMin: 0,
        progressPct: 0,
      };
    }

    // 2. 获取今日已有任务
    const existingTasks = await this.taskRepo.find({
      where: { userId, planId: plan.id, planDate: today, isActive: 1, status: 1 },
      order: { taskType: 'ASC', sortOrder: 'ASC', priority: 'DESC' },
    });

    // 如果今日已有任务，直接返回
    if (existingTasks.length > 0) {
      return this.buildTaskResult(plan, existingTasks);
    }

    // 3. 生成今日任务
    const newTasks = await this.generateTodayTasks(userId, plan, today);
    return this.buildTaskResult(plan, newTasks);
  }

  /**
   * 更新任务状态（8态FSM）
   *
   * @param taskId 任务ID
   * @param newStatus 新状态
   * @param userId 用户ID（安全校验）
   */
  async updateTaskStatus(
    taskId: number,
    newStatus: LearningTask['taskStatus'],
    userId: number,
  ): Promise<{ success: boolean; task: LearningTask | null; error?: string }> {
    const task = await this.taskRepo.findOne({ where: { id: taskId, userId, isActive: 1, status: 1 } });
    if (!task) return { success: false, task: null, error: '任务不存在' };

    // 校验状态转换合法性
    const allowedTransitions = this.STATE_TRANSITIONS[task.taskStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      return {
        success: false,
        task: null,
        error: `状态转换不合法：${task.taskStatus} → ${newStatus}，允许的目标状态：${allowedTransitions.join(', ')}`,
      };
    }

    const now = Date.now();

    // 更新任务状态
    task.taskStatus = newStatus;
    task.updateTime = now;

    // 记录时间戳
    if (newStatus === 'in_progress' && !task.startTime) {
      task.startTime = now;
    }

    if (newStatus === 'done' || newStatus === 'skipped') {
      task.completeTime = now;

      // 计算实际时长
      if (task.startTime) {
        task.actualMin = Math.round((now - task.startTime) / 60000);
      }

      // 如果完成，更新技能掌握度
      if (newStatus === 'done') {
        await this.skillService.updateMastery(userId, task.skillName, 10);
      }
    }

    await this.taskRepo.save(task);

    return { success: true, task };
  }

  /**
   * 检测学习速度并调整后续日程
   */
  async adjustForSpeed(userId: number, planId: number): Promise<{ adjusted: boolean; changes: string[] }> {
    const plan = await this.planRepo.findOne({ where: { id: planId, userId, status: 1 } });
    if (!plan) return { adjusted: false, changes: [] };

    const changes: string[] = [];
    const now = Date.now();

    // 获取最近 7 天的任务
    const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
    const recentTasks = await this.taskRepo.find({
      where: { userId, planId, status: 1, isActive: 1 },
      order: { planDate: 'DESC' },
    });

    const tasksByDate = new Map<string, LearningTask[]>();
    for (const task of recentTasks) {
      if (task.planDate && task.planDate >= sevenDaysAgo) {
        const dateTasks = tasksByDate.get(task.planDate) || [];
        dateTasks.push(task);
        tasksByDate.set(task.planDate, dateTasks);
      }
    }

    // 计算平均完成率
    let totalDays = 0;
    let completedDays = 0;
    for (const [date, tasks] of tasksByDate) {
      totalDays++;
      const completed = tasks.filter((t) => t.taskStatus === 'done' || t.taskStatus === 'skipped').length;
      if (completed > 0) completedDays++;
    }

    // 如果完成率低于 50%，建议减少每日任务量
    if (totalDays >= 3 && completedDays / totalDays < 0.5) {
      const dailyHours = Number(plan.dailyHours) || 2;
      const newDailyHours = Math.max(1, dailyHours - 0.5);
      if (newDailyHours !== dailyHours) {
        plan.dailyHours = newDailyHours;
        plan.updateTime = now;
        await this.planRepo.save(plan);
        changes.push(`检测到学习进度较慢，已将每日学习时长从 ${dailyHours}h 调整为 ${newDailyHours}h`);
      }
    }

    // 如果完成率高于 90%，可以增加任务量
    if (totalDays >= 3 && completedDays / totalDays > 0.9) {
      const dailyHours = Number(plan.dailyHours) || 2;
      const newDailyHours = Math.min(8, dailyHours + 0.5);
      if (newDailyHours !== dailyHours) {
        plan.dailyHours = newDailyHours;
        plan.updateTime = now;
        await this.planRepo.save(plan);
        changes.push(`检测到学习进度较快，已将每日学习时长从 ${dailyHours}h 调整为 ${newDailyHours}h`);
      }
    }

    return { adjusted: changes.length > 0, changes };
  }

  // ── 内部方法 ──────────────────────────────────

  /** 生成今日任务 */
  private async generateTodayTasks(
    userId: number,
    plan: LearningPlan,
    today: string,
  ): Promise<LearningTask[]> {
    const now = Date.now();
    const pathData = plan.pathData || {};
    const phases = pathData.phases || [];
    const currentPhase = plan.currentPhase || 0;
    const dailyHours = Number(plan.dailyHours) || 2;
    const mainRatio = Number(plan.mainRatio) || 80;

    const availableMinutes = dailyHours * 60;
    const mainMinutes = availableMinutes * (mainRatio / 100);
    const sideMinutes = availableMinutes * (1 - mainRatio / 100);

    // 获取用户已掌握技能
    const userSkills = await this.skillService.getEffectiveSkills(userId);
    const masteredSkills = new Set(
      userSkills.filter((s) => s.masteryPct >= 80).map((s) => s.name.toLowerCase()),
    );

    const tasks: Partial<LearningTask>[] = [];
    let mainUsed = 0;
    let sideUsed = 0;
    let sortOrder = 0;

    // 遍历当前阶段和后续阶段
    for (let phaseIdx = currentPhase; phaseIdx < phases.length; phaseIdx++) {
      const phase = phases[phaseIdx];
      const phaseSkills = phase.skills || [];

      for (const skill of phaseSkills) {
        // 跳过已掌握的技能
        if (masteredSkills.has(skill.name.toLowerCase())) continue;
        // 跳过已完成的任务
        if (skill.status === 'done' || skill.status === 'skipped') continue;

        const estimatedMin = skill.estimatedMin || 120;
        const isMain = phaseIdx === currentPhase;

        if (isMain && (mainUsed + estimatedMin <= mainMinutes || mainUsed === 0)) {
          tasks.push({
            userId,
            planId: plan.id,
            skillName: skill.name,
            taskType: 'main',
            taskStatus: 'pending',
            estimatedMin,
            priority: skill.priority || 5,
            sortOrder: sortOrder++,
            planDate: today,
            isActive: 1,
            status: 1,
            createTime: now,
            updateTime: now,
          });
          mainUsed += estimatedMin;
        } else if (!isMain && (sideUsed + estimatedMin <= sideMinutes || sideUsed === 0)) {
          tasks.push({
            userId,
            planId: plan.id,
            skillName: skill.name,
            taskType: 'side',
            taskStatus: 'pending',
            estimatedMin,
            priority: skill.priority || 5,
            sortOrder: sortOrder++,
            planDate: today,
            isActive: 1,
            status: 1,
            createTime: now,
            updateTime: now,
          });
          sideUsed += estimatedMin;
        }

        // 如果主线和支线都满了，停止
        if (mainUsed >= mainMinutes && sideUsed >= sideMinutes) break;
      }

      // 只在当前阶段生成主线任务
      if (phaseIdx === currentPhase && mainUsed >= mainMinutes) continue;
    }

    if (tasks.length === 0) return [];

    return this.taskRepo.save(tasks);
  }

  /** 构建任务结果 */
  private buildTaskResult(
    plan: LearningPlan,
    tasks: LearningTask[],
  ): {
    planId: number;
    planName: string;
    mainTasks: LearningTask[];
    sideTasks: LearningTask[];
    totalEstimatedMin: number;
    completedMin: number;
    progressPct: number;
  } {
    const mainTasks = tasks.filter((t) => t.taskType === 'main');
    const sideTasks = tasks.filter((t) => t.taskType === 'side');

    const totalEstimatedMin = tasks.reduce((sum, t) => sum + (t.estimatedMin || 0), 0);
    const completedMin = tasks
      .filter((t) => t.taskStatus === 'done' || t.taskStatus === 'skipped')
      .reduce((sum, t) => sum + (t.actualMin || t.estimatedMin || 0), 0);

    const progressPct = totalEstimatedMin > 0 ? Math.round((completedMin / totalEstimatedMin) * 100) : 0;

    return {
      planId: plan.id,
      planName: plan.planName,
      mainTasks,
      sideTasks,
      totalEstimatedMin,
      completedMin,
      progressPct,
    };
  }
}

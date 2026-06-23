import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentTask } from '../entities/agent-task.entity';

/**
 * AgentTask 服务 — 智能体任务队列管理
 *
 * 功能：
 *   - 创建/查询/更新任务
 *   - 状态流转（pending → running → success/failed/cancelled）
 *   - 紧急标记、跳过、取消
 *   - 统计各 Agent 状态
 */
@Injectable()
export class AgentTaskService {
  constructor(
    @InjectRepository(AgentTask) private taskRepo: Repository<AgentTask>,
  ) {}

  /**
   * 创建任务
   */
  async createTask(
    userId: number,
    agentType: AgentTask['agentType'],
    title: string,
    params?: Record<string, any>,
    description?: string,
  ): Promise<AgentTask> {
    const now = Date.now();

    // 获取当前最大排序号
    const maxOrder = await this.taskRepo
      .createQueryBuilder('t')
      .select('MAX(t.sort_order)', 'max')
      .where('t.user_id = :userId', { userId })
      .getRawOne();

    return this.taskRepo.save({
      userId,
      agentType,
      title,
      description: description || '',
      params: params || null,
      taskStatus: 'pending',
      progress: 0,
      result: null,
      errorMessage: null,
      isUrgent: 0,
      sortOrder: (maxOrder?.max || 0) + 1,
      startedAt: null,
      completedAt: null,
      createTime: now,
      updateTime: now,
      status: 1,
    });
  }

  /**
   * 获取用户的任务队列
   */
  async getTasks(
    userId: number,
    status?: AgentTask['taskStatus'],
  ): Promise<AgentTask[]> {
    const where: any = { userId, status: 1 };
    if (status) where.taskStatus = status;

    return this.taskRepo.find({
      where,
      order: { isUrgent: 'DESC', sortOrder: 'ASC', createTime: 'ASC' },
    });
  }

  /**
   * 获取任务详情
   */
  async getTask(taskId: number, userId: number): Promise<AgentTask | null> {
    return this.taskRepo.findOne({ where: { id: taskId, userId, status: 1 } });
  }

  /**
   * 更新任务状态
   */
  async updateStatus(
    taskId: number,
    newStatus: AgentTask['taskStatus'],
    result?: Record<string, any>,
    errorMessage?: string,
  ): Promise<AgentTask | null> {
    const task = await this.taskRepo.findOne({ where: { id: taskId, status: 1 } });
    if (!task) return null;

    const now = Date.now();
    const update: Partial<AgentTask> = {
      taskStatus: newStatus,
      updateTime: now,
    };

    if (newStatus === 'running') {
      update.startedAt = now;
      update.progress = 10;
    }

    if (newStatus === 'success') {
      update.completedAt = now;
      update.progress = 100;
      if (result) update.result = result;
    }

    if (newStatus === 'failed') {
      update.completedAt = now;
      if (errorMessage) update.errorMessage = errorMessage;
    }

    if (newStatus === 'cancelled') {
      update.completedAt = now;
    }

    await this.taskRepo.update(taskId, update);
    return this.taskRepo.findOne({ where: { id: taskId } });
  }

  /**
   * 更新进度
   */
  async updateProgress(taskId: number, progress: number): Promise<void> {
    await this.taskRepo.update(taskId, { progress: Math.min(100, Math.max(0, progress)), updateTime: Date.now() });
  }

  /**
   * 标记紧急
   */
  async markUrgent(taskId: number, userId: number): Promise<AgentTask | null> {
    const task = await this.taskRepo.findOne({ where: { id: taskId, userId, status: 1 } });
    if (!task) return null;

    await this.taskRepo.update(taskId, { isUrgent: task.isUrgent ? 0 : 1, updateTime: Date.now() });
    return this.taskRepo.findOne({ where: { id: taskId } });
  }

  /**
   * 跳过任务
   */
  async skipTask(taskId: number, userId: number): Promise<AgentTask | null> {
    const task = await this.taskRepo.findOne({ where: { id: taskId, userId, status: 1 } });
    if (!task || task.taskStatus !== 'pending') return null;

    // 将排序号设为最大（移到队尾）
    const maxOrder = await this.taskRepo
      .createQueryBuilder('t')
      .select('MAX(t.sort_order)', 'max')
      .where('t.user_id = :userId', { userId })
      .getRawOne();

    await this.taskRepo.update(taskId, { sortOrder: (maxOrder?.max || 0) + 1, updateTime: Date.now() });
    return this.taskRepo.findOne({ where: { id: taskId } });
  }

  /**
   * 批量重排任务顺序
   */
  async reorderTasks(userId: number, taskIds: number[]): Promise<void> {
    const now = Date.now();
    for (let i = 0; i < taskIds.length; i++) {
      await this.taskRepo.update(
        { id: taskIds[i], userId, status: 1 },
        { sortOrder: i, updateTime: now },
      );
    }
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: number, userId: number): Promise<AgentTask | null> {
    const task = await this.taskRepo.findOne({ where: { id: taskId, userId, status: 1 } });
    if (!task || !['pending', 'running'].includes(task.taskStatus)) return null;

    return this.updateStatus(taskId, 'cancelled');
  }

  /**
   * 删除任务（软删除）
   */
  async deleteTask(taskId: number, userId: number): Promise<boolean> {
    const task = await this.taskRepo.findOne({ where: { id: taskId, userId, status: 1 } });
    if (!task) return false;

    await this.taskRepo.update(taskId, { status: 0, updateTime: Date.now() });
    return true;
  }

  /**
   * 获取统计信息
   */
  async getStats(userId: number): Promise<{
    total: number;
    pending: number;
    running: number;
    success: number;
    failed: number;
    byAgent: Record<string, { pending: number; running: number; success: number; failed: number }>;
  }> {
    const tasks = await this.taskRepo.find({ where: { userId, status: 1 } });

    const stats = {
      total: tasks.length,
      pending: 0,
      running: 0,
      success: 0,
      failed: 0,
      byAgent: {} as Record<string, { pending: number; running: number; success: number; failed: number }>,
    };

    // 动态收集所有 agent 类型
    const agentTypes = [...new Set(tasks.map(t => t.agentType))];
    for (const type of agentTypes) {
      stats.byAgent[type] = { pending: 0, running: 0, success: 0, failed: 0 };
    }

    for (const task of tasks) {
      if (task.taskStatus in stats) {
        (stats as any)[task.taskStatus]++;
      }
      if (task.agentType in stats.byAgent && task.taskStatus in stats.byAgent[task.agentType]) {
        stats.byAgent[task.agentType][task.taskStatus]++;
      }
    }

    return stats;
  }

  /**
   * 获取最近完成的任务
   */
  async getRecentCompleted(userId: number, limit: number = 10): Promise<AgentTask[]> {
    return this.taskRepo.find({
      where: { userId, status: 1 },
      order: { completedAt: 'DESC' },
      take: limit,
    });
  }

  // ──────────────────────────────────────────────────────────────
  //  以下为增强方法：占位符 / 批量 / 任务组 / 清理 / 幂等
  // ──────────────────────────────────────────────────────────────

  /**
   * 占位符任务创建 — 立即写入一条 pending 记录，确保用户数据不丢失
   *
   * 典型场景：用户发起请求后先建占位符，后续 Agent 真正执行时再更新状态。
   * 占位符的 externalId 可用于后续幂等更新。
   */
  async createPlaceholderTask(
    userId: number,
    agentType: AgentTask['agentType'],
    title: string,
    options?: {
      params?: Record<string, any>;
      description?: string;
      groupId?: string;
      externalId?: string;
    },
  ): Promise<AgentTask> {
    const now = Date.now();

    const maxOrder = await this.taskRepo
      .createQueryBuilder('t')
      .select('MAX(t.sort_order)', 'max')
      .where('t.user_id = :userId', { userId })
      .getRawOne();

    return this.taskRepo.save({
      userId,
      agentType,
      title,
      description: options?.description || '',
      params: options?.params || null,
      taskStatus: 'pending',
      progress: 0,
      result: null,
      errorMessage: null,
      isUrgent: 0,
      sortOrder: (maxOrder?.max || 0) + 1,
      startedAt: null,
      completedAt: null,
      groupId: options?.groupId || null,
      externalId: options?.externalId || null,
      createTime: now,
      updateTime: now,
      status: 1,
    });
  }

  /**
   * 批量创建任务 — 一次创建多个关联任务，共享同一个 groupId
   *
   * 返回创建好的任务数组。如果未传 groupId 则自动生成一个 UUID。
   */
  async createBatchTasks(
    userId: number,
    tasks: Array<{
      agentType: AgentTask['agentType'];
      title: string;
      params?: Record<string, any>;
      description?: string;
      externalId?: string;
    }>,
    groupId?: string,
  ): Promise<AgentTask[]> {
    const effectiveGroupId = groupId || this.generateGroupId();
    const now = Date.now();

    // 获取当前最大排序号
    const maxOrder = await this.taskRepo
      .createQueryBuilder('t')
      .select('MAX(t.sort_order)', 'max')
      .where('t.user_id = :userId', { userId })
      .getRawOne();

    let nextOrder = (maxOrder?.max || 0) + 1;

    const entities: Partial<AgentTask>[] = tasks.map((t) => ({
      userId,
      agentType: t.agentType,
      title: t.title,
      description: t.description || '',
      params: t.params || null,
      taskStatus: 'pending' as const,
      progress: 0,
      result: null,
      errorMessage: null,
      isUrgent: 0,
      sortOrder: nextOrder++,
      startedAt: null,
      completedAt: null,
      groupId: effectiveGroupId,
      externalId: t.externalId || null,
      createTime: now,
      updateTime: now,
      status: 1,
    }));

    // TypeORM save 支持数组批量插入
    return this.taskRepo.save(entities) as Promise<AgentTask[]>;
  }

  /**
   * 按任务组查询所有任务
   */
  async getTasksByGroup(groupId: string, userId?: number): Promise<AgentTask[]> {
    const where: any = { groupId, status: 1 };
    if (userId !== undefined) where.userId = userId;

    return this.taskRepo.find({
      where,
      order: { sortOrder: 'ASC', createTime: 'ASC' },
    });
  }

  /**
   * 获取任务组整体进度
   *
   * 计算规则：每个任务权重相同，success=100, failed/cancelled=100（终态），
   * pending=0, running 取实际 progress 值。
   */
  async getGroupProgress(groupId: string): Promise<{
    groupId: string;
    total: number;
    completed: number;
    failed: number;
    running: number;
    pending: number;
    percent: number;
  }> {
    const tasks = await this.taskRepo.find({
      where: { groupId, status: 1 },
    });

    const total = tasks.length;
    if (total === 0) {
      return { groupId, total: 0, completed: 0, failed: 0, running: 0, pending: 0, percent: 0 };
    }

    let sumProgress = 0;
    let completed = 0;
    let failed = 0;
    let running = 0;
    let pending = 0;

    for (const task of tasks) {
      switch (task.taskStatus) {
        case 'success':
          sumProgress += 100;
          completed++;
          break;
        case 'failed':
        case 'cancelled':
          sumProgress += 100;
          failed++;
          break;
        case 'running':
          sumProgress += Math.min(100, Math.max(0, task.progress));
          running++;
          break;
        case 'pending':
        default:
          pending++;
          break;
      }
    }

    const percent = Math.round(sumProgress / total);

    return { groupId, total, completed, failed, running, pending, percent };
  }

  /**
   * 清理超时未完成的任务 — 将 stale 的 running/pending 任务标记为 failed
   *
   * @param maxAgeHours 最大允许运行时长（小时），默认 24
   * @returns 被清理的任务数量
   */
  async cleanupStaleTasks(maxAgeHours: number = 24): Promise<number> {
    const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;

    // 找到所有仍在运行/等待且创建时间超过阈值的任务
    const staleTasks = await this.taskRepo
      .createQueryBuilder('t')
      .where('t.status = :status', { status: 1 })
      .andWhere('t.task_status IN (:...statuses)', { statuses: ['pending', 'running'] })
      .andWhere('t.create_time < :cutoff', { cutoff })
      .getMany();

    if (staleTasks.length === 0) return 0;

    const now = Date.now();
    const ids = staleTasks.map((t) => t.id);

    await this.taskRepo
      .createQueryBuilder()
      .update()
      .set({
        taskStatus: 'failed',
        errorMessage: `自动清理：超过 ${maxAgeHours} 小时未完成`,
        completedAt: now,
        updateTime: now,
      })
      .whereInIds(ids)
      .execute();

    return staleTasks.length;
  }

  /**
   * 幂等更新任务状态 — 基于 externalId
   *
   * 如果 externalId 已存在则更新状态，不存在则创建新任务。
   * 避免因重试/重复调用导致的数据重复。
   */
  async upsertTaskStatus(
    userId: number,
    agentType: AgentTask['agentType'],
    title: string,
    externalId: string,
    update: {
      taskStatus?: AgentTask['taskStatus'];
      progress?: number;
      result?: Record<string, any>;
      errorMessage?: string;
      params?: Record<string, any>;
      description?: string;
    },
  ): Promise<AgentTask> {
    const existing = await this.taskRepo.findOne({
      where: { externalId, status: 1 },
    });

    const now = Date.now();

    if (existing) {
      // 幂等更新：仅更新有值的字段
      const patch: Partial<AgentTask> = { updateTime: now };

      if (update.taskStatus !== undefined) {
        patch.taskStatus = update.taskStatus;
        if (update.taskStatus === 'running' && !existing.startedAt) {
          patch.startedAt = now;
        }
        if (['success', 'failed', 'cancelled'].includes(update.taskStatus)) {
          patch.completedAt = now;
        }
      }
      if (update.progress !== undefined) {
        patch.progress = Math.min(100, Math.max(0, update.progress));
      }
      if (update.result !== undefined) {
        patch.result = update.result;
      }
      if (update.errorMessage !== undefined) {
        patch.errorMessage = update.errorMessage;
      }
      if (update.params !== undefined) {
        patch.params = update.params;
      }
      if (update.description !== undefined) {
        patch.description = update.description;
      }

      await this.taskRepo.update(existing.id, patch);
      return this.taskRepo.findOne({ where: { id: existing.id } }) as Promise<AgentTask>;
    }

    // 不存在则新建
    return this.createPlaceholderTask(userId, agentType, title, {
      params: update.params,
      description: update.description,
      externalId,
    });
  }

  /**
   * 生成任务组 ID（简易 UUID v4）
   */
  private generateGroupId(): string {
    const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
  }
}

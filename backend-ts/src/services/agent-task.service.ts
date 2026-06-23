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
}

import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/**
 * 队列服务 — 任务入队管理
 */
@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('agent-tasks') private agentQueue: Queue,
    @InjectQueue('resource-tasks') private resourceQueue: Queue,
  ) {}

  /**
   * 添加 Agent 任务到队列
   */
  async addAgentTask(
    userId: number,
    agentType: string,
    params: Record<string, any>,
    options?: { priority?: number; delay?: number },
  ) {
    const job = await this.agentQueue.add(
      agentType,
      {
        userId,
        agentType,
        params,
        createdAt: Date.now(),
      },
      {
        priority: options?.priority || 5,
        delay: options?.delay || 0,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400 }, // 保留 24 小时
        removeOnFail: { age: 604800 }, // 保留 7 天
      },
    );

    return { jobId: job.id, queue: 'agent-tasks' };
  }

  /**
   * 添加资源生成任务到队列
   */
  async addResourceTask(
    userId: number,
    resourceType: string,
    params: Record<string, any>,
  ) {
    const job = await this.resourceQueue.add(
      resourceType,
      {
        userId,
        resourceType,
        params,
        createdAt: Date.now(),
      },
      {
        attempts: 2,
        backoff: { type: 'fixed', delay: 10000 },
        removeOnComplete: { age: 86400 },
      },
    );

    return { jobId: job.id, queue: 'resource-tasks' };
  }

  /**
   * 获取队列状态
   */
  async getQueueStats() {
    const [agentWaiting, agentActive, agentCompleted, agentFailed] = await Promise.all([
      this.agentQueue.getWaitingCount(),
      this.agentQueue.getActiveCount(),
      this.agentQueue.getCompletedCount(),
      this.agentQueue.getFailedCount(),
    ]);

    const [resourceWaiting, resourceActive, resourceCompleted, resourceFailed] = await Promise.all([
      this.resourceQueue.getWaitingCount(),
      this.resourceQueue.getActiveCount(),
      this.resourceQueue.getCompletedCount(),
      this.resourceQueue.getFailedCount(),
    ]);

    return {
      agent: { waiting: agentWaiting, active: agentActive, completed: agentCompleted, failed: agentFailed },
      resource: { waiting: resourceWaiting, active: resourceActive, completed: resourceCompleted, failed: resourceFailed },
    };
  }

  /**
   * 获取任务详情
   */
  async getJobStatus(queueName: 'agent-tasks' | 'resource-tasks', jobId: string) {
    const queue = queueName === 'agent-tasks' ? this.agentQueue : this.resourceQueue;
    const job = await queue.getJob(jobId);

    if (!job) return null;

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress,
      status: await job.getState(),
      createdAt: new Date(job.timestamp),
      processedOn: job.processedOn ? new Date(job.processedOn) : null,
      finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
      failedReason: job.failedReason,
    };
  }

  /**
   * 取消任务
   */
  async cancelJob(queueName: 'agent-tasks' | 'resource-tasks', jobId: string) {
    const queue = queueName === 'agent-tasks' ? this.agentQueue : this.resourceQueue;
    const job = await queue.getJob(jobId);

    if (!job) return false;

    await job.remove();
    return true;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { randomUUID } from 'crypto';

/* ────────────────────────── 类型定义 ────────────────────────── */

/** 任务组内单个任务描述 */
interface GroupTaskDescriptor {
  agentType: string;
  params: Record<string, any>;
  priority?: number;
  delay?: number;
}

/** 任务组进度 */
interface GroupProgress {
  groupId: string;
  total: number;
  pending: number;
  active: number;
  completed: number;
  failed: number;
  progressPercent: number;
  jobs: GroupJobStatus[];
}

/** 组内单个任务状态 */
interface GroupJobStatus {
  jobId: string;
  agentType: string;
  status: string;
  progress: number | Record<string, any>;
  createdAt: Date | null;
  processedOn: Date | null;
  finishedOn: Date | null;
  duration: number | null;
  failedReason?: string;
}

/** Agent 类型统计 */
interface AgentTypeStats {
  agentType: string;
  total: number;
  completed: number;
  failed: number;
  active: number;
  waiting: number;
  successRate: number;
  avgDurationMs: number;
  p95DurationMs: number;
}

/** 详细统计 */
interface DetailedStats {
  agent: {
    overall: QueueOverview;
    byAgentType: AgentTypeStats[];
  };
  resource: QueueOverview;
}

interface QueueOverview {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  totalProcessed: number;
}

/** 超时基准配置（毫秒） */
const TIMEOUT_BASE: Record<string, number> = {
  lecture:  60_000,
  reading:  45_000,
  code:     90_000,
  path:     30_000,
  assess:   50_000,
  video:   120_000,
  default:  60_000,
};

/**
 * 队列服务 — 任务入队管理
 */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

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

  /* ────────────────────── 新增：任务组 / 动态超时 / 详细统计 ────────────────────── */

  private readonly GROUP_PREFIX = 'zhipath:group:';

  /**
   * 批量添加一组 Agent 任务，返回 groupId 和所有 jobId。
   * 通过 Redis Hash 记录组成员，支持后续进度查询和批量取消。
   */
  async addAgentTaskGroup(
    userId: number,
    tasks: Array<{ agentType: string; params: Record<string, any>; priority?: number }>,
    options?: { groupDelay?: number },
  ): Promise<{ groupId: string; jobIds: string[] }> {
    const groupId = randomUUID();
    const jobIds: string[] = [];
    const delay = options?.groupDelay ?? 0;

    for (const task of tasks) {
      const job = await this.agentQueue.add(
        task.agentType,
        {
          userId,
          agentType: task.agentType,
          params: task.params,
          groupId,
          createdAt: Date.now(),
        },
        {
          priority: task.priority || 5,
          delay,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { age: 86400 },
          removeOnFail: { age: 604800 },
        },
      );
      jobIds.push(job.id!);
    }

    // Redis Hash: groupId → { total, completed, failed, jobIds }
    const redis = await this.agentQueue.client;
    const key = `${this.GROUP_PREFIX}${groupId}`;
    await redis.hset(key, {
      total: String(tasks.length),
      completed: '0',
      failed: '0',
      jobIds: JSON.stringify(jobIds),
      createdAt: String(Date.now()),
    });
    await redis.runCommand('expire', [key, '604800']); // 7 天自动清理

    this.logger.log(`[Group] Created ${groupId} with ${jobIds.length} jobs for user ${userId}`);
    return { groupId, jobIds };
  }

  /**
   * 动态计算任务超时时间（毫秒）。
   *
   * 基准（秒）：lecture 120 | exam 180 | path 300 | video 600 | 默认 120
   * 按 params 中的数量/复杂度因子动态伸缩。
   */
  calculateTimeout(agentType: string, params: Record<string, any>): number {
    // 基准（秒）
    const baseSeconds: Record<string, number> = {
      lecture:  120,
      exam:     180,
      assess:   180,
      path:     300,
      video:    600,
      reading:   90,
      code:     150,
      default:  120,
    };
    const base = (baseSeconds[agentType] ?? baseSeconds.default) * 1000;

    // 根据 agentType 选取复杂度因子
    let factor = 1;
    switch (agentType) {
      case 'lecture':
        factor = Math.max(1, (params.slideCount ?? params.count ?? 10) / 10);
        break;
      case 'exam':
      case 'assess':
        factor = Math.max(1, (params.questionCount ?? params.count ?? 10) / 10);
        break;
      case 'video':
        factor = Math.max(1, (params.durationSec ?? params.seconds ?? 60) / 60);
        break;
      case 'path':
        factor = Math.max(1, (params.nodeCount ?? params.steps ?? 5) / 5) * 1.5;
        break;
      default:
        factor = Math.max(1, (params.count ?? 1));
        break;
    }

    // 限制在 [1x, 5x] 范围内，防止极端值
    const clamped = Math.min(5, Math.max(1, factor));
    return Math.round(base * clamped);
  }

  /**
   * 获取详细统计信息：队列概览 + 按 Agent 类型细分 + 运行时间。
   */
  async getDetailedStats(): Promise<{
    agent: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      byType: Record<string, any>;
    };
    resource: { waiting: number; active: number; completed: number; failed: number };
    uptime: number;
  }> {
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

    // 按 agentType 聚合统计（扫描已完成 + 失败的任务，各取最近 200 条）
    const byType: Record<string, any> = {};
    try {
      const [completedJobs, failedJobs] = await Promise.all([
        this.agentQueue.getCompleted(0, 200),
        this.agentQueue.getFailed(0, 200),
      ]);

      for (const job of completedJobs) {
        const type = (job.data?.agentType as string) ?? job.name;
        if (!byType[type]) {
          byType[type] = { completed: 0, failed: 0, avgDurationMs: 0, totalDurationMs: 0 };
        }
        byType[type].completed++;
        if (job.finishedOn && job.processedOn) {
          byType[type].totalDurationMs += job.finishedOn - job.processedOn;
        }
      }
      for (const job of failedJobs) {
        const type = (job.data?.agentType as string) ?? job.name;
        if (!byType[type]) {
          byType[type] = { completed: 0, failed: 0, avgDurationMs: 0, totalDurationMs: 0 };
        }
        byType[type].failed++;
      }
      for (const type of Object.keys(byType)) {
        const s = byType[type];
        const total = s.completed + s.failed;
        s.successRate = total > 0 ? Math.round((s.completed / total) * 100) : 0;
        s.avgDurationMs = s.completed > 0 ? Math.round(s.totalDurationMs / s.completed) : 0;
        delete s.totalDurationMs;
      }
    } catch {
      // Redis 不可用时降级为空
    }

    return {
      agent: {
        waiting: agentWaiting,
        active: agentActive,
        completed: agentCompleted,
        failed: agentFailed,
        byType,
      },
      resource: { waiting: resourceWaiting, active: resourceActive, completed: resourceCompleted, failed: resourceFailed },
      uptime: Math.round(process.uptime()),
    };
  }

  /**
   * 批量取消任务组内的所有任务。返回实际取消的数量。
   */
  async cancelGroupJobs(queueName: 'agent-tasks' | 'resource-tasks', groupId: string): Promise<number> {
    const queue = queueName === 'agent-tasks' ? this.agentQueue : this.resourceQueue;
    const redis = await queue.client;
    const key = `${this.GROUP_PREFIX}${groupId}`;
    const rawJobIds = await redis.hget(key, 'jobIds');

    if (!rawJobIds) return 0;

    let jobIds: string[];
    try {
      jobIds = JSON.parse(rawJobIds) as string[];
    } catch {
      return 0;
    }

    let cancelled = 0;
    const pipeline = redis.pipeline();

    for (const jobId of jobIds) {
      const job = await queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (['waiting', 'delayed', 'prioritized'].includes(state)) {
          await job.remove();
          cancelled++;
        }
      }
    }

    // 更新组状态标记
    pipeline.hset(key, { cancelled: String(cancelled), cancelledAt: String(Date.now()) });
    pipeline.exec().catch(() => {});

    this.logger.log(`[Group] Cancelled ${cancelled} jobs in group ${groupId}`);
    return cancelled;
  }

  /**
   * 查询任务组的执行进度。
   */
  async getGroupProgress(groupId: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    active: number;
    percent: number;
  }> {
    const redis = await this.agentQueue.client;
    const key = `${this.GROUP_PREFIX}${groupId}`;
    const data = await redis.hgetall(key);

    if (!data || !data.total) {
      return { total: 0, completed: 0, failed: 0, active: 0, percent: 0 };
    }

    const total = Number(data.total) || 0;
    let completed = Number(data.completed) || 0;
    let failed = Number(data.failed) || 0;

    // 逐个检查任务实际状态，同步计数器（防止回调遗漏）
    let active = 0;
    try {
      const jobIds: string[] = JSON.parse(data.jobIds ?? '[]');
      let realCompleted = 0;
      let realFailed = 0;
      let realActive = 0;

      for (const jobId of jobIds) {
        const job = await this.agentQueue.getJob(jobId);
        if (!job) continue;
        const state = await job.getState();
        if (state === 'completed') realCompleted++;
        else if (state === 'failed') realFailed++;
        else if (state === 'active') realActive++;
      }

      // 回写修正值
      completed = realCompleted;
      failed = realFailed;
      active = realActive;
      await redis.hset(key, { completed: String(completed), failed: String(failed) });
    } catch {
      // 降级使用缓存值
    }

    const percent = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;

    return { total, completed, failed, active, percent };
  }
}

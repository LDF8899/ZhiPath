import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  LectureAgentService,
  ReadingAgentService,
  CodeAgentService,
  PathAgentService,
  AssessAgentService,
} from '../../services/agents';
import { EventsService } from '../events/events.service';

/**
 * 可重试错误：网络超时、LLM 限流 (429)、连接重置
 */
class RetryableError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'RetryableError';
  }
}

/**
 * 不可重试错误：参数无效、未知 agent 类型
 */
class NonRetryableError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

/**
 * Agent 任务处理器
 *
 * §23 每步通过 SSE 推送进度给前端（智能体办公室）
 *
 * 增强特性：
 * - 细粒度进度推送（10→30→60→80→100）
 * - 占位符模式：任务开始即推送"已接收"
 * - 错误分类：可重试 vs 不可重试
 * - 结果缓存：相同参数 5 分钟内直接返回缓存
 */
@Processor('agent-tasks', { prefix: 'zhipath' })
export class AgentProcessor extends WorkerHost {
  /** 结果缓存：key = `${agentType}:${JSON.stringify(params)}` */
  private static resultCache = new Map<string, { result: any; expiry: number }>();

  /** 缓存有效期 5 分钟 */
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;

  /** 缓存清理间隔 10 分钟 */
  private static readonly CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

  private static cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly lectureAgent: LectureAgentService,
    private readonly readingAgent: ReadingAgentService,
    private readonly codeAgent: CodeAgentService,
    private readonly pathAgent: PathAgentService,
    private readonly assessAgent: AssessAgentService,
    private readonly events: EventsService,
  ) {
    super();
    // 启动缓存定期清理
    if (!AgentProcessor.cleanupTimer) {
      AgentProcessor.cleanupTimer = setInterval(() => {
        AgentProcessor.evictExpired();
      }, AgentProcessor.CLEANUP_INTERVAL_MS);
    }
  }

  async process(job: Job): Promise<any> {
    const { userId, agentType, params } = job.data;
    const jobId = String(job.id);

    // ── 1. 占位符模式：立即推送"任务已接收" ──────────────────────
    this.events.emitAgentStatus(userId, agentType, 'working');
    this.events.emitAgentProgress(userId, agentType, jobId, 0, `${agentType} 任务已接收，排队等待执行`);
    console.log(`[AgentProcessor] Received ${agentType} for user ${userId}, job ${job.id}`);

    // ── 2. 参数校验（不可重试） ──────────────────────────────────
    this.validateParams(agentType, params);

    // ── 3. 缓存查询 ─────────────────────────────────────────────
    const cacheKey = `${agentType}:${JSON.stringify(params)}`;
    const cached = AgentProcessor.resultCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      console.log(`[AgentProcessor] Cache hit for ${agentType}, user ${userId}`);
      await job.updateProgress(100);
      this.events.emitAgentProgress(userId, agentType, jobId, 100, `${agentType} 使用缓存结果`);
      this.events.emitAgentStatus(userId, agentType, 'idle');
      return cached.result;
    }

    // ── 4. 带细粒度进度的执行 ───────────────────────────────────
    try {
      const result = await this.executeWithProgress(job, userId, agentType, jobId, params);

      // 写入缓存
      AgentProcessor.resultCache.set(cacheKey, {
        result,
        expiry: Date.now() + AgentProcessor.CACHE_TTL_MS,
      });
      AgentProcessor.evictExpired();

      // 最终状态
      await job.updateProgress(100);
      this.events.emitAgentProgress(userId, agentType, jobId, 100, `${agentType} 任务完成`);
      this.events.emitAgentStatus(userId, agentType, 'idle');
      console.log(`[AgentProcessor] Completed ${agentType} for user ${userId}`);
      return result;
    } catch (e: any) {
      return this.handleError(e, userId, agentType, jobId);
    }
  }

  /**
   * 细粒度进度执行器：10（准备）→ 30（参数就绪）→ 60（执行中）→ 80（收尾）→ 100
   */
  private async executeWithProgress(
    job: Job,
    userId: number,
    agentType: string,
    jobId: string,
    params: any,
  ): Promise<any> {
    // 10 — 准备阶段
    await job.updateProgress(10);
    this.events.emitAgentProgress(userId, agentType, jobId, 10, `${agentType} 正在准备资源`);
    await this.sleep(50); // 给前端渲染时间

    // 30 — 参数就绪，即将调用 Agent
    await job.updateProgress(30);
    this.events.emitAgentProgress(userId, agentType, jobId, 30, `${agentType} 参数就绪，开始调用智能体`);
    await this.sleep(50);

    // 60 — Agent 执行中
    await job.updateProgress(60);
    this.events.emitAgentProgress(userId, agentType, jobId, 60, `${agentType} 智能体执行中，请稍候`);

    const result = await this.invokeAgent(agentType, params);

    // 80 — 收尾，处理结果
    await job.updateProgress(80);
    this.events.emitAgentProgress(userId, agentType, jobId, 80, `${agentType} 正在整理结果`);
    await this.sleep(50);

    return result;
  }

  /**
   * 调用具体 Agent，包装错误分类
   */
  private async invokeAgent(agentType: string, params: any): Promise<any> {
    try {
      switch (agentType) {
        case 'lecture':
          return await this.lectureAgent.generate(params.skillName, params.level, params.extra);
        case 'reading':
          return await this.readingAgent.generate(params.skillName, params.count, params.focus);
        case 'code':
          return await this.codeAgent.generate(params.skillName, params.language, params.count);
        case 'path':
          return await this.pathAgent.generate(params.goal, params.currentLevel, params.availableTime, params.preferences);
        case 'assess':
          return await this.assessAgent.assess(params.learningData, params.goal, params.currentProgress);
        default:
          throw new NonRetryableError(`Unknown agent type: ${agentType}`);
      }
    } catch (e: any) {
      // 已分类的错误直接抛出
      if (e instanceof RetryableError || e instanceof NonRetryableError) {
        throw e;
      }
      // 根据错误信息分类
      throw this.classifyError(e);
    }
  }

  /**
   * 参数校验（不可重试）
   */
  private validateParams(agentType: string, params: any): void {
    if (!agentType) {
      throw new NonRetryableError('agentType is required');
    }
    if (!params || typeof params !== 'object') {
      throw new NonRetryableError('params must be a non-null object');
    }
    const validTypes = ['lecture', 'reading', 'code', 'path', 'assess'];
    if (!validTypes.includes(agentType)) {
      throw new NonRetryableError(`Unknown agent type: ${agentType}. Valid: ${validTypes.join(', ')}`);
    }
    // 各 agent 必填参数检查
    if (agentType === 'lecture' && !params.skillName) {
      throw new NonRetryableError('lecture agent requires params.skillName');
    }
    if (agentType === 'reading' && !params.skillName) {
      throw new NonRetryableError('reading agent requires params.skillName');
    }
    if (agentType === 'code' && !params.skillName) {
      throw new NonRetryableError('code agent requires params.skillName');
    }
    if (agentType === 'path' && !params.goal) {
      throw new NonRetryableError('path agent requires params.goal');
    }
  }

  /**
   * 错误分类：将原始错误转为 RetryableError 或 NonRetryableError
   */
  private classifyError(e: Error): RetryableError | NonRetryableError {
    const msg = (e.message || '').toLowerCase();
    const code = (e as any).code || '';

    // 可重试：网络超时
    if (msg.includes('timeout') || msg.includes('timed out') || code === 'ETIMEDOUT' || code === 'ECONNRESET') {
      return new RetryableError(`Network timeout: ${e.message}`, e);
    }
    // 可重试：连接错误
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      return new RetryableError(`Connection error: ${e.message}`, e);
    }
    // 可重试：LLM 限流
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) {
      return new RetryableError(`Rate limited: ${e.message}`, e);
    }
    // 可重试：服务端 5xx
    if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
      return new RetryableError(`Server error: ${e.message}`, e);
    }
    // 可重试：socket hang up
    if (msg.includes('socket hang up') || msg.includes('socket disconnected')) {
      return new RetryableError(`Socket error: ${e.message}`, e);
    }
    // 可重试：LLM 上游临时故障
    if (msg.includes('overloaded') || msg.includes('capacity') || msg.includes('unavailable')) {
      return new RetryableError(`Upstream unavailable: ${e.message}`, e);
    }

    // 默认不可重试
    return new NonRetryableError(e.message, e);
  }

  /**
   * 统一错误处理：推送 SSE 错误状态，根据分类决定是否向外抛出
   */
  private handleError(e: any, userId: number, agentType: string, jobId: string): never {
    const isRetryable = e instanceof RetryableError;
    const errorType = isRetryable ? 'RETRYABLE' : 'NON_RETRYABLE';
    const errorMsg = `[${errorType}] ${e.message}`;

    console.error(`[AgentProcessor] Failed ${agentType} for user ${userId} (${errorType}):`, e.message);
    this.events.emitAgentProgress(userId, agentType, jobId, -1, `${agentType} 出错：${e.message}`);
    this.events.emitAgentStatus(userId, agentType, 'error', errorMsg);

    // 可重试错误：BullMQ 会根据 job 配置自动重试
    // 不可重试错误：直接抛出，跳过重试
    if (!isRetryable) {
      // 标记为不可重试，BullMQ 不再尝试
      throw new NonRetryableError(errorMsg, e.cause);
    }
    // 可重试：正常抛出，BullMQ 重试机制接管
    throw e;
  }

  /**
   * 清理过期缓存
   */
  private static evictExpired(): void {
    const now = Date.now();
    AgentProcessor.resultCache.forEach((entry, key) => {
      if (entry.expiry <= now) {
        AgentProcessor.resultCache.delete(key);
      }
    });
  }

  /**
   * 获取缓存统计（用于健康检查）
   */
  static getCacheStats(): { size: number; keys: string[] } {
    AgentProcessor.evictExpired();
    return {
      size: AgentProcessor.resultCache.size,
      keys: Array.from(AgentProcessor.resultCache.keys()),
    };
  }

  /**
   * 清空缓存（用于测试或强制刷新）
   */
  static clearCache(): void {
    AgentProcessor.resultCache.clear();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

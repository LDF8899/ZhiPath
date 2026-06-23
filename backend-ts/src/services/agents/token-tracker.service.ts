import { Injectable } from '@nestjs/common';

/**
 * Token 用量追踪服务
 *
 * 功能：
 * 1. 记录每次 LLM 调用的 token 用量
 * 2. 按智能体/用户/时间维度统计
 * 3. 预算告警
 *
 * 场景：成本控制、用量分析
 */

interface TokenUsage {
  agent: string;
  action: string;
  userId?: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
  tier: 'flash' | 'pro';
  timestamp: number;
  durationMs: number;
}

interface TokenStats {
  totalCalls: number;
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byAgent: Record<string, { calls: number; tokens: number }>;
  byTier: Record<string, { calls: number; tokens: number }>;
  byModel: Record<string, { calls: number; tokens: number }>;
  estimatedCost: number;
}

@Injectable()
export class TokenTrackerService {
  private usageLog: TokenUsage[] = [];
  private readonly maxLogSize = 10000;

  // 价格表（每 1000 tokens，美元）
  private readonly pricing: Record<string, { input: number; output: number }> = {
    'deepseek-v4-flash': { input: 0.0001, output: 0.0002 },
    'deepseek-v4-pro': { input: 0.001, output: 0.002 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'qwen2.5:7b': { input: 0, output: 0 }, // 本地模型免费
  };

  // 预算配置
  private budgetConfig = {
    dailyLimit: 1000000,    // 每日 token 限制
    monthlyLimit: 30000000, // 每月 token 限制
    alertThreshold: 0.8,    // 告警阈值（80%）
  };

  /**
   * 记录 token 用量
   */
  record(usage: TokenUsage): void {
    this.usageLog.push(usage);

    // 限制日志大小
    if (this.usageLog.length > this.maxLogSize) {
      this.usageLog = this.usageLog.slice(-this.maxLogSize / 2);
    }

    // 检查预算
    this.checkBudget(usage);
  }

  /**
   * 创建追踪器（返回一个函数，用于包装 LLM 调用）
   */
  createTracker(agent: string, action: string, userId?: number) {
    const startTime = Date.now();

    return (result: { inputTokens?: number; outputTokens?: number; model?: string; tier?: string }) => {
      const durationMs = Date.now() - startTime;
      const inputTokens = result.inputTokens || 0;
      const outputTokens = result.outputTokens || 0;

      this.record({
        agent,
        action,
        userId,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        model: result.model || 'unknown',
        tier: (result.tier as 'flash' | 'pro') || 'flash',
        timestamp: Date.now(),
        durationMs,
      });
    };
  }

  /**
   * 包装 LLM 调用，自动追踪 token
   */
  async wrapLLMCall<T>(
    agent: string,
    action: string,
    fn: () => Promise<T>,
    options?: { userId?: number; model?: string; tier?: string },
  ): Promise<T> {
    const tracker = this.createTracker(agent, action, options?.userId);
    const startTime = Date.now();

    try {
      const result = await fn();

      // 尝试从结果中提取 token 信息
      // 这需要 LlmService 返回 token 用量
      tracker({
        inputTokens: (result as any)?.usage?.prompt_tokens || 0,
        outputTokens: (result as any)?.usage?.completion_tokens || 0,
        model: options?.model,
        tier: options?.tier,
      });

      return result;
    } catch (e) {
      // 失败也记录（0 tokens）
      tracker({
        inputTokens: 0,
        outputTokens: 0,
        model: options?.model,
        tier: options?.tier,
      });
      throw e;
    }
  }

  /**
   * 获取统计数据
   */
  getStats(options?: {
    agent?: string;
    userId?: number;
    startTime?: number;
    endTime?: number;
  }): TokenStats {
    let filtered = this.usageLog;

    if (options?.agent) {
      filtered = filtered.filter(u => u.agent === options.agent);
    }
    if (options?.userId) {
      filtered = filtered.filter(u => u.userId === options.userId);
    }
    if (options?.startTime) {
      filtered = filtered.filter(u => u.timestamp >= options.startTime!);
    }
    if (options?.endTime) {
      filtered = filtered.filter(u => u.timestamp <= options.endTime!);
    }

    const byAgent: Record<string, { calls: number; tokens: number }> = {};
    const byTier: Record<string, { calls: number; tokens: number }> = {};
    const byModel: Record<string, { calls: number; tokens: number }> = {};

    let totalTokens = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let estimatedCost = 0;

    for (const usage of filtered) {
      totalTokens += usage.totalTokens;
      totalInputTokens += usage.inputTokens;
      totalOutputTokens += usage.outputTokens;

      // 按智能体统计
      if (!byAgent[usage.agent]) byAgent[usage.agent] = { calls: 0, tokens: 0 };
      byAgent[usage.agent].calls++;
      byAgent[usage.agent].tokens += usage.totalTokens;

      // 按 tier 统计
      if (!byTier[usage.tier]) byTier[usage.tier] = { calls: 0, tokens: 0 };
      byTier[usage.tier].calls++;
      byTier[usage.tier].tokens += usage.totalTokens;

      // 按模型统计
      if (!byModel[usage.model]) byModel[usage.model] = { calls: 0, tokens: 0 };
      byModel[usage.model].calls++;
      byModel[usage.model].tokens += usage.totalTokens;

      // 计算成本
      const pricing = this.pricing[usage.model];
      if (pricing) {
        estimatedCost += (usage.inputTokens / 1000) * pricing.input;
        estimatedCost += (usage.outputTokens / 1000) * pricing.output;
      }
    }

    return {
      totalCalls: filtered.length,
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      byAgent,
      byTier,
      byModel,
      estimatedCost: Math.round(estimatedCost * 10000) / 10000, // 保留4位小数
    };
  }

  /**
   * 获取今日用量
   */
  getTodayStats(): TokenStats {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.getStats({ startTime: today.getTime() });
  }

  /**
   * 获取本月用量
   */
  getMonthStats(): TokenStats {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.getStats({ startTime: monthStart.getTime() });
  }

  /**
   * 检查预算
   */
  private checkBudget(usage: TokenUsage): void {
    const todayStats = this.getTodayStats();
    const monthStats = this.getMonthStats();

    // 每日预算检查
    if (todayStats.totalTokens > this.budgetConfig.dailyLimit * this.budgetConfig.alertThreshold) {
      console.warn(`[TokenTracker] ⚠️ 每日 token 用量已达 ${Math.round(todayStats.totalTokens / this.budgetConfig.dailyLimit * 100)}%`);
    }

    // 每月预算检查
    if (monthStats.totalTokens > this.budgetConfig.monthlyLimit * this.budgetConfig.alertThreshold) {
      console.warn(`[TokenTracker] ⚠️ 每月 token 用量已达 ${Math.round(monthStats.totalTokens / this.budgetConfig.monthlyLimit * 100)}%`);
    }
  }

  /**
   * 更新预算配置
   */
  updateBudget(config: Partial<typeof this.budgetConfig>): void {
    Object.assign(this.budgetConfig, config);
  }

  /**
   * 获取预算状态
   */
  getBudgetStatus(): {
    daily: { used: number; limit: number; percentage: number };
    monthly: { used: number; limit: number; percentage: number };
  } {
    const todayStats = this.getTodayStats();
    const monthStats = this.getMonthStats();

    return {
      daily: {
        used: todayStats.totalTokens,
        limit: this.budgetConfig.dailyLimit,
        percentage: Math.round(todayStats.totalTokens / this.budgetConfig.dailyLimit * 100),
      },
      monthly: {
        used: monthStats.totalTokens,
        limit: this.budgetConfig.monthlyLimit,
        percentage: Math.round(monthStats.totalTokens / this.budgetConfig.monthlyLimit * 100),
      },
    };
  }
}

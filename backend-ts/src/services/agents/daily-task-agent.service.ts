import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm.service';
import { AgentCacheService } from './cache.service';
import { extractJson } from '../../common/json-repair';

/**
 * 每日任务调度 Agent
 *
 * 功能：
 * 1. 从学习路径中抽取每日任务
 * 2. 根据用户学习进度动态调整
 * 3. 生成任务推荐和鼓励语
 *
 * 优化：
 * - 支持更多上下文（天气、节日、用户心情）
 * - 智能调整任务量
 * - 缓存今日任务（10分钟）
 */

// ── 输入数据 ──────────────────────────────────

export interface DailyTaskInput {
  userId: number;
  date: string;                    // "2026-06-13"
  availableMinutes: number;        // 今日可用学习时长
  mainlineRatio: number;           // 主线比例 0-1（如 0.8）

  // 当前学习路径
  currentPath: {
    planId: string;
    planName: string;
    currentPhase: number;
    phases: Array<{
      name: string;
      skills: Array<{
        id: string;
        name: string;
        status: 'pending' | 'in_progress' | 'done' | 'skipped';
        mastery: number;
        estimatedMinutes: number;
        dependencies: string[];    // 前置技能 ID
      }>;
    }>;
  };

  // 支线计划（可选）
  sidePaths?: Array<{
    planId: string;
    planName: string;
    skills: Array<{
      id: string;
      name: string;
      status: string;
      mastery: number;
      estimatedMinutes: number;
    }>;
  }>;

  // 用户学习历史（用于调整推荐）
  recentHistory?: {
    consecutiveDays: number;       // 连续学习天数
    averageMinutes: number;        // 近7天日均学习时长
    lastSessionDate: string;       // 上次学习日期
    pace: 'fast' | 'normal' | 'slow';  // 学习速度
  };

  // 扩展上下文（新增）
  context?: {
    mood?: 'energetic' | 'normal' | 'tired';  // 用户心情
    dayOfWeek?: number;                        // 星期几（0-6）
    isHoliday?: boolean;                       // 是否节假日
    weather?: string;                          // 天气（可选）
    recentPerformance?: {                      // 近期表现
      avgAccuracy: number;                     // 平均正确率
      completionRate: number;                  // 完成率
    };
  };
}

// ── 输出任务 ──────────────────────────────────

export interface DailyTaskOutput {
  date: string;
  totalEstimatedMinutes: number;
  mainlineTasks: TaskItem[];
  sideTasks: TaskItem[];
  encouragement: string;           // 鼓励语
  tip: string;                     // 今日学习小贴士
  adjustments: string[];           // 调整说明
  schedule: ScheduleItem[];        // 建议时间表
  metadata: {
    mood: string;
    energyLevel: 'high' | 'medium' | 'low';
    suggestedBreaks: number;       // 建议休息次数
    focusMode: boolean;            // 是否建议专注模式
  };
}

export interface TaskItem {
  skillId: string;
  skillName: string;
  taskType: 'mainline' | 'side';
  estimatedMinutes: number;
  priority: number;                // 1-10
  status: 'pending';
  suggestedAction: 'lecture' | 'practice' | 'coding' | 'review';
  reason: string;                  // 为什么推荐这个任务
  dependencies: string[];          // 前置技能
  difficulty: 'easy' | 'medium' | 'hard';
  energyRequired: 'low' | 'medium' | 'high';
}

export interface ScheduleItem {
  timeSlot: string;                // "09:00-09:45"
  taskName: string;
  duration: number;                // 分钟
  type: 'focus' | 'review' | 'break';
}

@Injectable()
export class DailyTaskAgentService {
  constructor(
    private llmService: LlmService,
    private cacheService: AgentCacheService,
  ) {}

  /**
   * 生成每日任务
   * @param input 任务输入数据
   */
  async generateTasks(input: DailyTaskInput): Promise<DailyTaskOutput> {
    // 尝试从缓存获取（10分钟）
    const cacheKey = this.cacheService.generateKey('DailyTaskAgent', 'generateTasks', {
      userId: input.userId,
      date: input.date,
    });
    const cached = await this.cacheService.get<DailyTaskOutput>(cacheKey);
    if (cached) {
      console.log(`[DailyTaskAgent] 缓存命中: ${input.userId} - ${input.date}`);
      return cached;
    }

    // 1. 算法生成基础任务列表
    const basicTasks = this.calculateBasicTasks(input);

    // 2. 用 LLM 生成鼓励语和小贴士（带上下文）
    const messages = this.buildEncouragementPrompt(input, basicTasks);
    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 1024,
      tier: 'flash',
    });

    const llmResult = this.parseEncouragement(raw);

    // 3. 生成建议时间表
    const schedule = this.generateSchedule(basicTasks.mainlineTasks, basicTasks.sideTasks, input);

    // 4. 确定能量水平和专注模式
    const metadata = this.calculateMetadata(input);

    const result: DailyTaskOutput = {
      ...basicTasks,
      encouragement: llmResult.encouragement,
      tip: llmResult.tip,
      schedule,
      metadata,
    };

    // 写入缓存（10分钟）
    await this.cacheService.set(cacheKey, result, 600);

    return result;
  }

  /**
   * 快速生成任务（纯算法，不调用 LLM）
   * @param input 任务输入数据
   */
  generateQuickTasks(input: DailyTaskInput): DailyTaskOutput {
    const basicTasks = this.calculateBasicTasks(input);
    const schedule = this.generateSchedule(basicTasks.mainlineTasks, basicTasks.sideTasks, input);
    const metadata = this.calculateMetadata(input);

    return {
      ...basicTasks,
      encouragement: '今天也要加油学习哦！',
      tip: '建议先完成主线任务，再学习支线内容。',
      schedule,
      metadata,
    };
  }

  // ── 基础算法 ──────────────────────────────────

  private calculateBasicTasks(input: DailyTaskInput): Omit<DailyTaskOutput, 'encouragement' | 'tip' | 'schedule' | 'metadata'> {
    const { availableMinutes, mainlineRatio, currentPath, sidePaths, recentHistory, context } = input;

    // 计算主线和支线可用时间
    let mainlineMinutes = Math.round(availableMinutes * mainlineRatio);
    let sideMinutes = availableMinutes - mainlineMinutes;

    // 动态调整
    const adjustments: string[] = [];

    // 根据上下文调整
    if (context) {
      // 心情调整
      if (context.mood === 'tired') {
        mainlineMinutes = Math.round(mainlineMinutes * 0.7);
        sideMinutes = Math.round(sideMinutes * 0.5);
        adjustments.push('今天状态一般，任务量减少30%，注意休息');
      } else if (context.mood === 'energetic') {
        mainlineMinutes = Math.round(mainlineMinutes * 1.1);
        adjustments.push('状态很好！适当增加一点挑战');
      }

      // 周末调整
      if (context.dayOfWeek === 0 || context.dayOfWeek === 6) {
        mainlineMinutes = Math.round(mainlineMinutes * 1.2);
        sideMinutes = Math.round(sideMinutes * 1.3);
        adjustments.push('周末时间充裕，可以多学一点');
      }

      // 节假日调整
      if (context.isHoliday) {
        mainlineMinutes = Math.round(mainlineMinutes * 0.8);
        sideMinutes = Math.round(sideMinutes * 1.5);
        adjustments.push('节假日轻松学习，多探索感兴趣的支线');
      }

      // 近期表现调整
      if (context.recentPerformance) {
        if (context.recentPerformance.avgAccuracy < 60) {
          adjustments.push('近期正确率较低，建议复习巩固');
        }
        if (context.recentPerformance.completionRate < 50) {
          mainlineMinutes = Math.round(mainlineMinutes * 0.8);
          adjustments.push('近期完成率较低，适当减少任务量');
        }
      }
    }

    // 学习历史调整
    if (recentHistory) {
      const lastSession = new Date(recentHistory.lastSessionDate);
      const today = new Date(input.date);
      const daysSinceLastSession = Math.floor((today.getTime() - lastSession.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceLastSession >= 3) {
        mainlineMinutes = Math.round(mainlineMinutes * 0.5);
        sideMinutes = Math.round(sideMinutes * 0.3);
        adjustments.push(`已${daysSinceLastSession}天未学习，今日任务量减少50%，帮助你轻松回归`);
      }

      // 如果学习速度快，可以增加任务
      if (recentHistory.pace === 'fast') {
        mainlineMinutes = Math.round(mainlineMinutes * 1.2);
        adjustments.push('你学习速度很快，今日任务量增加20%');
      }
    }

    // 获取当前阶段的技能
    const currentPhase = currentPath.phases[currentPath.currentPhase];
    if (!currentPhase) {
      return {
        date: input.date,
        totalEstimatedMinutes: 0,
        mainlineTasks: [],
        sideTasks: [],
        adjustments,
      };
    }

    // 筛选未完成的技能，按依赖拓扑排序
    const pendingSkills = currentPhase.skills
      .filter(s => s.status !== 'done' && s.status !== 'skipped')
      .filter(s => this.areDependenciesMet(s.dependencies, currentPhase.skills))
      .sort((a, b) => {
        // 优先级：正在学习的 > 未开始的
        if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
        if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
        return 0;
      });

    // 分配主线任务
    const mainlineTasks: TaskItem[] = [];
    let mainlineUsed = 0;

    for (const skill of pendingSkills) {
      if (mainlineUsed >= mainlineMinutes) break;

      const remainingMinutes = skill.estimatedMinutes - this.getSpentMinutes(skill);
      if (remainingMinutes <= 0) continue;

      const taskMinutes = Math.min(remainingMinutes, mainlineMinutes - mainlineUsed);
      mainlineUsed += taskMinutes;

      mainlineTasks.push({
        skillId: skill.id,
        skillName: skill.name,
        taskType: 'mainline',
        estimatedMinutes: taskMinutes,
        priority: skill.status === 'in_progress' ? 10 : 8,
        status: 'pending',
        suggestedAction: this.suggestAction(skill),
        reason: skill.status === 'in_progress' ? '继续学习中' : '前置技能已完成，可以开始',
        dependencies: skill.dependencies,
        difficulty: this.estimateDifficulty(skill),
        energyRequired: this.estimateEnergyRequired(skill),
      });
    }

    // 分配支线任务
    const sideTasks: TaskItem[] = [];
    let sideUsed = 0;

    if (sidePaths?.length) {
      for (const path of sidePaths) {
        for (const skill of path.skills) {
          if (sideUsed >= sideMinutes) break;
          if (skill.status === 'done' || skill.status === 'skipped') continue;

          const taskMinutes = Math.min(skill.estimatedMinutes, sideMinutes - sideUsed);
          sideUsed += taskMinutes;

          sideTasks.push({
            skillId: skill.id,
            skillName: skill.name,
            taskType: 'side',
            estimatedMinutes: taskMinutes,
            priority: 5,
            status: 'pending',
            suggestedAction: 'lecture',
            reason: `支线「${path.planName}」`,
            dependencies: [],
            difficulty: 'medium',
            energyRequired: 'medium',
          });
        }
      }
    }

    return {
      date: input.date,
      totalEstimatedMinutes: mainlineUsed + sideUsed,
      mainlineTasks,
      sideTasks,
      adjustments,
    };
  }

  // ── 时间表生成 ──────────────────────────────────

  private generateSchedule(
    mainlineTasks: TaskItem[],
    sideTasks: TaskItem[],
    input: DailyTaskInput,
  ): ScheduleItem[] {
    const schedule: ScheduleItem[] = [];
    const allTasks = [...mainlineTasks, ...sideTasks];

    if (allTasks.length === 0) return schedule;

    // 默认从早上 9 点开始
    let currentHour = 9;
    let currentMinute = 0;

    // 根据上下文调整开始时间
    if (input.context?.mood === 'tired') {
      currentHour = 10; // 疲惫时晚点开始
    }

    for (const task of allTasks) {
      const startTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

      // 计算结束时间
      let endMinute = currentMinute + task.estimatedMinutes;
      let endHour = currentHour + Math.floor(endMinute / 60);
      endMinute = endMinute % 60;

      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

      schedule.push({
        timeSlot: `${startTime}-${endTime}`,
        taskName: task.skillName,
        duration: task.estimatedMinutes,
        type: 'focus',
      });

      // 每 45 分钟建议休息 5 分钟
      if (task.estimatedMinutes > 45) {
        const breakStart = endTime;
        const breakEndMinute = endMinute + 5;
        const breakEndHour = endHour + Math.floor(breakEndMinute / 60);
        const breakEnd = `${breakEndHour.toString().padStart(2, '0')}:${(breakEndMinute % 60).toString().padStart(2, '0')}`;

        schedule.push({
          timeSlot: `${breakStart}-${breakEnd}`,
          taskName: '休息',
          duration: 5,
          type: 'break',
        });

        currentHour = breakEndHour;
        currentMinute = breakEndMinute % 60;
      } else {
        currentHour = endHour;
        currentMinute = endMinute;
      }
    }

    return schedule;
  }

  // ── 元数据计算 ──────────────────────────────────

  private calculateMetadata(input: DailyTaskInput): DailyTaskOutput['metadata'] {
    const mood = input.context?.mood || 'normal';
    const energyLevel = mood === 'energetic' ? 'high' : mood === 'tired' ? 'low' : 'medium';

    // 建议休息次数（每 45 分钟一次）
    const suggestedBreaks = Math.max(1, Math.floor(input.availableMinutes / 45));

    // 专注模式（能量高且任务多时建议）
    const focusMode = energyLevel === 'high' && input.availableMinutes > 60;

    return {
      mood,
      energyLevel,
      suggestedBreaks,
      focusMode,
    };
  }

  // ── 辅助函数 ──────────────────────────────────

  private areDependenciesMet(dependencies: string[], allSkills: any[]): boolean {
    if (!dependencies.length) return true;
    return dependencies.every(depId => {
      const dep = allSkills.find(s => s.id === depId);
      return dep?.status === 'done';
    });
  }

  private getSpentMinutes(skill: any): number {
    // 这里应该从学习记录中获取已花费时间，简化处理
    if (skill.status === 'in_progress') return Math.round(skill.estimatedMinutes * 0.3);
    return 0;
  }

  private suggestAction(skill: any): 'lecture' | 'practice' | 'coding' | 'review' {
    if (skill.status !== 'in_progress') return 'lecture';
    if (skill.mastery < 30) return 'lecture';
    if (skill.mastery < 60) return 'practice';
    if (skill.mastery < 80) return 'coding';
    return 'review';
  }

  private estimateDifficulty(skill: any): 'easy' | 'medium' | 'hard' {
    if (skill.estimatedMinutes <= 30) return 'easy';
    if (skill.estimatedMinutes <= 60) return 'medium';
    return 'hard';
  }

  private estimateEnergyRequired(skill: any): 'low' | 'medium' | 'high' {
    if (skill.estimatedMinutes <= 30) return 'low';
    if (skill.estimatedMinutes <= 60) return 'medium';
    return 'high';
  }

  // ── LLM Prompt ──────────────────────────────────

  private buildEncouragementPrompt(
    input: DailyTaskInput,
    tasks: Omit<DailyTaskOutput, 'encouragement' | 'tip' | 'schedule' | 'metadata'>,
  ): { role: string; content: string }[] {
    const contextInfo = input.context ? `
用户状态：
- 心情：${input.context.mood || '正常'}
- 星期：${input.context.dayOfWeek !== undefined ? ['日', '一', '二', '三', '四', '五', '六'][input.context.dayOfWeek] : '未知'}
- 节假日：${input.context.isHoliday ? '是' : '否'}
${input.context.recentPerformance ? `- 近期正确率：${input.context.recentPerformance.avgAccuracy}%
- 近期完成率：${input.context.recentPerformance.completionRate}%` : ''}` : '';

    return [
      {
        role: 'system',
        content: `你是学习助手，为用户生成今日的鼓励语和学习小贴士。

要求：
- encouragement：鼓励语（30字内，积极向上，针对用户当前状态）
- tip：学习小贴士（50字内，实用建议）

根据用户状态调整语气：
- 疲惫时：温柔鼓励，强调休息的重要性
- 状态好时：激发斗志，建议挑战
- 连续学习多天：肯定坚持，提醒劳逸结合
- 多天未学习：欢迎回归，降低门槛

输出严格 JSON：
{
  "encouragement": "今天也要加油哦！",
  "tip": "建议先完成主线任务，再学习支线内容。"
}

只输出 JSON，不要其他文字。`,
      },
      {
        role: 'user',
        content: `请为用户生成今日鼓励语：

今日任务：${tasks.mainlineTasks.length} 个主线 + ${tasks.sideTasks.length} 个支线
预计时长：${tasks.totalEstimatedMinutes} 分钟
${input.recentHistory ? `连续学习：${input.recentHistory.consecutiveDays} 天` : ''}
${tasks.adjustments.length > 0 ? `调整说明：${tasks.adjustments.join('；')}` : ''}
${contextInfo}`,
      },
    ];
  }

  private parseEncouragement(raw: string): { encouragement: string; tip: string } {
    try {
      const data = extractJson(raw);
      return {
        encouragement: String(data.encouragement || '今天也要加油学习哦！').substring(0, 100),
        tip: String(data.tip || '建议先完成主线任务。').substring(0, 200),
      };
    } catch (e) {
      console.error('[DailyTaskAgent] JSON parse failed:', e.message);
      return {
        encouragement: '今天也要加油学习哦！',
        tip: '建议先完成主线任务，再学习支线内容。',
      };
    }
  }
}

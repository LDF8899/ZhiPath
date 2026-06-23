import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm.service';
import { extractJson } from '../../common/json-repair';

/**
 * 用户画像分析 Agent
 *
 * 功能：
 * 1. 分析用户学习数据，生成学习报告
 * 2. 提供个性化学习建议
 * 3. 识别学习模式和习惯
 *
 * 场景：个人中心展示、学习周报、AI 助手对话
 */

// ── 输入数据 ──────────────────────────────────

export interface LearningData {
  userId: number;
  period: 'week' | 'month' | 'all';
  totalMinutes: number;              // 总学习时长
  daysActive: number;                // 活跃天数
  skillsLearned: Array<{
    name: string;
    minutesSpent: number;
    masteryBefore: number;
    masteryAfter: number;
    tasksCompleted: number;
  }>;
  examsTaken: Array<{
    skill: string;
    score: number;
    passed: boolean;
  }>;
  matchScoreBefore: number;
  matchScoreAfter: number;
  streakDays: number;                // 连续学习天数
  dailyAverage: number;              // 日均学习时长（分钟）
}

// ── 输出报告 ──────────────────────────────────

export interface ProfileReport {
  summary: string;                   // 一句话总结
  achievements: Achievement[];       // 成就/亮点
  learningPattern: LearningPattern;  // 学习模式分析
  strengths: string[];               // 优势
  weaknesses: string[];              // 待改进
  recommendations: Recommendation[]; // 个性化建议
  motivation: string;                // 鼓励语
  weeklyGoal?: WeeklyGoal;           // 下周目标建议
}

export interface Achievement {
  type: 'skill' | 'streak' | 'exam' | 'match' | 'speed';
  title: string;
  description: string;
  icon: string;                      // emoji 或图标名
}

export interface LearningPattern {
  preferredTime: string;             // 偏好学习时间（如"晚上"）
  averageSessionMinutes: number;     // 平均每次学习时长
  focusArea: string;                 // 主要学习领域
  consistency: 'excellent' | 'good' | 'irregular';  // 学习规律性
  pace: 'fast' | 'normal' | 'slow'; // 学习速度
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'skill' | 'habit' | 'exam' | 'project';
  title: string;
  reason: string;
  action: string;
  estimatedImpact: string;           // 预期效果
}

export interface WeeklyGoal {
  focusSkills: string[];
  targetMinutes: number;
  tasks: string[];
  tip: string;
}

@Injectable()
export class ProfileAgentService {
  constructor(private llmService: LlmService) {}

  /**
   * 生成学习报告
   * @param data 学习数据
   */
  async generateReport(data: LearningData): Promise<ProfileReport> {
    const messages = this.buildReportPrompt(data);
    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.6,
      maxTokens: 4096,
      tier: 'flash',
    });

    return this.parseReport(raw);
  }

  /**
   * 生成学习周报（用于邮件）
   * @param data 学习数据
   */
  async generateWeeklyEmail(data: LearningData): Promise<string> {
    const messages = [
      {
        role: 'system',
        content: `你是学习周报撰写专家，为用户生成简洁的周报邮件正文。

要求：
- 200-300字
- 包含：本周成果、学习亮点、下周建议
- 语气积极鼓励
- 用数据说话（学习时长、完成技能数、匹配度变化等）
- 不要用 Markdown 格式，用纯文本`,
      },
      {
        role: 'user',
        content: `请生成本周学习周报：

学习时长：${data.totalMinutes}分钟（日均${data.dailyAverage}分钟）
活跃天数：${data.daysActive}天
连续学习：${data.streakDays}天
完成技能：${data.skillsLearned.length}个
${data.examsTaken.length > 0 ? `考试：${data.examsTaken.filter(e => e.passed).length}/${data.examsTaken.length} 通过` : ''}
匹配度：${data.matchScoreBefore}% → ${data.matchScoreAfter}%

技能详情：
${data.skillsLearned.map(s => `- ${s.name}: ${s.masteryBefore}% → ${s.masteryAfter}% (${s.minutesSpent}分钟)`).join('\n')}`,
      },
    ];

    return this.llmService.chatCompletion(messages, {
      temperature: 0.6,
      maxTokens: 512,
      tier: 'flash',
    });
  }

  /**
   * 分析学习趋势
   * @param weeklyData 近几周的学习数据
   */
  async analyzeTrend(
    weeklyData: Array<{ week: string; minutes: number; skillsCompleted: number; matchScore: number }>,
  ): Promise<{ trend: string; insight: string; suggestion: string }> {
    const messages = [
      {
        role: 'system',
        content: `你是数据分析专家，分析用户学习趋势并给出洞察。

输出严格 JSON：
{
  "trend": "上升/稳定/下降",
  "insight": "一句话洞察（50字内）",
  "suggestion": "一句建议（50字内）"
}`,
      },
      {
        role: 'user',
        content: `请分析以下学习趋势数据：
${weeklyData.map(w => `${w.week}: ${w.minutes}分钟, ${w.skillsCompleted}个技能, 匹配度${w.matchScore}%`).join('\n')}`,
      },
    ];

    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.4,
      maxTokens: 256,
      tier: 'flash',
    });

    try {
      return extractJson(raw);
    } catch (e) {
      console.error('[ProfileAgent] JSON parse failed:', e.message);
      return { trend: '稳定', insight: '学习进度平稳', suggestion: '保持当前节奏' };
    }
  }

  // ── Prompt 设计 ──────────────────────────────────

  private buildReportPrompt(data: LearningData): { role: string; content: string }[] {
    const periodText = {
      week: '本周',
      month: '本月',
      all: '至今',
    };

    return [
      {
        role: 'system',
        content: `你是学习分析专家，根据用户学习数据生成个性化学习报告。

分析维度：
1. 学习成果（完成了什么）
2. 学习模式（怎么学的）
3. 优势与不足
4. 个性化建议

输出严格 JSON：
{
  "summary": "一句话总结（30字内）",
  "achievements": [
    {
      "type": "skill",
      "title": "掌握 React Hooks",
      "description": "从 30% 提升到 100%",
      "icon": "🎯"
    }
  ],
  "learningPattern": {
    "preferredTime": "晚上",
    "averageSessionMinutes": 45,
    "focusArea": "前端开发",
    "consistency": "good",
    "pace": "normal"
  },
  "strengths": ["学习连续性好", "考试通过率高"],
  "weaknesses": ["编程题练习不足", "支线任务较少"],
  "recommendations": [
    {
      "priority": "high",
      "category": "skill",
      "title": "加强 TypeScript 练习",
      "reason": "目标岗位要求，当前掌握度较低",
      "action": "每天完成 2 道 TypeScript 编程题",
      "estimatedImpact": "匹配度预计提升 5%"
    }
  ],
  "motivation": "坚持下去，你正在稳步接近目标！",
  "weeklyGoal": {
    "focusSkills": ["TypeScript", "React Router"],
    "targetMinutes": 300,
    "tasks": ["完成 TypeScript 基础讲义", "通过 React Router 阶段考试"],
    "tip": "本周重点突破 TypeScript，这是你目标岗位的核心要求"
  }
}

只输出 JSON，不要其他文字。`,
      },
      {
        role: 'user',
        content: `请分析以下学习数据（${periodText[data.period]}）：

总学习时长：${data.totalMinutes} 分钟
活跃天数：${data.daysActive} 天
连续学习：${data.streakDays} 天
日均学习：${data.dailyAverage} 分钟

技能学习：
${data.skillsLearned.map(s => `- ${s.name}: ${s.masteryBefore}% → ${s.masteryAfter}% (${s.minutesSpent}分钟, ${s.tasksCompleted}个任务)`).join('\n')}

${data.examsTaken.length > 0 ? `考试成绩：
${data.examsTaken.map(e => `- ${e.skill}: ${e.score}分 ${e.passed ? '✓' : '✗'}`).join('\n')}` : ''}

匹配度变化：${data.matchScoreBefore}% → ${data.matchScoreAfter}%`,
      },
    ];
  }

  // ── 解析函数 ──────────────────────────────────

  private parseReport(raw: string): ProfileReport {
    try {
      const data = extractJson(raw);

      return {
        summary: String(data.summary || '').substring(0, 100),
        achievements: Array.isArray(data.achievements)
          ? data.achievements.slice(0, 5).map((a: any) => ({
              type: ['skill', 'streak', 'exam', 'match', 'speed'].includes(a.type) ? a.type : 'skill',
              title: String(a.title || '').substring(0, 100),
              description: String(a.description || '').substring(0, 200),
              icon: String(a.icon || '🎯'),
            }))
          : [],
        learningPattern: this.parseLearningPattern(data.learningPattern),
        strengths: Array.isArray(data.strengths)
          ? data.strengths.slice(0, 5).map((s: any) => String(s).substring(0, 100))
          : [],
        weaknesses: Array.isArray(data.weaknesses)
          ? data.weaknesses.slice(0, 5).map((w: any) => String(w).substring(0, 100))
          : [],
        recommendations: Array.isArray(data.recommendations)
          ? data.recommendations.slice(0, 5).map((r: any) => ({
              priority: ['high', 'medium', 'low'].includes(r.priority) ? r.priority : 'medium',
              category: ['skill', 'habit', 'exam', 'project'].includes(r.category) ? r.category : 'skill',
              title: String(r.title || '').substring(0, 100),
              reason: String(r.reason || '').substring(0, 200),
              action: String(r.action || '').substring(0, 200),
              estimatedImpact: String(r.estimatedImpact || '').substring(0, 100),
            }))
          : [],
        motivation: String(data.motivation || '继续加油！').substring(0, 200),
        weeklyGoal: data.weeklyGoal ? this.parseWeeklyGoal(data.weeklyGoal) : undefined,
      };
    } catch (e) {
      console.error('[ProfileAgent] JSON parse failed:', e.message);
      return {
        summary: '学习数据生成中...',
        achievements: [],
        learningPattern: {
          preferredTime: '未知',
          averageSessionMinutes: 0,
          focusArea: '未知',
          consistency: 'irregular',
          pace: 'normal',
        },
        strengths: [],
        weaknesses: [],
        recommendations: [],
        motivation: '继续加油！',
      };
    }
  }

  private parseLearningPattern(pattern: any): LearningPattern {
    if (!pattern) {
      return {
        preferredTime: '未知',
        averageSessionMinutes: 0,
        focusArea: '未知',
        consistency: 'irregular',
        pace: 'normal',
      };
    }
    return {
      preferredTime: String(pattern.preferredTime || '未知'),
      averageSessionMinutes: Number(pattern.averageSessionMinutes) || 0,
      focusArea: String(pattern.focusArea || '未知'),
      consistency: ['excellent', 'good', 'irregular'].includes(pattern.consistency) ? pattern.consistency : 'irregular',
      pace: ['fast', 'normal', 'slow'].includes(pattern.pace) ? pattern.pace : 'normal',
    };
  }

  private parseWeeklyGoal(goal: any): WeeklyGoal {
    return {
      focusSkills: Array.isArray(goal.focusSkills) ? goal.focusSkills.slice(0, 3).map((s: any) => String(s)) : [],
      targetMinutes: Number(goal.targetMinutes) || 300,
      tasks: Array.isArray(goal.tasks) ? goal.tasks.slice(0, 5).map((t: any) => String(t).substring(0, 100)) : [],
      tip: String(goal.tip || '').substring(0, 200),
    };
  }
}

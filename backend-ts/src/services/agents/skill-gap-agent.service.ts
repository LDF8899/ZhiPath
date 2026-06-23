import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm.service';
import { extractJson } from '../../common/json-repair';

/**
 * 技能差距分析 Agent
 *
 * 功能：
 * 1. 分析用户与目标岗位的技能差距
 * 2. 生成差距报告和提升建议
 * 3. 计算匹配度和预估提升时间
 *
 * 场景：岗位详情页、匹配度分析、学习建议
 */

// ── 输入数据 ──────────────────────────────────

export interface SkillGapInput {
  userSkills: Array<{
    name: string;
    mastery: number;       // 0-100
    verified: boolean;     // 是否经过考试验证
  }>;
  targetJob: {
    title: string;
    company: string;
    level: 'junior' | 'mid' | 'senior';
    requiredSkills: Array<{
      name: string;
      weight: number;      // 权重 0-1
      minLevel: number;    // 最低要求掌握度
    }>;
    preferredSkills: Array<{
      name: string;
      weight: number;
      minLevel: number;
    }>;
  };
}

// ── 输出报告 ──────────────────────────────────

export interface SkillGapReport {
  matchScore: number;                // 总匹配度 0-100
  requiredMatch: number;             // 必须技能匹配度
  preferredMatch: number;            // 加分技能匹配度
  canApply: boolean;                 // 是否可以投递
  applyLevel: 'ready' | 'almost' | 'not_ready';  // 投递状态

  matchedSkills: MatchedSkill[];     // 已匹配技能
  gapSkills: GapSkill[];             // 缺少技能
  overqualifiedSkills: string[];     // 超出要求的技能

  gapAnalysis: GapAnalysis;          // 差距分析
  improvementPlan: ImprovementPlan;  // 提升计划
  timeline: TimelineEstimate;        // 时间预估

  suggestions: string[];             // 综合建议
}

export interface MatchedSkill {
  name: string;
  userLevel: number;
  requiredLevel: number;
  coverage: number;        // 覆盖度（userLevel / requiredLevel）
  isVerified: boolean;
}

export interface GapSkill {
  name: string;
  importance: 'required' | 'preferred';
  requiredLevel: number;
  userLevel: number;
  gap: number;             // 差距（requiredLevel - userLevel）
  estimatedHours: number;  // 预估学习时长
  priority: number;        // 优先级（1-10，10最高）
}

export interface GapAnalysis {
  totalRequired: number;
  matchedCount: number;
  gapCount: number;
  matchPercentage: number;
  criticalGaps: string[];  // 关键差距（必须技能中差距最大的）
  quickWins: string[];     // 快速提升点（差距小但权重高的）
}

export interface ImprovementPlan {
  phases: ImprovementPhase[];
  totalEstimatedHours: number;
  totalEstimatedDays: number;
}

export interface ImprovementPhase {
  phase: number;
  name: string;
  skills: string[];
  estimatedHours: number;
  estimatedDays: number;
  priority: 'high' | 'medium' | 'low';
}

export interface TimelineEstimate {
  optimistic: number;      // 乐观预估（天）
  realistic: number;       // 现实预估（天）
  pessimistic: number;     // 悲观预估（天）
  assumptions: string[];   // 假设条件
}

@Injectable()
export class SkillGapAgentService {
  constructor(private llmService: LlmService) {}

  /**
   * 分析技能差距
   * @param input 用户技能 + 目标岗位
   */
  async analyze(input: SkillGapInput): Promise<SkillGapReport> {
    // 先用算法计算基础数据
    const basicAnalysis = this.calculateBasicGap(input);

    // 用 LLM 生成详细的分析和建议
    const messages = this.buildAnalysisPrompt(input, basicAnalysis);
    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.4,
      maxTokens: 4096,
      tier: 'pro',
    });

    return this.parseReport(raw, basicAnalysis);
  }

  /**
   * 快速匹配度计算（纯算法，不调用 LLM）
   * @param input 用户技能 + 目标岗位
   */
  calculateQuickMatch(input: SkillGapInput): { score: number; canApply: boolean; gaps: string[] } {
    const analysis = this.calculateBasicGap(input);
    return {
      score: analysis.matchScore,
      canApply: analysis.canApply,
      gaps: analysis.gapSkills.filter(g => g.importance === 'required').map(g => g.name),
    };
  }

  // ── 基础算法 ──────────────────────────────────

  private calculateBasicGap(input: SkillGapInput): SkillGapReport {
    const { userSkills, targetJob } = input;
    const userSkillMap = new Map(userSkills.map(s => [s.name.toLowerCase(), s]));

    // 分析必须技能
    const matchedSkills: MatchedSkill[] = [];
    const gapSkills: GapSkill[] = [];
    let requiredTotal = 0;
    let requiredMatched = 0;

    for (const req of targetJob.requiredSkills) {
      const userSkill = userSkillMap.get(req.name.toLowerCase());
      const userLevel = userSkill?.mastery || 0;
      const coverage = Math.min(1, userLevel / req.minLevel);

      if (coverage >= 0.8) {
        matchedSkills.push({
          name: req.name,
          userLevel,
          requiredLevel: req.minLevel,
          coverage,
          isVerified: userSkill?.verified || false,
        });
        requiredMatched += coverage * req.weight;
      } else {
        gapSkills.push({
          name: req.name,
          importance: 'required',
          requiredLevel: req.minLevel,
          userLevel,
          gap: req.minLevel - userLevel,
          estimatedHours: Math.ceil((req.minLevel - userLevel) / 10) * 10,
          priority: Math.round(req.weight * 10),
        });
      }
      requiredTotal += req.weight;
    }

    // 分析加分技能
    let preferredTotal = 0;
    let preferredMatched = 0;

    for (const pref of targetJob.preferredSkills) {
      const userSkill = userSkillMap.get(pref.name.toLowerCase());
      const userLevel = userSkill?.mastery || 0;
      const coverage = Math.min(1, userLevel / pref.minLevel);

      if (coverage >= 0.8) {
        matchedSkills.push({
          name: pref.name,
          userLevel,
          requiredLevel: pref.minLevel,
          coverage,
          isVerified: userSkill?.verified || false,
        });
        preferredMatched += coverage * pref.weight;
      } else if (userLevel < pref.minLevel) {
        gapSkills.push({
          name: pref.name,
          importance: 'preferred',
          requiredLevel: pref.minLevel,
          userLevel,
          gap: pref.minLevel - userLevel,
          estimatedHours: Math.ceil((pref.minLevel - userLevel) / 10) * 10,
          priority: Math.round(pref.weight * 5),
        });
      }
      preferredTotal += pref.weight;
    }

    // 计算匹配度（校招权重）
    const requiredScore = requiredTotal > 0 ? (requiredMatched / requiredTotal) * 30 : 0;
    const preferredScore = preferredTotal > 0 ? (preferredMatched / preferredTotal) * 15 : 0;
    const matchScore = Math.round(requiredScore + preferredScore + 55); // 基础分55（项目+考试+进度）

    // 找出超出要求的技能
    const overqualifiedSkills = userSkills
      .filter(u => {
        const req = targetJob.requiredSkills.find(r => r.name.toLowerCase() === u.name.toLowerCase());
        const pref = targetJob.preferredSkills.find(p => p.name.toLowerCase() === u.name.toLowerCase());
        return (req && u.mastery > req.minLevel * 1.2) || (pref && u.mastery > pref.minLevel * 1.2);
      })
      .map(s => s.name);

    // 差距分析
    const criticalGaps = gapSkills
      .filter(g => g.importance === 'required')
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 3)
      .map(g => g.name);

    const quickWins = gapSkills
      .filter(g => g.gap <= 30 && g.priority >= 7)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3)
      .map(g => g.name);

    // 时间预估
    const totalGapHours = gapSkills.reduce((sum, g) => sum + g.estimatedHours, 0);

    return {
      matchScore: Math.min(100, Math.max(0, matchScore)),
      requiredMatch: requiredTotal > 0 ? Math.round((requiredMatched / requiredTotal) * 100) : 0,
      preferredMatch: preferredTotal > 0 ? Math.round((preferredMatched / preferredTotal) * 100) : 0,
      canApply: matchScore >= 60,
      applyLevel: matchScore >= 80 ? 'ready' : matchScore >= 60 ? 'almost' : 'not_ready',
      matchedSkills,
      gapSkills: gapSkills.sort((a, b) => b.priority - a.priority),
      overqualifiedSkills,
      gapAnalysis: {
        totalRequired: targetJob.requiredSkills.length,
        matchedCount: matchedSkills.filter(m => targetJob.requiredSkills.some(r => r.name === m.name)).length,
        gapCount: gapSkills.filter(g => g.importance === 'required').length,
        matchPercentage: Math.round(requiredScore / 30 * 100),
        criticalGaps,
        quickWins,
      },
      improvementPlan: {
        phases: [],
        totalEstimatedHours: totalGapHours,
        totalEstimatedDays: Math.ceil(totalGapHours / 2),
      },
      timeline: {
        optimistic: Math.ceil(totalGapHours / 3),
        realistic: Math.ceil(totalGapHours / 2),
        pessimistic: Math.ceil(totalGapHours / 1.5),
        assumptions: ['每天学习2小时', '学习效率中等'],
      },
      suggestions: [],
    };
  }

  // ── LLM 分析 Prompt ──────────────────────────────────

  private buildAnalysisPrompt(
    input: SkillGapInput,
    basicAnalysis: SkillGapReport,
  ): { role: string; content: string }[] {
    return [
      {
        role: 'system',
        content: `你是职业规划专家，负责分析用户与目标岗位的技能差距并生成详细报告。

基于以下算法分析结果，生成详细的差距分析和提升建议：

算法分析结果：
- 总匹配度：${basicAnalysis.matchScore}%
- 必须技能匹配：${basicAnalysis.requiredMatch}%
- 加分技能匹配：${basicAnalysis.preferredMatch}%
- 可投递：${basicAnalysis.canApply ? '是' : '否'}

已匹配技能：${basicAnalysis.matchedSkills.map(s => `${s.name}(${s.userLevel}%)`).join('、') || '无'}
缺少技能：${basicAnalysis.gapSkills.map(g => `${g.name}(差距${g.gap}%)`).join('、') || '无'}
关键差距：${basicAnalysis.gapAnalysis.criticalGaps.join('、') || '无'}
快速提升点：${basicAnalysis.gapAnalysis.quickWins.join('、') || '无'}

请生成：
1. 详细的差距分析（为什么会有这些差距，影响是什么）
2. 分阶段提升计划（按优先级排序）
3. 综合建议（包括学习策略、时间安排等）
4. 鼓励性总结

输出严格 JSON：
{
  "gapAnalysis": {
    "summary": "差距总结（50字）",
    "impact": "差距对求职的影响（50字）",
    "rootCause": "差距原因分析（100字）"
  },
  "improvementPlan": {
    "phases": [
      {
        "phase": 1,
        "name": "基础补强",
        "skills": ["TypeScript", "Node.js"],
        "estimatedHours": 40,
        "estimatedDays": 20,
        "priority": "high"
      }
    ],
    "totalEstimatedHours": 100,
    "totalEstimatedDays": 50
  },
  "suggestions": [
    "建议先集中学习 TypeScript，这是前端岗位的核心要求",
    "..."
  ],
  "motivation": "虽然目前还有差距，但你的学习速度很快，坚持下去一定可以达标！"
}

只输出 JSON，不要其他文字。`,
      },
      {
        role: 'user',
        content: `请分析以下技能差距：

目标岗位：${input.targetJob.title} @ ${input.targetJob.company}
岗位级别：${input.targetJob.level}

用户技能：
${input.userSkills.map(s => `- ${s.name}: ${s.mastery}%${s.verified ? ' (已认证)' : ''}`).join('\n')}

岗位要求：
必须技能：${input.targetJob.requiredSkills.map(s => `${s.name}(要求${s.minLevel}%, 权重${s.weight})`).join('、')}
加分技能：${input.targetJob.preferredSkills.map(s => `${s.name}(要求${s.minLevel}%, 权重${s.weight})`).join('、')}`,
      },
    ];
  }

  // ── 解析函数 ──────────────────────────────────

  private parseReport(raw: string, basicAnalysis: SkillGapReport): SkillGapReport {
    try {
      const data = extractJson(raw);

      // 合并 LLM 分析结果到基础分析
      return {
        ...basicAnalysis,
        improvementPlan: {
          ...basicAnalysis.improvementPlan,
          phases: Array.isArray(data.improvementPlan?.phases)
            ? data.improvementPlan.phases.map((p: any, i: number) => ({
                phase: Number(p.phase) || i + 1,
                name: String(p.name || `阶段${i + 1}`).substring(0, 50),
                skills: Array.isArray(p.skills) ? p.skills.map((s: any) => String(s)) : [],
                estimatedHours: Number(p.estimatedHours) || 0,
                estimatedDays: Number(p.estimatedDays) || 0,
                priority: ['high', 'medium', 'low'].includes(p.priority) ? p.priority : 'medium',
              }))
            : basicAnalysis.improvementPlan.phases,
        },
        suggestions: Array.isArray(data.suggestions)
          ? data.suggestions.slice(0, 5).map((s: any) => String(s).substring(0, 200))
          : [],
      };
    } catch (e) {
      console.error('[SkillGapAgent] JSON parse failed:', e.message);
      return basicAnalysis;
    }
  }
}

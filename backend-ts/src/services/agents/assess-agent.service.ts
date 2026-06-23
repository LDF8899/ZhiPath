import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm.service';
import { extractJson } from '../../common/json-repair';

/**
 * 学习效果评估 Agent
 *
 * 功能：根据学生学习数据，评估学习效果，给出改进建议
 * 输出：多维度评分、薄弱点分析、改进建议、计划调整
 */

export interface DimensionScore {
  dimension: string;
  score: number;
  maxScore: number;
  detail: string;
  trend: 'up' | 'stable' | 'down';
}

export interface WeakPoint {
  skill: string;
  level: 'low' | 'medium';
  description: string;
  suggestion: string;
}

export interface Improvement {
  priority: 'high' | 'medium' | 'low';
  area: string;
  action: string;
  expectedEffect: string;
}

export interface AssessData {
  overallScore: number;
  level: string;
  dimensions: DimensionScore[];
  weakPoints: WeakPoint[];
  improvements: Improvement[];
  planAdjustment: string;
  encouragement: string;
  summary: string;
}

@Injectable()
export class AssessAgentService {
  constructor(private llmService: LlmService) {}

  /**
   * 评估学习效果
   * @param learningData 学习数据描述
   * @param goal 学习目标
   * @param currentProgress 当前进度
   */
  async assess(
    learningData: string,
    goal: string = '掌握技术栈',
    currentProgress: string = '学习中',
  ): Promise<AssessData> {
    if (!learningData?.trim()) {
      throw new Error('请提供学习数据（如：已完成课程、做题情况、学习时长等）');
    }

    const messages = this.buildPrompt(learningData.trim(), goal, currentProgress);
    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.5,
      maxTokens: 4096,
      tier: 'pro',
    });

    return this.parseResponse(raw, goal);
  }

  // ── Prompt 设计 ──────────────────────────────────

  private buildPrompt(
    learningData: string,
    goal: string,
    currentProgress: string,
  ): { role: string; content: string }[] {
    return [
      {
        role: 'system',
        content: `你是学习效果评估专家，负责分析学生学习数据并给出评估。

任务：评估学生的学习效果，给出多维度分析和改进建议。

评估维度（5个）：
1. 知识掌握：对已学知识的理解程度
2. 实践能力：动手编码和解决问题的能力
3. 学习效率：单位时间内的学习产出
4. 学习习惯：学习规律性和持续性
5. 目标达成：与学习目标的匹配程度

每个维度：
- dimension：维度名称
- score：得分（0-100）
- maxScore：满分（100）
- detail：说明（30-50字）
- trend：趋势（up/stable/down）

薄弱点分析（2-4个）：
- skill：技能名
- level：low/medium
- description：说明
- suggestion：改进建议

改进建议（3-5个）：
- priority：high/medium/low
- area：改进领域
- action：具体行动
- expectedEffect：预期效果

另外：
- planAdjustment：计划调整建议（50-100字）
- encouragement：鼓励语（30-50字）
- summary：总结（50-100字）

输出严格JSON：
{"overallScore":85,"level":"良好","dimensions":[{"dimension":"","score":80,"maxScore":100,"detail":"","trend":"up"}],"weakPoints":[{"skill":"","level":"medium","description":"","suggestion":""}],"improvements":[{"priority":"high","area":"","action":"","expectedEffect":""}],"planAdjustment":"","encouragement":"","summary":""}`,
      },
      {
        role: 'user',
        content: `请评估我的学习效果：

学习目标：${goal}
当前进度：${currentProgress}
学习数据：${learningData}`,
      },
    ];
  }

  // ── 解析输出 ──────────────────────────────────

  private parseResponse(raw: string, goal: string): AssessData {
    try {
      const data = extractJson(raw);

      const dimensions: DimensionScore[] = Array.isArray(data.dimensions)
        ? data.dimensions.slice(0, 5).map((d: any) => ({
            dimension: String(d.dimension || '').substring(0, 20),
            score: Math.min(100, Math.max(0, Number(d.score) || 0)),
            maxScore: 100,
            detail: String(d.detail || '').substring(0, 100),
            trend: ['up', 'stable', 'down'].includes(d.trend) ? d.trend : 'stable',
          }))
        : [];

      const weakPoints: WeakPoint[] = Array.isArray(data.weakPoints)
        ? data.weakPoints.slice(0, 4).map((w: any) => ({
            skill: String(w.skill || '').substring(0, 20),
            level: ['low', 'medium'].includes(w.level) ? w.level : 'medium',
            description: String(w.description || '').substring(0, 100),
            suggestion: String(w.suggestion || '').substring(0, 100),
          }))
        : [];

      const improvements: Improvement[] = Array.isArray(data.improvements)
        ? data.improvements.slice(0, 5).map((i: any) => ({
            priority: ['high', 'medium', 'low'].includes(i.priority) ? i.priority : 'medium',
            area: String(i.area || '').substring(0, 20),
            action: String(i.action || '').substring(0, 100),
            expectedEffect: String(i.expectedEffect || '').substring(0, 100),
          }))
        : [];

      const overallScore = Number(data.overallScore) || (dimensions.length > 0
        ? Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length)
        : 0);

      return {
        overallScore: Math.min(100, Math.max(0, overallScore)),
        level: this.getLevel(overallScore),
        dimensions,
        weakPoints,
        improvements,
        planAdjustment: String(data.planAdjustment || '').substring(0, 200),
        encouragement: String(data.encouragement || '继续加油！').substring(0, 100),
        summary: String(data.summary || '').substring(0, 200),
      };
    } catch (e) {
      console.error('[AssessAgent] JSON parse failed:', e.message);
      return {
        overallScore: 0,
        level: '评估失败',
        dimensions: [],
        weakPoints: [],
        improvements: [],
        planAdjustment: '',
        encouragement: '',
        summary: '评估失败，请重试',
      };
    }
  }

  private getLevel(score: number): string {
    if (score >= 90) return '优秀';
    if (score >= 80) return '良好';
    if (score >= 70) return '中等';
    if (score >= 60) return '一般';
    return '需努力';
  }
}

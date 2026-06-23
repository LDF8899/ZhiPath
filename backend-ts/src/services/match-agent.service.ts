import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { JobPosition } from '../entities/job.entity';
import { LearningPlan } from '../entities/learning.entity';
import { LearningTask } from '../entities/learning-tasks.entity';
import { ExamRecord } from '../entities/exam.entity';
import { MatchHistory } from '../entities/match-history.entity';
import { SkillService } from './skill.service';
import { EventsService } from '../modules/events/events.service';

/** 招聘场景 — 业务深度设计 §7.1 分场景权重 */
export type RecruitScenario = 'campus' | 'social';

/** 单场景的 6 因子权重（社招无学习速度，置 0） */
export interface ScenarioWeights {
  requiredSkills: number;
  preferredSkills: number;
  projects: number;
  exams: number;
  learningProgress: number;
  learningSpeed: number;
}

/**
 * MatchAgent — 匹配度计算服务
 *
 * 严格对齐《业务深度设计 v2.0》§7 匹配度计算：
 *
 *   §7.1 分场景权重（校招 vs 社招）：
 *     校招(campus, junior 岗)：
 *       必须技能 30% + 加分技能 15% + 项目经历 15%
 *       + 考试成绩 20% + 学习进度 10% + 学习速度 10%
 *     社招(social, mid/senior 岗)：
 *       必须技能 40% + 加分技能 20% + 项目经历 25%
 *       + 考试成绩 10% + 学习进度 5%
 *
 *   §7.4 分阶段达标（投递门槛）：
 *     初级(junior)：必须技能覆盖 ≥ 60% 即可投递
 *     中级(mid)：  必须技能覆盖 ≥ 80% 且 阶段考试通过
 *     高级(senior)：必须技能覆盖 ≥ 95% 且 有相关项目经历
 *
 *   §7.3 事件驱动：每次匹配度变化后通过 SSE 推送给前端
 */
@Injectable()
export class MatchAgentService {
  /** §7.1 校招权重（junior 岗位） */
  private readonly CAMPUS_WEIGHTS: ScenarioWeights = {
    requiredSkills: 0.30,
    preferredSkills: 0.15,
    projects: 0.15,
    exams: 0.20,
    learningProgress: 0.10,
    learningSpeed: 0.10,
  };

  /** §7.1 社招权重（mid/senior 岗位） */
  private readonly SOCIAL_WEIGHTS: ScenarioWeights = {
    requiredSkills: 0.40,
    preferredSkills: 0.20,
    projects: 0.25,
    exams: 0.10,
    learningProgress: 0.05,
    learningSpeed: 0,
  };

  constructor(
    @InjectRepository(JobPosition) private jobRepo: Repository<JobPosition>,
    @InjectRepository(LearningPlan) private planRepo: Repository<LearningPlan>,
    @InjectRepository(LearningTask) private taskRepo: Repository<LearningTask>,
    @InjectRepository(ExamRecord) private examRepo: Repository<ExamRecord>,
    @InjectRepository(MatchHistory) private historyRepo: Repository<MatchHistory>,
    @InjectConnection() private mongoConnection: Connection,
    private skillService: SkillService,
    private eventsService: EventsService,
  ) {}

  /**
   * 按岗位级别确定招聘场景（§7.1）
   * junior → 校招；mid/senior → 社招
   */
  private getScenario(level: string): RecruitScenario {
    return level === 'mid' || level === 'senior' ? 'social' : 'campus';
  }

  private getWeights(scenario: RecruitScenario): ScenarioWeights {
    return scenario === 'social' ? this.SOCIAL_WEIGHTS : this.CAMPUS_WEIGHTS;
  }

  /**
   * 计算用户与岗位的匹配度（核心方法）
   *
   * @returns 结构化结果（含各项贡献度 + 差距分析）
   */
  async calculateMatch(userId: number, jobId: number, triggerEvent?: string): Promise<{
    totalScore: number;
    scenario: RecruitScenario;
    weights: ScenarioWeights;
    breakdown: {
      requiredSkills: { score: number; matched: string[]; missing: string[]; coverage: number };
      preferredSkills: { score: number; matched: string[]; missing: string[] };
      projects: { score: number; relatedCount: number };
      exams: { score: number; passedCount: number; totalCount: number };
      learningProgress: { score: number; completionPct: number };
      learningSpeed: { score: number; sampleCount: number };
    };
    gapAnalysis: Array<{ skill: string; type: 'required' | 'preferred'; currentMastery: number }>;
    canApply: boolean;
    deliveryThreshold: number;
    requirement: { level: string; coverageNeeded: number; coverageActual: number; extraConditionMet: boolean; extraConditionLabel: string; reason: string };
  }> {
    // 1. 获取用户有效技能
    const userSkills = await this.skillService.getEffectiveSkills(userId);
    const userSkillMap = new Map<string, { effectiveScore: number; masteryPct: number }>();
    for (const s of userSkills) {
      userSkillMap.set(s.name.toLowerCase(), { effectiveScore: s.effectiveScore, masteryPct: s.masteryPct });
    }

    // 2. 获取岗位信息
    const job = await this.jobRepo.findOne({ where: { id: jobId, status: 1 } });
    if (!job) throw new Error('岗位不存在');

    const requiredSkills = job.requiredSkills || [];
    const preferredSkills = job.preferredSkills || [];
    const level = job.level || 'junior';

    // §7.1 按岗位级别确定场景与权重
    const scenario = this.getScenario(level);
    const weights = this.getWeights(scenario);

    // 3. 计算必须技能匹配
    const requiredResult = this.calculateSkillMatch(requiredSkills, userSkillMap);

    // 4. 计算加分技能匹配
    const preferredResult = this.calculateSkillMatch(preferredSkills, userSkillMap);

    // 5. 获取项目经历相关度
    const projectScore = await this.calculateProjectScore(userId, jobId);

    // 6. 获取考试成绩
    const examScore = await this.calculateExamScore(userId, jobId);

    // 7. 获取学习路径进度
    const progressScore = await this.calculateProgressScore(userId, jobId);

    // 8. 获取学习速度（§7.1 校招新增因子）
    const speedScore = await this.calculateSpeedScore(userId);

    // 9. 按场景权重公式计算总分
    const totalScore = Math.round(
      (requiredResult.score * weights.requiredSkills +
        preferredResult.score * weights.preferredSkills +
        projectScore.score * weights.projects +
        examScore.score * weights.exams +
        progressScore.score * weights.learningProgress +
        speedScore.score * weights.learningSpeed) * 100,
    ) / 100;

    // 10. 生成差距分析
    const gapAnalysis: Array<{ skill: string; type: 'required' | 'preferred'; currentMastery: number }> = [];

    for (const missing of requiredResult.missing) {
      const mastery = userSkillMap.get(missing.toLowerCase())?.masteryPct || 0;
      gapAnalysis.push({ skill: missing, type: 'required', currentMastery: mastery });
    }

    for (const missing of preferredResult.missing) {
      const mastery = userSkillMap.get(missing.toLowerCase())?.masteryPct || 0;
      gapAnalysis.push({ skill: missing, type: 'preferred', currentMastery: mastery });
    }

    // 按必须技能优先 + 掌握度升序排序
    gapAnalysis.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'required' ? -1 : 1;
      return a.currentMastery - b.currentMastery;
    });

    // 11. §7.4 分阶段达标判定（投递门槛）
    const requirement = this.evaluateDeliveryEligibility(
      level,
      requiredResult.coverage,
      examScore.passedCount > 0,
      projectScore.relatedCount > 0,
      job.deliveryThreshold,
    );

    // 12. 写入匹配度历史记录
    this.historyRepo.save({
      userId,
      jobId,
      score: totalScore,
      breakdown: {
        scenario,
        requiredSkills: requiredResult,
        preferredSkills: preferredResult,
        projects: projectScore,
        exams: examScore,
        learningProgress: progressScore,
        learningSpeed: speedScore,
      },
      triggerEvent: triggerEvent || null,
    }).catch((e) => console.warn('[MatchAgent] save match history failed:', e.message));

    return {
      totalScore,
      scenario,
      weights,
      breakdown: {
        requiredSkills: {
          score: requiredResult.score,
          matched: requiredResult.matched,
          missing: requiredResult.missing,
          coverage: requiredResult.coverage,
        },
        preferredSkills: {
          score: preferredResult.score,
          matched: preferredResult.matched,
          missing: preferredResult.missing,
        },
        projects: projectScore,
        exams: examScore,
        learningProgress: progressScore,
        learningSpeed: speedScore,
      },
      gapAnalysis,
      canApply: requirement.eligible,
      deliveryThreshold: requirement.coverageNeeded,
      requirement: {
        level,
        coverageNeeded: requirement.coverageNeeded,
        coverageActual: requirement.coverageActual,
        extraConditionMet: requirement.extraConditionMet,
        extraConditionLabel: requirement.extraConditionLabel,
        reason: requirement.reason,
      },
    };
  }

  /**
   * §7.4 分阶段达标判定
   * junior：必须技能覆盖 ≥ max(60, 岗位自定义门槛)
   * mid：   覆盖 ≥ 80% 且 至少通过一次考试
   * senior：覆盖 ≥ 95% 且 有相关项目经历
   */
  private evaluateDeliveryEligibility(
    level: string,
    coverage: number,
    hasPassedExam: boolean,
    hasRelatedProject: boolean,
    jobThreshold?: number,
  ): {
    eligible: boolean;
    coverageNeeded: number;
    coverageActual: number;
    extraConditionMet: boolean;
    extraConditionLabel: string;
    reason: string;
  } {
    const coverageActual = Math.round(coverage);
    let coverageNeeded: number;
    let extraConditionMet = true;
    let extraConditionLabel = '';

    if (level === 'senior') {
      coverageNeeded = 95;
      extraConditionMet = hasRelatedProject;
      extraConditionLabel = '相关项目经历';
    } else if (level === 'mid') {
      coverageNeeded = 80;
      extraConditionMet = hasPassedExam;
      extraConditionLabel = '阶段考试通过';
    } else {
      // junior：默认 60%，允许岗位自定义更高门槛
      coverageNeeded = Math.max(60, jobThreshold || 60);
    }

    const coverageMet = coverageActual >= coverageNeeded;
    const eligible = coverageMet && extraConditionMet;

    let reason: string;
    if (eligible) {
      reason = '已达标，可以投递';
    } else if (!coverageMet) {
      reason = `必须技能覆盖 ${coverageActual}%，需达到 ${coverageNeeded}%`;
    } else {
      reason = `还需满足条件：${extraConditionLabel}`;
    }

    return { eligible, coverageNeeded, coverageActual, extraConditionMet, extraConditionLabel, reason };
  }

  /**
   * 批量计算用户与所有岗位的匹配度
   */
  async calculateForAllJobs(userId: number, triggerEvent?: string): Promise<Array<{ jobId: number; jobTitle: string; matchScore: number; canApply: boolean }>> {
    const jobs = await this.jobRepo.find({ where: { status: 1 } });
    const results: Array<{ jobId: number; jobTitle: string; matchScore: number; canApply: boolean }> = [];

    for (const job of jobs) {
      try {
        const jobId = Number(job.id);
        if (isNaN(jobId)) continue;
        const match = await this.calculateMatch(userId, jobId, triggerEvent);
        results.push({
          jobId,
          jobTitle: job.title,
          matchScore: match.totalScore,
          canApply: match.canApply,
        });
      } catch (e) {
        console.warn(`[MatchAgent] calculateMatch failed for job ${job.id}:`, e.message);
      }
    }

    // 按匹配度降序排序
    results.sort((a, b) => b.matchScore - a.matchScore);
    return results;
  }

  /**
   * 技能变化时重新计算所有岗位匹配度，并通过 SSE 推送变化
   */
  async recalculateOnSkillChange(userId: number): Promise<void> {
    // 异步执行，不阻塞主流程
    this.calculateForAllJobs(userId, 'skill_change')
      .then((results) => {
        if (results.length > 0) {
          // 推送最佳匹配度变化
          const best = results[0];
          this.eventsService.emitMatchUpdate(userId, best.jobId, best.matchScore);
        }
      })
      .catch((e) =>
        console.warn('[MatchAgent] recalculateOnSkillChange failed:', e.message),
      );
  }

  /**
   * 获取用户最佳匹配岗位（供 Dashboard 展示）
   */
  async getBestMatch(userId: number): Promise<{ jobId: number; jobTitle: string; matchScore: number; canApply: boolean } | null> {
    try {
      const results = await this.calculateForAllJobs(userId);
      return results.length > 0 ? results[0] : null;
    } catch (e: any) {
      console.error('[MatchAgent] getBestMatch error:', e.message, e.stack);
      throw e;
    }
  }

  /**
   * 获取匹配度趋势数据（最近 N 天）
   */
  async getMatchTrend(userId: number, jobId: number, days = 30): Promise<Array<{ score: number; createdAt: Date }>> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const records = await this.historyRepo.find({
      where: { userId, jobId },
      order: { createdAt: 'ASC' },
    });

    return records
      .filter((r) => r.createdAt >= since)
      .map((r) => ({ score: Number(r.score), createdAt: r.createdAt }));
  }

  /**
   * 新岗位录入时触发所有用户重新计算
   */
  async recalculateOnJobChange(jobId: number): Promise<void> {
    // 从 MongoDB 获取所有用户
    const collection = this.mongoConnection.db!.collection('user_profiles');
    const users = await collection.find({}, { projection: { user_id: 1 } }).toArray();

    for (const user of users) {
      const userId = parseInt(user.user_id, 10);
      if (!isNaN(userId)) {
        this.calculateMatch(userId, jobId).catch((e) =>
          console.warn(`[MatchAgent] recalculateOnJobChange failed for user ${userId}:`, e.message),
        );
      }
    }
  }

  // ── 内部方法 ──────────────────────────────────

  /** 计算技能匹配度
   *  - score：按掌握度加权的匹配分（用于总分计算）
   *  - coverage：命中技能数 / 总技能数 × 100（用于 §7.4 达标门槛判定）
   */
  private calculateSkillMatch(
    jobSkills: Array<{ name: string; weight?: number }>,
    userSkillMap: Map<string, { effectiveScore: number; masteryPct: number }>,
  ): { score: number; matched: string[]; missing: string[]; coverage: number } {
    if (jobSkills.length === 0) return { score: 100, matched: [], missing: [], coverage: 100 };

    const matched: string[] = [];
    const missing: string[] = [];
    let totalWeight = 0;
    let matchedWeight = 0;

    for (const skill of jobSkills) {
      const weight = skill.weight || 1;
      totalWeight += weight;

      const userSkill = userSkillMap.get(skill.name.toLowerCase());
      if (userSkill) {
        matched.push(skill.name);
        // 匹配度按掌握度加权，最低给 10% 基础分
        const effectivePct = Math.max(userSkill.masteryPct, 10);
        matchedWeight += weight * (effectivePct / 100);
      } else {
        missing.push(skill.name);
      }
    }

    const score = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;
    const coverage = Math.round((matched.length / jobSkills.length) * 100);
    return { score, matched, missing, coverage };
  }

  /**
   * 计算学习速度分（§7.1 校招新增因子 — 完成效率）
   * 基于已完成任务的「实际用时 vs 预估用时」比值：
   *   ratio = 实际/预估，越小越快
   *   score = clamp(40, 100)，ratio≤0.7→100，ratio≥1.5→40，中间线性
   * 无数据时给中性分 60。
   */
  private async calculateSpeedScore(userId: number): Promise<{ score: number; sampleCount: number }> {
    try {
      const tasks = await this.taskRepo.find({
        where: { userId, isActive: 1 },
        order: { id: 'DESC' },
        take: 50,
      });

      const samples = tasks.filter(
        (t) => t.actualMin && t.actualMin > 0 && t.estimatedMin && t.estimatedMin > 0,
      );
      if (samples.length === 0) return { score: 60, sampleCount: 0 };

      let ratioSum = 0;
      for (const t of samples) {
        ratioSum += t.actualMin / t.estimatedMin;
      }
      const avgRatio = ratioSum / samples.length;

      let score: number;
      if (avgRatio <= 0.7) score = 100;
      else if (avgRatio >= 1.5) score = 40;
      else {
        // 0.7→100, 1.5→40 线性插值
        score = Math.round(100 - ((avgRatio - 0.7) / (1.5 - 0.7)) * 60);
      }

      return { score, sampleCount: samples.length };
    } catch (e: any) {
      console.warn('[MatchAgent] calculateSpeedScore failed:', e.message);
      return { score: 60, sampleCount: 0 };
    }
  }

  /** 计算项目经历相关度 */
  private async calculateProjectScore(userId: number, jobId: number): Promise<{ score: number; relatedCount: number }> {
    try {
      const collection = this.mongoConnection.db!.collection('user_profiles');
      const profile = await collection.findOne({ user_id: String(userId) });

      if (!profile?.projects?.length) return { score: 0, relatedCount: 0 };

      // 获取岗位技能关键词
      const job = await this.jobRepo.findOne({ where: { id: jobId, status: 1 } });
      const jobSkillKeywords = new Set<string>();

      for (const skill of job?.requiredSkills || []) {
        jobSkillKeywords.add(skill.name.toLowerCase());
      }
      for (const skill of job?.preferredSkills || []) {
        jobSkillKeywords.add(skill.name.toLowerCase());
      }

      // 计算项目相关度
      let relatedCount = 0;
      for (const project of profile.projects) {
        const projectText = `${project.name || ''} ${project.description || ''} ${(project.techStack || []).join(' ')}`.toLowerCase();
        for (const keyword of jobSkillKeywords) {
          if (projectText.includes(keyword)) {
            relatedCount++;
            break;
          }
        }
      }

      // 相关项目数 → 分数（0个=0, 1个=50, 2个+=100）
      const score = Math.min(100, relatedCount * 50);
      return { score, relatedCount };
    } catch (e) {
      console.warn('[MatchAgent] calculateProjectScore failed:', e.message);
      return { score: 0, relatedCount: 0 };
    }
  }

  /** 计算考试成绩 */
  private async calculateExamScore(userId: number, jobId: number): Promise<{ score: number; passedCount: number; totalCount: number }> {
    try {
      // 查询用户通过的考试（与岗位技能相关）
      const exams = await this.examRepo.find({
        where: { userId, status: 1 },
        order: { createTime: 'DESC' },
      });

      if (exams.length === 0) return { score: 0, passedCount: 0, totalCount: 0 };

      const passedExams = exams.filter((e) => e.passed === 1);
      const totalCount = exams.length;
      const passedCount = passedExams.length;

      // 通过率 → 分数
      const score = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
      return { score, passedCount, totalCount };
    } catch (e) {
      console.warn('[MatchAgent] calculateExamScore failed:', e.message);
      return { score: 0, passedCount: 0, totalCount: 0 };
    }
  }

  /** 计算学习路径进度 */
  private async calculateProgressScore(userId: number, jobId: number): Promise<{ score: number; completionPct: number }> {
    try {
      // 查询用户的学习计划
      const plans = await this.planRepo.find({
        where: { userId, status: 1 },
        order: { createTime: 'DESC' },
      });

      if (plans.length === 0) return { score: 0, completionPct: 0 };

      const plan = plans[0];
      const pathData = plan.pathData || {};
      const phases = pathData.phases || [];

      let totalSkills = 0;
      let doneSkills = 0;

      for (const phase of phases) {
        for (const skill of phase.skills || []) {
          totalSkills++;
          if (skill.status === 'done') doneSkills++;
        }
      }

      const completionPct = totalSkills > 0 ? Math.round((doneSkills / totalSkills) * 100) : 0;
      return { score: completionPct, completionPct };
    } catch (e) {
      console.warn('[MatchAgent] calculateProgressScore failed:', e.message);
      return { score: 0, completionPct: 0 };
    }
  }
}

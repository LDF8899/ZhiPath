import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { JobPosition, JobApplication } from '../../entities/job.entity';
import { Student } from '../../entities/student.entity';
import { Enterprise } from '../../entities/enterprise.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { MatchAgentService } from '../../services/match-agent.service';

/**
 * Jobs 服务 — 岗位列表/详情/匹配/投递/技能导入
 *
 * 匹配度使用 MatchAgentService 的 5 因子加权算法（必须技能 35% + 加分技能 15% + 项目 20% + 考试 15% + 学习进度 15%）
 */
@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(JobPosition) private jobRepo: Repository<JobPosition>,
    @InjectRepository(JobApplication) private applicationRepo: Repository<JobApplication>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(Enterprise) private enterpriseRepo: Repository<Enterprise>,
    @InjectRepository(LearningPlan) private planRepo: Repository<LearningPlan>,
    private matchAgent: MatchAgentService,
  ) {}

  /** 岗位列表（按匹配度排序） — GET /api/user/jobs */
  async getJobs(userId: number, options: { page?: number; pageSize?: number; keyword?: string; company?: string; location?: string; level?: string }) {
    const { page = 1, pageSize = 20, keyword, company, location, level } = options;
    const skip = (page - 1) * pageSize;

    const qb = this.jobRepo.createQueryBuilder('j')
      .where('j.status = 1');

    if (keyword) qb.andWhere('j.title LIKE :kw', { kw: `%${keyword}%` });
    if (company) qb.andWhere('j.company LIKE :co', { co: `%${company}%` });
    if (location) qb.andWhere('j.location LIKE :lo', { lo: `%${location}%` });
    if (level) qb.andWhere('j.level = :lv', { lv: level });

    const [items, total] = await qb
      .orderBy('j.createTime', 'DESC')
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    // 使用 5 因子算法批量计算匹配度
    let matchMap = new Map<number, number>();
    try {
      const matchResults = await this.matchAgent.calculateForAllJobs(userId);
      for (const m of matchResults) {
        matchMap.set(m.jobId, m.matchScore);
      }
    } catch (e) {
      // 匹配度计算失败时降级为 0
      console.warn('[JobsService] match calculation fallback:', (e as Error).message);
    }

    // 批量查询关联企业
    const enterpriseIds = [...new Set(items.map((j) => j.enterpriseId).filter(Boolean))];
    const enterpriseMap = new Map<number, { name: string; industry: string }>();
    if (enterpriseIds.length > 0) {
      const enterprises = await this.enterpriseRepo.find({ where: { id: In(enterpriseIds) } });
      for (const e of enterprises) {
        enterpriseMap.set(Number(e.id), { name: e.name, industry: e.industry || '' });
      }
    }

    const list = items.map((j) => {
      const enterprise = j.enterpriseId ? enterpriseMap.get(Number(j.enterpriseId)) : null;
      return {
        id: j.id,
        title: j.title,
        company: j.company || '',
        location: j.location || '',
        salaryRange: j.salaryRange || '',
        level: j.level || 'junior',
        requiredSkills: j.requiredSkills || [],
        preferredSkills: j.preferredSkills || [],
        jdText: j.jdText || '',
        deliveryThreshold: j.deliveryThreshold || 60,
        source: j.source || 'manual',
        enterpriseId: j.enterpriseId || null,
        enterpriseName: enterprise?.name || j.company || '',
        enterpriseIndustry: enterprise?.industry || '',
        matchScore: matchMap.get(Number(j.id)) || 0,
      };
    });

    // 按匹配度降序排序
    list.sort((a, b) => b.matchScore - a.matchScore);

    return { list, total, page, pageSize };
  }

  /** 岗位详情 — GET /api/user/jobs/:jobId */
  async getJob(jobId: number) {
    const job = await this.jobRepo.findOne({ where: { id: jobId, status: 1 } });
    if (!job) return null;

    // 关联企业信息
    let enterprise: Enterprise | null = null;
    if (job.enterpriseId) {
      enterprise = await this.enterpriseRepo.findOne({ where: { id: job.enterpriseId, status: 1 } });
    }

    return {
      id: job.id,
      title: job.title,
      company: job.company || '',
      location: job.location || '',
      salaryRange: job.salaryRange || '',
      level: job.level || 'junior',
      requiredSkills: job.requiredSkills || [],
      preferredSkills: job.preferredSkills || [],
      jdText: job.jdText || '',
      deliveryThreshold: job.deliveryThreshold || 60,
      source: job.source || 'manual',
      enterpriseId: job.enterpriseId || null,
      enterpriseName: enterprise?.name || job.company || '',
      enterpriseIndustry: enterprise?.industry || '',
      enterpriseContact: enterprise ? { name: enterprise.contactName, email: enterprise.contactEmail } : null,
    };
  }

  /** 岗位匹配分析 — GET /api/user/jobs/:jobId/match
   *  统一走 MatchAgent 的分场景 6 因子算法（§7），不再用简化命中率。
   *  返回结构兼容前端：matchResult.{score,matched,missing}
   */
  async getJobMatch(userId: number, jobId: number) {
    const job = await this.jobRepo.findOne({ where: { id: jobId, status: 1 } });
    if (!job) return null;

    const match = await this.matchAgent.calculateMatch(userId, jobId, 'view_job');

    return {
      jobId,
      scenario: match.scenario,
      requiredSkills: job.requiredSkills || [],
      preferredSkills: job.preferredSkills || [],
      matchResult: {
        score: match.totalScore,
        matched: match.breakdown.requiredSkills.matched,
        missing: match.breakdown.requiredSkills.missing,
      },
      breakdown: match.breakdown,
      gapAnalysis: match.gapAnalysis,
      canApply: match.canApply,
      deliveryThreshold: match.deliveryThreshold,
      requirement: match.requirement,
    };
  }

  /** 申请岗位 — POST /api/user/jobs/:jobId/apply */
  async applyJob(userId: number, jobId: number) {
    const existing = await this.applicationRepo.findOne({
      where: { userId: userId, jobId: jobId, status: 1 },
    });
    if (existing) {
      return { message: '已申请过该岗位' };
    }

    await this.applicationRepo.save({
      userId: userId,
      jobId: jobId,
      adminDecision: 0,
      createTime: Date.now(),
      updateTime: Date.now(),
      status: 1,
    });

    return { message: '申请成功' };
  }

  /** 将岗位缺少的技能导入学习计划 — POST /api/user/jobs/:jobId/import-skills */
  async importSkills(userId: number, jobId: number, target: 'main' | 'side' = 'side') {
    const job = await this.jobRepo.findOne({ where: { id: jobId, status: 1 } });
    if (!job) return { error: '岗位不存在' };

    // 计算缺少的技能
    const student = await this.studentRepo.findOne({ where: { userId, status: 1 } });
    const userSkills = new Set<string>();
    if (student?.skills) {
      for (const s of student.skills) {
        userSkills.add((s.name || '').toLowerCase());
      }
    }

    const required = (job.requiredSkills || []).map((s: any) => typeof s === 'string' ? s : s.name || '');
    const preferred = (job.preferredSkills || []).map((s: any) => typeof s === 'string' ? s : s.name || '');
    const missingRequired = required.filter(s => !userSkills.has(s.toLowerCase()));
    const missingPreferred = preferred.filter(s => !userSkills.has(s.toLowerCase()));

    const allMissing = [...new Set([...missingRequired, ...missingPreferred])];
    if (allMissing.length === 0) {
      return { imported: 0, message: '你已掌握该岗位所有技能' };
    }

    // 获取用户活跃计划（target 指定主线/支线，优先找对应类型的计划）
    let plan = await this.planRepo.findOne({
      where: { userId, planType: target, status: 1 },
      order: { createTime: 'DESC' },
    });
    // 没有对应类型的计划 → 找任意活跃计划
    if (!plan) {
      plan = await this.planRepo.findOne({
        where: { userId, status: 1 },
        order: { createTime: 'DESC' },
      });
    }
    if (!plan) return { error: '暂无学习计划，请先创建计划' };

    // 将缺少技能追加到计划的 pathData
    const pathData = JSON.parse(JSON.stringify(plan.pathData || {}));
    if (!pathData.phases) pathData.phases = [];

    // 找到或创建一个"岗位补充"阶段
    let importPhase = pathData.phases.find((p: any) => p.name === '岗位技能补充');
    if (!importPhase) {
      importPhase = {
        name: '岗位技能补充',
        status: 'in_progress',
        skills: [],
      };
      pathData.phases.push(importPhase);
    }

    // 去重：不添加已存在的技能
    const existingSkills = new Set<string>();
    for (const phase of pathData.phases) {
      for (const skill of phase.skills || []) {
        const name = typeof skill === 'string' ? skill : skill.name || '';
        if (name) existingSkills.add(name.toLowerCase());
      }
    }

    let imported = 0;
    for (const skillName of allMissing) {
      if (!existingSkills.has(skillName.toLowerCase())) {
        importPhase.skills.push({
          name: skillName,
          status: 'pending',
          source: `job:${jobId}`,
        });
        imported++;
      }
    }

    if (imported === 0) {
      return { imported: 0, message: '缺少的技能已在计划中' };
    }

    // 保存
    plan.pathData = pathData;
    plan.updateTime = Date.now();
    await this.planRepo.save(plan);

    return {
      imported,
      planId: plan.id,
      planName: plan.planName,
      skills: allMissing.filter(s => !existingSkills.has(s.toLowerCase())),
      message: `已将 ${imported} 个技能加入「${plan.planName}」`,
    };
  }
}

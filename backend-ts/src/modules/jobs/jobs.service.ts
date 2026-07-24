import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Brackets } from 'typeorm';
import { JobPosition, JobApplication } from '../../entities/job.entity';
import { Student } from '../../entities/student.entity';
import { Enterprise } from '../../entities/enterprise.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { LearningBranch } from '../../entities/learning-branch.entity';
import { LearningCommit } from '../../entities/learning-commit.entity';
import { SkillSnapshotV3 } from '../../entities/skill-snapshot-v3.entity';
import { MatchAgentService } from '../../services/match-agent.service';
import { JobSearchService } from '../../services/job-search.service';
import { SkillService } from '../../services/skill.service';
import { LlmService } from '../../services/llm.service';

export interface CompanyContext {
  companyName: string;
  introduction: string;
  location: {
    query: string;
    formattedAddress: string;
    longitude: number | null;
    latitude: number | null;
    mapImage: string | null;
  };
}

/**
 * Jobs 服务 — 岗位列表/详情/匹配/投递/技能导入
 *
 * 匹配度使用 MatchAgentService 的 5 因子加权算法（必须技能 35% + 加分技能 15% + 项目 20% + 考试 15% + 学习进度 15%）
 */
@Injectable()
export class JobsService {
  private readonly companyContextCache = new Map<number, { expiresAt: number; value: CompanyContext }>();

  constructor(
    @InjectRepository(JobPosition) private jobRepo: Repository<JobPosition>,
    @InjectRepository(JobApplication) private applicationRepo: Repository<JobApplication>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(Enterprise) private enterpriseRepo: Repository<Enterprise>,
    @InjectRepository(LearningPlan) private planRepo: Repository<LearningPlan>,
    @InjectRepository(LearningBranch) private branchRepo: Repository<LearningBranch>,
    @InjectRepository(LearningCommit) private commitRepo: Repository<LearningCommit>,
    @InjectRepository(SkillSnapshotV3) private snapshotRepo: Repository<SkillSnapshotV3>,
    private matchAgent: MatchAgentService,
    private jobSearch: JobSearchService,
    private skillService: SkillService,
    private llmService: LlmService,
    private config: ConfigService,
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

  /** Search v2: local multi-field search + online fallback + match ordering. */
  async searchJobs(userId: number, options: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    company?: string;
    location?: string;
    level?: string;
    searchMode?: 'local' | 'hybrid' | 'online';
    includeOnline?: boolean;
  }) {
    const { page = 1, pageSize = 20, company, location, level } = options;
    const keyword = (options.keyword || '').trim();
    const mode = options.searchMode || 'hybrid';
    const includeOnline = mode === 'online' || options.includeOnline || (mode === 'hybrid' && keyword.length > 0);
    const onlineQuery = includeOnline ? (keyword || 'IT') : '';
    const skip = (page - 1) * pageSize;

    const localItems = mode === 'online'
      ? []
      : await this.searchLocalJobs({ keyword, company, location, level });

    const matchMap = new Map<number, number>();
    try {
      const matchResults = await this.matchAgent.calculateForAllJobs(userId, keyword ? 'job_search' : undefined);
      for (const m of matchResults) matchMap.set(m.jobId, m.matchScore);
    } catch (e) {
      console.warn('[JobsService] match calculation fallback:', (e as Error).message);
    }

    const enterpriseIds = [...new Set(localItems.map((j) => j.enterpriseId).filter(Boolean))];
    const enterpriseMap = new Map<number, { name: string; industry: string }>();
    if (enterpriseIds.length > 0) {
      const enterprises = await this.enterpriseRepo.find({ where: { id: In(enterpriseIds) } });
      for (const e of enterprises) {
        enterpriseMap.set(Number(e.id), { name: e.name, industry: e.industry || '' });
      }
    }

    const localList = localItems.map((j) => this.toJobCard(j, enterpriseMap, matchMap.get(Number(j.id)) || 0, keyword));
    let onlineList: any[] = [];
    if (onlineQuery) {
      onlineList = await this.searchOnlineJobs(userId, onlineQuery);
    }
    const aiRecommendationCount = onlineList.filter((job) => job.searchMeta?.origin === 'ai_generated').length;
    const webOnlineCount = onlineList.length - aiRecommendationCount;

    const merged = this.dedupeJobs([...localList, ...onlineList]);
    merged.sort((a, b) => {
      const scoreDiff = Number(b.matchScore || 0) - Number(a.matchScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const sourceDiff = (a.source === 'online' ? 1 : 0) - (b.source === 'online' ? 1 : 0);
      if (sourceDiff !== 0) return sourceDiff;
      return Number(b.id || 0) - Number(a.id || 0);
    });

    return {
      list: merged.slice(skip, skip + pageSize),
      total: merged.length,
      page,
      pageSize,
      meta: {
        keyword,
        onlineQuery,
        searchMode: mode,
        localCount: localList.length,
        onlineCount: onlineList.length,
        webOnlineCount,
        aiRecommendationCount,
      },
    };
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

  /** Company introduction and geocoded location for the job detail page. */
  async getCompanyContext(jobId: number): Promise<CompanyContext | null> {
    const cached = this.companyContextCache.get(jobId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const job = await this.jobRepo.findOne({ where: { id: jobId, status: 1 } });
    if (!job) return null;
    const enterprise = job.enterpriseId
      ? await this.enterpriseRepo.findOne({ where: { id: job.enterpriseId, status: 1 } })
      : null;
    const companyName = enterprise?.name || job.company || '该公司';
    const industry = enterprise?.industry || '';

    const [introduction, location] = await Promise.all([
      this.generateCompanyIntroduction(companyName, industry, job),
      this.resolveCompanyLocation(companyName, job.location || ''),
    ]);
    const value: CompanyContext = { companyName, introduction, location };
    this.companyContextCache.set(jobId, { expiresAt: Date.now() + 24 * 60 * 60 * 1000, value });
    return value;
  }

  private async generateCompanyIntroduction(
    companyName: string,
    industry: string,
    job: JobPosition,
  ): Promise<string> {
    const fallback = industry
      ? `${companyName}是一家从事${industry}相关业务的企业。本岗位为${job.title}，可结合岗位描述进一步了解团队方向、工作内容与能力要求。`
      : `${companyName}正在招聘${job.title}。建议结合岗位描述和企业公开渠道，进一步了解业务方向、团队情况与岗位发展空间。`;
    try {
      const result = await this.llmService.chatCompletion([
        {
          role: 'system',
          content: `你是严谨的企业研究助理。根据公司名称、行业和招聘岗位，撰写 120-180 字中文公司简介。
只写稳定、可验证的公开常识和与求职相关的业务方向；不得编造人数、融资、营收、排名、福利或具体产品数据。
若信息不足，明确使用“公开信息有限”等克制表达。直接输出纯文本，不要标题、列表或 Markdown。`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            company: companyName,
            industry,
            position: job.title,
            location: job.location,
            jobDescription: String(job.jdText || '').slice(0, 1200),
          }),
        },
      ], { tier: 'flash', temperature: 0.2, maxTokens: 350 });
      const clean = String(result || '').replace(/[#*_`]/g, '').replace(/\s+/g, ' ').trim();
      return clean.length >= 40 ? clean.slice(0, 320) : fallback;
    } catch (e: any) {
      console.warn('[JobsService] Company introduction fallback:', e.message);
      return fallback;
    }
  }

  private async resolveCompanyLocation(companyName: string, location: string): Promise<CompanyContext['location']> {
    const query = [location, companyName].filter(Boolean).join(' ');
    const fallback = { query, formattedAddress: location || '暂未提供工作地点', longitude: null, latitude: null, mapImage: null };
    const key = this.config.get<string>('AMAP_WEB_SERVICE_KEY', '').trim();
    if (!key || !query) return fallback;

    try {
      const params = new URLSearchParams({ key, address: query });
      const response = await fetch(`https://restapi.amap.com/v3/geocode/geo?${params}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return fallback;
      const data: any = await response.json();
      const geocode = Array.isArray(data?.geocodes) ? data.geocodes[0] : null;
      const [longitude, latitude] = String(geocode?.location || '').split(',').map(Number);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return fallback;

      const mapParams = new URLSearchParams({
        key,
        location: `${longitude},${latitude}`,
        zoom: '12',
        size: '700*320',
        scale: '2',
        markers: `mid,,A:${longitude},${latitude}`,
      });
      let mapImage: string | null = null;
      const mapResponse = await fetch(`https://restapi.amap.com/v3/staticmap?${mapParams}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (mapResponse.ok && (mapResponse.headers.get('content-type') || '').startsWith('image/')) {
        const contentType = mapResponse.headers.get('content-type') || 'image/png';
        const image = Buffer.from(await mapResponse.arrayBuffer()).toString('base64');
        mapImage = `data:${contentType};base64,${image}`;
      }

      return {
        query,
        formattedAddress: String(geocode.formatted_address || location || query),
        longitude,
        latitude,
        mapImage,
      };
    } catch (e: any) {
      console.warn('[JobsService] AMap location fallback:', e.message);
      return fallback;
    }
  }

  /** 岗位匹配分析 — GET /api/user/jobs/:jobId/match
   *  统一走 MatchAgent 的分场景 6 因子算法（§7），不再用简化命中率。
   *  返回结构兼容前端：matchResult.{score,matched,missing}
   */
  async getJobMatch(userId: number, jobId: number) {
    const job = await this.jobRepo.findOne({ where: { id: jobId, status: 1 } });
    if (!job) return null;

    const match = await this.matchAgent.calculateMatch(userId, jobId, 'view_job');
    const scoreChange = await this.getLatestJobScoreChange(userId, jobId, match.totalScore);

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
      scoreChange,
    };
  }

  /** 申请岗位 — POST /api/user/jobs/:jobId/apply */
  async applyJob(userId: number, jobId: number) {
    if (!Number.isInteger(jobId) || jobId <= 0) {
      throw new BadRequestException('参考岗位不能直接投递，可作为学习目标参考');
    }

    const job = await this.jobRepo.findOne({ where: { id: jobId, status: 1 } });
    if (!job) {
      throw new NotFoundException('岗位不存在或已下线');
    }
    if (!this.canDirectApply(job)) {
      throw new BadRequestException('参考岗位不能直接投递，可作为学习目标参考');
    }

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

  private canDirectApply(job: JobPosition): boolean {
    const source = this.norm(job.source || 'manual');
    return !['online', 'web', 'ai_generated'].includes(source);
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

  private async searchLocalJobs(filters: { keyword?: string; company?: string; location?: string; level?: string }) {
    const qb = this.jobRepo.createQueryBuilder('j').where('j.status = 1');
    if (filters.company) qb.andWhere('j.company LIKE :co', { co: `%${filters.company}%` });
    if (filters.location) qb.andWhere('j.location LIKE :lo', { lo: `%${filters.location}%` });
    if (filters.level) qb.andWhere('j.level = :lv', { lv: filters.level });

    const tokens = this.tokenize(filters.keyword || '');
    if (tokens.length) {
      qb.andWhere(new Brackets((where) => {
        tokens.forEach((token, i) => {
          const param = `kw${i}`;
          const expression = [
            `LOWER(j.title) LIKE :${param}`,
            `LOWER(COALESCE(j.company, '')) LIKE :${param}`,
            `LOWER(COALESCE(j.location, '')) LIKE :${param}`,
            `LOWER(COALESCE(j.salary_range, '')) LIKE :${param}`,
            `LOWER(COALESCE(j.jd_text, '')) LIKE :${param}`,
            `LOWER(CAST(j.required_skills AS CHAR)) LIKE :${param}`,
            `LOWER(CAST(j.preferred_skills AS CHAR)) LIKE :${param}`,
          ].join(' OR ');
          const params = { [param]: `%${token}%` };
          if (i === 0) where.where(expression, params);
          else where.orWhere(expression, params);
        });
      }));
    }

    const jobs = await qb.orderBy('j.createTime', 'DESC').take(tokens.length ? 500 : 300).getMany();
    if (!tokens.length) return jobs;

    return jobs
      .map((job) => ({ job, rank: this.localSearchRank(job, tokens) }))
      .filter((item) => item.rank > 0)
      .sort((a, b) => b.rank - a.rank)
      .map((item) => item.job);
  }

  private async searchOnlineJobs(userId: number, keyword: string) {
    try {
      const userSkills = await this.skillService.getEffectiveSkills(userId);
      const skillNames = userSkills.map((s) => s.name).filter(Boolean);
      const onlineCards = await this.jobSearch.search(keyword, skillNames);
      return onlineCards.map((card) => ({
        id: card.id,
        title: card.title,
        company: card.company || '',
        location: card.location || '',
        salaryRange: card.salaryRange || '',
        level: 'junior',
        requiredSkills: (card.requiredSkills || []).map((name) => ({ name })),
        preferredSkills: [],
        jdText: card.snippet || '',
        deliveryThreshold: 60,
        source: 'online',
        url: card.url,
        host: card.host,
        snippet: card.snippet,
        enterpriseName: card.company || '',
        enterpriseIndustry: '',
        matchScore: card.matchScore || 0,
        searchMeta: {
          source: 'online',
          origin: card.origin || (card.url ? 'web' : 'ai_generated'),
          matchedFields: ['online'],
        },
      }));
    } catch (e) {
      console.warn('[JobsService] online job search failed:', (e as Error).message);
      return [];
    }
  }

  private toJobCard(
    job: JobPosition,
    enterpriseMap: Map<number, { name: string; industry: string }>,
    matchScore: number,
    keyword: string,
  ) {
    const enterprise = job.enterpriseId ? enterpriseMap.get(Number(job.enterpriseId)) : null;
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
      source: job.source === 'online' ? 'online' : 'local',
      enterpriseId: job.enterpriseId || null,
      enterpriseName: enterprise?.name || job.company || '',
      enterpriseIndustry: enterprise?.industry || '',
      matchScore,
      searchMeta: { source: 'local', matchedFields: this.getMatchedFields(job, keyword) },
    };
  }

  private dedupeJobs(jobs: any[]) {
    const seen = new Set<string>();
    const result: any[] = [];
    for (const job of jobs) {
      const key = `${this.norm(job.company || job.enterpriseName)}|${this.norm(job.title)}|${this.norm(job.location)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(job);
    }
    return result;
  }

  private getMatchedFields(job: JobPosition, keyword: string) {
    const tokens = this.tokenize(keyword);
    if (!tokens.length) return [];
    const fields: Array<[string, string]> = [
      ['title', job.title || ''],
      ['company', job.company || ''],
      ['location', job.location || ''],
      ['salary', job.salaryRange || ''],
      ['jd', job.jdText || ''],
      ['requiredSkills', this.skillText(job.requiredSkills || [])],
      ['preferredSkills', this.skillText(job.preferredSkills || [])],
    ];
    return fields
      .filter(([, value]) => tokens.some((token) => this.norm(value).includes(token)))
      .map(([name]) => name);
  }

  private localSearchRank(job: JobPosition, tokens: string[]) {
    const weightedFields: Array<[string, number]> = [
      [job.title || '', 8],
      [job.company || '', 5],
      [this.skillText(job.requiredSkills || []), 7],
      [this.skillText(job.preferredSkills || []), 4],
      [job.location || '', 3],
      [job.salaryRange || '', 2],
      [job.jdText || '', 1],
    ];
    let score = 0;
    for (const token of tokens) {
      for (const [value, weight] of weightedFields) {
        if (this.norm(value).includes(token)) score += weight;
      }
    }
    return score;
  }

  private skillText(skills: Array<{ name?: string } | string>) {
    return skills.map((skill: any) => typeof skill === 'string' ? skill : skill?.name || '').join(' ');
  }

  private tokenize(input: string) {
    return this.norm(input)
      .split(/[\s,，/|+;；、-]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
  }

  private async getLatestJobScoreChange(userId: number, jobId: number, currentScore: number) {
    const branch = await this.branchRepo.findOne({
      where: { userId, branchType: 'main', status: 1 },
      order: { id: 'ASC' },
    });
    if (!branch) return null;

    const commits = await this.commitRepo.find({
      where: { userId, branchId: branch.id, status: 1 },
      order: { createTime: 'DESC', id: 'DESC' },
      take: 20,
    });

    for (const commit of commits) {
      if (commit.commitType === 'baseline' || !commit.snapshotId) continue;
      const snapshot = await this.snapshotRepo.findOne({ where: { id: commit.snapshotId, userId, status: 1 } });
      const afterFromSnapshot = this.findJobScore(snapshot?.matchSummaryJson, jobId);
      if (afterFromSnapshot == null) continue;

      let beforeScore: number | null = null;
      if (commit.parentCommitId) {
        const previous = await this.snapshotRepo.findOne({ where: { commitId: commit.parentCommitId, userId, status: 1 } });
        beforeScore = this.findJobScore(previous?.matchSummaryJson, jobId);
      }

      const deltaFromSnapshots = beforeScore == null ? null : this.round(afterFromSnapshot - beforeScore);
      const deltaFromCommit = this.round(Number(commit.deltaJson?.metricsChange?.matchScore || 0));
      const delta = deltaFromSnapshots != null ? deltaFromSnapshots : deltaFromCommit;
      if (Math.abs(delta) < 0.01) continue;

      const afterScore = Number(commit.id) === Number(branch.headCommitId)
        ? this.round(currentScore)
        : this.round(afterFromSnapshot);
      const before = this.round(afterScore - delta);
      const skillChanges = this.topChanges(commit.deltaJson?.skillChanges, 'delta', 3);
      const radarChanges = this.topChanges(commit.deltaJson?.radarChanges, 'delta', 2);

      return {
        commitId: commit.id,
        commitType: commit.commitType,
        message: commit.message,
        skillName: commit.skillName,
        beforeScore: before,
        afterScore,
        delta,
        createdAt: Number(commit.createTime || 0),
        skillChanges,
        radarChanges,
        explanation: this.buildScoreChangeExplanation(commit, before, afterScore, delta, skillChanges, radarChanges),
      };
    }

    return null;
  }

  private findJobScore(summary: any, jobId: number): number | null {
    const jobs = Array.isArray(summary?.jobs) ? summary.jobs : [];
    const item = jobs.find((job: any) => Number(job.jobId || job.id) === Number(jobId));
    const score = Number(item?.matchScore ?? item?.totalScore);
    return Number.isFinite(score) ? this.round(score) : null;
  }

  private topChanges(items: any, field: string, limit: number) {
    return (Array.isArray(items) ? items : [])
      .filter((item) => Math.abs(Number(item?.[field] || 0)) >= 0.01)
      .sort((a, b) => Math.abs(Number(b[field] || 0)) - Math.abs(Number(a[field] || 0)))
      .slice(0, limit)
      .map((item) => ({
        name: item.name || item.dimension || '',
        before: this.round(Number(item.before || 0)),
        after: this.round(Number(item.after || 0)),
        delta: this.round(Number(item[field] || 0)),
      }));
  }

  private buildScoreChangeExplanation(
    commit: LearningCommit,
    beforeScore: number,
    afterScore: number,
    delta: number,
    skillChanges: Array<{ name: string; delta: number }>,
    radarChanges: Array<{ name: string; delta: number }>,
  ): string {
    const source = commit.skillName || commit.message || this.labelCommitType(commit.commitType);
    const skillText = skillChanges.length
      ? skillChanges.map((item) => `${item.name} ${this.signed(item.delta)}`).join('、')
      : `${source} 形成了新的能力证据`;
    const radarText = radarChanges.length
      ? `，带动 ${radarChanges.map((item) => `${item.name} ${this.signed(item.delta)}`).join('、')}`
      : '';
    return `最近一次${this.labelCommitType(commit.commitType)}更新了 ${skillText}${radarText}，因此该岗位匹配度从 ${beforeScore}% 到 ${afterScore}%（${this.signed(delta)}）。`;
  }

  private labelCommitType(type: string): string {
    const labels: Record<string, string> = {
      lecture_read: '讲义学习',
      quiz_passed: '测验通过',
      quiz_failed: '测验记录',
      code_done: '代码练习',
      skill_complete: '技能完成',
      task_done: '任务完成',
      manual: '手动记录',
      merge: '分支合并',
      rollback: '回滚',
    };
    return labels[type] || '学习';
  }

  private signed(value: number): string {
    const rounded = this.round(value);
    return `${rounded > 0 ? '+' : ''}${rounded}`;
  }

  private round(value: number): number {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  private norm(input: string) {
    return String(input || '').trim().toLowerCase();
  }
}

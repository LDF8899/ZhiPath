import { JobsService } from './jobs.service';

describe('JobsService.searchJobs', () => {
  const onlineJob = {
    id: -2000,
    title: 'Java 开发工程师',
    company: '示例科技',
    location: '上海',
    salaryRange: '20-30K',
    requiredSkills: ['Java'],
    matchScore: 80,
    source: 'online' as const,
    origin: 'ai_generated' as const,
    url: '',
  };

  function createService() {
    const jobRepo = {
      findOne: jest.fn(),
    };
    const applicationRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue({ id: 1 }),
    };
    const branchRepo = {
      findOne: jest.fn(),
    };
    const commitRepo = {
      find: jest.fn(),
    };
    const snapshotRepo = {
      findOne: jest.fn(),
    };
    const jobSearch = { search: jest.fn().mockResolvedValue([onlineJob]) };
    const skillService = {
      getEffectiveSkills: jest.fn().mockResolvedValue([{ name: 'Java' }]),
    };
    const matchAgent = {
      calculateForAllJobs: jest.fn().mockResolvedValue([]),
      calculateMatch: jest.fn(),
    };

    const service = new JobsService(
      jobRepo as any,
      applicationRepo as any,
      {} as any,
      {} as any,
      {} as any,
      branchRepo as any,
      commitRepo as any,
      snapshotRepo as any,
      matchAgent as any,
      jobSearch as any,
      skillService as any,
      {} as any,
      {} as any,
      { search: jest.fn().mockResolvedValue([]) } as any,
    );

    return { service, jobRepo, applicationRepo, branchRepo, commitRepo, snapshotRepo, matchAgent, jobSearch };
  }

  it('uses a default query when online mode is selected without a keyword', async () => {
    const { service, jobSearch } = createService();

    const result = await service.searchJobs(7, {
      searchMode: 'online',
      page: 1,
      pageSize: 20,
    });

    expect(jobSearch.search).toHaveBeenCalledWith('IT', ['Java']);
    expect(result.list).toHaveLength(1);
    expect(result.meta).toEqual(expect.objectContaining({
      searchMode: 'online',
      keyword: '',
      onlineQuery: 'IT',
      localCount: 0,
      onlineCount: 1,
      webOnlineCount: 0,
      aiRecommendationCount: 1,
    }));
  });

  it('returns the latest job-specific score change explanation', async () => {
    const { service, jobRepo, branchRepo, commitRepo, snapshotRepo, matchAgent } = createService();
    jobRepo.findOne.mockResolvedValue({
      id: 9,
      title: 'Web 前端实习生',
      requiredSkills: [{ name: 'React' }],
      preferredSkills: [],
      status: 1,
    });
    matchAgent.calculateMatch.mockResolvedValue({
      scenario: 'view_job',
      totalScore: 52.3,
      breakdown: {
        requiredSkills: { matched: ['React'], missing: [] },
        preferredSkills: { matched: [], missing: [] },
      },
      gapAnalysis: [],
      canApply: true,
      deliveryThreshold: 60,
      requirement: null,
    });
    branchRepo.findOne.mockResolvedValue({ id: 3, headCommitId: 22 });
    commitRepo.find.mockResolvedValue([{
      id: 22,
      branchId: 3,
      parentCommitId: 21,
      snapshotId: 102,
      commitType: 'quiz_passed',
      skillName: 'React 状态管理',
      message: 'quiz_passed: React 状态管理',
      createTime: 1710000000000,
      deltaJson: {
        skillChanges: [{ name: 'React 状态管理', before: 40, after: 48, delta: 8 }],
        radarChanges: [{ dimension: '状态管理', before: 35, after: 43, delta: 8 }],
        metricsChange: { matchScore: 6.2 },
      },
    }]);
    snapshotRepo.findOne
      .mockResolvedValueOnce({ id: 102, matchSummaryJson: { jobs: [{ jobId: 9, matchScore: 52.3 }] } })
      .mockResolvedValueOnce({ id: 101, matchSummaryJson: { jobs: [{ jobId: 9, matchScore: 46.1 }] } });

    const result = await service.getJobMatch(7, 9);

    expect(result.scoreChange).toEqual(expect.objectContaining({
      commitId: 22,
      beforeScore: 46.1,
      afterScore: 52.3,
      delta: 6.2,
    }));
    expect(result.scoreChange.explanation).toContain('React 状态管理 +8');
    expect(result.scoreChange.explanation).toContain('46.1% 到 52.3%');
  });

  it('allows direct apply for platform jobs', async () => {
    const { service, jobRepo, applicationRepo } = createService();
    jobRepo.findOne.mockResolvedValue({ id: 9, title: 'Web 前端实习生', source: 'manual', status: 1 });

    const result = await service.applyJob(7, 9);

    expect(applicationRepo.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, jobId: 9 }));
    expect(result).toEqual({ message: '申请成功' });
  });

  it('rejects temporary reference jobs before creating an application', async () => {
    const { service, jobRepo, applicationRepo } = createService();

    await expect(service.applyJob(7, -2000)).rejects.toThrow('参考岗位不能直接投递');

    expect(jobRepo.findOne).not.toHaveBeenCalled();
    expect(applicationRepo.save).not.toHaveBeenCalled();
  });

  it('rejects online or AI reference jobs even if they are persisted', async () => {
    const { service, jobRepo, applicationRepo } = createService();
    jobRepo.findOne.mockResolvedValue({ id: 12, title: 'AI 参考岗位', source: 'ai_generated', status: 1 });

    await expect(service.applyJob(7, 12)).rejects.toThrow('参考岗位不能直接投递');

    expect(applicationRepo.save).not.toHaveBeenCalled();
  });
});

describe('JobsService.getGapCard', () => {
  const baseJob = {
    id: 5,
    title: '前端开发实习生',
    company: '示例科技',
    level: 'junior',
    deliveryThreshold: 60,
    status: 1,
    requiredSkills: [
      { name: 'React Hooks', weight: 1, minLevel: 70 },
      { name: '接口联调', weight: 1, minLevel: 60 },
      { name: '项目部署', weight: 1, minLevel: 50 },
    ],
    preferredSkills: [{ name: 'TypeScript', weight: 0.5, minLevel: 50 }],
  };

  const matchResult = {
    totalScore: 58,
    canApply: false,
    requirement: { reason: '必须技能覆盖 45%，需达到 60%' },
    gapAnalysis: [
      { skill: 'React Hooks', type: 'required', currentMastery: 20 },
      { skill: '接口联调', type: 'required', currentMastery: 0 },
      { skill: '项目部署', type: 'required', currentMastery: 40 },
      { skill: 'TypeScript', type: 'preferred', currentMastery: 10 },
    ],
  };

  function createService(overrides: { skillList?: any[]; job?: any; match?: any; evidenceHits?: any[] } = {}) {
    const jobRepo = { findOne: jest.fn().mockResolvedValue(overrides.job === undefined ? baseJob : overrides.job) };
    const applicationRepo = { findOne: jest.fn(), save: jest.fn() };
    const studentRepo = { findOne: jest.fn().mockResolvedValue({ skills: [{ name: 'HTML' }] }) };
    const enterpriseRepo = {};
    const planRepo = {};
    const branchRepo = {};
    const commitRepo = {};
    const snapshotRepo = {};
    const matchAgent = {
      calculateForAllJobs: jest.fn(),
      calculateMatch: jest.fn().mockResolvedValue(overrides.match ?? matchResult),
    };
    const jobSearch = {};
    const skillService = {
      getEffectiveSkills: jest.fn().mockResolvedValue(overrides.skillList ?? [{ name: 'React', masteryPct: 20 }]),
    };
    const llmService = {};
    const config = {};
    const evidenceRag = {
      search: jest.fn().mockResolvedValue(
        overrides.evidenceHits ?? [],
      ),
    };

    const service = new JobsService(
      jobRepo as any,
      applicationRepo as any,
      studentRepo as any,
      enterpriseRepo as any,
      planRepo as any,
      branchRepo as any,
      commitRepo as any,
      snapshotRepo as any,
      matchAgent as any,
      jobSearch as any,
      skillService as any,
      llmService as any,
      config as any,
      evidenceRag as any,
    );

    return { service, jobRepo, studentRepo, matchAgent, skillService, evidenceRag };
  }

  it('returns score, top 3 gaps with actions and estimated impact', async () => {
    const { service } = createService();

    const card = await service.getGapCard(7, 5);

    expect(card.jobTitle).toBe('前端开发实习生');
    expect(card.score).toBe(58);
    expect(card.canApply).toBe(false);
    expect(card.hasProfile).toBe(true);
    expect(card.applyAdvice).toContain('暂不建议投递');
    expect(card.reason).toContain('必须技能覆盖 45%');
    // Top 3 缺口：required 优先、掌握度升序
    expect(card.topGaps.map((g: any) => g.skill)).toEqual(['接口联调', 'React Hooks', '项目部署']);
    expect(card.topGaps[0]).toEqual(expect.objectContaining({
      type: 'required',
      currentMastery: 0,
      actionTarget: 'learning',
      estimatedImpact: 3,
    }));
    expect(card.totalEstimatedImpact).toBe(9);
    expect(card.message).toBe('');
  });

  it('top gaps 标注证据覆盖状态（P1-2）', async () => {
    const { service, evidenceRag } = createService();
    evidenceRag.search.mockImplementation(async (_userId: number, skill: string) =>
      skill === '接口联调'
        ? [{ chunkId: 601, sourceType: 'project', title: '项目证据：接口联调实战', snippet: '…', score: 0.8 }]
        : [],
    );

    const card = await service.getGapCard(7, 5);

    // 缺口带 evidence 状态：首个缺口有证据，其余无
    expect(card.topGaps[0].evidence.hasEvidence).toBe(true);
    expect(card.topGaps[0].evidence.count).toBe(1);
    expect(card.topGaps[0].evidence.items[0]).toEqual(expect.objectContaining({ chunkId: 601 }));
    expect(card.topGaps[1].evidence.hasEvidence).toBe(false);
  });

  it('gives basic guidance when user has no skill profile', async () => {
    const { service } = createService({ skillList: [] });

    const card = await service.getGapCard(7, 5);

    expect(card.hasProfile).toBe(false);
    expect(card.message).toContain('还没有技能画像');
    expect(card.topGaps.every((g: any) => g.actionTarget === 'plan')).toBe(true);
  });

  it('falls back to basic skill hit when match calculation fails', async () => {
    const { service, matchAgent } = createService();
    matchAgent.calculateMatch.mockRejectedValue(new Error('match service down'));

    const card = await service.getGapCard(7, 5);

    // 降级：按 student.skills 与 requiredSkills 基础命中计算
    expect(card.score).toBe(0);
    expect(card.canApply).toBe(false);
    expect(card.topGaps.map((g: any) => g.skill)).toEqual(['React Hooks', '接口联调', '项目部署']);
    expect(card.topGaps.every((g: any) => g.type === 'required')).toBe(true);
  });

  it('throws NotFoundException when job does not exist', async () => {
    const { service, jobRepo } = createService({ job: null });

    await expect(service.getGapCard(7, 999)).rejects.toThrow('岗位不存在');
    expect(jobRepo.findOne).toHaveBeenCalledWith({ where: { id: 999, status: 1 } });
  });
});

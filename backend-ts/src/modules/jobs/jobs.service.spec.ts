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
      {} as any,
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
    );

    return { service, jobRepo, branchRepo, commitRepo, snapshotRepo, matchAgent, jobSearch };
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
});

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
    const jobSearch = { search: jest.fn().mockResolvedValue([onlineJob]) };
    const skillService = {
      getEffectiveSkills: jest.fn().mockResolvedValue([{ name: 'Java' }]),
    };
    const matchAgent = { calculateForAllJobs: jest.fn().mockResolvedValue([]) };

    const service = new JobsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      matchAgent as any,
      jobSearch as any,
      skillService as any,
      {} as any,
      {} as any,
    );

    return { service, jobSearch };
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
});

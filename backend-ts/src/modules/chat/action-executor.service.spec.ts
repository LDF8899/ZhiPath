import { ActionExecutorService } from './action-executor.service';

describe('ActionExecutorService video context', () => {
  let service: any;
  let videoAgent: any;
  let plannerAgent: any;
  let domainRegistry: any;

  beforeEach(() => {
    jest.useFakeTimers();
    videoAgent = {
      generate: jest.fn().mockReturnValue(new Promise(() => {})),
    };
    plannerAgent = {
      generateDomainPath: jest.fn().mockResolvedValue({
        plan: { id: 9, planName: '大学英语六级 CET-6', estimatedDate: '2026-12-01' },
        gapSkills: ['六级听力理解'],
        tasks: [],
      }),
    };
    domainRegistry = {
      resolvePath: jest.fn().mockReturnValue({
        domain: { id: 'english', name: '英语' },
        starterPath: { id: 'cet-6', title: '大学英语六级 CET-6' },
      }),
    };

    service = new ActionExecutorService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { setex: jest.fn().mockResolvedValue('OK') } as any,
      {} as any,
      { get: jest.fn().mockImplementation((k: string, d?: any) => d ?? '') } as any,
      {} as any,
      {} as any,
      plannerAgent,
      {} as any,
      videoAgent,
      {
        startActionTask: jest.fn().mockResolvedValue({ id: 7, agentType: 'code' }),
        reportProgress: jest.fn(),
        completeTask: jest.fn(),
        failTask: jest.fn(),
      } as any,
      domainRegistry,
      { generateForChat: jest.fn() } as any,
      { weakPoints: jest.fn().mockResolvedValue([]) } as any,
    );
  });

  afterEach(() => {
    ActionExecutorService.videoTasks.clear();
    jest.useRealTimers();
  });

  it('passes the user request and recent chat into video knowledge content', async () => {
    const result = await service.generateVideo(
      {
        type: 'generate_video',
        skillName: 'React Suspense',
        difficulty: 'intermediate',
        _userMessage: '把刚才讨论的 React Suspense 数据加载方案做成视频',
        _recentMessages: [
          { role: 'user', content: '我想优化首屏加载' },
          { role: 'assistant', content: '可以用 Suspense 边界和 fallback 拆分加载状态' },
          { role: 'user', content: '把刚才讨论的 React Suspense 数据加载方案做成视频' },
        ],
        _pageContext: 'chat',
      },
      24,
    );

    expect(result.type).toBe('video_pending');
    const [input] = videoAgent.generate.mock.calls[0];
    expect(input.skill_name).toBe('React Suspense');
    expect(input.knowledge_content).toContain('React Suspense 数据加载方案');
    expect(input.knowledge_content).toContain('Suspense 边界和 fallback');
    expect(input.knowledge_content).toContain('Page context');
    expect(result.data.contextSummary).toContain('React Suspense 数据加载方案');
  });

  it('creates a registered domain path without a target job', async () => {
    const result = await service.generatePath({
      type: 'generate_path',
      domainId: 'english',
      goalType: 'exam',
      starterPathId: 'cet-6',
      goalTitle: '大学英语六级 CET-6',
      dailyHours: 2,
    }, 24);

    expect(domainRegistry.resolvePath).toHaveBeenCalledWith('english', 'exam', 'cet-6');
    expect(plannerAgent.generateDomainPath).toHaveBeenCalledWith(
      24,
      expect.objectContaining({ id: 'english' }),
      expect.objectContaining({ id: 'cet-6' }),
      'exam',
      '大学英语六级 CET-6',
      2,
      'main',
    );
    expect(result.data.message).toContain('1 个能力项');
  });
});

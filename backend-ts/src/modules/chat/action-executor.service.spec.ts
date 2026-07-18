import { ActionExecutorService } from './action-executor.service';

describe('ActionExecutorService video context', () => {
  let service: any;
  let videoAgent: any;

  beforeEach(() => {
    jest.useFakeTimers();
    videoAgent = {
      generate: jest.fn().mockReturnValue(new Promise(() => {})),
    };

    service = new ActionExecutorService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { setex: jest.fn().mockResolvedValue('OK') } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      videoAgent,
      {
        startActionTask: jest.fn().mockResolvedValue({ id: 7, agentType: 'code' }),
        reportProgress: jest.fn(),
        completeTask: jest.fn(),
        failTask: jest.fn(),
      } as any,
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
});

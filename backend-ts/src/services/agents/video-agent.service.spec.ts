import { createHash } from 'crypto';
import { VideoAgentService } from './video-agent.service';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(() => true),
}));

describe('VideoAgentService cache key', () => {
  let service: VideoAgentService;
  let cacheService: any;

  beforeEach(() => {
    cacheService = {
      generateKey: jest.fn((_agent, _action, params) => `cache:${params.contentHash}`),
      get: jest.fn().mockResolvedValue({
        video_file_path: 'D:/tmp/video.mp4',
        duration_sec: 12,
        segments_count: 2,
        script: { segments: [] },
        cost_estimate: { llm_tokens: 0, tts_characters: 0, render_time_sec: 0 },
      }),
      del: jest.fn(),
      set: jest.fn(),
    };

    service = new VideoAgentService(
      {} as any,
      {} as any,
      {} as any,
      cacheService,
      {} as any,
      {} as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('includes knowledge content in the cache key hash', async () => {
    await service.generate({
      task_id: 'task-1',
      skill_name: 'React',
      difficulty: 'beginner',
      knowledge_content: 'context A',
    });
    await service.generate({
      task_id: 'task-2',
      skill_name: 'React',
      difficulty: 'beginner',
      knowledge_content: 'context B',
    });

    const firstParams = cacheService.generateKey.mock.calls[0][2];
    const secondParams = cacheService.generateKey.mock.calls[1][2];

    expect(firstParams).toEqual(expect.objectContaining({
      skill: 'React',
      difficulty: 'beginner',
      contentHash: createHash('sha256').update('context A').digest('hex').slice(0, 16),
    }));
    expect(secondParams.contentHash).toBe(
      createHash('sha256').update('context B').digest('hex').slice(0, 16),
    );
    expect(secondParams.contentHash).not.toBe(firstParams.contentHash);
  });
});

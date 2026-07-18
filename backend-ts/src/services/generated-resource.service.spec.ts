import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GeneratedResource } from '../entities/generated-resource.entity';
import { GeneratedResourceService } from './generated-resource.service';

function mockRepo() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
}

describe('GeneratedResourceService', () => {
  let service: GeneratedResourceService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    repo = mockRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneratedResourceService,
        { provide: getRepositoryToken(GeneratedResource), useValue: repo },
      ],
    }).compile();

    service = module.get(GeneratedResourceService);
  });

  it('normalizes chat exam task result into a quiz resource', async () => {
    repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    repo.save.mockImplementation(async (value) => ({ ...value, id: 10 }));

    const result = await service.upsertFromTask(24, {
      id: 7,
      userId: 24,
      agentType: 'exam',
      title: 'Generate quiz: React',
      taskStatus: 'success',
      progress: 100,
      params: {
        type: 'generate_exam',
        skillName: 'React',
        _source: 'chat',
        _chatSessionId: 'session-1',
      },
      result: {
        type: 'exam',
        data: { skill: 'React', questions: [{ question: 'What is JSX?' }] },
      },
      externalId: 'chat:24:generate_exam:1',
      errorMessage: null,
    } as any);

    expect(result.id).toBe(10);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: 24,
      resourceType: 'quiz',
      source: 'chat',
      sourceTaskId: 7,
      externalId: 'chat:24:generate_exam:1',
      chatSessionId: 'session-1',
      agentType: 'exam',
      skillName: 'React',
      resourceStatus: 'success',
      payload: { skill: 'React', questions: [{ question: 'What is JSX?' }] },
      previewMeta: expect.objectContaining({
        actionType: 'exam',
        actionKey: 'task:chat:24:generate_exam:1',
        progress: 100,
      }),
    }));
  });

  it('updates an existing resource by source task id when external id changes', async () => {
    repo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 99, userId: 24 });
    repo.findOne.mockResolvedValueOnce({ id: 99, resourceType: 'video' });

    const result = await service.upsertFromTask(24, {
      id: 8,
      userId: 24,
      agentType: 'code',
      title: 'Generate video: CSS Grid',
      taskStatus: 'success',
      progress: 100,
      params: { skillName: 'CSS Grid', _source: 'chat', _chatSessionId: 'session-2' },
      result: { video_file_path: '/videos/css-grid.mp4', skill_name: 'CSS Grid' },
      externalId: 'chat_video_1',
      errorMessage: null,
    } as any);

    expect(repo.update).toHaveBeenCalledWith(99, expect.objectContaining({
      resourceType: 'video',
      sourceTaskId: 8,
      externalId: 'chat_video_1',
      chatSessionId: 'session-2',
      skillName: 'CSS Grid',
      resourceStatus: 'success',
    }));
    expect(repo.save).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 99, resourceType: 'video' });
  });

  it('normalizes a running chat video task as a pending video resource', async () => {
    repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    repo.save.mockImplementation(async (value) => ({ ...value, id: 12 }));

    await service.upsertFromTask(24, {
      id: 10,
      userId: 24,
      agentType: 'code',
      title: 'Generate video: TypeScript',
      taskStatus: 'running',
      progress: 45,
      params: {
        type: 'generate_video',
        skillName: 'TypeScript',
        _source: 'chat',
        _chatSessionId: 'session-4',
      },
      result: null,
      externalId: 'chat_video_2',
      errorMessage: null,
    } as any);

    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
      resourceType: 'video',
      resourceStatus: 'running',
      source: 'chat',
      chatSessionId: 'session-4',
      skillName: 'TypeScript',
      previewMeta: expect.objectContaining({
        actionType: 'video_pending',
        progress: 45,
      }),
    }));
  });

  it('extracts card payload from LangGraph node action results', async () => {
    repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    repo.save.mockImplementation(async (value) => ({ ...value, id: 13 }));

    await service.upsertFromTask(24, {
      id: 11,
      userId: 24,
      agentType: 'code',
      title: 'Generate diagram: Event loop',
      taskStatus: 'success',
      progress: 100,
      params: {
        type: 'generate_diagram',
        skillName: 'Event loop',
        _source: 'chat',
        _chatSessionId: 'session-5',
      },
      result: {
        diagramResult: { mermaid: 'graph TD; A-->B;' },
        actions: [
          {
            type: 'diagram',
            data: {
              skill: 'Event loop',
              skillName: 'Event loop',
              title: 'Event loop diagram',
              mermaid: 'graph TD; A-->B;',
            },
          },
        ],
      },
      externalId: 'chat:24:generate_diagram:2',
      errorMessage: null,
    } as any);

    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
      resourceType: 'diagram',
      resourceStatus: 'success',
      source: 'chat',
      chatSessionId: 'session-5',
      skillName: 'Event loop',
      payload: {
        skill: 'Event loop',
        skillName: 'Event loop',
        title: 'Event loop diagram',
        mermaid: 'graph TD; A-->B;',
      },
      previewMeta: expect.objectContaining({
        actionType: 'diagram',
        progress: 100,
      }),
    }));
  });

  it('persists failed task as an error action resource', async () => {
    repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    repo.save.mockImplementation(async (value) => ({ ...value, id: 11 }));

    await service.failFromTask(24, {
      id: 9,
      userId: 24,
      agentType: 'code',
      title: 'Generate diagram: Vue',
      taskStatus: 'failed',
      progress: 30,
      params: { type: 'generate_diagram', skillName: 'Vue', _source: 'chat', _chatSessionId: 'session-3' },
      result: null,
      externalId: 'chat:24:generate_diagram:1',
      errorMessage: 'LLM timeout',
    } as any, 'LLM timeout');

    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
      resourceType: 'diagram',
      resourceStatus: 'failed',
      source: 'chat',
      chatSessionId: 'session-3',
      errorMessage: 'LLM timeout',
      previewMeta: expect.objectContaining({ actionType: 'error' }),
    }));
  });
});

import { AgentOfficeBridgeService } from './agent-office-bridge.service';

function makeTask(overrides: Record<string, any> = {}) {
  return {
    id: 101,
    userId: 24,
    agentType: 'code',
    title: 'Generate video: React',
    taskStatus: 'running',
    progress: 10,
    params: { type: 'generate_video', skillName: 'React', _source: 'chat', _chatSessionId: 's1' },
    result: null,
    externalId: 'chat_video_101',
    errorMessage: null,
    ...overrides,
  } as any;
}

describe('AgentOfficeBridgeService', () => {
  let taskService: any;
  let profileService: any;
  let eventsService: any;
  let generatedResources: any;
  let service: AgentOfficeBridgeService;

  beforeEach(() => {
    taskService = {
      upsertTaskStatus: jest.fn(),
      updateStatus: jest.fn(),
      updateProgress: jest.fn(),
      getTask: jest.fn(),
      hasRunningTask: jest.fn().mockResolvedValue(false),
    };
    profileService = {
      ensureAgent: jest.fn().mockResolvedValue(null),
      updateStatus: jest.fn().mockResolvedValue(null),
    };
    eventsService = {
      emitAgentStatus: jest.fn(),
      emitAgentProgress: jest.fn(),
      emitResourceReady: jest.fn(),
    };
    generatedResources = {
      upsertFromTask: jest.fn().mockResolvedValue({ id: 1, skillName: 'React', resourceType: 'video' }),
      failFromTask: jest.fn().mockResolvedValue({ id: 1 }),
    };
    service = new AgentOfficeBridgeService(
      taskService,
      profileService,
      eventsService,
      generatedResources,
    );
  });

  it('persists a running generated resource when a chat action enters the office', async () => {
    const created = makeTask({ progress: 0 });
    const running = makeTask({ progress: 10 });
    taskService.upsertTaskStatus.mockResolvedValue(created);
    taskService.updateStatus.mockResolvedValue(running);

    const task = await service.startActionTask(24, {
      type: 'generate_video',
      skillName: 'React',
      _source: 'chat',
      _chatSessionId: 's1',
    }, { externalId: 'chat_video_101' });

    expect(task).toBe(running);
    expect(taskService.upsertTaskStatus).toHaveBeenCalledWith(
      24,
      'code',
      expect.any(String),
      'chat_video_101',
      expect.objectContaining({
        taskStatus: 'running',
        progress: 10,
        params: expect.objectContaining({
          type: 'generate_video',
          skillName: 'React',
          _chatSessionId: 's1',
        }),
      }),
    );
    expect(generatedResources.upsertFromTask).toHaveBeenCalledWith(24, running);
  });

  it('refreshes the generated resource on progress and completion', async () => {
    const running = makeTask({ progress: 55 });
    const success = makeTask({
      taskStatus: 'success',
      progress: 100,
      result: { video_file_path: '/videos/react.mp4', skill_name: 'React' },
    });
    taskService.getTask.mockResolvedValue(running);
    taskService.updateStatus.mockResolvedValue(success);

    await service.reportProgress(24, running.id, running.agentType, 55, 'rendering');
    await service.completeTask(24, success.id, success.agentType, success.result);

    expect(taskService.updateProgress).toHaveBeenCalledWith(running.id, 55);
    expect(generatedResources.upsertFromTask).toHaveBeenCalledWith(24, running);
    expect(generatedResources.upsertFromTask).toHaveBeenCalledWith(24, success, success.result);
    expect(eventsService.emitResourceReady).toHaveBeenCalledWith(24, 'React', 'video');
    expect(eventsService.emitAgentProgress).toHaveBeenCalledWith(24, 'code', String(success.id), 100, expect.any(String));
  });
});

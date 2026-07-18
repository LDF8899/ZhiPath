import { LearningPathsService } from './learning-paths.service';

describe('LearningPathsService generated resources', () => {
  it('tracks auto generated content tasks through pending, running, and final states', async () => {
    const createdTasks = [
      { id: 1, agentType: 'lecture', taskStatus: 'pending', progress: 0, params: { skillName: 'React' } },
      { id: 2, agentType: 'code', taskStatus: 'pending', progress: 0, params: { skillName: 'React' } },
      { id: 3, agentType: 'reading', taskStatus: 'pending', progress: 0, params: { skillName: 'React' } },
    ];
    const taskById = new Map(createdTasks.map((task) => [task.id, task]));
    const taskService = {
      createTask: jest.fn()
        .mockResolvedValueOnce(createdTasks[0])
        .mockResolvedValueOnce(createdTasks[1])
        .mockResolvedValueOnce(createdTasks[2]),
      updateStatus: jest.fn(async (id: number, status: string, result?: any, errorMessage?: string) => ({
        ...taskById.get(id),
        taskStatus: status,
        progress: status === 'success' ? 100 : status === 'running' ? 10 : 0,
        result: result || null,
        errorMessage: errorMessage || null,
      })),
    };
    const generatedResources = {
      upsertFromTask: jest.fn().mockResolvedValue({ id: 1 }),
      failFromTask: jest.fn().mockResolvedValue({ id: 1 }),
    };

    const service = new LearningPathsService(
      {} as any,
      {} as any,
      {
        saveLecture: jest.fn().mockResolvedValue(undefined),
        saveQuiz: jest.fn().mockResolvedValue(undefined),
        saveCoding: jest.fn().mockResolvedValue(undefined),
        saveContent: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        generate: jest.fn().mockResolvedValue({
          content: 'React content',
          exercises: [{ type: 'choice', question: 'Q', options: ['A'], answer: 'A' }],
        }),
      } as any,
      {
        generate: jest.fn().mockResolvedValue({ examples: [{ title: 'Example' }] }),
      } as any,
      {
        generate: jest.fn().mockResolvedValue({ items: [{ title: 'Reading' }] }),
      } as any,
      taskService as any,
      {
        getProfiles: jest.fn().mockResolvedValue([]),
        updateStatus: jest.fn().mockResolvedValue(undefined),
        assignStation: jest.fn().mockResolvedValue(undefined),
      } as any,
      generatedResources as any,
    );

    await (service as any).generateAllContent('React', 24);

    expect(taskService.createTask).toHaveBeenCalledTimes(3);
    expect(taskService.updateStatus).toHaveBeenCalledWith(1, 'running');
    expect(taskService.updateStatus).toHaveBeenCalledWith(2, 'running');
    expect(taskService.updateStatus).toHaveBeenCalledWith(3, 'running');
    expect(taskService.updateStatus).toHaveBeenCalledWith(1, 'success', expect.any(Object), undefined);
    expect(taskService.updateStatus).toHaveBeenCalledWith(2, 'success', expect.any(Object), undefined);
    expect(taskService.updateStatus).toHaveBeenCalledWith(3, 'success', expect.any(Object), undefined);
    expect(generatedResources.upsertFromTask).toHaveBeenCalledWith(24, createdTasks[0], undefined);
    expect(generatedResources.upsertFromTask).toHaveBeenCalledWith(
      24,
      expect.objectContaining({ id: 1, taskStatus: 'running' }),
      undefined,
    );
    expect(generatedResources.upsertFromTask).toHaveBeenCalledWith(
      24,
      expect.objectContaining({ id: 1, taskStatus: 'success' }),
      expect.any(Object),
    );
    expect(generatedResources.failFromTask).not.toHaveBeenCalled();
  });
});

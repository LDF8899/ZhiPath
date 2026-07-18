import { AgentsController } from './agents.controller';

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('AgentsController resource ledger integration', () => {
  it('registers direct agent output in generated resources', async () => {
    const task = { id: 11, agentType: 'lecture', taskStatus: 'pending', progress: 0 };
    const completedTask = { ...task, taskStatus: 'success', progress: 100 };
    const lectureAgent = {
      generate: jest.fn().mockResolvedValue({ content: 'React content', skill: 'React' }),
    };
    const knowledgeBase = {
      saveLecture: jest.fn().mockResolvedValue(undefined),
    };
    const taskService = {
      createTask: jest.fn().mockResolvedValue(task),
      updateStatus: jest.fn().mockResolvedValue(completedTask),
    };
    const generatedResources = {
      upsertFromTask: jest.fn().mockResolvedValue({ id: 1 }),
    };

    const controller = new AgentsController(
      lectureAgent as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      knowledgeBase as any,
      taskService as any,
      generatedResources as any,
      {} as any,
      {} as any,
    );

    const response = await controller.generateLecture(24, { skillName: 'React' });
    await flushPromises();

    expect(response.code).toBe(200);
    expect(taskService.createTask).toHaveBeenCalledWith(
      24,
      'lecture',
      expect.stringContaining('React'),
      { skillName: 'React' },
    );
    expect(generatedResources.upsertFromTask).toHaveBeenCalledWith(24, task);
    expect(taskService.updateStatus).toHaveBeenCalledWith(11, 'success', {
      content: 'React content',
      skill: 'React',
    });
    expect(generatedResources.upsertFromTask).toHaveBeenCalledWith(24, completedTask, {
      content: 'React content',
      skill: 'React',
    });
  });
});

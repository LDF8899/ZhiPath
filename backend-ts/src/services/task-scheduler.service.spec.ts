import { TaskSchedulerService } from './task-scheduler.service';

describe('TaskSchedulerService legacy path compatibility', () => {
  it('accepts string skills and skips malformed entries without failing the day', async () => {
    const planRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 10,
          userId: 5,
          status: 1,
          planStatus: 'active',
          scheduleEnabled: 1,
          planType: 'main',
          planName: '兼容路径',
          currentPhase: 0,
          dailyHours: 2,
          mainRatio: 100,
          pathData: {
            phases: [
              {
                skills: [
                  'TypeScript',
                  { name: 'NestJS', estimatedMin: 30 },
                  { estimatedMin: 10 },
                  null,
                ],
              },
            ],
          },
        },
      ]),
    };
    const taskRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (tasks) => tasks),
    };
    const studentRepo = { findOne: jest.fn().mockResolvedValue({ dailyHours: 2 }) };
    const skillService = {
      getEffectiveSkills: jest.fn().mockResolvedValue([
        { name: undefined, masteryPct: 90 },
        { name: 'TypeScript', masteryPct: 40 },
      ]),
    };
    const service = new TaskSchedulerService(
      planRepo as any,
      taskRepo as any,
      studentRepo as any,
      skillService as any,
      {} as any,
      {} as any,
    );

    const result = await service.getTodayTasks(5);

    expect(taskRepo.save).toHaveBeenCalledTimes(1);
    expect(result.mainTasks.map((task) => task.skillName)).toEqual(['TypeScript']);
    expect(result.totalEstimatedMin).toBe(120);
  });
});

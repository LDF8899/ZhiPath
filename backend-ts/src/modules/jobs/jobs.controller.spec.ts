import { JobsController } from './jobs.controller';

describe('JobsController gap-card route', () => {
  it('delegates to jobsService.getGapCard with current user id and parsed jobId', async () => {
    const jobsService = {
      getGapCard: jest.fn().mockResolvedValue({ jobId: 5, score: 58 }),
    };
    const controller = new JobsController(jobsService as any);

    const response = await controller.getGapCard({ sub: 7 }, '5');

    expect(jobsService.getGapCard).toHaveBeenCalledWith(7, 5);
    expect(response.code).toBe(200);
    expect(response.data).toEqual({ jobId: 5, score: 58 });
  });

  it('parses jobId as number', async () => {
    const jobsService = {
      getGapCard: jest.fn().mockResolvedValue({ jobId: 101 }),
    };
    const controller = new JobsController(jobsService as any);

    await controller.getGapCard({ sub: 1 }, '101');

    expect(jobsService.getGapCard).toHaveBeenCalledWith(1, 101);
  });
});

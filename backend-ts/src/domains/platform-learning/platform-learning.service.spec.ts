import { PlatformLearningService } from './platform-learning.service';

describe('PlatformLearningService activity commands', () => {
  function createService(currentStatus = 'planned') {
    const runner = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('FROM learning_activities') && sql.includes('FOR UPDATE')) {
          return [{
            id: 8,
            publicId: '11111111-1111-4111-8111-111111111111',
            currentStatus,
            legacyTaskId: 12,
            actualMinutes: null,
          }];
        }
        return {};
      }),
    };
    const emit = jest.fn();
    const audit = jest.fn();
    const commands = {
      execute: jest.fn().mockImplementation(async (_context, _route, _payload, _status, handler) =>
        handler({ runner, clientAppId: 1, emit, audit }),
      ),
    };
    return {
      service: new PlatformLearningService({} as any, commands as any),
      runner,
      emit,
      audit,
    };
  }

  const input = {
    tenantId: 1,
    userId: 2,
    clientApp: 'zhipath-web',
    requestId: 'request-activity',
    idempotencyKey: 'idem-activity',
    activityId: '11111111-1111-4111-8111-111111111111',
    dto: { status: 'in_progress', actualMinutes: 15 },
  };

  it('updates the normalized activity and its legacy task in one command', async () => {
    const { service, runner, emit, audit } = createService();
    const result = await service.updateActivityStatus(input);

    expect(result).toMatchObject({ status: 'in_progress', previousStatus: 'planned', actualMinutes: 15 });
    expect(runner.query.mock.calls.some(([sql]) => sql.includes('UPDATE learning_activities'))).toBe(true);
    expect(runner.query.mock.calls.some(([sql]) => sql.includes('UPDATE learning_tasks_v3'))).toBe(true);
    expect(emit).toHaveBeenCalledWith(
      'learning_activity',
      input.activityId,
      'learning.activity.status_changed.v1',
      expect.objectContaining({ status: 'in_progress' }),
    );
    expect(audit).toHaveBeenCalled();
  });

  it('rejects transitions out of a completed activity', async () => {
    const { service } = createService('completed');
    await expect(service.updateActivityStatus(input)).rejects.toThrow(
      '学习活动状态不能从 completed 变更为 in_progress',
    );
  });
});

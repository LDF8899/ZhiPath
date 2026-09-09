import { PlatformJobCancelledError, PlatformJobTrackerService } from './platform-job-tracker.service';

function createService(row: Record<string, unknown>) {
  const manager = {
    query: jest.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FROM async_jobs') && sql.includes('FOR UPDATE')) return [row];
      return { affectedRows: 1 };
    }),
  };
  const dataSource = {
    transaction: jest.fn(async (handler: (value: typeof manager) => unknown) => handler(manager)),
    query: jest.fn(),
  };
  return { service: new PlatformJobTrackerService(dataSource as any), manager, dataSource };
}

describe('PlatformJobTrackerService cancellation', () => {
  it('does not start work after cancellation was requested', async () => {
    const { service, manager } = createService({
      id: 7,
      agentRunId: 8,
      status: 'cancelling',
      cancelRequestedAt: new Date(),
    });

    await expect(service.start('job-1')).resolves.toBe(false);
    expect(manager.query.mock.calls.some(([sql]) => sql.includes("status = 'cancelled'"))).toBe(true);
    expect(manager.query.mock.calls.some(([sql]) => sql.includes("status = 'running'"))).toBe(false);
  });

  it('turns a cooperative checkpoint into a typed cancellation signal', async () => {
    const { service } = createService({
      id: 7,
      agentRunId: null,
      status: 'cancelling',
      cancelRequestedAt: new Date(),
    });

    await expect(service.assertActive('job-1')).rejects.toBeInstanceOf(PlatformJobCancelledError);
  });

  it('never creates an artifact when completion races with cancellation', async () => {
    const { service, manager } = createService({
      id: 7,
      tenantId: 1,
      userId: 2,
      clientAppId: 3,
      agentRunId: 8,
      jobType: 'agent.lecture',
      payload: '{}',
      requestId: 'request-1',
      status: 'cancelling',
    });

    await expect(service.complete('job-1', { content: 'late result' })).resolves.toBe(false);
    expect(manager.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO generated_artifacts'))).toBe(false);
    expect(manager.query.mock.calls.some(([sql]) => sql.includes('async.job.completed.v1'))).toBe(false);
  });

  it('records a normal running job result and completion event', async () => {
    const { service, manager } = createService({
      id: 7,
      tenantId: 1,
      userId: 2,
      clientAppId: 3,
      agentRunId: null,
      jobType: 'resource.quiz',
      payload: '{"skillName":"TypeScript"}',
      requestId: 'request-1',
      status: 'running',
    });

    await expect(service.complete('job-1', { count: 5 })).resolves.toBe(true);
    expect(manager.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO generated_artifacts'))).toBe(true);
    expect(manager.query.mock.calls.some(([sql]) => sql.includes('async.job.completed.v1'))).toBe(true);
  });
});

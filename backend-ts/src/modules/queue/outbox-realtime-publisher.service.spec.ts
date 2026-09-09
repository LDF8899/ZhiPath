import { OutboxRealtimePublisherService } from './outbox-realtime-publisher.service';

describe('OutboxRealtimePublisherService', () => {
  it('claims a terminal job event, emits the canonical state and marks it published', async () => {
    const query = jest.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FROM outbox_events')) {
        return [{ id: 11, aggregateId: 'job-1', eventType: 'async.job.completed.v1', payload: '{}' }];
      }
      if (sql.startsWith('UPDATE outbox_events SET status = \'processing\'')) return { affectedRows: 1 };
      if (sql.includes('FROM async_jobs')) {
        return [{
          userId: 7,
          jobType: 'resource.quiz',
          status: 'completed',
          progress: 100,
          result: '{"count":5}',
          error: null,
        }];
      }
      return { affectedRows: 1 };
    });
    const events = { emit: jest.fn() };
    const service = new OutboxRealtimePublisherService({ query } as any, events as any);

    await service.publish();

    expect(events.emit).toHaveBeenCalledWith(7, {
      type: 'async_job_status',
      data: expect.objectContaining({ id: 'job-1', status: 'completed', result: { count: 5 } }),
    });
    expect(query.mock.calls.some(([sql]) => sql.includes("status = 'published'"))).toBe(true);
  });

  it('does not publish an event another worker already claimed', async () => {
    const query = jest.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FROM outbox_events')) return [{ id: 12, aggregateId: 'job-2' }];
      return { affectedRows: 0 };
    });
    const events = { emit: jest.fn() };
    const service = new OutboxRealtimePublisherService({ query } as any, events as any);

    await service.publish();

    expect(events.emit).not.toHaveBeenCalled();
  });
});

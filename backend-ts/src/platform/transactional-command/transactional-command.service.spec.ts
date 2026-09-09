import { TransactionalCommandService } from './transactional-command.service';

describe('TransactionalCommandService', () => {
  const context = {
    tenantId: 1,
    userId: 2,
    clientApp: 'zhipath-web',
    requestId: 'request-command',
    idempotencyKey: 'idem-command',
  };

  it('commits the domain write, outbox, audit and idempotency response together', async () => {
    const runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isTransactionActive: true,
      query: jest.fn().mockImplementation(async (sql: string) =>
        sql.includes('SELECT id FROM client_apps') ? [{ id: 1 }] : {},
      ),
    };
    const service = new TransactionalCommandService({ createQueryRunner: () => runner } as any);

    const result = await service.execute(context, '/api/v1/test', { value: 1 }, 201, async (execution) => {
      await execution.emit('test', 'resource-1', 'test.created.v1', { id: 'resource-1' });
      await execution.audit('test.create', 'test', 'resource-1');
      return { id: 'resource-1' };
    });

    expect(result).toEqual({ id: 'resource-1' });
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(runner.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO outbox_events'))).toBe(true);
    expect(runner.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO audit_logs'))).toBe(true);
    expect(runner.query.mock.calls.some(([sql]) => sql.includes("state = 'completed'"))).toBe(true);
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('returns a completed idempotent response without re-running the handler', async () => {
    const runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isTransactionActive: true,
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT id FROM client_apps')) return [{ id: 1 }];
        if (sql.includes('INSERT INTO idempotency_keys')) {
          const duplicate: any = new Error('duplicate');
          duplicate.code = 'ER_DUP_ENTRY';
          throw duplicate;
        }
        if (sql.includes('SELECT request_hash')) {
          const crypto = await import('crypto');
          return [{
            requestHash: crypto.createHash('sha256').update(JSON.stringify({ value: 1 })).digest('hex'),
            state: 'completed',
            responseJson: JSON.stringify({ id: 'resource-1' }),
          }];
        }
        return {};
      }),
    };
    const service = new TransactionalCommandService({ createQueryRunner: () => runner } as any);
    const handler = jest.fn();

    await expect(service.execute(context, '/api/v1/test', { value: 1 }, 201, handler)).resolves.toEqual({
      id: 'resource-1',
      idempotencyReplayed: true,
    });
    expect(handler).not.toHaveBeenCalled();
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });
});

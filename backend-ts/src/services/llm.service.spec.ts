import { LlmService } from './llm.service';

describe('LlmService usage attribution', () => {
  function createService() {
    const config = { get: jest.fn((_key: string, fallback?: unknown) => fallback) };
    const dataSource = { query: jest.fn().mockResolvedValue({ affectedRows: 1 }) };
    const service = new LlmService(config as any, dataSource as any);
    (service as any).client = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
          }),
        },
      },
    };
    return { service, dataSource };
  }

  it('writes tenant, user, client, model, tokens and request id to the ledger', async () => {
    const { service, dataSource } = createService();

    const result = await service.withUser(
      undefined,
      () => service.chatCompletionWithUsage([{ role: 'user', content: 'hello' }]),
      {
        tenantId: 2,
        userId: 7,
        clientApp: 'codenova-web',
        requestId: 'request-ledger',
      },
    );

    expect(result.content).toBe('ok');
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ai_usage_ledger'),
      expect.arrayContaining([2, 7, 'ollama', 'qwen2.5:7b', 12, 3, 'request-ledger', 'codenova-web']),
    );
  });

  it('does not write unattributed background work to a misleading client', async () => {
    const { service, dataSource } = createService();

    await service.chatCompletionWithUsage([{ role: 'user', content: 'hello' }]);

    expect(dataSource.query).not.toHaveBeenCalled();
  });
});

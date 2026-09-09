import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PlatformApiClient,
  PlatformApiError,
  PlatformTokenStore,
  type StorageLike,
} from '../src/index.ts';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function createTokenStore() {
  return new PlatformTokenStore(new MemoryStorage(), {
    accessToken: 'access',
    refreshToken: 'refresh',
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('token store isolates keys and removes an explicitly cleared refresh token', () => {
  const storage = new MemoryStorage();
  const zhipath = new PlatformTokenStore(storage, {
    accessToken: 'zhipath_access',
    refreshToken: 'zhipath_refresh',
  });
  const codenova = new PlatformTokenStore(storage, {
    accessToken: 'codenova_access',
    refreshToken: 'codenova_refresh',
  });

  zhipath.setTokens('z-access', 'z-refresh');
  codenova.setTokens('c-access', 'c-refresh');
  zhipath.setTokens('z-access-2', null);

  assert.equal(zhipath.getAccessToken(), 'z-access-2');
  assert.equal(zhipath.getRefreshToken(), null);
  assert.equal(codenova.getAccessToken(), 'c-access');
  assert.equal(codenova.getRefreshToken(), 'c-refresh');
});

test('request sends client identity, version, access token, query and JSON body', async () => {
  const tokenStore = createTokenStore();
  tokenStore.setTokens('access-token', 'refresh-token');
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const client = new PlatformApiClient({
    baseUrl: 'http://localhost:3000/api/',
    clientApp: 'zhipath-web',
    clientVersion: 'smoke',
    requestIdFactory: () => 'request-fixed-1',
    tokenStore,
    fetchImpl: async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return jsonResponse({ code: 200, data: { ok: true } });
    },
  });

  const result = await client.request<{ ok: boolean }>('/v1/example', {
    method: 'POST',
    query: { page: 2, enabled: true, empty: '', omitted: undefined },
    body: { answer: 42 },
    headers: { 'Idempotency-Key': 'request-1' },
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(capturedUrl, 'http://localhost:3000/api/v1/example?page=2&enabled=true');
  const headers = capturedInit?.headers as Record<string, string>;
  assert.equal(headers['X-Client-App'], 'zhipath-web');
  assert.equal(headers['X-Client-Version'], 'smoke');
  assert.equal(headers.Authorization, 'Bearer access-token');
  assert.equal(headers['Idempotency-Key'], 'request-1');
  assert.equal(headers['X-Request-Id'], 'request-fixed-1');
  assert.equal(capturedInit?.body, JSON.stringify({ answer: 42 }));
});

test('experience home uses the shared v1 composition contract', async () => {
  const tokenStore = createTokenStore();
  let requestedUrl = '';
  const client = new PlatformApiClient({
    clientApp: 'codenova-web',
    tokenStore,
    fetchImpl: async (input) => {
      requestedUrl = String(input);
      return jsonResponse({
        data: {
          client: { key: 'codenova-web', configVersion: 2 },
          generatedAt: '2026-09-08T00:00:00.000Z',
          sections: { dashboard: { activePaths: 1 } },
        },
      });
    },
  });

  const result = await client.home();

  assert.equal(requestedUrl, '/api/v1/experience/home');
  assert.equal(result.client.key, 'codenova-web');
  assert.equal(result.sections.dashboard?.activePaths, 1);
});

test('tenant switch keeps client identity and returns rotated credentials', async () => {
  const tokenStore = createTokenStore();
  tokenStore.setTokens('tenant-1-access', 'tenant-1-refresh');
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const client = new PlatformApiClient({
    clientApp: 'zhipath-web',
    tokenStore,
    fetchImpl: async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return jsonResponse({
        data: { token: 'tenant-2-access', accessToken: 'tenant-2-access', refreshToken: 'tenant-2-refresh' },
      });
    },
  });

  const result = await client.switchTenant(2);

  assert.equal(capturedUrl, '/api/v1/auth/switch-tenant');
  assert.equal(capturedInit?.body, JSON.stringify({ tenantId: 2 }));
  const headers = capturedInit?.headers as Record<string, string>;
  assert.equal(headers['X-Client-App'], 'zhipath-web');
  assert.equal(headers.Authorization, 'Bearer tenant-1-access');
  assert.equal(result.accessToken, 'tenant-2-access');
  assert.equal(tokenStore.getAccessToken(), 'tenant-2-access');
  assert.equal(tokenStore.getRefreshToken(), 'tenant-2-refresh');
});

test('concurrent 401 responses share one refresh and retry with the rotated token', async () => {
  const tokenStore = createTokenStore();
  tokenStore.setTokens('expired-access', 'refresh-1');
  let refreshCalls = 0;
  let protectedCalls = 0;
  const client = new PlatformApiClient({
    clientApp: 'codenova-web',
    tokenStore,
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url.endsWith('/v1/auth/refresh')) {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return jsonResponse({
          data: { accessToken: 'rotated-access', refreshToken: 'refresh-2' },
        });
      }
      protectedCalls += 1;
      const authorization = (init?.headers as Record<string, string>)?.Authorization;
      return authorization === 'Bearer rotated-access'
        ? jsonResponse({ data: { ok: true } })
        : jsonResponse({ error: { code: 401, message: 'expired' } }, 401);
    },
  });

  const [first, second] = await Promise.all([
    client.request<{ ok: boolean }>('/v1/me'),
    client.request<{ ok: boolean }>('/v1/me'),
  ]);

  assert.deepEqual(first, { ok: true });
  assert.deepEqual(second, { ok: true });
  assert.equal(refreshCalls, 1);
  assert.equal(protectedCalls, 4);
  assert.equal(tokenStore.getAccessToken(), 'rotated-access');
  assert.equal(tokenStore.getRefreshToken(), 'refresh-2');
});

test('failed authentication preserves stable string error codes and reports request id', async () => {
  const tokenStore = createTokenStore();
  tokenStore.setTokens('expired-access', null);
  let unauthorizedCalls = 0;
  const client = new PlatformApiClient({
    clientApp: 'zhipath-web',
    tokenStore,
    onUnauthorized: () => unauthorizedCalls += 1,
    fetchImpl: async () => jsonResponse({
      error: { code: 'AUTH_TOKEN_EXPIRED', message: '令牌已失效', requestId: 'req-auth-1' },
    }, 401),
  });

  await assert.rejects(
    client.request('/v1/me'),
    (error: unknown) => {
      assert.ok(error instanceof PlatformApiError);
      assert.equal(error.code, 'AUTH_TOKEN_EXPIRED');
      assert.equal(error.message, '令牌已失效');
      assert.equal(error.requestId, 'req-auth-1');
      return true;
    },
  );
  assert.equal(unauthorizedCalls, 1);
  assert.equal(tokenStore.getAccessToken(), null);
});

test('401 retry keeps the caller request id while refresh gets its own id', async () => {
  const tokenStore = createTokenStore();
  tokenStore.setTokens('expired-access', 'refresh-1');
  const captured: Array<{ url: string; requestId?: string }> = [];
  let sequence = 0;
  const client = new PlatformApiClient({
    clientApp: 'zhipath-web',
    tokenStore,
    requestIdFactory: () => `generated-${++sequence}`,
    fetchImpl: async (input, init) => {
      const url = String(input);
      const headers = init?.headers as Record<string, string>;
      captured.push({ url, requestId: headers['X-Request-Id'] });
      if (url.endsWith('/v1/auth/refresh')) {
        return jsonResponse({ data: { accessToken: 'rotated', refreshToken: 'refresh-2' } });
      }
      return headers.Authorization === 'Bearer rotated'
        ? jsonResponse({ data: { ok: true } })
        : jsonResponse({ error: { code: 'AUTH_TOKEN_EXPIRED', message: 'expired' } }, 401);
    },
  });

  await client.request('/v1/me', { headers: { 'X-Request-Id': 'caller-request' } });

  const protectedRequests = captured.filter((item) => item.url.endsWith('/v1/me'));
  const refreshRequest = captured.find((item) => item.url.endsWith('/v1/auth/refresh'));
  assert.deepEqual(protectedRequests.map((item) => item.requestId), [
    'caller-request',
    'caller-request',
  ]);
  assert.equal(refreshRequest?.requestId, 'generated-1');
});

test('commands reject invalid idempotency keys before issuing a request', async () => {
  let fetchCalls = 0;
  const client = new PlatformApiClient({
    clientApp: 'zhipath-web',
    tokenStore: createTokenStore(),
    fetchImpl: async () => {
      fetchCalls += 1;
      return jsonResponse({ data: {} });
    },
  });

  await assert.rejects(
    client.createJob({ jobType: 'agent.path', payload: {} }, ''),
    (error: unknown) => error instanceof PlatformApiError && error.code === 400,
  );
  await assert.rejects(
    client.createEvidence({}, 'x'.repeat(201)),
    (error: unknown) => error instanceof PlatformApiError && error.code === 400,
  );
  assert.equal(fetchCalls, 0);
});

test('timeout is normalized to a stable platform error', async () => {
  const client = new PlatformApiClient({
    clientApp: 'codenova-web',
    tokenStore: createTokenStore(),
    defaultTimeoutMs: 5,
    fetchImpl: async (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('aborted', 'AbortError'));
      });
    }),
  });

  await assert.rejects(
    client.request('/v1/slow'),
    (error: unknown) => {
      assert.ok(error instanceof PlatformApiError);
      assert.equal(error.code, 0);
      assert.match(error.message, /请求超时/);
      return true;
    },
  );
});

test('binary responses bypass the JSON envelope for document downloads', async () => {
  const client = new PlatformApiClient({
    clientApp: 'zhipath-web',
    tokenStore: createTokenStore(),
    fetchImpl: async () => new Response(new Uint8Array([37, 80, 68, 70]), {
      status: 200,
      headers: { 'Content-Type': 'application/pdf' },
    }),
  });

  const result = await client.request<Blob>('/v1/resumes/1/pdf', { responseType: 'blob' });
  assert.equal(result.type, 'application/pdf');
  assert.deepEqual(Array.from(new Uint8Array(await result.arrayBuffer())), [37, 80, 68, 70]);
});

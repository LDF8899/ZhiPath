import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright';

type ClientDefinition = {
  name: string;
  clientApp: 'zhipath-web' | 'codenova-web';
  baseUrl: string;
  loginPath: string;
  brand: RegExp;
  forbiddenBrand: RegExp;
  accessTokenKey: string;
  forbiddenAccessTokenKey: string;
  authenticatedPath: RegExp;
  prepareLogin(page: Page): Promise<void>;
};

type SmokeSession = {
  definition: ClientDefinition;
  page: Page;
  token: string;
};

const username = process.env.SMOKE_USERNAME || 'demo_frontend_rag';
const password = process.env.SMOKE_PASSWORD || '123456';
const headless = process.env.SMOKE_HEADLESS !== 'false';
const executablePath = resolveChromiumExecutable();

const clients: ClientDefinition[] = [
  {
    name: '智途 ZhiPath',
    clientApp: 'zhipath-web',
    baseUrl: process.env.ZHIPATH_FRONTEND_URL || 'http://127.0.0.1:5173',
    loginPath: '/login',
    brand: /智途|ZhiPath/,
    forbiddenBrand: /AI 原生能力成长工作台/,
    accessTokenKey: 'zhpath_token',
    forbiddenAccessTokenKey: 'codenova_token',
    authenticatedPath: /\/(user\/home|onboarding|admin\/dashboard)(?:$|[/?#])/,
    prepareLogin: async (page) => {
      await page.getByPlaceholder('请输入用户名').waitFor();
    },
  },
  {
    name: 'CodeNova',
    clientApp: 'codenova-web',
    baseUrl: process.env.CODENOVA_FRONTEND_URL || 'http://127.0.0.1:5180',
    loginPath: '/',
    brand: /CodeNova|AI 原生能力成长工作台/,
    forbiddenBrand: /每个专业，都有一条|智途 ZhiPath/,
    accessTokenKey: 'codenova_token',
    forbiddenAccessTokenKey: 'zhpath_token',
    authenticatedPath: /\/(today|onboarding)(?:$|[/?#])/,
    prepareLogin: async (page) => {
      await page.getByRole('button', { name: '登录', exact: true }).first().click();
      await page.locator('input[autocomplete="current-password"]').waitFor();
    },
  },
];

function resolveChromiumExecutable(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/snap/bin/chromium',
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

async function login(browser: Browser, definition: ClientDefinition): Promise<SmokeSession> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const loginHeaders: Record<string, string>[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/auth/login')) loginHeaders.push(request.headers());
  });

  await page.goto(`${definition.baseUrl}${definition.loginPath}`, { waitUntil: 'domcontentloaded' });
  const body = await page.locator('body').innerText();
  assert.match(body, definition.brand, `${definition.name} 品牌标识缺失`);
  assert.doesNotMatch(body, definition.forbiddenBrand, `${definition.name} 混入了另一套前端品牌`);

  await definition.prepareLogin(page);
  const userInput = page.locator('input[autocomplete="username"], input[placeholder="请输入用户名"]').last();
  const passwordInput = page.locator('input[autocomplete="current-password"], input[placeholder="请输入密码"]').last();
  await userInput.fill(username);
  await passwordInput.fill(password);

  const loginResponse = page.waitForResponse(
    (response) => response.url().includes('/api/v1/auth/login') && response.request().method() === 'POST',
  );
  await page.locator('form').filter({ has: passwordInput }).locator('button[type="submit"]').click();
  const response = await loginResponse;
  assert.equal(response.status(), 200, `${definition.name} 登录接口返回 ${response.status()}`);
  const loginBody = await response.json();
  const capturedLoginHeaders = loginHeaders[loginHeaders.length - 1];
  assert.equal(
    capturedLoginHeaders?.['x-client-app'],
    definition.clientApp,
    `${definition.name} 发出了错误的 X-Client-App`,
  );
  assert.ok(capturedLoginHeaders?.['x-request-id'], `${definition.name} 登录请求缺少 X-Request-Id`);
  assert.equal(
    loginBody?.meta?.requestId,
    capturedLoginHeaders['x-request-id'],
    `${definition.name} 的 request ID 没有端到端透传`,
  );
  await page.waitForURL(definition.authenticatedPath, { timeout: 15_000 });

  const storage = await page.evaluate(
    ({ ownKey, forbiddenKey }) => ({
      token: sessionStorage.getItem(ownKey),
      forbiddenToken: sessionStorage.getItem(forbiddenKey),
    }),
    { ownKey: definition.accessTokenKey, forbiddenKey: definition.forbiddenAccessTokenKey },
  );
  assert.ok(storage.token, `${definition.name} 登录后没有保存自己的访问令牌`);
  assert.equal(storage.forbiddenToken, null, `${definition.name} 写入了另一客户端的令牌键`);

  const bootstrap = await page.evaluate(
    async ({ token, clientApp }) => {
      const result = await fetch('/api/v1/experience/bootstrap', {
        headers: { Authorization: `Bearer ${token}`, 'X-Client-App': clientApp },
      });
      return { status: result.status, body: await result.json() };
    },
    { token: storage.token, clientApp: definition.clientApp },
  );
  assert.equal(bootstrap.status, 200, `${definition.name} bootstrap 失败`);
  assert.equal(
    bootstrap.body?.data?.client?.key,
    definition.clientApp,
    `${definition.name} 收到了错误的客户端体验配置`,
  );

  const home = await page.evaluate(
    async ({ token, clientApp }) => {
      const result = await fetch('/api/v1/experience/home', {
        headers: { Authorization: `Bearer ${token}`, 'X-Client-App': clientApp },
      });
      return { status: result.status, body: await result.json() };
    },
    { token: storage.token, clientApp: definition.clientApp },
  );
  assert.equal(home.status, 200, `${definition.name} experience home 失败`);
  assert.equal(home.body?.data?.client?.key, definition.clientApp);
  assert.ok(home.body?.data?.sections?.dashboard, `${definition.name} 缺少 dashboard 体验区块`);

  const profile = await page.evaluate(
    async ({ token, clientApp }) => {
      const result = await fetch('/api/v1/profile', {
        headers: { Authorization: `Bearer ${token}`, 'X-Client-App': clientApp },
      });
      return { status: result.status, body: await result.json() };
    },
    { token: storage.token, clientApp: definition.clientApp },
  );
  assert.equal(profile.status, 200, `${definition.name} 统一画像读取失败`);
  assert.equal(Number(profile.body?.data?.userId || 0) > 0, true, `${definition.name} 画像缺少 userId`);

  const skills = await page.evaluate(
    async ({ token, clientApp }) => {
      const result = await fetch('/api/v1/me/skills', {
        headers: { Authorization: `Bearer ${token}`, 'X-Client-App': clientApp },
      });
      return { status: result.status, body: await result.json() };
    },
    { token: storage.token, clientApp: definition.clientApp },
  );
  assert.equal(skills.status, 200, `${definition.name} 租户技能读取失败`);
  assert.ok(Array.isArray(skills.body?.data), `${definition.name} 技能响应格式错误`);

  const resources = await page.evaluate(
    async ({ token, clientApp }) => {
      const result = await fetch('/api/v1/resources?page=1&pageSize=5', {
        headers: { Authorization: `Bearer ${token}`, 'X-Client-App': clientApp },
      });
      return { status: result.status, body: await result.json() };
    },
    { token: storage.token, clientApp: definition.clientApp },
  );
  assert.equal(resources.status, 200, `${definition.name} 规范资源台账读取失败`);
  assert.ok(Array.isArray(resources.body?.data?.items), `${definition.name} 资源响应缺少 items`);
  assert.equal(resources.body?.data?.pageInfo?.page, 1, `${definition.name} 资源分页信息缺失`);

  const activities = await page.evaluate(
    async ({ token, clientApp }) => {
      const result = await fetch('/api/v1/learning-activities?page=1&pageSize=5', {
        headers: { Authorization: `Bearer ${token}`, 'X-Client-App': clientApp },
      });
      return { status: result.status, body: await result.json() };
    },
    { token: storage.token, clientApp: definition.clientApp },
  );
  assert.equal(activities.status, 200, `${definition.name} 规范学习活动读取失败`);
  assert.ok(Array.isArray(activities.body?.data?.items), `${definition.name} 学习活动响应缺少 items`);

  const assessments = await page.evaluate(
    async ({ token, clientApp }) => {
      const result = await fetch('/api/v1/assessments/attempts?page=1&pageSize=5', {
        headers: { Authorization: `Bearer ${token}`, 'X-Client-App': clientApp },
      });
      return { status: result.status, body: await result.json() };
    },
    { token: storage.token, clientApp: definition.clientApp },
  );
  assert.equal(assessments.status, 200, `${definition.name} 规范测评历史读取失败`);
  assert.ok(Array.isArray(assessments.body?.data?.items), `${definition.name} 测评响应缺少 items`);

  const remediation = await page.evaluate(
    async ({ token, clientApp }) => {
      const result = await fetch('/api/v1/remediation/weak-points', {
        headers: { Authorization: `Bearer ${token}`, 'X-Client-App': clientApp },
      });
      return { status: result.status, body: await result.json() };
    },
    { token: storage.token, clientApp: definition.clientApp },
  );
  assert.equal(remediation.status, 200, `${definition.name} 补弱入口读取失败`);
  assert.ok(Array.isArray(remediation.body?.data), `${definition.name} 补弱响应格式错误`);

  const progress = await page.evaluate(
    async ({ token, clientApp }) => {
      const result = await fetch('/api/v1/progress/summary', {
        headers: { Authorization: `Bearer ${token}`, 'X-Client-App': clientApp },
      });
      return { status: result.status, body: await result.json() };
    },
    { token: storage.token, clientApp: definition.clientApp },
  );
  assert.equal(progress.status, 200, `${definition.name} 规范进度汇总读取失败`);

  const resourceSearch = await page.evaluate(
    async ({ token, clientApp }) => {
      const result = await fetch('/api/v1/resources/search?q=RAG&limit=5', {
        headers: { Authorization: `Bearer ${token}`, 'X-Client-App': clientApp },
      });
      return { status: result.status, body: await result.json() };
    },
    { token: storage.token, clientApp: definition.clientApp },
  );
  assert.equal(resourceSearch.status, 200, `${definition.name} 规范资源检索失败`);
  assert.ok(Array.isArray(resourceSearch.body?.data?.items), `${definition.name} 资源检索响应缺少 items`);

  const sseStatus = await page.evaluate(
    async ({ token, clientApp }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const query = new URLSearchParams({ token, client_app: clientApp });
        const result = await fetch(`/api/v1/events?${query}`, { signal: controller.signal });
        return result.status;
      } finally {
        clearTimeout(timeout);
        controller.abort();
      }
    },
    { token: storage.token, clientApp: definition.clientApp },
  );
  assert.equal(sseStatus, 200, `${definition.name} SSE 鉴权失败`);

  return { definition, page, token: storage.token };
}

async function assertCrossClientTokensRejected(sessions: SmokeSession[]): Promise<void> {
  const [zhipath, codenova] = sessions;
  const checks = [
    { page: zhipath.page, token: codenova.token, clientApp: zhipath.definition.clientApp },
    { page: codenova.page, token: zhipath.token, clientApp: codenova.definition.clientApp },
  ];
  for (const check of checks) {
    const status = await check.page.evaluate(
      async ({ token, clientApp }) => {
        const result = await fetch('/api/v1/me', {
          headers: { Authorization: `Bearer ${token}`, 'X-Client-App': clientApp },
        });
        return result.status;
      },
      { token: check.token, clientApp: check.clientApp },
    );
    assert.equal(status, 401, `跨客户端令牌未被拒绝：${check.clientApp}`);
  }
}

async function main(): Promise<void> {
  const browser = await chromium.launch({
    headless,
    executablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const sessions: SmokeSession[] = [];
    for (const definition of clients) {
      sessions.push(await login(browser, definition));
      console.log(`✓ ${definition.name}: 品牌、登录、体验配置、资源台账、SSE`);
    }
    await assertCrossClientTokensRejected(sessions);
    console.log('✓ 双向跨客户端令牌均返回 401');
    console.log('双前端平台烟测通过');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});

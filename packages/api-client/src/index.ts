export type RequestQuery = Record<string, string | number | boolean | null | undefined>;

export type RequestOptions = {
  method?: string;
  body?: unknown;
  query?: RequestQuery;
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** 成功响应的解码方式；默认解析统一 JSON 信封。 */
  responseType?: 'json' | 'blob' | 'text';
  skipAuthRefresh?: boolean;
};

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type TokenKeys = {
  accessToken: string;
  refreshToken: string;
};

export type LoginResult = {
  token: string;
  accessToken: string;
  refreshToken: string | null;
  userId: number;
  username: string;
  realName: string;
  role: string;
  onboardingCompleted: boolean;
};

export type AuthUser = {
  id: number;
  username: string;
  realName: string;
  role: string;
  onboardingCompleted: boolean;
  phone?: string;
  email?: string;
  avatar?: string;
};

export type TenantMembership = {
  id: number;
  key: string;
  name: string;
  type: string;
  role: string;
  membershipId: number;
};

export type ExperienceBootstrap = {
  client: {
    key: string;
    name: string;
    configVersion: number;
    theme: Record<string, unknown>;
  };
  tenant: { id: number; key: string; name: string; type: string } | null;
  user: AuthUser;
  features: Record<
    string,
    { enabled: boolean; rolloutPercent: number; config: Record<string, unknown> }
  >;
  navigation: Array<{ key: string; label?: string; route?: string; order?: number }>;
  preference?: {
    onboardingState: string;
    locale: string;
    values: Record<string, unknown>;
  } | null;
  roles: string[];
  permissions: string[];
};

export type ExperienceHome = {
  client: { key: string; configVersion: number };
  generatedAt: string;
  sections: {
    dashboard?: {
      activePaths: number;
      dueActivities: number;
      inProgressActivities: number;
      completedToday: number;
      pendingJobs: number;
    };
    learningPaths?: { items: PlatformLearningPath[] };
    assessment?: { attemptCount: number; averageScore: number | null; lastCompletedAt: string | null };
    remediation?: {
      items: Array<{ id: string; name: string; masteryPercent: number; confidence: number }>;
    };
    [featureKey: string]: unknown;
  };
};

export type PageInfo = {
  page: number;
  pageSize: number;
  total?: number;
  hasNextPage: boolean;
};

export type PageResult<T> = { items: T[]; pageInfo: PageInfo };

export type PlatformLearningPath = {
  id: string;
  /** 迁移期旧计划引用，仅供兼容层使用，业务代码不得把它当作主键。 */
  legacyPlanId?: number | null;
  goalId: string;
  name: string;
  kind: string;
  pathKind?: string;
  status: string;
  version: number;
  currentPhase?: number;
  dailyMinutes: number | null;
  domainKey?: string;
  goalType?: string;
  goalTitle?: string;
  nodes?: unknown[];
  edges?: unknown[];
  snapshot?: Record<string, unknown> | null;
};

export type PlatformLearningActivity = {
  id: string;
  pathId: string;
  pathNodeId: string | null;
  competencyId: string | null;
  type: string;
  title: string;
  status: string;
  plannedDate: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  priority: number;
  legacyTaskId?: number | null;
  legacyPlanId?: number | null;
  pathKind?: string;
};

export type PlatformAsyncJob = {
  id: string;
  type: string;
  status: string;
  progress: number;
  result?: unknown;
  error?: unknown;
  requestId?: string;
  attemptCount?: number;
  agentRunId?: string | null;
};

export type PlatformArtifact = {
  id: string;
  type: string;
  status: string;
  schemaVersion: number;
  title: string;
  content?: unknown;
  objectKey?: string | null;
  provenance: Record<string, unknown>;
  source?: string | null;
  skillName?: string | null;
  chatSessionId?: string | null;
  errorMessage?: string | null;
  producerRunId?: string | null;
  feedbackUseful?: boolean | null;
  feedbackAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export class PlatformApiError extends Error {
  constructor(
    message: string,
    public readonly code: number | string,
    public readonly payload?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'PlatformApiError';
  }
}

export class PlatformTokenStore {
  constructor(
    private readonly storage: StorageLike,
    private readonly keys: TokenKeys,
  ) {}

  getAccessToken(): string | null {
    return this.storage.getItem(this.keys.accessToken);
  }

  getRefreshToken(): string | null {
    return this.storage.getItem(this.keys.refreshToken);
  }

  setTokens(accessToken: string, refreshToken?: string | null): void {
    this.storage.setItem(this.keys.accessToken, accessToken);
    if (refreshToken) this.storage.setItem(this.keys.refreshToken, refreshToken);
    else if (refreshToken === null) this.storage.removeItem(this.keys.refreshToken);
  }

  clear(): void {
    this.storage.removeItem(this.keys.accessToken);
    this.storage.removeItem(this.keys.refreshToken);
  }
}

export type PlatformApiClientOptions = {
  baseUrl?: string;
  clientApp: string;
  clientVersion?: string;
  tokenStore: PlatformTokenStore;
  defaultTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  requestIdFactory?: () => string;
  onUnauthorized?: () => void;
};

/** 为有副作用的命令生成稳定格式的幂等键。 */
export function createIdempotencyKey(prefix = 'web'): string {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export class PlatformApiClient {
  private refreshPromise: Promise<string | null> | null = null;
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: PlatformApiClientOptions) {
    this.baseUrl = (options.baseUrl || '/api').replace(/\/$/, '');
    this.defaultTimeoutMs = options.defaultTimeoutMs || 60_000;
    // Browser-native fetch requires globalThis as its receiver. Calling an
    // unbound fetch stored on this class throws `Illegal invocation` in Chromium.
    this.fetchImpl = options.fetchImpl || globalThis.fetch.bind(globalThis);
  }

  get tokenStore(): PlatformTokenStore {
    return this.options.tokenStore;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const requestOptions = this.withRequestId(options);
    const result = await this.performRequest<T>(path, requestOptions);
    if (result.status !== 401) {
      if (options.responseType === 'blob' || options.responseType === 'text') return result.data as T;
      return this.unwrap<T>(result.status, result.json);
    }

    if (!options.skipAuthRefresh && path !== '/v1/auth/refresh') {
      const nextToken = await this.refreshAccessToken();
      if (nextToken) {
        return this.request<T>(path, { ...requestOptions, skipAuthRefresh: true });
      }
    }
    this.options.tokenStore.clear();
    this.options.onUnauthorized?.();
    throw this.toError(result.status, result.json, '登录状态已失效，请重新登录');
  }

  async refreshAccessToken(): Promise<string | null> {
    const refreshToken = this.options.tokenStore.getRefreshToken();
    if (!refreshToken) return null;
    this.refreshPromise ||= this.performRequest<{
      accessToken: string;
      refreshToken: string;
    }>('/v1/auth/refresh', this.withRequestId({
      method: 'POST',
      body: { refreshToken },
      skipAuthRefresh: true,
    }))
      .then((result) => {
        if (result.status < 200 || result.status >= 300) return null;
        const tokens = this.unwrap<{ accessToken: string; refreshToken: string }>(
          result.status,
          result.json,
        );
        this.options.tokenStore.setTokens(tokens.accessToken, tokens.refreshToken);
        return tokens.accessToken;
      })
      .catch(() => null)
      .finally(() => {
        this.refreshPromise = null;
      });
    return this.refreshPromise;
  }

  login(username: string, password: string): Promise<LoginResult> {
    return this.request<LoginResult>('/v1/auth/login', {
      method: 'POST',
      body: { username, password },
      skipAuthRefresh: true,
    });
  }

  register(username: string, password: string, realName?: string) {
    return this.request<{ id: number; username: string }>('/v1/auth/register', {
      method: 'POST',
      body: { username, password, realName },
      skipAuthRefresh: true,
    });
  }

  me(): Promise<AuthUser> {
    return this.request<AuthUser>('/v1/me');
  }

  listTenants(): Promise<TenantMembership[]> {
    return this.request<TenantMembership[]>('/v1/me/tenants');
  }

  async switchTenant(tenantId: number): Promise<{ token: string; accessToken: string; refreshToken: string | null }> {
    const result = await this.request<{ token: string; accessToken: string; refreshToken: string | null }>('/v1/auth/switch-tenant', {
      method: 'POST',
      body: { tenantId },
      skipAuthRefresh: true,
    });
    this.options.tokenStore.setTokens(result.accessToken, result.refreshToken);
    return result;
  }

  bootstrap(): Promise<ExperienceBootstrap> {
    return this.request<ExperienceBootstrap>('/v1/experience/bootstrap');
  }

  home(): Promise<ExperienceHome> {
    return this.request<ExperienceHome>('/v1/experience/home');
  }

  listLearningDomains<T = unknown>(): Promise<T[]> {
    return this.request<T[]>('/v1/learning-domains');
  }

  getLearningDomain<T = unknown>(id: string): Promise<T> {
    return this.request<T>(`/v1/learning-domains/${encodeURIComponent(id)}`);
  }

  listLearningPaths(page = 1, pageSize = 20): Promise<PageResult<PlatformLearningPath>> {
    return this.request('/v1/learning-paths', { query: { page, pageSize } });
  }

  getLearningPath(id: string): Promise<PlatformLearningPath> {
    return this.request(`/v1/learning-paths/${encodeURIComponent(id)}`);
  }

  updateLearningPathStatus(
    id: string,
    status: 'active' | 'paused' | 'archived',
    idempotencyKey: string,
  ): Promise<{ id: string; status: string }> {
    return this.command(
      `/v1/learning-paths/${encodeURIComponent(id)}/status`,
      'PATCH',
      { status },
      idempotencyKey,
    );
  }

  createLearningGoal(
    input: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<{ goal: { id: string }; path: { id: string } }> {
    return this.command('/v1/learning-goals', 'POST', input, idempotencyKey);
  }

  createPathNode(
    pathId: string,
    input: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<Record<string, unknown>> {
    return this.command(`/v1/learning-paths/${encodeURIComponent(pathId)}/nodes`, 'POST', input, idempotencyKey);
  }

  createPathEdge(
    pathId: string,
    input: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<Record<string, unknown>> {
    return this.command(`/v1/learning-paths/${encodeURIComponent(pathId)}/edges`, 'POST', input, idempotencyKey);
  }

  listLearningActivities(page = 1, pageSize = 20): Promise<PageResult<PlatformLearningActivity>> {
    return this.request('/v1/learning-activities', { query: { page, pageSize } });
  }

  createLearningActivity(
    input: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<PlatformLearningActivity> {
    return this.command('/v1/learning-activities', 'POST', input, idempotencyKey);
  }

  updateLearningActivityStatus(
    id: string,
    input: { status: string; actualMinutes?: number },
    idempotencyKey: string,
  ): Promise<Record<string, unknown>> {
    return this.command(`/v1/learning-activities/${encodeURIComponent(id)}/status`, 'PATCH', input, idempotencyKey);
  }

  listAssessments(page = 1, pageSize = 20): Promise<PageResult<Record<string, unknown>>> {
    return this.request('/v1/assessments', { query: { page, pageSize } });
  }

  listAssessmentAttempts(page = 1, pageSize = 20): Promise<PageResult<Record<string, unknown>>> {
    return this.request('/v1/assessments/attempts', { query: { page, pageSize } });
  }

  startAssessment(
    definitionId: string,
    input: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<Record<string, any>> {
    return this.command(`/v1/assessments/${encodeURIComponent(definitionId)}/attempts`, 'POST', input, idempotencyKey);
  }

  startLegacyExam(
    legacyExamId: number,
    input: Record<string, unknown> = {},
    idempotencyKey: string,
  ): Promise<Record<string, any>> {
    return this.command(
      `/v1/assessments/legacy-exams/${encodeURIComponent(String(legacyExamId))}/attempts`,
      'POST',
      input,
      idempotencyKey,
    );
  }

  submitAssessment(
    attemptId: string,
    responses: Array<{ itemId: string; response: unknown }>,
    idempotencyKey: string,
  ): Promise<Record<string, unknown>> {
    return this.command(
      `/v1/assessments/attempts/${encodeURIComponent(attemptId)}/submit`,
      'POST',
      { responses },
      idempotencyKey,
    );
  }

  listEvidence(page = 1, pageSize = 20): Promise<PageResult<Record<string, unknown>>> {
    return this.request('/v1/evidence', { query: { page, pageSize } });
  }

  createEvidence(input: Record<string, unknown>, idempotencyKey: string) {
    return this.command<Record<string, unknown>>('/v1/evidence', 'POST', input, idempotencyKey);
  }

  listJobs(page = 1, pageSize = 20): Promise<PageResult<PlatformAsyncJob>> {
    return this.request('/v1/jobs', { query: { page, pageSize } });
  }

  getJob(id: string): Promise<PlatformAsyncJob> {
    return this.request(`/v1/jobs/${encodeURIComponent(id)}`);
  }

  /** 等待统一异步作业终态；页面需要同步展示结果时可使用，后台仍由 jobs/SSE 驱动。 */
  async waitForJob(id: string, options: { timeoutMs?: number; intervalMs?: number } = {}): Promise<PlatformAsyncJob> {
    const deadline = Date.now() + (options.timeoutMs ?? 240_000);
    const interval = Math.max(200, options.intervalMs ?? 800);
    while (Date.now() < deadline) {
      const job = await this.getJob(id);
      if (['completed', 'failed', 'cancelled'].includes(String(job.status))) return job;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
    throw new PlatformApiError('异步作业仍在处理中，请稍后从任务中心查看', 0);
  }

  createJob(input: Record<string, unknown>, idempotencyKey: string): Promise<PlatformAsyncJob> {
    return this.command('/v1/jobs', 'POST', input, idempotencyKey);
  }

  cancelJob(id: string, idempotencyKey: string): Promise<PlatformAsyncJob> {
    return this.command(`/v1/jobs/${encodeURIComponent(id)}/cancel`, 'POST', {}, idempotencyKey);
  }

  retryJob(id: string, idempotencyKey: string): Promise<PlatformAsyncJob> {
    return this.command(`/v1/jobs/${encodeURIComponent(id)}/retry`, 'POST', {}, idempotencyKey);
  }

  markJobUrgent(id: string, idempotencyKey: string): Promise<Record<string, unknown>> {
    return this.command(`/v1/agent-office/tasks/${encodeURIComponent(id)}/urgent`, 'POST', {}, idempotencyKey);
  }

  skipJob(id: string, idempotencyKey: string): Promise<Record<string, unknown>> {
    return this.command(`/v1/agent-office/tasks/${encodeURIComponent(id)}/skip`, 'POST', {}, idempotencyKey);
  }

  reorderJobs(jobIds: string[], idempotencyKey: string): Promise<Record<string, unknown>> {
    return this.command('/v1/agent-office/tasks/reorder', 'POST', { jobIds }, idempotencyKey);
  }

  deleteJob(id: string, idempotencyKey: string): Promise<Record<string, unknown>> {
    return this.command(`/v1/agent-office/tasks/${encodeURIComponent(id)}`, 'DELETE', {}, idempotencyKey);
  }

  listResources(page = 1, pageSize = 20, type?: string, search?: string): Promise<PageResult<PlatformArtifact>> {
    return this.request('/v1/resources', { query: { page, pageSize, type, search } });
  }

  getResource(id: string): Promise<PlatformArtifact> {
    return this.request(`/v1/resources/${encodeURIComponent(id)}`);
  }

  feedbackResource(id: string, useful: boolean): Promise<PlatformArtifact> {
    return this.request(`/v1/resources/${encodeURIComponent(id)}/feedback`, {
      method: 'POST',
      body: { useful },
      headers: { 'Idempotency-Key': createIdempotencyKey(`resource-feedback-${id}`) },
    });
  }

  async logout(): Promise<void> {
    const refreshToken = this.options.tokenStore.getRefreshToken();
    if (refreshToken) {
      try {
        await this.request('/v1/auth/logout', {
          method: 'POST',
          body: { refreshToken },
          skipAuthRefresh: true,
        });
      } catch {
        // 本地退出不能被网络故障阻塞。
      }
    }
    this.options.tokenStore.clear();
  }

  private command<T>(
    path: string,
    method: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<T> {
    if (!idempotencyKey || idempotencyKey.length > 200) {
      return Promise.reject(new PlatformApiError('Idempotency-Key 必填且不得超过 200 字符', 400));
    }
    return this.request<T>(path, {
      method,
      body,
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  private async performRequest<T>(path: string, options: RequestOptions) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || this.defaultTimeoutMs);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort);
    try {
      const response = await this.fetchImpl(this.buildUrl(path, options.query), {
        method: options.method || 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Client-App': this.options.clientApp,
          'X-Client-Version': this.options.clientVersion || 'dev',
          ...(this.options.tokenStore.getAccessToken()
            ? { Authorization: `Bearer ${this.options.tokenStore.getAccessToken()}` }
            : {}),
          ...options.headers,
        },
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      });
      // 错误响应始终按 JSON 读取，以便统一错误协议；成功的二进制/文本
      // 响应则保留原始内容，供 PDF、视频等下载接口使用。
      const responseType = options.responseType || 'json';
      let data: unknown;
      let json: unknown = null;
      if (responseType === 'blob' && response.ok) {
        data = await response.blob();
      } else {
        const text = await response.text();
        data = text;
        if (text) {
        try {
          json = JSON.parse(text);
        } catch {
            if (responseType === 'json' || !response.ok) {
              throw new PlatformApiError(
                `服务端返回了无法解析的内容（HTTP ${response.status}）`,
                response.status,
              );
            }
          }
        }
      }
      return { status: response.status, json, data };
    } catch (error: unknown) {
      if (error instanceof PlatformApiError) throw error;
      if ((error as { name?: string })?.name === 'AbortError') {
        throw new PlatformApiError('请求超时，服务端仍在处理，请稍后刷新查看', 0);
      }
      throw new PlatformApiError(
        (error as { message?: string })?.message || '网络异常，请检查后端服务是否已启动',
        0,
      );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }

  private buildUrl(path: string, query?: RequestQuery): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${this.baseUrl}${cleanPath}`;
    if (!query) return url;
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') params.append(key, String(value));
    });
    return params.size ? `${url}?${params.toString()}` : url;
  }

  private withRequestId(options: RequestOptions): RequestOptions {
    const headers = options.headers || {};
    const hasRequestId = Object.keys(headers).some(
      (key) => key.toLowerCase() === 'x-request-id',
    );
    if (hasRequestId) return options;
    const requestId = this.options.requestIdFactory?.() || this.createRequestId();
    return { ...options, headers: { ...headers, 'X-Request-Id': requestId } };
  }

  private createRequestId(): string {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  private unwrap<T>(status: number, json: unknown): T {
    if (status < 200 || status >= 300) throw this.toError(status, json);
    if (json && typeof json === 'object') {
      const payload = json as Record<string, unknown>;
      if ('error' in payload) throw this.toError(status, json);
      if ('data' in payload) {
        if (typeof payload.code === 'number' && payload.code !== 200) {
          throw this.toError(payload.code, json);
        }
        return payload.data as T;
      }
    }
    return json as T;
  }

  private toError(status: number, json: unknown, fallback?: string): PlatformApiError {
    const payload = (json && typeof json === 'object' ? json : {}) as Record<string, any>;
    const error = payload.error && typeof payload.error === 'object' ? payload.error : payload;
    const code =
      typeof error.code === 'number' || typeof error.code === 'string'
        ? error.code
        : status;
    return new PlatformApiError(
      error.message || fallback || `请求失败（HTTP ${status}）`,
      code,
      json,
      error.requestId || payload.meta?.requestId,
    );
  }
}

export function createPlatformApiClient(options: PlatformApiClientOptions): PlatformApiClient {
  return new PlatformApiClient(options);
}

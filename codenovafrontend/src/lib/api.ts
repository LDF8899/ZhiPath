/**
 * 统一 API 客户端
 *
 * 后端是 NestJS，全局前缀 /api，统一信封：{ code, message, data }
 * 这里做三件事：注入 Bearer token、拆信封、把业务错误变成可读的中文提示。
 */

export const TOKEN_KEY = 'codenova_token';
export const USER_KEY = 'codenova_user';

export class ApiError extends Error {
  code: number;
  payload: any;

  constructor(message: string, code = 0, payload?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.payload = payload;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAuth() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

type RequestOptions = {
  method?: string;
  body?: any;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** 某些接口（如 LLM 生成）耗时较长，单独放宽超时 */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT = 60_000;

function buildUrl(path: string, query?: RequestOptions['query']) {
  const clean = path.startsWith('/') ? path : `/${path}`;
  const url = `/api${clean}`;
  if (!query) return url;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

async function rawRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, timeoutMs = DEFAULT_TIMEOUT } = options;
  const token = getToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(buildUrl(path, query), {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const text = await response.text();
    let json: any = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new ApiError(`服务端返回了无法解析的内容（HTTP ${response.status}）`, response.status);
      }
    }

    if (response.status === 401) {
      clearAuth();
      throw new ApiError('登录状态已失效，请重新登录', 401, json);
    }

    // NestJS 的抛错（UnauthorizedException 等）不经过统一信封，走这里兜底
    if (!json || typeof json.code !== 'number') {
      if (!response.ok) {
        throw new ApiError(json?.message || `请求失败（HTTP ${response.status}）`, response.status, json);
      }
      return (json ?? null) as T;
    }

    if (json.code !== 200) {
      throw new ApiError(json.message || '请求失败', json.code, json);
    }

    return json.data as T;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    if (err?.name === 'AbortError') {
      throw new ApiError('请求超时，服务端仍在处理，请稍后刷新查看', 0);
    }
    throw new ApiError(err?.message || '网络异常，请检查后端服务是否已启动', 0);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** 带一次自动重试的 GET（应对后端冷启动 / 瞬断） */
export async function request<T>(path: string, options: RequestOptions = {}, retry = 1): Promise<T> {
  try {
    return await rawRequest<T>(path, options);
  } catch (err: any) {
    const retriable = retry > 0 && (err?.code === 0 || err?.code >= 500);
    if (!retriable) throw err;
    await new Promise((resolve) => setTimeout(resolve, 600));
    return rawRequest<T>(path, options);
  }
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], opts?: Omit<RequestOptions, 'body' | 'query'>) =>
    request<T>(path, { ...opts, method: 'GET', query }),
  post: <T>(path: string, body?: any, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: any, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: any, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  del: <T>(path: string, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};

// ────────────────────────────────────────────────────────────
//  鉴权
// ────────────────────────────────────────────────────────────

export type AuthUser = {
  id: number;
  username: string;
  realName: string;
  role: string;
  onboardingCompleted: boolean;
};

export type LoginResult = {
  token: string;
  userId: number;
  username: string;
  realName: string;
  role: string;
  onboardingCompleted: boolean;
};

export const authApi = {
  login: (username: string, password: string) =>
    rawRequest<LoginResult>('/admin/auth/login', { method: 'POST', body: { username, password } }),
  register: (username: string, password: string, realName?: string) =>
    rawRequest<{ id: number; username: string }>('/admin/auth/register', {
      method: 'POST',
      body: { username, password, realName },
    }),
  me: () => api.get<AuthUser>('/admin/auth/me'),
};

// ────────────────────────────────────────────────────────────
//  学习领域 / 画像
// ────────────────────────────────────────────────────────────

export type LearningAbility = { id: string; name: string; estimatedMin: number; priority: number };
export type LearningPhase = { name: string; abilities: LearningAbility[] };
export type StarterPath = {
  id: string;
  title: string;
  description: string;
  goalType: string;
  phases: LearningPhase[];
};
export type RadarDimension = { id: string; name: string; abilityIds: string[]; weight: number };
export type LearningDomain = {
  id: string;
  name: string;
  description: string;
  goalTypes: string[];
  terminology: Record<string, string>;
  assessmentModes: string[];
  evidenceTypes: string[];
  passScore: number;
  radarDimensions: RadarDimension[];
  starterPaths: StarterPath[];
};

export const studentApi = {
  domains: () => api.get<LearningDomain[]>('/user/learning-domains'),
  profile: () => api.get<any>('/user/profile'),
  radar: () => api.get<any>('/user/profile/radar'),
  abilityMetrics: () => api.get<any>('/user/profile/ability-metrics'),
  updateProfile: (body: Record<string, any>) => api.put<any>('/user/profile', body),
  onboarding: (body: Record<string, any>) => api.post<{ completed: boolean }>('/user/onboarding', body),
  onboardingStatus: () => api.get<any>('/user/onboarding/status'),
};

// ────────────────────────────────────────────────────────────
//  学习计划
// ────────────────────────────────────────────────────────────

export type PlanSkill = {
  name: string;
  estimatedMin?: number;
  priority?: number;
  status?: 'pending' | 'done' | string;
  read_at?: number;
  quiz_passed?: boolean;
  quiz_score?: number;
  code_done?: boolean;
  exam_done?: boolean;
  completed_at?: number;
};

export type PlanPhase = {
  name: string;
  index?: number;
  kind?: string;
  status?: string;
  skills: PlanSkill[];
};

export type LearningPlan = {
  id: number;
  planName: string;
  planType: 'main' | 'side';
  domainId?: string;
  goalType?: string;
  goalTitle?: string;
  targetJobId?: number | null;
  currentPhase: number;
  planStatus: 'active' | 'paused' | 'archived';
  scheduleEnabled?: number;
  matchScore?: number;
  estimatedDate?: string;
  dailyHours?: number;
  pathData?: {
    domainId?: string;
    domainName?: string;
    goalType?: string;
    goalTitle?: string;
    terminology?: Record<string, string>;
    assessmentModes?: string[];
    evidenceTypes?: string[];
    radarDimensions?: RadarDimension[];
    passScore?: number;
    phases?: PlanPhase[];
  };
  createTime?: number;
};

export const planApi = {
  list: (pageSize = 100) => api.get<LearningPlan[]>('/user/learning-paths', { page: 1, pageSize }),
  detail: (pathId: number | string) => api.get<LearningPlan>(`/user/learning-paths/${pathId}`),
  create: (body: Record<string, any>) =>
    api.post<any>('/user/learning-paths', body, { timeoutMs: 180_000 }),
  addSkill: (pathId: number | string, body: { skillName: string; estimatedMin?: number }) =>
    api.post<LearningPlan>(`/user/learning-paths/${pathId}/skills`, body),
  setStatus: (pathId: number | string, planStatus: 'active' | 'paused' | 'archived') =>
    api.patch<LearningPlan>(`/user/learning-paths/${pathId}/status`, { planStatus }),
  merge: (pathId: number | string) => api.post<any>(`/user/learning-paths/${pathId}/merge`),
};

// ────────────────────────────────────────────────────────────
//  工作台 / 任务
// ────────────────────────────────────────────────────────────

export type DashboardData = {
  student: any;
  target_job: any;
  plans: Array<{ id: number; planName: string; planType: string; domainId?: string; goalType?: string; goalTitle?: string; currentPhase: number; estimatedDate: string; totalSkills: number }>;
  learning_path: LearningPlan | null;
  stats: {
    total_skills: number;
    done_skills: number;
    in_progress_skills?: number;
    exam_count: number;
    job_count: number;
    total_learned_hours: number;
    active_days: number;
  };
  today_tasks: Array<{ id: number; title: string; taskType: string; estimatedMin: number; status: string; planDate: string }>;
  recent_news: any[];
  golden_path: any;
};

export type TodayAction = {
  id?: number;
  type?: string;
  title?: string;
  taskType?: string;
  skillName?: string;
  reason?: string;
  estimatedMin?: number;
  estimatedImpact?: number;
  impactLabel?: string;
  evidence?: string;
  path?: string;
  [key: string]: any;
};

/** GET /api/user/today-actions —— 1 个主任务 + 最多 2 个辅助任务 */
export type TodayActionsResult = {
  main?: TodayAction;
  subs?: TodayAction[];
};

export const workbenchApi = {
  dashboard: () => api.get<DashboardData>('/user/dashboard'),
  todayActions: () => api.get<TodayActionsResult>('/user/today-actions'),
  growthReport: (days = 30) => api.get<any>('/user/growth-report', { days }),
  todayTasks: (planId?: number) => api.get<any>('/user/learning-tasks/today', { planId }),
  updateTaskStatus: (taskId: number, status: string) =>
    api.post<any>(`/user/learning-tasks/${taskId}/status`, { status }),
  adjustSpeed: (planId: number) => api.post<any>('/user/learning-tasks/adjust-speed', { planId }),
};

// ────────────────────────────────────────────────────────────
//  技能学习闭环
// ────────────────────────────────────────────────────────────

export type SkillContent = {
  skill: string;
  lecture: string | null;
  quiz: Array<{
    question: string;
    options: string[];
    answer: number | string;
    explanation?: string;
    type?: string;
  }> | null;
  coding: Array<{
    title?: string;
    description?: string;
    setup?: string;
    code?: string;
    comments?: string;
    solution?: string;
    solutionExplanation?: string;
    expectedOutput?: string;
    commonMistakes?: string[];
    keyPoints?: string[];
    hints?: string[];
  }> | null;
  reading: Array<{ title?: string; type?: string; summary?: string; url?: string; why?: string }> | null;
  has_content: boolean;
  generating?: boolean;
};

export type MasteryBreakdown = {
  skill: string;
  masteryPct: number;
  trustWeight: number;
  source: string;
  breakdown: Record<string, { done: boolean; weight: number; label: string }>;
};

export type ProgressResult = {
  skill: string;
  status?: string;
  score?: number;
  passed?: boolean;
  masteryPct: number;
  delta: number;
  phase_completed?: boolean;
  message?: string;
  commit?: { id: string | number; message?: string; [key: string]: any };
  snapshot?: any;
  gitDelta?: any;
  branch?: any;
  matchSummary?: any;
  evaluation?: any;
};

export const skillApi = {
  content: (skill: string) =>
    api.get<SkillContent>(`/user/learning-paths/knowledge/${encodeURIComponent(skill)}`),
  mastery: (skill: string) =>
    api.get<MasteryBreakdown>(`/user/progress/mastery/${encodeURIComponent(skill)}`),
  markRead: (skill: string, pathId?: number) =>
    api.post<ProgressResult>('/user/progress/read', { skill, path_id: pathId ?? 0 }),
  submitQuiz: (skill: string, total: number, correct: number, pathId?: number) =>
    api.post<ProgressResult>('/user/progress/quiz', { skill, total, correct, path_id: pathId ?? 0 }),
  markCode: (skill: string, pathId?: number) =>
    api.post<ProgressResult>('/user/progress/code', { skill, path_id: pathId ?? 0 }),
  complete: (skill: string, pathId?: number) =>
    api.post<ProgressResult>('/user/progress/complete', { skill, path_id: pathId ?? 0 }),
  heartbeat: (body: { deltaMs?: number; skill?: string; lecturePosition?: number }) =>
    api.post<{ ok: boolean }>('/user/progress/heartbeat', body),
  summary: () => api.get<any>('/user/progress/summary'),
  restore: (planId?: number) => api.get<any>('/user/progress/restore', { planId }),
  list: () => api.get<any[]>('/user/skills'),
  stats: () => api.get<any>('/user/skills/stats'),
  effective: () => api.get<Array<{ name: string; masteryPct: number; trustWeight: number; source: string }>>('/user/skills/effective'),
  evidence: (skillName: string) => api.get<any>(`/user/skills/${encodeURIComponent(skillName)}/evidence`),
};

// ────────────────────────────────────────────────────────────
//  Agent 生成能力
// ────────────────────────────────────────────────────────────

export const agentApi = {
  lecture: (skillName: string, level: 'beginner' | 'intermediate' | 'advanced' = 'beginner', extra?: string) =>
    api.post<any>('/user/agents/lecture', { skillName, level, extra }, { timeoutMs: 240_000 }),
  reading: (skillName: string, count = 5, focus?: string) =>
    api.post<any>('/user/agents/reading', { skillName, count, focus }, { timeoutMs: 240_000 }),
  code: (skillName: string, language = 'JavaScript', count = 3) =>
    api.post<any>('/user/agents/code', { skillName, language, count }, { timeoutMs: 240_000 }),
  assess: (body: { learningData: string; skillName?: string; goal?: string; currentProgress?: string }) =>
    api.post<any>('/user/agents/assess', body, { timeoutMs: 240_000 }),
};

// ────────────────────────────────────────────────────────────
//  教练对话
// ────────────────────────────────────────────────────────────

export type ChatAction = {
  type: string;
  [key: string]: any;
};

export type ChatReply = {
  reply: string;
  session_id: string;
  agent: string;
  agentInfo?: { name: string; animal?: string; color?: string };
  profile_version?: number;
  actions: ChatAction[];
  evidence: Array<{ title?: string; source?: string; snippet?: string; score?: number; [key: string]: any }>;
  citationMiss: boolean;
};

export type ChatSession = {
  _id?: string;
  session_id: string;
  title?: string;
  last_message?: string;
  last_role?: string;
  last_agent?: string;
  message_count?: number;
  resources_count?: number;
  page_context?: string;
  created_at?: number;
  updated_at?: number;
  messages?: Array<{
    id?: string;
    message_id?: string;
    role: 'user' | 'assistant' | string;
    content: string;
    agent?: string;
    actions?: ChatAction[];
    timestamp?: number;
  }>;
};

export const chatApi = {
  send: (message: string, sessionId?: string, pageContext = 'general') =>
    api.post<ChatReply>('/user/chat', { message, session_id: sessionId, page_context: pageContext }, { timeoutMs: 180_000 }),
  sessions: (page = 1, pageSize = 20) => api.get<ChatSession[]>('/user/chat-sessions', { page, pageSize }),
  session: (sessionId: string) => api.get<ChatSession>(`/user/chat-sessions/${sessionId}`),
  deleteSession: (sessionId: string) => api.del<any>(`/user/chat-sessions/${sessionId}`),
};

// ────────────────────────────────────────────────────────────
//  资源台账 / Agent 办公室
// ────────────────────────────────────────────────────────────

export type GeneratedResource = {
  id: number;
  title: string;
  resourceType?: string;
  resourceStatus?: string;
  source?: string;
  skillName?: string;
  chatSessionId?: string;
  /** 后端把反馈存在 previewMeta.feedbackUseful，顶层没有 useful 字段 */
  previewMeta?: { feedbackUseful?: boolean; feedbackAt?: number; [key: string]: any } | null;
  useful?: boolean | null;
  targetEntity?: { type?: string; skillName?: string } | null;
  content?: any;
  createdAt?: number;
  createTime?: number;
  errorMessage?: string;
  [key: string]: any;
};

/** 统一取反馈值：优先 previewMeta.feedbackUseful（真实存储位），兼容顶层 useful */
export function resourceUseful(r: GeneratedResource | null | undefined): boolean | null {
  if (!r) return null;
  if (typeof r.previewMeta?.feedbackUseful === 'boolean') return r.previewMeta.feedbackUseful;
  if (typeof r.useful === 'boolean') return r.useful;
  return null;
}

export const resourceApi = {
  list: (query?: { source?: string; resourceType?: string; status?: string; chatSessionId?: string; search?: string; limit?: number }) =>
    api.get<GeneratedResource[]>('/user/generated-resources', query as any),
  detail: (id: number | string) => api.get<GeneratedResource>(`/user/generated-resources/${id}`),
  feedback: (id: number | string, useful: boolean) =>
    api.post<GeneratedResource>(`/user/generated-resources/${id}/feedback`, { useful }),
};

export type OfficeTask = {
  id: number;
  agentType: string;
  title: string;
  taskStatus: string;
  progress?: number;
  description?: string;
  params?: Record<string, any>;
  outputType?: string;
  targetEntity?: { type?: string; skillName?: string } | null;
  errorMessage?: string;
  createTime?: number;
  updateTime?: number;
  result?: any;
  [key: string]: any;
};

export const officeApi = {
  tasks: () => api.get<OfficeTask[]>('/user/agent-office/tasks'),
  task: (taskId: number | string) => api.get<OfficeTask>(`/user/agent-office/tasks/${taskId}`),
  stats: () => api.get<any>('/user/agent-office/stats'),
  agentTypes: () => api.get<any[]>('/user/agent-office/agent-types'),
  create: (body: { agentType: string; title: string; params?: Record<string, any>; description?: string }) =>
    api.post<OfficeTask>('/user/agent-office/tasks', body),
  retry: (taskId: number | string) => api.post<any>(`/user/agent-office/tasks/${taskId}/retry`),
  cancel: (taskId: number | string) => api.post<any>(`/user/agent-office/tasks/${taskId}/cancel`),
  remove: (taskId: number | string) => api.post<any>(`/user/agent-office/tasks/${taskId}/delete`),
};

// ────────────────────────────────────────────────────────────
//  速测 / 补弱 / 测评
// ────────────────────────────────────────────────────────────

export type GenerationConfig = {
  subject: string;
  curriculum?: string;
  locale?: string;
  grade?: string;
  questionTypes: string[];
  count: number;
  difficulty: number;
  difficultyMix?: Record<string, number>;
  topics?: Array<{ id?: string | number; code?: string; label?: string; metadata?: Record<string, any>; [key: string]: any }>;
  instructions?: string;
  metadata?: Record<string, any>;
  referenceLibrary?: boolean;
};

export type GeneratedQuestion = {
  id?: string | number;
  clientId?: string;
  type: string;
  stem: string;
  options?: Array<{ key?: string; text?: string; [key: string]: any }>;
  answer?: any;
  solution?: string;
  parts?: Array<{ label?: string; question?: string; answer?: any; solution?: string; marks?: number; [key: string]: any }>;
  metadata?: Record<string, any>;
  figure?: any;
  [key: string]: any;
};

export type QuestionGenerationSnapshot = {
  taskId: number;
  id?: number;
  taskStatus: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | string;
  subject?: string;
  questionCount?: number;
  resultCount?: number;
  errorMessage?: string;
  progress?: { current: number; total: number; failed: number; message: string };
  questions?: GeneratedQuestion[];
  config?: GenerationConfig;
  reviewStatuses?: string[];
  persistedQuestionIds?: number[];
  approvedQuestionIds?: number[];
  hasSnapshot?: boolean;
  [key: string]: any;
};

export const questionGenerationApi = {
  list: (limit = 20) => api.get<QuestionGenerationSnapshot[]>('/user/question-generation/tasks', { limit }),
  create: (config: GenerationConfig) =>
    api.post<QuestionGenerationSnapshot>('/user/question-generation/tasks', config, { timeoutMs: 120_000 }),
  start: (taskId: number) =>
    api.post<QuestionGenerationSnapshot>(`/user/question-generation/tasks/${taskId}/start`, undefined, { timeoutMs: 120_000 }),
  snapshot: (taskId: number) =>
    api.get<QuestionGenerationSnapshot>(`/user/question-generation/tasks/${taskId}/snapshot`),
  saveSnapshot: (taskId: number, payload: { questions: GeneratedQuestion[]; config?: GenerationConfig; reviewStatuses?: string[] }) =>
    api.put<any>(`/user/question-generation/tasks/${taskId}/snapshot`, payload),
  persistDrafts: (taskId: number, questions: GeneratedQuestion[]) =>
    api.post<{ persisted: number; questionIds: number[] }>(`/user/question-generation/tasks/${taskId}/questions/batch`, { questions }),
  approve: (taskId: number, questionIds: number[], questionsMap?: Record<string, GeneratedQuestion>) =>
    api.patch<{ approved: number; questionIds: number[] }>(`/user/question-generation/tasks/${taskId}/questions/approve`, { questionIds, questionsMap }),
  updateDraft: (taskId: number, questionId: number, question: GeneratedQuestion) =>
    api.patch<any>(`/user/question-generation/tasks/${taskId}/questions/${questionId}`, { question }),
  remove: (taskId: number) => api.del<any>(`/user/question-generation/tasks/${taskId}`),
};

export const quickTestApi = {
  questions: (direction?: string) => api.get<any>('/user/quick-test', { direction }),
  submit: (body: { skillName: string; answers: Record<string, any>; questions: any[] }) =>
    api.post<any>('/user/quick-test/submit', body),
};

export const remediationApi = {
  weakPoints: () => api.get<any[]>('/user/remediation/weak-points'),
  prepare: (body: any) => api.post<any>('/user/remediation/prepare', body),
  generate: (body: any) => api.post<any>('/user/remediation/generate', body, { timeoutMs: 240_000 }),
  history: (limit = 10) => api.get<any[]>('/user/remediation/history', { limit }),
};

export const evaluationApi = {
  list: () => api.get<any[]>('/user/evaluations'),
  detail: (attemptId: string | number) => api.get<any>(`/user/evaluations/${attemptId}`),
};

export const matchApi = {
  best: () => api.get<any>('/user/match/best'),
  all: () => api.get<any[]>('/user/match-all'),
  recalculate: () => api.post<any>('/user/match/recalculate'),
  trend: (jobId: number, days = 30) => api.get<any>(`/user/match/trend/${jobId}`, { days }),
};

export const evidenceApi = {
  search: (q: string, explain = false) => api.get<any>('/user/evidence/search', { query: q, q, explain: explain ? 1 : undefined }),
  summary: () => api.get<any>('/user/evidence/summary'),
  graph: (limit = 120) => api.get<any>('/user/evidence/graph', { limit }),
};

export const knowledgeIngestionApi = {
  uploadText: (body: { title?: string; content: string; sourceName?: string; sourceUrl?: string; skillTags?: string[] }) =>
    api.post<any>('/user/knowledge-ingestion/upload-text', body, { timeoutMs: 180_000 }),
  ingestUrl: (body: { url: string; title?: string; skillTags?: string[] }) =>
    api.post<any>('/user/knowledge-ingestion/url', body, { timeoutMs: 180_000 }),
  refreshNews: (body: { keywords?: string[]; limit?: number } = {}) =>
    api.post<any>('/user/knowledge-ingestion/news-refresh', body, { timeoutMs: 240_000 }),
  listTasks: (params: { status?: string; limit?: number } = {}) =>
    api.get<any>('/user/knowledge-ingestion/tasks', params),
  getTask: (taskId: string) => api.get<any>(`/user/knowledge-ingestion/tasks/${encodeURIComponent(taskId)}`),
  retry: (taskId: string) => api.post<any>(`/user/knowledge-ingestion/tasks/${encodeURIComponent(taskId)}/retry`, {}, { timeoutMs: 180_000 }),
};

export const notificationApi = {
  list: () => api.get<any[]>('/user/notifications'),
  unread: () => api.get<any[]>('/user/notifications/unread'),
  unreadCount: () => api.get<any>('/user/notifications/unread-count'),
  read: (id: number | string) => api.post<any>(`/user/notifications/${id}/read`),
  readAll: () => api.post<any>('/user/notifications/read-all'),
};

export const multimodalApi = {
  get: (skill: string) => api.get<any>(`/user/multimodal/${encodeURIComponent(skill)}`),
  diagram: (skillName: string, diagramType = 'flowchart') =>
    api.post<any>('/user/multimodal/diagram', { skillName, diagramType }, { timeoutMs: 240_000 }),
  video: (skillName: string) =>
    api.post<any>('/user/multimodal/video', { skillName }, { timeoutMs: 60_000 }),
  videoTask: (taskId: string) => api.get<any>(`/user/video-task/${taskId}`),
  /** 教学视频（Remotion + TTS 管线）：聊天/资源里"重新生成"必须走这里，而不是智谱短视频端点 */
  createTeachingVideo: (skillName: string, difficulty = 'beginner') =>
    api.post<any>('/user/video-task', { skillName, difficulty }, { timeoutMs: 60_000 }),
};

// ────────────────────────────────────────────────────────────
//  比赛演示闭环（差异化画像 -> 多 Agent 协同 -> 报告 -> 动态决策）
// ────────────────────────────────────────────────────────────

export type CompetitionLearner = {
  id: string;
  name: string;
  level: 'foundation' | 'project' | 'transition' | string;
  title: string;
  background: string;
  targetRole: string;
  weeklyHours: number;
  theoryScore: number;
  practiceScore: number;
  strengths: string[];
  blindSpots: string[];
};

export type CompetitionResource = {
  type: 'lecture' | 'labGuide' | 'stagedQuiz' | string;
  title: string;
  level: string;
  summary: string;
  sections: string[];
  evidence: string[];
};

export type CompetitionLoopResult = {
  learner: CompetitionLearner;
  domain: { id: string; name: string; knowledgeSlice: string | string[]; targetRole: string };
  agents: Array<{
    id: string;
    name: string;
    role: string;
    status: 'success' | 'warning' | string;
    output: string;
    confidence: number;
  }>;
  report: {
    matchScore: number;
    hallucinationRisk: number;
    citationCoverage: number;
    blindSpots: Array<{ skill: string; severity: number; reason: string }>;
    difficultyCurve: Array<{ week: string; target: number; adapted: number }>;
    pathNodes: Array<{ id: string; title: string; level: string; status: 'done' | 'active' | 'next' | string }>;
  };
  resources: CompetitionResource[];
  evidenceTrail: Array<{ id: string; source: string; claim: string; coverage: number }>;
  debate: Array<{ agent: string; stance: string; verdict: 'pass' | 'revise' | string }>;
  decision: {
    action: '降维解释' | '补弱巩固' | '进阶挑战' | string;
    reason: string;
    nextTasks: string[];
  };
};

export const competitionApi = {
  health: () => api.get<any>('/competition/health'),
  demoCases: () => api.get<any>('/competition/demo-cases'),
  runLoop: (body: { learnerId?: string; quizAccuracy?: number }) =>
    api.post<CompetitionLoopResult>('/competition/run-loop', body, { timeoutMs: 60_000 }),
  feedback: (body: { learnerId?: string; quizAccuracy?: number }) => api.post<any>('/competition/feedback', body),
};

// ────────────────────────────────────────────────────────────
//  考试 / 题库（组卷答题闭环）
// ────────────────────────────────────────────────────────────

/** GET /user/exams/:examId/take 返回的已抽题快照（服务端剔除答案） */
export type ExamTakeData = {
  examId: number;
  examType: number;
  skillName: string | null;
  questions: Array<{
    id: number;
    questionType?: string;
    type?: string;
    title: string;
    content?: { options?: Array<{ key?: string; text?: string }>; [key: string]: any };
    options?: Array<{ key?: string; text?: string }>;
    difficulty?: number;
    [key: string]: any;
  }>;
  timeLimitSec: number;
  startedAt: number;
};

export const examsApi = {
  list: (page = 1, pageSize = 20, examType?: number) =>
    api.get<any>('/user/exams', { page, pageSize, exam_type: examType }),
  detail: (examId: number) => api.get<any>(`/user/exams/${examId}`),
  take: (examId: number, count = 10) => api.get<ExamTakeData>(`/user/exams/${examId}/take`, { count }),
  submit: (body: {
    examId?: number;
    examType: number;
    skillName?: string;
    answers: Record<string, any>;
    questionTimings?: Record<string, number>;
  }) => api.post<any>('/user/exams/submit', body, { timeoutMs: 120_000 }),
  wrongAnswers: (skillName?: string) => api.get<any[]>('/user/exams/wrong-answers', { skillName }),
  retryable: () => api.get<any[]>('/user/exams/retryable'),
  retry: (examId: number) => api.post<any>(`/user/exams/${examId}/retry`),
};

export const questionBankApi = {
  questions: (query?: {
    skillName?: string;
    questionType?: string;
    difficulty?: number;
    source?: string;
    page?: number;
    pageSize?: number;
  }) => api.get<any>('/user/question-bank/questions', query),
  assemble: (questionIds: number[]) =>
    api.post<{ examId: number; questionCount: number }>('/user/question-bank/assemble', { questionIds }, { timeoutMs: 60_000 }),
};

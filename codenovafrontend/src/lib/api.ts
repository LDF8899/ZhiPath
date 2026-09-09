import {
  createPlatformApiClient,
  createIdempotencyKey,
  PlatformApiError,
  PlatformTokenStore,
  type AuthUser,
  type ExperienceBootstrap,
  type LoginResult,
  type PlatformArtifact,
  type RequestOptions,
} from '@zhipath/api-client';

export { PlatformApiError as ApiError };
export type { AuthUser, ExperienceBootstrap, LoginResult };
export type { PlatformArtifact };

export const TOKEN_KEY = 'codenova_token';
export const USER_KEY = 'codenova_user';
export const REFRESH_TOKEN_KEY = 'codenova_refresh_token';

const tokenStore = new PlatformTokenStore(sessionStorage, {
  accessToken: TOKEN_KEY,
  refreshToken: REFRESH_TOKEN_KEY,
});

const platformApi = createPlatformApiClient({
  clientApp: 'codenova-web',
  clientVersion: import.meta.env.VITE_APP_VERSION || 'dev',
  tokenStore,
  onUnauthorized: () => clearAuth(),
});

export function getToken(): string | null {
  return tokenStore.getAccessToken();
}

export function setToken(token: string, refreshToken?: string | null) {
  tokenStore.setTokens(token, refreshToken);
}

export function getRefreshToken(): string | null {
  return tokenStore.getRefreshToken();
}

export function clearAuth() {
  tokenStore.clear();
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem('codenova_experience');
}

async function rawRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return platformApi.request<T>(path, options);
}

/** 带一次自动重试的 GET（应对后端冷启动 / 瞬断） */
export async function request<T>(path: string, options: RequestOptions = {}, retry = 1): Promise<T> {
  try {
    return await rawRequest<T>(path, options);
  } catch (err: any) {
    const retriable =
      retry > 0 &&
      err instanceof PlatformApiError &&
      typeof err.code === 'number' &&
      (err.code === 0 || err.code >= 500);
    if (!retriable) throw err;
    await new Promise((resolve) => setTimeout(resolve, 600));
    return rawRequest<T>(path, options);
  }
}

/**
 * 兼容路由只允许在服务端明确表示“该 v1 路由不存在”时触发。
 * 认证失败、权限不足、超时或 5xx 绝不能静默切回旧写入口，否则会把
 * 一个已经排队成功的作业重复提交，或把真实故障掩盖成旧页面数据。
 */
export function isLegacyFallbackError(error: unknown): boolean {
  return error instanceof PlatformApiError && [404, 405].includes(Number(error.code));
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

export const authApi = {
  login: (username: string, password: string) => platformApi.login(username, password),
  register: (username: string, password: string, realName?: string) =>
    platformApi.register(username, password, realName),
  me: () => platformApi.me(),
  tenants: () => platformApi.listTenants(),
  switchTenant: (tenantId: number) => platformApi.switchTenant(tenantId),
  logout: () => platformApi.logout(),
};

export const experienceApi = {
  bootstrap: () => platformApi.bootstrap(),
  /** 规范化首页读模型；页面迁移期间仍可按需读取旧接口的详细投影。 */
  home: () => platformApi.home(),
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
  domains: async () => {
    try { return await platformApi.listLearningDomains<LearningDomain>(); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<LearningDomain[]>('/user/learning-domains'); }
  },
  profile: async () => { try { return await platformApi.request<any>('/v1/profile'); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any>('/user/profile'); } },
  radar: async () => { try { return await platformApi.request<any>('/v1/profile/radar'); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any>('/user/profile/radar'); } },
  abilityMetrics: async () => { try { return await platformApi.request<any>('/v1/profile/ability-metrics'); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any>('/user/profile/ability-metrics'); } },
  updateProfile: async (body: Record<string, any>) => { try { return await platformApi.request<any>('/v1/profile', { method: 'PUT', body }); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.put<any>('/user/profile', body); } },
  onboarding: async (body: Record<string, any>) => {
    try {
      return await platformApi.request<{ completed: boolean }>('/v1/profile/onboarding', {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': createIdempotencyKey('codenova-onboarding') },
      });
    } catch (error) {
      if (!isLegacyFallbackError(error)) throw error;
      return api.post<{ completed: boolean }>('/user/onboarding', body);
    }
  },
  onboardingStatus: async () => {
    try { return await platformApi.request<any>('/v1/profile/onboarding/status'); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any>('/user/onboarding/status'); }
  },
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
  /** 规范路径 ID；旧数字 id 仅用于兼容期写操作。 */
  canonicalId?: string;
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
  list: async (pageSize = 100) => {
    try {
      const canonical = await platformApi.listLearningPaths(1, pageSize);
      return canonical.items.map((item) => {
        const snapshot = (item.snapshot || {}) as any;
        return {
          id: Number(item.legacyPlanId || 0),
          canonicalId: item.id,
          planName: item.name,
          planType: (item.pathKind || item.kind) === 'side' ? 'side' : 'main',
          domainId: item.domainKey,
          goalType: item.goalType,
          goalTitle: item.goalTitle,
          currentPhase: item.currentPhase || 0,
          planStatus: item.status,
          dailyHours: item.dailyMinutes ? item.dailyMinutes / 60 : undefined,
          pathData: toLegacyPathData(snapshot),
        } as LearningPlan;
      });
    } catch (error) {
      if (!isLegacyFallbackError(error)) throw error;
      // 兼容旧环境尚未部署 v1 learning 路由时继续读取历史契约。
    }
    return api.get<LearningPlan[]>('/user/learning-paths', { page: 1, pageSize });
  },
  detail: async (pathId: number | string) => {
    if (typeof pathId === 'string') {
      try {
        const canonical = await platformApi.getLearningPath(pathId);
        const snapshot = (canonical.snapshot || {}) as any;
        return {
          id: Number(canonical.legacyPlanId || 0),
          canonicalId: canonical.id,
          planName: canonical.name,
          planType: (canonical.pathKind || canonical.kind) === 'side' ? 'side' : 'main',
          domainId: canonical.domainKey,
          goalType: canonical.goalType,
          goalTitle: canonical.goalTitle,
          currentPhase: canonical.currentPhase || 0,
          planStatus: canonical.status,
          dailyHours: canonical.dailyMinutes ? canonical.dailyMinutes / 60 : undefined,
          pathData: toLegacyPathData(snapshot),
          nodes: canonical.nodes,
          edges: canonical.edges,
        } as LearningPlan;
      } catch (error) {
        if (!isLegacyFallbackError(error)) throw error;
        // 兼容期允许尚未部署 v1 详情路由的环境继续读取历史契约。
      }
    }
    return api.get<LearningPlan>(`/user/learning-paths/${pathId}`);
  },
  create: async (body: Record<string, any>) => {
    const canonical = await platformApi.createLearningGoal(
      {
        goalType: body.goalType || (body.planType === 'main' ? 'career' : 'project'),
        title: body.goalTitle || body.planName || body.direction || '自定义学习路径',
        domainKey: body.domainId || 'general',
        pathName: body.planName || body.goalTitle || body.direction,
        pathKind: body.planType || 'main',
        dailyMinutes: Math.round((body.dailyHours || 1) * 60),
        starterPathId: body.starterPathId,
      },
      createIdempotencyKey('codenova-create'),
    );
    for (const [index, skill] of (body.skills || []).entries()) {
      const title = String(skill).trim();
      await platformApi.createPathNode(
        canonical.path.id,
        {
          nodeKey: title.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || `skill-${index + 1}`,
          type: 'competency',
          title,
          position: index,
          metadata: { estimatedMin: 120, source: 'custom-plan' },
        },
        createIdempotencyKey('codenova-node'),
      );
    }
    return { id: 0, canonicalId: canonical.path.id, totalSkills: (body.skills || []).length, pathData: { phases: [] } } as any;
  },
  addSkill: async (pathId: number | string, body: { skillName: string; estimatedMin?: number }) => {
    if (typeof pathId === 'string') {
      const title = body.skillName.trim();
      await platformApi.createPathNode(
        pathId,
        { nodeKey: title.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || `skill-${Date.now()}`, type: 'competency', title, position: Date.now() % 100000, metadata: { estimatedMin: body.estimatedMin || 120, source: 'custom-add' } },
        createIdempotencyKey('codenova-node'),
      );
      return null as any;
    }
    return api.post<LearningPlan>(`/user/learning-paths/${pathId}/skills`, body);
  },
  setStatus: (pathId: number | string, planStatus: 'active' | 'paused' | 'archived') =>
    typeof pathId === 'string'
      ? platformApi.updateLearningPathStatus(pathId, planStatus, createIdempotencyKey('codenova'))
      : api.patch<LearningPlan>(`/user/learning-paths/${pathId}/status`, { planStatus }),
  merge: async (pathId: number | string) => {
    // merge has no v1 command yet; keep it explicitly legacy instead of
    // pretending a v1 failure is safe to retry.
    return api.post<any>(`/user/learning-paths/${pathId}/merge`);
  },
};

/** 将规范路径快照适配为 CodeNova 当前页面的展示模型；不改变后端事实。 */
function toLegacyPathData(snapshot: any) {
  // The v1 service normally returns `snapshot`, but during the migration
  // window a few deployments exposed the same JSON as `snapshot_json`,
  // `pathData`, or one level below `data`.  Normalize those representations
  // here so the CodeNova dashboard does not incorrectly fall back to the
  // "no learning path" empty state when a path already exists.
  let value = snapshot;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return undefined; }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const nested = value.pathData || value.snapshot || value.snapshot_json || value.data;
    if (nested && typeof nested === 'object' && !Array.isArray(nested) && !Array.isArray(value.phases)) {
      value = nested;
    }
  }
  if (!value || typeof value !== 'object') return undefined;
  const phases = Array.isArray(value.phases)
    ? value.phases.map((phase: any, index: number) => ({
        ...phase,
        name: phase.name || phase.title || `阶段 ${index + 1}`,
        index: phase.index ?? index,
        skills: Array.isArray(phase.skills)
          ? phase.skills.map((skill: any) =>
              typeof skill === 'string'
                ? { name: skill, status: phase.status === 'done' ? 'done' : 'pending' }
                : { ...skill, name: skill.name || skill.title || '未命名能力' },
            )
          : [],
      }))
    : [];
  return { ...value, phases };
}

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
  dashboard: async () => {
    try {
      const [home, profile, paths, today] = await Promise.all([
        experienceApi.home(),
        platformApi.request<any>('/v1/profile'),
        platformApi.listLearningPaths(1, 5),
        platformApi.request<any>('/v1/learning-tasks/today'),
      ]);
      const first = paths.items?.[0];
      let learningPath: any = first
        ? {
            id: Number(first.legacyPlanId || 0),
            canonicalId: first.id,
            planName: first.name,
            planType: (first.pathKind || first.kind) === 'side' ? 'side' : 'main',
            goalType: first.goalType,
            goalTitle: first.goalTitle,
            currentPhase: first.currentPhase || 0,
            planStatus: first.status,
            pathData: toLegacyPathData(first.snapshot || {}),
          }
        : null;
      if (first?.id) {
        try {
          const detail = await platformApi.getLearningPath(first.id);
          // Prefer the detailed snapshot only when it actually contains the
          // phase list.  Some older rows return an empty detail projection;
          // replacing a valid list snapshot with that object made `hasPlan`
          // false and hid the dashboard for users who already had a path.
          const detailSnapshot = toLegacyPathData(detail.snapshot);
          const listSnapshot = toLegacyPathData(first.snapshot);
          const pathData = detailSnapshot?.phases?.length ? detailSnapshot : listSnapshot || detailSnapshot;
          learningPath = { ...learningPath, nodes: detail.nodes, edges: detail.edges, pathData };
        } catch { /* 首页仍可使用列表快照 */ }
      }
      const homeData: any = home as any;
      const dashboard: any = homeData.sections?.dashboard || {};
      const taskItems = [...(today.mainTasks || []), ...(today.sideTasks || [])];
      const canonical: DashboardData = {
        student: profile,
        target_job: null,
        plans: (paths.items || []).map((item: any) => ({
          id: Number(item.legacyPlanId || 0),
          planName: item.name,
          planType: (item.pathKind || item.kind) === 'side' ? 'side' : 'main',
          domainId: item.domainKey,
          goalType: item.goalType,
          goalTitle: item.goalTitle,
          currentPhase: item.currentPhase || 0,
          estimatedDate: item.estimatedDate || '',
          totalSkills: Number(item.totalSkills || 0),
        })),
        learning_path: learningPath,
        stats: {
          total_skills: Number(dashboard.activePaths || 0),
          done_skills: Number(dashboard.completedToday || 0),
          in_progress_skills: Number(dashboard.inProgressActivities || 0),
          exam_count: Number(homeData.sections?.assessment?.attemptCount || 0),
          job_count: Number(dashboard.pendingJobs || 0),
          total_learned_hours: 0,
          active_days: 0,
        },
        today_tasks: taskItems,
        recent_news: [],
        golden_path: null,
      };
      return { code: 200, message: 'success', data: canonical } as any;
    } catch (error) {
      if (!isLegacyFallbackError(error)) throw error;
      return api.get<DashboardData>('/user/dashboard');
    }
  },
  todayActions: async () => {
    try {
      const today = await platformApi.request<any>('/v1/learning-tasks/today');
      const items = [...(today.mainTasks || []), ...(today.sideTasks || [])];
      const first = items.find((item: any) => !['done', 'completed', 'skipped'].includes(item.status || item.taskStatus));
      return { main: first ? { id: first.id, title: `学习 ${first.skillName || first.title}`, taskType: 'learning', skillName: first.skillName, estimatedMin: first.estimatedMin } : undefined, subs: [] };
    } catch (error) {
      if (!isLegacyFallbackError(error)) throw error;
      return api.get<TodayActionsResult>('/user/today-actions');
    }
  },
  growthReport: (days = 30) => api.get<any>('/user/growth-report', { days }),
  todayTasks: async (planId?: number) => {
    try {
      return await platformApi.request<any>('/v1/learning-tasks/today', { query: planId ? { planId } : {} });
    } catch (error) {
      if (!isLegacyFallbackError(error)) throw error;
      try {
        const activities = await platformApi.listLearningActivities(1, 100);
        const mapped = activities.items.filter((item: any) => !planId || Number(item.legacyPlanId) === planId).map((item: any) => ({ id: Number(item.legacyTaskId || 0), canonicalId: item.id, title: item.title, skillName: item.title, taskType: item.type, taskStatus: item.status === 'completed' ? 'done' : item.status, status: item.status === 'completed' ? 'done' : item.status, estimatedMin: item.estimatedMinutes || 30, planId: Number(item.legacyPlanId || 0) }));
        const mainTasks = mapped.filter((task: any) => (activities.items.find((item: any) => item.id === task.canonicalId)?.pathKind || 'main') === 'main');
        const sideTasks = mapped.filter((task: any) => !mainTasks.includes(task));
        return { planId: planId || 0, planName: '', mainTasks, sideTasks, totalEstimatedMin: mapped.reduce((sum: number, task: any) => sum + Number(task.estimatedMin || 0), 0), completedMin: mapped.filter((task: any) => task.status === 'done').reduce((sum: number, task: any) => sum + Number(task.estimatedMin || 0), 0), progressPct: mapped.length ? Math.round(mapped.filter((task: any) => task.status === 'done').length / mapped.length * 100) : 0 };
      } catch (fallbackError) {
        if (!isLegacyFallbackError(fallbackError)) throw fallbackError;
        return api.get<any>('/user/learning-tasks/today', { planId });
      }
    }
  },
  updateTaskStatus: async (taskId: number | string, status: string) => {
    if (typeof taskId === 'string') {
      return platformApi.updateLearningActivityStatus(taskId, { status: status === 'done' ? 'completed' : status }, createIdempotencyKey('codenova-activity'));
    }
    return api.post<any>(`/user/learning-tasks/${taskId}/status`, { status });
  },
  adjustSpeed: async (planId: number) => {
    try {
      return await platformApi.request<any>('/v1/learning-tasks/adjust-speed', {
        method: 'POST',
        body: { planId },
        headers: { 'Idempotency-Key': createIdempotencyKey(`codenova-adjust-speed-${planId}`) },
      });
    } catch (error) {
      if (!isLegacyFallbackError(error)) throw error;
      return api.post<any>('/user/learning-tasks/adjust-speed', { planId });
    }
  },
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
    platformApi.request<SkillContent>(`/v1/knowledge/${encodeURIComponent(skill)}`).catch((error) => { if (!isLegacyFallbackError(error)) throw error; return api.get<SkillContent>(`/user/learning-paths/knowledge/${encodeURIComponent(skill)}`); }),
  mastery: async (skill: string) => {
    try { return platformApi.request<MasteryBreakdown>(`/v1/progress/mastery/${encodeURIComponent(skill)}`); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<MasteryBreakdown>(`/user/progress/mastery/${encodeURIComponent(skill)}`); }
  },
  markRead: async (skill: string, pathId?: number) => {
    try { return platformApi.request<ProgressResult>('/v1/progress/read', { method: 'POST', body: { skill, path_id: pathId ?? 0 }, headers: { 'Idempotency-Key': createIdempotencyKey('codenova-progress-read') } }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<ProgressResult>('/user/progress/read', { skill, path_id: pathId ?? 0 }); }
  },
  submitQuiz: async (skill: string, total: number, correct: number, pathId?: number) => {
    try { return platformApi.request<ProgressResult>('/v1/progress/quiz', { method: 'POST', body: { skill, total, correct, path_id: pathId ?? 0 }, headers: { 'Idempotency-Key': createIdempotencyKey('codenova-progress-quiz') } }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<ProgressResult>('/user/progress/quiz', { skill, total, correct, path_id: pathId ?? 0 }); }
  },
  markCode: async (skill: string, pathId?: number) => {
    try { return platformApi.request<ProgressResult>('/v1/progress/code', { method: 'POST', body: { skill, path_id: pathId ?? 0 }, headers: { 'Idempotency-Key': createIdempotencyKey('codenova-progress-code') } }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<ProgressResult>('/user/progress/code', { skill, path_id: pathId ?? 0 }); }
  },
  complete: async (skill: string, pathId?: number) => {
    try { return platformApi.request<ProgressResult>('/v1/progress/complete', { method: 'POST', body: { skill, path_id: pathId ?? 0 }, headers: { 'Idempotency-Key': createIdempotencyKey('codenova-progress-complete') } }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<ProgressResult>('/user/progress/complete', { skill, path_id: pathId ?? 0 }); }
  },
  heartbeat: async (body: { deltaMs?: number; skill?: string; lecturePosition?: number }) => {
    try { return platformApi.request<{ ok: boolean }>('/v1/progress/heartbeat', { method: 'POST', body, headers: { 'Idempotency-Key': createIdempotencyKey('codenova-progress-heartbeat') } }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<{ ok: boolean }>('/user/progress/heartbeat', body); }
  },
  summary: async () => {
    try { return platformApi.request<any>('/v1/progress/summary'); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any>('/user/progress/summary'); }
  },
  restore: async (planId?: number) => {
    try { return platformApi.request<any>('/v1/progress/restore', { query: { planId } }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any>('/user/progress/restore', { planId }); }
  },
  list: async () => { try { return await platformApi.request<any[]>('/v1/me/skills'); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any[]>('/user/skills'); } },
  stats: async () => { try { return await platformApi.request<any>('/v1/me/skills/stats'); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any>('/user/skills/stats'); } },
  effective: async () => { try { return await platformApi.request<Array<{ name: string; masteryPct: number; trustWeight: number; source: string }>>('/v1/me/skills/effective'); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<Array<{ name: string; masteryPct: number; trustWeight: number; source: string }>>('/user/skills/effective'); } },
  evidence: async (skillName: string) => { try { return await platformApi.request<any>(`/v1/me/skills/${encodeURIComponent(skillName)}/evidence`); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any>(`/user/skills/${encodeURIComponent(skillName)}/evidence`); } },
};

// ────────────────────────────────────────────────────────────
//  Agent 生成能力
// ────────────────────────────────────────────────────────────

async function runPlatformAgent<T>(jobType: string, payload: Record<string, unknown>, timeoutMs = 240_000): Promise<T> {
  const queued = await platformApi.createJob({ jobType, payload }, createIdempotencyKey(`codenova-${jobType}`));
  const finished = await platformApi.waitForJob(queued.id, { timeoutMs });
  if (finished.status !== 'completed') {
    throw new PlatformApiError((finished.error as any)?.message || '智能体作业执行失败', 500, finished.error);
  }
  return finished.result as T;
}

async function runPlatformResource<T>(resourceType: string, payload: Record<string, unknown>, timeoutMs = 240_000): Promise<T> {
  const queued = await platformApi.createJob({ jobType: `resource.${resourceType}`, payload }, createIdempotencyKey(`codenova-resource-${resourceType}`));
  const finished = await platformApi.waitForJob(queued.id, { timeoutMs });
  if (finished.status !== 'completed') {
    throw new PlatformApiError((finished.error as any)?.message || '资源作业执行失败', 500, finished.error);
  }
  return finished.result as T;
}

export const agentApi = {
  lecture: async (skillName: string, level: 'beginner' | 'intermediate' | 'advanced' = 'beginner', extra?: string) => {
    try { return await runPlatformAgent<any>('agent.lecture', { skillName, level, extra }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>('/user/agents/lecture', { skillName, level, extra }, { timeoutMs: 240_000 }); }
  },
  reading: async (skillName: string, count = 5, focus?: string) => {
    try { return await runPlatformAgent<any>('agent.reading', { skillName, count, focus }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>('/user/agents/reading', { skillName, count, focus }, { timeoutMs: 240_000 }); }
  },
  code: async (skillName: string, language = 'JavaScript', count = 3) => {
    try { return await runPlatformAgent<any>('agent.code', { skillName, language, count }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>('/user/agents/code', { skillName, language, count }, { timeoutMs: 240_000 }); }
  },
  assess: async (body: { learningData: string; skillName?: string; goal?: string; currentProgress?: string }) => {
    try { return await runPlatformAgent<any>('agent.assess', body); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>('/user/agents/assess', body, { timeoutMs: 240_000 }); }
  },
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
  send: async (message: string, sessionId?: string, pageContext = 'general') => { try { return await platformApi.request<ChatReply>('/v1/chat', { method: 'POST', body: { message, sessionId, pageContext }, timeoutMs: 180_000 }); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<ChatReply>('/user/chat', { message, session_id: sessionId, page_context: pageContext }, { timeoutMs: 180_000 }); } },
  sessions: async (page = 1, pageSize = 20): Promise<ChatSession[]> => { try { const result = await platformApi.request<any>('/v1/chat/sessions', { query: { page, pageSize } }); return (Array.isArray(result) ? result : (result?.items || [])) as ChatSession[]; } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<ChatSession[]>('/user/chat-sessions', { page, pageSize }); } },
  session: async (sessionId: string) => { try { return await platformApi.request<ChatSession>(`/v1/chat/sessions/${encodeURIComponent(sessionId)}`); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<ChatSession>(`/user/chat-sessions/${sessionId}`); } },
  deleteSession: async (sessionId: string) => { try { return await platformApi.request<any>(`/v1/chat/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.del<any>(`/user/chat-sessions/${sessionId}`); } },
};

// ────────────────────────────────────────────────────────────
//  资源台账 / Agent 办公室
// ────────────────────────────────────────────────────────────

export type GeneratedResource = {
  id: number | string;
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
  createdAt?: number | string;
  createTime?: number | string;
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
  /**
   * 规范资源台账优先读取 generated_artifacts；仅在 v1 不可用时回退旧资源表。
   */
  list: async (query?: { source?: string; resourceType?: string; status?: string; chatSessionId?: string; search?: string; limit?: number }) => {
    const pageSize = Math.min(100, Math.max(1, Number(query?.limit || 100)));
    try {
      const canonical = await platformApi.listResources(1, pageSize, query?.resourceType, query?.search);
      return canonical.items.map((artifact: PlatformArtifact) => ({
          id: artifact.id,
          title: artifact.title,
          resourceType: artifact.type,
          resourceStatus: artifact.status,
          source: artifact.source || undefined,
          skillName: artifact.skillName || undefined,
          chatSessionId: artifact.chatSessionId || undefined,
          content: artifact.content,
          previewMeta: artifact.feedbackUseful === null || artifact.feedbackUseful === undefined
            ? ((artifact.provenance?.previewMeta as any) || null)
            : { ...((artifact.provenance?.previewMeta as any) || {}), feedbackUseful: artifact.feedbackUseful },
          createdAt: artifact.createdAt,
          updatedAt: artifact.updatedAt,
          provenance: artifact.provenance,
          producerRunId: artifact.producerRunId,
          errorMessage: artifact.errorMessage || undefined,
        }));
    } catch {
      return api.get<GeneratedResource[]>('/user/generated-resources', query as any);
    }
  },
  detail: async (id: number | string) => {
    if (typeof id === 'string') {
      try {
        const artifact = await platformApi.getResource(id);
        return {
          id: artifact.id,
          title: artifact.title,
          resourceType: artifact.type,
          resourceStatus: artifact.status,
          source: artifact.source || undefined,
          skillName: artifact.skillName || undefined,
          chatSessionId: artifact.chatSessionId || undefined,
          content: artifact.content,
          previewMeta: artifact.feedbackUseful === null || artifact.feedbackUseful === undefined
            ? ((artifact.provenance?.previewMeta as any) || null)
            : { ...((artifact.provenance?.previewMeta as any) || {}), feedbackUseful: artifact.feedbackUseful },
          createdAt: artifact.createdAt,
          updatedAt: artifact.updatedAt,
          provenance: artifact.provenance,
          producerRunId: artifact.producerRunId,
          errorMessage: artifact.errorMessage || undefined,
        } as GeneratedResource;
      } catch {
        // 兼容期允许调用方传入旧数字 ID。
      }
    }
    return api.get<GeneratedResource>(`/user/generated-resources/${id}`);
  },
  feedback: async (id: number | string, useful: boolean) => {
    if (typeof id === 'string') {
      const artifact = await platformApi.feedbackResource(id, useful);
      return {
        id: artifact.id,
        title: artifact.title,
        resourceType: artifact.type,
        resourceStatus: artifact.status,
        content: artifact.content,
        previewMeta: artifact.feedbackUseful === null || artifact.feedbackUseful === undefined
          ? ((artifact.provenance?.previewMeta as any) || null)
          : { ...((artifact.provenance?.previewMeta as any) || {}), feedbackUseful: artifact.feedbackUseful },
        createdAt: artifact.createdAt,
        updatedAt: artifact.updatedAt,
        provenance: artifact.provenance,
      } as GeneratedResource;
    }
    return api.post<GeneratedResource>(`/user/generated-resources/${id}/feedback`, { useful });
  },
};

export type OfficeTask = {
  id: number | string;
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
  profiles: async () => {
    try { return await platformApi.request<any[]>('/v1/agent-office/profiles'); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any[]>('/user/agent-office/profiles'); }
  },
  tasks: async () => {
    try {
      const page = await platformApi.request<any>('/v1/agent-office/tasks', { query: { page: 1, pageSize: 100 } });
      const items = page.items || page.data?.items || [];
      return items.map((job: any) => ({ id: job.id, agentType: String(job.type || '').replace(/^agent\./, ''), title: job.payload?.title || job.type, taskStatus: job.status, progress: job.progress, result: job.result, errorMessage: job.error?.message }));
    } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<OfficeTask[]>('/user/agent-office/tasks'); }
  },
  task: async (taskId: number | string) => {
    try {
      const job = await platformApi.request<any>(`/v1/agent-office/tasks/${encodeURIComponent(String(taskId))}`);
      return { id: job.id, agentType: String(job.type || '').replace(/^agent\./, ''), title: job.payload?.title || job.type, taskStatus: job.status, progress: job.progress, result: job.result, errorMessage: (job.error as any)?.message } as any;
    } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<OfficeTask>(`/user/agent-office/tasks/${taskId}`); }
  },
  stats: async () => {
    const tasks: any[] = await officeApi.tasks();
    return { total: tasks.length, pending: tasks.filter((x) => ['queued','running'].includes(x.taskStatus)).length, completed: tasks.filter((x) => x.taskStatus === 'completed').length, failed: tasks.filter((x) => x.taskStatus === 'failed').length };
  },
  agentTypes: async () => { try { return await platformApi.request<any>('/v1/agent-office/agent-types'); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any[]>('/user/agent-office/agent-types'); } },
  create: async (body: { agentType: string; title: string; params?: Record<string, any>; description?: string }) => {
    try { return await platformApi.request<any>('/v1/agent-office/tasks', { method: 'POST', headers: { 'Idempotency-Key': createIdempotencyKey('codenova-office-create') }, body }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<OfficeTask>('/user/agent-office/tasks', body); }
  },
  use: async (profileId: number | string, prompt: string, params?: Record<string, any>) => {
    try {
      return await platformApi.request<any>(`/v1/agent-office/profiles/${encodeURIComponent(String(profileId))}/use`, {
        method: 'POST',
        headers: { 'Idempotency-Key': createIdempotencyKey('codenova-office-use') },
        body: { prompt, params },
      });
    } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>(`/user/agent-office/profiles/${profileId}/use`, { prompt, params }); }
  },
  retry: async (taskId: number | string) => { try { return await platformApi.retryJob(String(taskId), createIdempotencyKey('codenova-office-retry')); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>(`/user/agent-office/tasks/${taskId}/retry`); } },
  cancel: async (taskId: number | string) => { try { return await platformApi.cancelJob(String(taskId), createIdempotencyKey('codenova-office-cancel')); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>(`/user/agent-office/tasks/${taskId}/cancel`); } },
  urgent: async (taskId: number | string) => { try { return await platformApi.markJobUrgent(String(taskId), createIdempotencyKey('codenova-office-urgent')); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>(`/user/agent-office/tasks/${taskId}/urgent`); } },
  skip: async (taskId: number | string) => { try { return await platformApi.skipJob(String(taskId), createIdempotencyKey('codenova-office-skip')); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>(`/user/agent-office/tasks/${taskId}/skip`); } },
  reorder: async (jobIds: Array<number | string>) => { try { return await platformApi.reorderJobs(jobIds.map(String), createIdempotencyKey('codenova-office-reorder')); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>('/user/agent-office/tasks/reorder', { taskIds: jobIds }); } },
  remove: async (taskId: number | string) => { try { return await platformApi.deleteJob(String(taskId), createIdempotencyKey('codenova-office-delete')); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>(`/user/agent-office/tasks/${taskId}/delete`); } },
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
  list: async (limit = 20) => { try { return await platformApi.request<any>('/v1/question-generation/tasks', { query: { limit } }); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<QuestionGenerationSnapshot[]>('/user/question-generation/tasks', { limit }); } },
  create: async (config: GenerationConfig) => { try { return await platformApi.request<any>('/v1/question-generation/tasks', { method: 'POST', body: config, timeoutMs: 120_000, headers: { 'Idempotency-Key': createIdempotencyKey('codenova-question-create') } }); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<QuestionGenerationSnapshot>('/user/question-generation/tasks', config, { timeoutMs: 120_000 }); } },
  start: async (taskId: number) => { try { return await platformApi.request<any>(`/v1/question-generation/tasks/${taskId}/start`, { method: 'POST', timeoutMs: 120_000 }); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<QuestionGenerationSnapshot>(`/user/question-generation/tasks/${taskId}/start`, undefined, { timeoutMs: 120_000 }); } },
  snapshot: async (taskId: number) => { try { return await platformApi.request<any>(`/v1/question-generation/tasks/${taskId}/snapshot`); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<QuestionGenerationSnapshot>(`/user/question-generation/tasks/${taskId}/snapshot`); } },
  saveSnapshot: async (taskId: number, payload: { questions: GeneratedQuestion[]; config?: GenerationConfig; reviewStatuses?: string[] }) => { try { return await platformApi.request<any>(`/v1/question-generation/tasks/${taskId}/snapshot`, { method: 'PUT', body: payload }); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.put<any>(`/user/question-generation/tasks/${taskId}/snapshot`, payload); } },
  persistDrafts: async (taskId: number, questions: GeneratedQuestion[]) => { try { return await platformApi.request<any>(`/v1/question-generation/tasks/${taskId}/questions/batch`, { method: 'POST', body: { questions } }); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>(`/user/question-generation/tasks/${taskId}/questions/batch`, { questions }); } },
  approve: async (taskId: number, questionIds: number[], questionsMap?: Record<string, GeneratedQuestion>) => { try { return await platformApi.request<any>(`/v1/question-generation/tasks/${taskId}/questions/approve`, { method: 'PATCH', body: { questionIds, questionsMap } }); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.patch<any>(`/user/question-generation/tasks/${taskId}/questions/approve`, { questionIds, questionsMap }); } },
  updateDraft: async (taskId: number, questionId: number, question: GeneratedQuestion) => { try { return await platformApi.request<any>(`/v1/question-generation/tasks/${taskId}/questions/${questionId}`, { method: 'PATCH', body: { question } }); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.patch<any>(`/user/question-generation/tasks/${taskId}/questions/${questionId}`, { question }); } },
  remove: async (taskId: number) => { try { return await platformApi.request<any>(`/v1/question-generation/tasks/${taskId}`, { method: 'DELETE' }); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.del<any>(`/user/question-generation/tasks/${taskId}`); } },
};

export const quickTestApi = {
  questions: async (direction?: string) => {
    try {
      return await platformApi.request<any>('/v1/assessments/quick-test', { query: { direction } });
    } catch (error) {
      if (!isLegacyFallbackError(error)) throw error;
      return api.get<any>('/user/quick-test', { direction });
    }
  },
  submit: async (body: { skillName: string; answers: Record<string, any>; questions: any[] }) => {
    try {
      return platformApi.request<any>('/v1/assessments/quick-test/submit', {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': createIdempotencyKey('codenova-quick-test') },
        timeoutMs: 120_000,
      });
    } catch (error) {
      if (!isLegacyFallbackError(error)) throw error;
      return api.post<any>('/user/quick-test/submit', body);
    }
  },
};

export const remediationApi = {
  weakPoints: async () => {
    try { return platformApi.request<any[]>('/v1/remediation/weak-points'); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any[]>('/user/remediation/weak-points'); }
  },
  prepare: async (body: any) => {
    try { return platformApi.request<any>('/v1/remediation/prepare', { method: 'POST', body }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>('/user/remediation/prepare', body); }
  },
  generate: async (body: any) => {
    try {
      return platformApi.request<any>('/v1/remediation/generate', {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': createIdempotencyKey('codenova-remediation') },
        timeoutMs: 240_000,
      });
    } catch (error) {
      if (!isLegacyFallbackError(error)) throw error;
      return api.post<any>('/user/remediation/generate', body, { timeoutMs: 240_000 });
    }
  },
  history: async (limit = 10) => {
    try { return platformApi.request<any[]>('/v1/remediation/history', { query: { limit } }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any[]>('/user/remediation/history', { limit }); }
  },
};

export const evaluationApi = {
  list: async () => {
    try {
      const result = await platformApi.listAssessmentAttempts(1, 100);
      return result.items.map((item: any) => ({
        id: item.id,
        resultId: item.id,
        skillName: item.competency || null,
        score: item.score == null ? 0 : Number(item.score),
        passed: item.passed == null ? null : Boolean(item.passed),
        level: null,
        summary: item.kind || '',
        time: Date.parse(item.completedAt || item.startedAt || '') || Date.now(),
      }));
    } catch {
      return api.get<any[]>('/user/evaluations');
    }
  },
  detail: async (attemptId: string | number) => { try { return await platformApi.request<any>(`/v1/evaluations/${encodeURIComponent(String(attemptId))}`); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any>(`/user/evaluations/${attemptId}`); } },
};

export const matchApi = {
  best: async () => { try { return await platformApi.request<any>('/v1/match/best'); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any>('/user/match/best'); } },
  all: async () => { try { return await platformApi.request<any[]>('/v1/match/all'); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any[]>('/user/match-all'); } },
  recalculate: async () => { try { return await platformApi.request<any>('/v1/match/recalculate', { method: 'POST' }); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>('/user/match/recalculate'); } },
  trend: async (jobId: number, days = 30) => { try { return await platformApi.request<any>(`/v1/match/${jobId}/trend`, { query: { days } }); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any>(`/user/match/trend/${jobId}`, { days }); } },
};

export const evidenceApi = {
  search: async (q: string, explain = false) => {
    try {
      const result = await platformApi.request<any>('/v1/evidence/search', { query: { q, limit: 100 } });
      return { ...result, query: q, explain };
    } catch {
      return api.get<any>('/user/evidence/search', { query: q, q, explain: explain ? 1 : undefined });
    }
  },
  summary: async () => {
    try {
      return await platformApi.request<any>('/v1/evidence/summary');
    } catch {
      return api.get<any>('/user/evidence/summary');
    }
  },
  graph: async (limit = 120) => { try { return await platformApi.request<any>('/v1/evidence/graph', { query: { limit } }); } catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any>('/user/evidence/graph', { limit }); } },
};

export const knowledgeIngestionApi = {
  uploadText: async (body: { title?: string; content: string; sourceName?: string; sourceUrl?: string; skillTags?: string[] }) => {
    try { return platformApi.request<any>('/v1/knowledge-ingestion/upload-text', { method: 'POST', body, headers: { 'Idempotency-Key': createIdempotencyKey('codenova-ingest-text') }, timeoutMs: 180_000 }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>('/user/knowledge-ingestion/upload-text', body, { timeoutMs: 180_000 }); }
  },
  ingestUrl: async (body: { url: string; title?: string; skillTags?: string[] }) => {
    try { return platformApi.request<any>('/v1/knowledge-ingestion/url', { method: 'POST', body, headers: { 'Idempotency-Key': createIdempotencyKey('codenova-ingest-url') }, timeoutMs: 180_000 }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>('/user/knowledge-ingestion/url', body, { timeoutMs: 180_000 }); }
  },
  refreshNews: async (body: { keywords?: string[]; limit?: number } = {}) => {
    try { return platformApi.request<any>('/v1/knowledge-ingestion/news-refresh', { method: 'POST', body, headers: { 'Idempotency-Key': createIdempotencyKey('codenova-news-refresh') }, timeoutMs: 240_000 }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>('/user/knowledge-ingestion/news-refresh', body, { timeoutMs: 240_000 }); }
  },
  listTasks: async (params: { status?: string; limit?: number } = {}) => {
    try { return platformApi.request<any>('/v1/knowledge-ingestion/tasks', { query: params }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any>('/user/knowledge-ingestion/tasks', params); }
  },
  getTask: async (taskId: string) => {
    try { return platformApi.request<any>(`/v1/knowledge-ingestion/tasks/${encodeURIComponent(taskId)}`); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any>(`/user/knowledge-ingestion/tasks/${encodeURIComponent(taskId)}`); }
  },
  retry: async (taskId: string) => {
    try { return platformApi.request<any>(`/v1/knowledge-ingestion/tasks/${encodeURIComponent(taskId)}/retry`, { method: 'POST', headers: { 'Idempotency-Key': createIdempotencyKey('codenova-ingest-retry') }, timeoutMs: 180_000 }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>(`/user/knowledge-ingestion/tasks/${encodeURIComponent(taskId)}/retry`, {}, { timeoutMs: 180_000 }); }
  },
};

export const notificationApi = {
  list: async () => {
    try { const result = await platformApi.request<any>('/v1/notifications'); return result.items || []; }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any[]>('/user/notifications'); }
  },
  unread: async () => {
    try { const result = await platformApi.request<any>('/v1/notifications/unread'); return result.items || []; }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any[]>('/user/notifications/unread'); }
  },
  unreadCount: async () => {
    try { return await platformApi.request<any>('/v1/notifications/unread-count'); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any>('/user/notifications/unread-count'); }
  },
  read: async (id: number | string) => {
    try { return await platformApi.request<any>(`/v1/notifications/${id}/read`, { method: 'POST', headers: { 'Idempotency-Key': createIdempotencyKey(`codenova-notification-read-${id}`) } }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>(`/user/notifications/${id}/read`); }
  },
  readAll: async () => {
    try { return await platformApi.request<any>('/v1/notifications/read-all', { method: 'POST', headers: { 'Idempotency-Key': createIdempotencyKey('codenova-notifications-read-all') } }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>('/user/notifications/read-all'); }
  },
};

export const multimodalApi = {
  get: async (skill: string) => {
    try { return await platformApi.request<any>('/v1/resources/search', { query: { q: skill, limit: 50 } }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<any>(`/user/multimodal/${encodeURIComponent(skill)}`); }
  },
  animation: async (skillName: string, difficulty = 'beginner') => {
    try { return await runPlatformResource<any>('animation', { skillName, difficulty }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>('/user/multimodal/animation', { skillName, difficulty }, { timeoutMs: 240_000 }); }
  },
  diagram: async (skillName: string, diagramType = 'flowchart') => {
    try { return await runPlatformResource<any>('diagram', { skillName, diagramType }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>('/user/multimodal/diagram', { skillName, diagramType }, { timeoutMs: 240_000 }); }
  },
  video: async (skillName: string) => {
    try { return await runPlatformResource<any>('video', { skillName }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>('/user/multimodal/video', { skillName }, { timeoutMs: 60_000 }); }
  },
  avatar: async (skillName: string) => {
    try { return await runPlatformResource<any>('avatar', { skillName }); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.post<any>('/user/multimodal/avatar', { skillName }, { timeoutMs: 240_000 }); }
  },
  videoTask: async (taskId: string) => {
    try {
      const job = await platformApi.getJob(String(taskId));
      const status = String(job.status);
      const mapped = status === 'completed' ? 'completed' : status === 'failed' || status === 'cancelled' ? 'failed' : 'pending';
      return {
        status: mapped,
        progress: Number(job.progress || 0),
        message: mapped === 'completed' ? '视频生成完成' : mapped === 'failed' ? ((job.error as any)?.message || '视频生成失败') : '视频生成中…',
        result: job.result,
        error: job.error,
        taskId,
      };
    } catch {
      return api.get<any>(`/user/video-task/${taskId}`);
    }
  },
  /** 教学视频（Remotion + TTS 管线）统一进入 durable jobs。 */
  createTeachingVideo: async (skillName: string, difficulty = 'beginner') => {
    try {
      const queued = await platformApi.createJob(
        { jobType: 'resource.video', payload: { skillName, difficulty } },
        createIdempotencyKey('codenova-video-task'),
      );
      return { type: 'video_pending', data: { taskId: queued.id, skillName, difficulty, message: '视频任务已进入统一作业队列' } };
    } catch {
      return api.post<any>('/user/video-task', { skillName, difficulty }, { timeoutMs: 60_000 });
    }
  },
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
  attemptId?: string;
  examType: number;
  skillName: string | null;
  questions: Array<{
    id: number | string;
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
  list: async (page = 1, pageSize = 20, examType?: number) => {
    try {
      const result = await platformApi.listAssessmentAttempts(page, pageSize);
      const rows = result.items.map((item: any) => ({
        id: Number(item.legacyExamId || 0),
        canonicalAttemptId: item.id,
        definitionId: item.definitionId,
        examId: Number(item.legacyExamId || 0),
        userId: 0,
        examType: Number(item.definitionSettings?.legacyExamType || 1),
        skillName: item.competency || '',
        score: item.score == null ? null : Number(item.score),
        passed: item.passed == null ? 0 : Number(item.passed),
        retryCount: 0,
        createTime: Date.parse(item.completedAt || item.startedAt || '') || Date.now(),
      })).filter((item: any) => !examType || item.examType === examType);
      return { data: rows, total: rows.length, page, pageSize };
    } catch {
      return api.get<any>('/user/exams', { page, pageSize, exam_type: examType });
    }
  },
  detail: (examId: number) => api.get<any>(`/user/exams/${examId}`),
  take: async (examId: number, count = 10) => {
    try {
      const started = await platformApi.startLegacyExam(examId, { count }, createIdempotencyKey(`codenova-exam-${examId}`));
      const data: ExamTakeData & { attemptId?: string } = {
        examId,
        attemptId: started.id,
        examType: 1,
        skillName: started.definition?.title || null,
        questions: (started.items || []).map((item: any) => ({
          id: item.id,
          title: item.prompt,
          questionType: item.type,
          type: item.type,
          content: item.content || {},
          options: item.content?.options || [],
          difficulty: item.difficulty,
        })),
        timeLimitSec: Number(started.definition?.settings?.timeLimitSec || 0),
        startedAt: Date.now(),
      };
      sessionStorage.setItem(`codenova_exam_attempt_${examId}`, JSON.stringify({ attemptId: started.id }));
      return data;
    } catch {
      return api.get<ExamTakeData>(`/user/exams/${examId}/take`, { count });
    }
  },
  submit: async (body: {
    examId?: number;
    examType: number;
    skillName?: string;
    answers: Record<string, any>;
    questionTimings?: Record<string, number>;
  }) => {
    try {
      const cached = body.examId ? sessionStorage.getItem(`codenova_exam_attempt_${body.examId}`) : null;
      const attemptId = cached ? JSON.parse(cached).attemptId : null;
      if (!attemptId) throw new Error('canonical attempt unavailable');
      const responses = Object.entries(body.answers || {}).map(([itemId, response]) => ({ itemId, response }));
      const result = await platformApi.submitAssessment(attemptId, responses, createIdempotencyKey(`codenova-submit-${attemptId}`));
      sessionStorage.removeItem(`codenova_exam_attempt_${body.examId}`);
      return { ...result, summary: { correctCount: result.correctCount, totalQuestions: result.totalCount } };
    } catch {
      return api.post<any>('/user/exams/submit', body, { timeoutMs: 120_000 });
    }
  },
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
  }) => platformApi.request<any>('/v1/question-bank/questions', { query }).catch((error) => { if (!isLegacyFallbackError(error)) throw error; return api.get<any>('/user/question-bank/questions', query); }),
  assemble: (questionIds: number[]) =>
    platformApi.request<{ examId: number; questionCount: number }>('/v1/question-bank/assemble', { method: 'POST', body: { questionIds }, headers: { 'Idempotency-Key': createIdempotencyKey('codenova-question-bank-assemble') }, timeoutMs: 60_000 }).catch((error) => { if (!isLegacyFallbackError(error)) throw error; return api.post<{ examId: number; questionCount: number }>('/user/question-bank/assemble', { questionIds }, { timeoutMs: 60_000 }); }),
};

/* ---------------------------------- AI 服务商 ---------------------------------- */

export interface LlmProviderOption {
  id: string;
  label: string;
  defaultBaseUrl: string;
  note: string;
  accent?: string;
  needsApiKey: boolean;
}

export interface UserLlmConfig {
  provider: string | null;
  configured: boolean;
  keyMasked: string | null;
  baseUrl: string | null;
  enabled: number;
}

export const userLlmApi = {
  /** 可选服务商清单 */
  providers: async () => {
    try { return await platformApi.request<LlmProviderOption[]>('/v1/user-llm/providers'); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<LlmProviderOption[]>('/user/llm/providers'); }
  },
  /** 当前用户配置（脱敏视图） */
  config: async () => {
    try { return await platformApi.request<UserLlmConfig>('/v1/user-llm/config'); }
    catch (error) { if (!isLegacyFallbackError(error)) throw error; return api.get<UserLlmConfig>('/user/llm/config'); }
  },
  /** 保存当前用户配置 */
  save: (body: { provider: string; apiKey?: string; baseUrl?: string }) =>
    platformApi.request<UserLlmConfig & { ok: boolean }>('/v1/user-llm/config', { method: 'POST', body, timeoutMs: 30_000, headers: { 'Idempotency-Key': createIdempotencyKey('codenova-llm-config') } }).catch((error) => { if (!isLegacyFallbackError(error)) throw error; return api.post<UserLlmConfig & { ok: boolean }>('/user/llm/config', body, { timeoutMs: 30_000 }); }),
  /** 清除当前用户配置和已保存的密钥 */
  clear: () =>
    platformApi.request<{ ok: boolean }>('/v1/user-llm/config', { method: 'DELETE', headers: { 'Idempotency-Key': createIdempotencyKey('codenova-llm-config-clear') } }).catch((error) => { if (!isLegacyFallbackError(error)) throw error; return api.del<{ ok: boolean }>('/user/llm/config'); }),
};

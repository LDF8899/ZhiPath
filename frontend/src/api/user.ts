import client from './client';
import { zhipathPlatformApi } from './platform';
import { createIdempotencyKey, PlatformApiError } from '@zhipath/api-client';
import { snakeToCamel } from '../utils/transform';
import type {
  ApiResponse,
  PaginatedResponse,
  DashboardData,
  Job,
  LearningPath,
  ExamRecord,
  NewsItem,
  ChatReply,
  ChatSession,
  GeneratedResource,
  ProgressSummary,
  UserProfile,
  LearningBranch,
  LearningCommit,
  SkillSnapshot,
  RadarComparison,
  AbilityMetrics,
  RadarDimension,
  EvaluationListItem,
  GapCard,
  TodayActions,
  SkillEvidence,
  LearningDomain,
  LearningGoalType,
} from '../types';

/** 兼容路由仅用于旧后端明确返回 404/405 的过渡场景。 */
function isLegacyFallbackError(error: unknown): boolean {
  return error instanceof PlatformApiError && [404, 405].includes(Number(error.code));
}

/** 登录 */
export const login = (username: string, password: string) =>
  zhipathPlatformApi.login(username, password);

/** 注册 */
export const register = (data: { username: string; password: string; realName?: string }) =>
  zhipathPlatformApi.register(data.username, data.password, data.realName);

/** 获取当前用户 */
export const getMe = (_token?: string) => zhipathPlatformApi.me();

/** 当前账号的租户工作空间；用于多组织切换，不与客户端品牌混用。 */
export const listTenants = () => zhipathPlatformApi.listTenants();
export const switchTenant = (tenantId: number) => zhipathPlatformApi.switchTenant(tenantId);

/** 当前智途客户端的品牌、租户、功能开关和导航配置 */
export const getExperienceBootstrap = () =>
  zhipathPlatformApi.bootstrap();

/** Onboarding 状态 */
export const getOnboardingStatus = () =>
  zhipathPlatformApi.request<{ completed: boolean }>('/v1/profile/onboarding/status')
    .then((data) => ({ code: 200, message: 'success', data }) as ApiResponse<{ completed: boolean }>)
    .catch((error) => {
      if (!isLegacyFallbackError(error)) throw error;
      return client.get('/user/onboarding/status') as Promise<ApiResponse<{ completed: boolean }>>;
    });

/** 提交 Onboarding（只保存资料） */
export const submitOnboarding = (data: {
  name: string;
  school?: string;
  major: string;
  grade: string;
  direction: string;
  domainId?: string;
  goalType?: LearningGoalType;
  starterPathId?: string;
  goalTitle?: string;
  dailyHours: number;
  skills: Array<{ name: string; level: string }>;
}) =>
  zhipathPlatformApi.request<{ completed: boolean }>('/v1/profile/onboarding', {
    method: 'POST',
    body: data,
    headers: { 'Idempotency-Key': createIdempotencyKey('zhipath-onboarding') },
  })
    .then((result) => ({ code: 200, message: 'success', data: result }) as ApiResponse<{ completed: boolean }>)
    .catch((error) => {
      if (!isLegacyFallbackError(error)) throw error;
      return client.post('/user/onboarding', data) as Promise<ApiResponse<{ completed: boolean }>>;
    });

/** 获取用户所有计划。
 *
 * v1 返回规范 UUID；这里仅做一次边界适配，保留旧页面所需的摘要字段。
 * 页面和业务代码不再直接依赖 /api/user/learning-paths，兼容路由只作为
 * 尚未升级环境的回退。
 */
export const getMyPlans = async () => {
  try {
    const result = await zhipathPlatformApi.listLearningPaths(1, 100);
    return {
      code: 200,
      message: 'success',
      data: result.items.map(toLegacyLearningPathSummary),
      total: result.pageInfo.total || result.items.length,
      page: result.pageInfo.page,
      pageSize: result.pageInfo.pageSize,
    } as ApiResponse<any>;
  } catch (error) {
    if (!isLegacyFallbackError(error)) throw error;
    return client.get('/user/learning-paths') as Promise<ApiResponse<any>>;
  }
};

function toLegacyLearningPathSummary(item: any) {
  const legacy = toLegacyLearningPath(item);
  const phases = legacy.pathData?.phases || [];
  const skills = phases.flatMap((phase: any) => Array.isArray(phase.skills) ? phase.skills : []);
  const doneSkills = skills.filter((skill: any) => skill.status === 'done' || skill.status === 'completed').length;
  return {
    id: legacy.id,
    canonicalId: legacy.canonicalId,
    planName: legacy.planName,
    planType: legacy.planType,
    targetJobId: legacy.targetJobId,
    domainId: legacy.domainId,
    goalType: legacy.goalType,
    goalTitle: legacy.goalTitle,
    currentPhase: legacy.currentPhase,
    dailyHours: legacy.dailyHours,
    estimatedDate: legacy.estimatedDate,
    totalSkills: skills.length,
    doneSkills,
    matchScore: legacy.matchScore,
  };
}

/** 创建新计划 */
export const createPlan = async (data: {
  planType: 'main' | 'side';
  direction?: string;
  planName?: string;
  skills?: string[];
  targetJobId?: number;
  dailyHours?: number;
  importFromPlanId?: number;
  domainId?: string;
  goalType?: LearningGoalType;
  goalTitle?: string;
  starterPathId?: string;
}) => {
  // 统一写入口：先写规范目标/路径，再按需物化自选能力节点。
  const canonical = await zhipathPlatformApi.createLearningGoal(
    {
      goalType: data.goalType || (data.planType === 'main' ? 'career' : 'project'),
      title: data.goalTitle || data.planName || data.direction || '自定义学习路径',
      domainKey: data.domainId || 'general',
      pathName: data.planName || data.goalTitle || data.direction,
      pathKind: data.planType || 'main',
      dailyMinutes: Math.round((data.dailyHours || 1) * 60),
      starterPathId: data.starterPathId,
    },
    createIdempotencyKey('zhipath-create'),
  );
  for (const [index, skill] of (data.skills || []).entries()) {
    await zhipathPlatformApi.createPathNode(
      canonical.path.id,
      {
        nodeKey: String(skill).trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || `skill-${index + 1}`,
        type: 'competency',
        title: String(skill).trim(),
        position: index,
        metadata: { estimatedMin: 120, source: 'custom-plan' },
      },
      createIdempotencyKey('zhipath-node'),
    );
  }
  return {
    code: 201,
    message: 'success',
    data: {
      id: 0,
      canonicalId: canonical.path.id,
      planName: data.planName || data.goalTitle || '自定义学习路径',
      planType: data.planType || 'main',
      domainId: data.domainId || 'general',
      goalType: data.goalType || 'project',
      goalTitle: data.goalTitle || data.planName || '自定义学习路径',
      totalSkills: (data.skills || []).length,
      todayTasks: [],
    },
  } as any;
};

/** 可用学习领域与起步路线 */
export const getLearningDomains = async () => {
  try {
    const data = await zhipathPlatformApi.listLearningDomains<LearningDomain>();
    return { code: 200, message: 'success', data } as ApiResponse<LearningDomain[]>;
  } catch (error) {
    if (!isLegacyFallbackError(error)) throw error;
    return client.get('/user/learning-domains') as Promise<ApiResponse<LearningDomain[]>>;
  }
};

/** Dashboard */
export const getDashboard = async () => {
  try {
    const [home, profile, paths, today] = await Promise.all([
      zhipathPlatformApi.home(),
      zhipathPlatformApi.request<any>('/v1/profile'),
      zhipathPlatformApi.listLearningPaths(1, 5),
      zhipathPlatformApi.request<any>('/v1/learning-tasks/today'),
    ]);
    const first = paths.items?.[0];
    let learningPath: any = first ? toLegacyLearningPath(first) : null;
    if (first?.id) {
      try { learningPath = toLegacyLearningPath(await zhipathPlatformApi.getLearningPath(first.id)); } catch { /* 使用列表快照 */ }
    }
    const dashboard = home.sections?.dashboard || {};
    const taskItems = [...(today.mainTasks || []), ...(today.sideTasks || [])];
    const data: DashboardData = {
      student: profile as any,
      target_job: null,
      plans: paths.items?.map(toLegacyLearningPathSummary) || [],
      learning_path: learningPath,
      stats: {
        total_skills: Number(dashboard.activePaths || 0),
        done_skills: Number(dashboard.completedToday || 0),
        exam_count: Number(home.sections?.assessment?.attemptCount || 0),
        job_count: Number(dashboard.pendingJobs || 0),
        total_learned_hours: 0,
        active_days: 0,
      },
      today_tasks: taskItems as any,
      recent_news: [],
    };
    return { code: 200, message: 'success', data } as ApiResponse<DashboardData>;
  } catch (error) {
    if (!isLegacyFallbackError(error)) throw error;
    return client.get('/user/dashboard') as Promise<ApiResponse<DashboardData>>;
  }
};

/** 用户画像 */
export const getProfile = async () => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<UserProfile>('/v1/profile') } as ApiResponse<UserProfile>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/profile') as Promise<ApiResponse<UserProfile>>; }
};

export const getProfileRadar = async () => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/profile/radar') } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/profile/radar') as Promise<ApiResponse<any>>; }
};

export const getProfileAbilityMetrics = async () => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/profile/ability-metrics') } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/profile/ability-metrics') as Promise<ApiResponse<any>>; }
};

/** 更新画像 */
export const updateProfile = async (data: Partial<UserProfile>) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/profile', { method: 'PUT', body: data }) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.put('/user/profile', data) as Promise<ApiResponse<any>>; }
};

/** 岗位列表 */
export const getJobs = async (params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  company?: string;
  location?: string;
  level?: string;
  searchMode?: 'local' | 'hybrid' | 'online';
  includeOnline?: boolean;
}) => {
  try {
    const result = await zhipathPlatformApi.request<any>('/v1/job-postings', { query: params });
    return { code: 200, message: 'success', data: result.items || [], total: result.pageInfo?.total, page: result.pageInfo?.page, pageSize: result.pageInfo?.pageSize, meta: result.meta } as PaginatedResponse<Job>;
  } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/jobs', { params }) as Promise<PaginatedResponse<Job>>; }
};

/** 岗位详情 */
export const getJobDetail = async (id: number) => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<Job>(`/v1/job-postings/${id}`) } as ApiResponse<Job>; } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get(`/user/jobs/${id}`) as Promise<ApiResponse<Job>>; } };

/** 获取 AI 公司简介与地理位置 */
export const getJobCompanyContext = async (id: number) => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/job-postings/${id}/company-context`) } as ApiResponse<any>; } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get(`/user/jobs/${id}/company-context`) as Promise<ApiResponse<{
    companyName: string;
    introduction: string;
    location: {
      query: string;
      formattedAddress: string;
      longitude: number | null;
      latitude: number | null;
      mapImage: string | null;
    };
  }>>; }
};

/** 岗位匹配分析 */
export const getJobMatch = async (id: number) => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/job-postings/${id}/match`) } as ApiResponse<any>; } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get(`/user/jobs/${id}/match`) as Promise<ApiResponse<any>>; } };

/** 岗位差距卡 — 匹配度 + Top3 缺口 + 推荐动作 + 预计影响（P0-1） */
export const getGapCard = async (jobId: number) => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<GapCard>(`/v1/job-postings/${jobId}/gap-card`) } as ApiResponse<GapCard>; } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get(`/user/jobs/${jobId}/gap-card`) as Promise<ApiResponse<GapCard>>; } };

/** 今日行动推荐 — 1 主任务 + 最多 2 辅助任务，含原因与预计影响（P0-2） */
export const getTodayActions = () =>
  client.get('/user/today-actions') as Promise<ApiResponse<TodayActions>>;

/** 技能证据链（P1-1）— 学习/测评/项目/简历证据 + 岗位影响 */
export const getSkillEvidence = async (skillName: string) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<SkillEvidence>(`/v1/me/skills/${encodeURIComponent(skillName)}/evidence`) } as ApiResponse<SkillEvidence>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get(`/user/skills/${encodeURIComponent(skillName)}/evidence`) as Promise<ApiResponse<SkillEvidence>>; }
};

/** 证据检索（Evidence RAG P0）— 个人证据语义/关键词召回 */
export const searchEvidence = async (params: { query?: string; skill?: string; sourceType?: string; limit?: number } = {}) => {
  try {
    const result = await zhipathPlatformApi.request<any>('/v1/evidence/search', {
      query: { q: params.query, limit: params.limit },
    });
    return { code: 200, message: 'success', data: result } as ApiResponse<any>;
  } catch {
    return client.get('/user/evidence/search', { params }) as Promise<ApiResponse<any>>;
  }
};

/** 证据索引状态汇总（Evidence RAG P0）— Projects 页展示索引状态 */
export const getEvidenceSummary = async () => {
  try {
    const result = await zhipathPlatformApi.listEvidence(1, 1);
    return { code: 200, message: 'success', data: { total: result.pageInfo.total || result.items.length } } as ApiResponse<any>;
  } catch {
    return client.get('/user/evidence/summary') as Promise<ApiResponse<any>>;
  }
};

/** 阶段成长报告（P2-2）— 7/30 天学习、技能、测评、匹配变化 */
export const getGrowthReport = (days: number = 30) =>
  client.get('/user/growth-report', { params: { days } }) as Promise<ApiResponse<any>>;

/** 申请岗位 */
export const applyJob = async (id: number) => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/job-postings/${id}/apply`, { method: 'POST', headers: { 'Idempotency-Key': createIdempotencyKey(`zhipath-job-apply-${id}`) } }) } as ApiResponse<any>; } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post(`/user/jobs/${id}/apply`) as Promise<ApiResponse<any>>; } };

/** 将岗位缺少技能导入学习计划 */
export const importJobSkills = async (id: number, target?: 'main' | 'side') => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/job-postings/${id}/import-skills`, { method: 'POST', body: { target }, headers: { 'Idempotency-Key': createIdempotencyKey(`zhipath-job-import-${id}`) } }) } as ApiResponse<any>; } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post(`/user/jobs/${id}/import-skills`, { target }) as Promise<ApiResponse<any>>; } };

/** 学习路径列表：规范 v1 读模型优先，旧数字 ID 仅在兼容期用于写操作。 */
export const getLearningPaths = async (params?: { page?: number; pageSize?: number }) => {
  try {
    const result = await zhipathPlatformApi.listLearningPaths(params?.page || 1, params?.pageSize || 20);
    return {
      code: 200,
      message: 'success',
      data: result.items.map(toLegacyLearningPath),
      total: result.pageInfo.total || result.items.length,
      page: result.pageInfo.page,
      pageSize: result.pageInfo.pageSize,
    } as PaginatedResponse<LearningPath>;
  } catch {
    // 兼容期允许尚未部署 v1 learning 路由的环境继续运行。
  }
  return client.get('/user/learning-paths', { params }) as Promise<PaginatedResponse<LearningPath>>;
};

function toLegacyLearningPath(item: any): LearningPath {
  const snapshot = item?.snapshot && typeof item.snapshot === 'object' ? item.snapshot : {};
  const phases = Array.isArray(snapshot.phases)
    ? snapshot.phases.map((phase: any, index: number) => ({
        ...phase,
        name: phase.name || phase.title || `阶段 ${index + 1}`,
        skills: Array.isArray(phase.skills)
          ? phase.skills.map((skill: any) =>
              typeof skill === 'string'
                ? { name: skill, status: phase.status === 'done' ? 'done' : 'pending' }
                : { ...skill, name: skill.name || skill.title || '未命名能力' },
            )
          : [],
      }))
    : [];
  return {
    id: Number(item.legacyPlanId || 0),
    userId: 0,
    planName: item.name,
    planType: item.pathKind === 'side' ? 'side' : 'main',
    targetJobId: null,
    domainId: item.domainKey || 'general',
    goalType: item.goalType || 'project',
    goalTitle: item.goalTitle || item.name,
    planStatus: item.status,
    scheduleEnabled: item.status === 'active' ? 1 : 0,
    currentPhase: Number(item.currentPhase || 0),
    matchScore: 0,
    estimatedDate: '',
    dailyHours: item.dailyMinutes ? Number(item.dailyMinutes) / 60 : 0,
    pathData: { ...snapshot, phases },
    status: 1,
    createTime: Date.parse(item.updatedAt || '') || Date.now(),
    canonicalId: item.id,
  } as LearningPath & { canonicalId?: string };
}

/** 学习路径详情；规范 UUID 走 v1，旧数字 ID 走兼容适配器。 */
export const getLearningPathDetail = async (id: number | string) => {
  if (typeof id === 'string') {
    try {
      const item = await zhipathPlatformApi.getLearningPath(id);
      return { code: 200, message: 'success', data: toLegacyLearningPath(item) } as ApiResponse<LearningPath>;
    } catch {
      // 兼容期允许页面继续展示历史路径。
    }
  }
  return client.get(`/user/learning-paths/${id}`) as Promise<ApiResponse<LearningPath>>;
};

export const addLearningPathSkill = async (id: number | string, data: { skillName: string; estimatedMin?: number }) => {
  if (typeof id === 'string') {
    const key = data.skillName.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || `skill-${Date.now()}`;
    await zhipathPlatformApi.createPathNode(
      id,
      { nodeKey: key, type: 'competency', title: data.skillName.trim(), position: Date.now() % 100000, metadata: { estimatedMin: data.estimatedMin || 120, source: 'custom-add' } },
      createIdempotencyKey('zhipath-node'),
    );
    return { code: 201, message: 'success', data: null } as any;
  }
  return client.post(`/user/learning-paths/${id}/skills`, data) as Promise<ApiResponse<LearningPath>>;
};

export const setLearningPathStatus = (id: number | string, planStatus: 'active' | 'paused' | 'archived') =>
  typeof id === 'string'
    ? zhipathPlatformApi.updateLearningPathStatus(id, planStatus, createIdempotencyKey('zhipath'))
    : client.patch(`/user/learning-paths/${id}/status`, { planStatus }) as Promise<ApiResponse<LearningPath>>;

export const mergeLearningPath = (id: number) =>
  client.post(`/user/learning-paths/${id}/merge`) as Promise<ApiResponse<any>>;

/** 知识库资源 */
export const getKnowledge = (skill: string) =>
  zhipathPlatformApi.request<any>(`/v1/knowledge/${encodeURIComponent(skill)}`)
    .then((data) => ({ code: 200, message: 'success', data }) as ApiResponse<any>)
    .catch((error) => { if (!isLegacyFallbackError(error)) throw error; return client.get(`/user/learning-paths/knowledge/${skill}`) as Promise<ApiResponse<any>>; });

/** 阅读完成 */
export const markRead = async (skill: string, pathId: number) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/progress/read', { method: 'POST', body: { skill, path_id: pathId }, headers: { 'Idempotency-Key': createIdempotencyKey('zhipath-progress-read') } }) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post('/user/progress/read', { skill, path_id: pathId }); }
};

/** 习题完成 */
export const submitQuiz = async (skill: string, total: number, correct: number, pathId: number) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/progress/quiz', { method: 'POST', body: { skill, total, correct, path_id: pathId }, headers: { 'Idempotency-Key': createIdempotencyKey('zhipath-progress-quiz') } }) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post('/user/progress/quiz', { skill, total, correct, path_id: pathId }); }
};

/** 技能完成 */
export const markComplete = async (skill: string, pathId: number) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/progress/complete', { method: 'POST', body: { skill, path_id: pathId }, headers: { 'Idempotency-Key': createIdempotencyKey('zhipath-progress-complete') } }) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post('/user/progress/complete', { skill, path_id: pathId }); }
};

/** 编程题完成 */
export const markCodeComplete = async (skill: string, pathId: number) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/progress/code', { method: 'POST', body: { skill, path_id: pathId }, headers: { 'Idempotency-Key': createIdempotencyKey('zhipath-progress-code') } }) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post('/user/progress/code', { skill, path_id: pathId }); }
};

/** 获取技能掌握度明细 */
export const getMasteryBreakdown = async (skill: string) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/progress/mastery/${encodeURIComponent(skill)}`) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get(`/user/progress/mastery/${encodeURIComponent(skill)}`) as Promise<ApiResponse<any>>; }
};

/** 进度汇总 */
export const getProgressSummary = async () => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<ProgressSummary>('/v1/progress/summary') } as ApiResponse<ProgressSummary>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/progress/summary') as Promise<ApiResponse<ProgressSummary>>; }
};

/** 规范技能读模型；旧 /user/skills 仅作兼容回退。 */
export const getMySkills = async () => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any[]>('/v1/me/skills') } as ApiResponse<any[]>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/skills') as Promise<ApiResponse<any[]>>; }
};

export const getMySkillStats = async () => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/me/skills/stats') } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/skills/stats') as Promise<ApiResponse<any>>; }
};

export const getGitBranches = async () => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<LearningBranch[]>('/v1/git/branches') } as ApiResponse<LearningBranch[]>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/git/branches') as Promise<ApiResponse<LearningBranch[]>>; }
};

export const createGitBranch = async (data: { branchName?: string; branchType?: 'main' | 'side' | 'experiment'; sourceBranchId?: number }) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<LearningBranch>('/v1/git/branches', { method: 'POST', body: data, headers: { 'Idempotency-Key': createIdempotencyKey('zhipath-git-branch') } }) } as ApiResponse<LearningBranch>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post('/user/git/branches', data) as Promise<ApiResponse<LearningBranch>>; }
};

export const getGitBranchLog = async (branchId: number, limit?: number) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<LearningCommit[]>(`/v1/git/branches/${branchId}/log`, { query: limit ? { limit } : {} }) } as ApiResponse<LearningCommit[]>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get(`/user/git/branches/${branchId}/log`, { params: limit ? { limit } : {} }) as Promise<ApiResponse<LearningCommit[]>>; }
};

export const commitGitBranch = async (branchId: number, data: any) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/git/branches/${branchId}/commit`, { method: 'POST', body: data, headers: { 'Idempotency-Key': createIdempotencyKey(`zhipath-git-commit-${branchId}`) } }) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post(`/user/git/branches/${branchId}/commit`, data) as Promise<ApiResponse<any>>; }
};

export const getGitCommit = async (commitId: number) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<{ commit: LearningCommit; snapshot: SkillSnapshot | null }>(`/v1/git/commits/${commitId}`) } as ApiResponse<{ commit: LearningCommit; snapshot: SkillSnapshot | null }>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get(`/user/git/commits/${commitId}`) as Promise<ApiResponse<{ commit: LearningCommit; snapshot: SkillSnapshot | null }>>; }
};

export const rollbackGitCommit = async (commitId: number) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/git/commits/${commitId}/rollback`, { method: 'POST', headers: { 'Idempotency-Key': createIdempotencyKey(`zhipath-git-rollback-${commitId}`) } }) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post(`/user/git/commits/${commitId}/rollback`) as Promise<ApiResponse<any>>; }
};

export const getGitSnapshots = async (params?: { branchId?: number; limit?: number }) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<SkillSnapshot[]>('/v1/git/snapshots', { query: params }) } as ApiResponse<SkillSnapshot[]>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/git/snapshots', { params }) as Promise<ApiResponse<SkillSnapshot[]>>; }
};

export const compareGitSnapshots = async (snapshotA: number, snapshotB: number) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<RadarComparison | null>('/v1/git/snapshots/compare', { query: { snapshotA, snapshotB } }) } as ApiResponse<RadarComparison | null>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/git/snapshots/compare', { params: { snapshotA, snapshotB } }) as Promise<ApiResponse<RadarComparison | null>>; }
};

export const compareGitBranches = async (source: number, target: number) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/git/branches/compare', { query: { source, target } }) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/git/branches/compare', { params: { source, target } }) as Promise<ApiResponse<any>>; }
};

export const mergeGitBranch = async (branchId: number, targetBranchId?: number) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/git/branches/${branchId}/merge`, { method: 'POST', body: { targetBranchId }, headers: { 'Idempotency-Key': createIdempotencyKey(`zhipath-git-merge-${branchId}`) } }) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post(`/user/git/branches/${branchId}/merge`, { targetBranchId }) as Promise<ApiResponse<any>>; }
};

export const getEvaluations = async (limit?: number) => {
  try {
    // The growth page renders the evaluation aggregate
    // `{ attempt, result, impact }`.  Assessment attempt summaries are a
    // different read model and must not be flattened into this contract.
    const result = await zhipathPlatformApi.request<EvaluationListItem[]>('/v1/evaluations', {
      query: { limit: limit || 20 },
    });
    return {
      code: 200,
      message: 'success',
      data: result,
    } as ApiResponse<EvaluationListItem[]>;
  } catch {
    return client.get('/user/evaluations', { params: limit ? { limit } : {} }) as Promise<ApiResponse<EvaluationListItem[]>>;
  }
};

export const getEvaluationDetail = async (attemptId: number) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/evaluations/${attemptId}`) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get(`/user/evaluations/${attemptId}`) as Promise<ApiResponse<any>>; }
};

/** 考试列表：优先读取规范 assessment_attempts，旧路由只作为历史兼容回退。 */
export const getExams = async (params?: { page?: number; pageSize?: number; exam_type?: number }) => {
  try {
    const result = await zhipathPlatformApi.listAssessmentAttempts(params?.page || 1, params?.pageSize || 20);
    const rows = result.items
      .map((item: any) => ({
        id: Number(item.legacyExamId || 0),
        canonicalAttemptId: item.id,
        definitionId: item.definitionId,
        userId: 0,
        examType: Number(item.definitionSettings?.legacyExamType || 1),
        skillName: item.competency || '',
        jobId: null,
        score: item.score == null ? 0 : Number(item.score),
        passed: item.passed == null ? 0 : Number(item.passed),
        answers: { skill: item.competency || '', questions: [] },
        retryCount: 0,
        createTime: Date.parse(item.completedAt || item.startedAt || '') || Date.now(),
      }))
      .filter((item: ExamRecord) => !params?.exam_type || item.examType === params.exam_type);
    return { code: 200, message: 'success', data: rows } as PaginatedResponse<ExamRecord>;
  } catch {
    return client.get('/user/exams', { params }) as Promise<PaginatedResponse<ExamRecord>>;
  }
};

/** 考试详情 */
export const getExamDetail = (id: number) =>
  client.get(`/user/exams/${id}`) as Promise<ApiResponse<ExamRecord>>;

/** 开始考试：优先通过规范兼容适配器创建 assessment_attempt。 */
export const startExam = async (id: number, count?: number) => {
  try {
    const started = await zhipathPlatformApi.startLegacyExam(id, { count }, createIdempotencyKey(`zhipath-exam-${id}`));
    const adapted = {
      examId: id,
      attemptId: started.id,
      examType: Number(started.definition?.settings?.legacyExamType || 1),
      skillName: started.definition?.title || null,
      questions: (started.items || []).map((item: any) => ({
        id: item.id,
        question: item.prompt,
        title: item.prompt,
        type: item.type,
        questionType: item.type,
        options: item.content?.options || [],
        content: item.content || {},
        difficulty: item.difficulty,
      })),
      timeLimitSec: Number(started.definition?.settings?.timeLimitSec || 0),
      startedAt: Date.now(),
    };
    sessionStorage.setItem(`zhpath_exam_attempt_${id}`, JSON.stringify({ attemptId: started.id }));
    return { code: 200, message: 'success', data: adapted } as ApiResponse<any>;
  } catch {
    return client.get(`/user/exams/${id}/take`, { params: count ? { count } : {} }) as Promise<ApiResponse<{
    examId: number;
    examType: number;
    skillName: string | null;
    questions: any[];
    timeLimitSec: number;
    startedAt: number;
  } | null>>;
  }
};

/** 提交考试（含每题用时，用于防作弊检测） */
export const submitExam = async (data: {
  examId?: number;
  exam_type: number;
  skill_name: string;
  answers: any;
  questionTimings?: Record<string, number>;
}) => {
  try {
    const cached = data.examId ? sessionStorage.getItem(`zhpath_exam_attempt_${data.examId}`) : null;
    const attemptId = cached ? JSON.parse(cached).attemptId : null;
    if (!attemptId) throw new Error('canonical attempt unavailable');
    const responses = Object.entries(data.answers || {}).map(([itemId, response]) => ({ itemId, response }));
    const result = await zhipathPlatformApi.submitAssessment(attemptId, responses, createIdempotencyKey(`zhipath-submit-${attemptId}`));
    sessionStorage.removeItem(`zhpath_exam_attempt_${data.examId}`);
    return {
      code: 200,
      message: 'success',
      data: {
        ...result,
        summary: { correctCount: result.correctCount, totalQuestions: result.totalCount },
        wrongAnalysis: { wrongQuestions: (result.responses || []).filter((r: any) => r.correct === false) },
      },
    } as ApiResponse<any>;
  } catch {
    return client.post('/user/exams/submit', data) as Promise<ApiResponse<any>>;
  }
};

export const reportExamQuestionFeedback = (
  examId: number,
  questionId: string | number,
  type: 'helpful' | 'complaint',
  reason?: string,
) =>
  client.post(`/user/exams/${examId}/questions/${encodeURIComponent(String(questionId))}/feedback`, { type, reason }) as Promise<ApiResponse<any>>;

/** 获取错题本 */
export const getWrongAnswers = (skillName?: string) =>
  client.get('/user/exams/wrong-answers', { params: skillName ? { skillName } : {} }) as Promise<ApiResponse<any>>;

/** 资讯列表 */
export const getNews = async (params?: { page?: number; pageSize?: number; type?: string }) => {
  try {
    const result = await zhipathPlatformApi.request<any>('/v1/news', { query: params });
    return {
      code: 200,
      message: 'success',
      data: result?.items || [],
      total: result?.pageInfo?.total || 0,
      page: result?.pageInfo?.page || params?.page || 1,
      pageSize: result?.pageInfo?.pageSize || params?.pageSize || 20,
    } as PaginatedResponse<NewsItem>;
  } catch {
    return client.get('/user/news', { params }) as Promise<PaginatedResponse<NewsItem>>;
  }
};

/** 刷新 AI 资讯 */
export const refreshNews = (keywords?: string) =>
  client.post('/user/news/refresh', undefined, { params: keywords ? { keywords } : {} }) as Promise<ApiResponse<any>>;

/** 资讯详情 */
export const getNewsDetail = async (id: number) => {
  try {
    return { code: 200, message: 'success', data: await zhipathPlatformApi.request<NewsItem>(`/v1/news/${id}`) } as ApiResponse<NewsItem>;
  } catch {
    return client.get(`/user/news/${id}`) as Promise<ApiResponse<NewsItem>>;
  }
};

/** 知识图谱 */
export const getGraph = (params?: { skill?: string; job_id?: number; limit?: number }) =>
  client.get('/user/graph', { params }) as Promise<ApiResponse<any>>;

/** AI 对话 */
export const sendChat = async (message: string, sessionId?: string, pageContext?: string) => {
  try {
    const result = await zhipathPlatformApi.request<any>('/v1/chat', { method: 'POST', body: { message, sessionId, pageContext }, timeoutMs: 180_000 });
    return { code: 200, message: 'success', data: snakeToCamel<ChatReply>(result) } as ApiResponse<ChatReply>;
  } catch {
    const res: ApiResponse<any> = await client.post('/user/chat', { message, session_id: sessionId, page_context: pageContext });
    return { ...res, data: snakeToCamel<ChatReply>(res.data) } as ApiResponse<ChatReply>;
  }
};

/** 对话历史列表 */
export const getChatSessions = async (params?: { page?: number; pageSize?: number }) => {
  try {
    const result = await zhipathPlatformApi.request<any>('/v1/chat/sessions', { query: params });
    const items = result?.items || [];
    return { code: 200, message: 'success', data: items.map((s: any) => snakeToCamel<ChatSession>(s)), total: result?.pageInfo?.total, page: result?.pageInfo?.page, pageSize: result?.pageInfo?.pageSize } as PaginatedResponse<ChatSession>;
  } catch {
    const res: PaginatedResponse<any> = await client.get('/user/chat-sessions', { params });
    return { ...res, data: res.data.map(snakeToCamel<ChatSession>) } as PaginatedResponse<ChatSession>;
  }
};

/** 对话详情 */
export const getChatSession = async (sessionId: string) => {
  try {
    const result = await zhipathPlatformApi.request<any>(`/v1/chat/sessions/${encodeURIComponent(sessionId)}`);
    return { code: 200, message: 'success', data: result ? snakeToCamel<ChatSession>(result) : null } as ApiResponse<ChatSession>;
  } catch {
    const res: ApiResponse<any> = await client.get(`/user/chat-sessions/${sessionId}`);
    return { ...res, data: snakeToCamel<ChatSession>(res.data) } as ApiResponse<ChatSession>;
  }
};

/** 删除对话 */
export const deleteChatSession = async (sessionId: string) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/chat/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }) }; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.delete(`/user/chat-sessions/${sessionId}`); }
};

export const getGeneratedResources = async (params?: {
  chatSessionId?: string;
  source?: string;
  resourceType?: string;
  status?: string;
  limit?: number;
}) => {
  try {
    const canonical = await zhipathPlatformApi.listResources(1, Math.min(100, Math.max(1, Number(params?.limit || 100))), params?.resourceType, params?.source);
    const canonicalItems: GeneratedResource[] = canonical.items.map((artifact: any) => ({
        id: artifact.id,
        userId: undefined,
        resourceType: artifact.type,
        title: artifact.title,
        source: artifact.source || 'queue',
        resourceStatus: artifact.status === 'completed' ? 'success' : artifact.status,
        skillName: artifact.skillName || undefined,
        chatSessionId: artifact.chatSessionId || undefined,
        payload: artifact.content,
        previewMeta: artifact.provenance?.previewMeta || null,
        errorMessage: artifact.errorMessage || undefined,
        createTime: Date.parse(artifact.createdAt),
        updateTime: Date.parse(artifact.updatedAt),
      }));
    return { data: canonicalItems } as ApiResponse<GeneratedResource[]>;
  } catch {
    const legacy = await client.get('/user/generated-resources', { params }) as ApiResponse<any[]>;
    return { ...legacy, data: (legacy.data || []).map(normalizeGeneratedResource) } as ApiResponse<GeneratedResource[]>;
  }
};

function normalizeGeneratedResource(raw: any): GeneratedResource {
  const normalized = snakeToCamel<any>(raw || {});
  return {
    ...normalized,
    payload: raw?.payload ?? normalized.payload,
    rawRequest: raw?.raw_request ?? raw?.rawRequest ?? normalized.rawRequest,
    rawResponse: raw?.raw_response ?? raw?.rawResponse ?? normalized.rawResponse,
    previewMeta: raw?.preview_meta ? snakeToCamel(raw.preview_meta) : normalized.previewMeta,
  } as GeneratedResource;
}

export const setGeneratedResourceFeedback = async (id: number | string, useful: boolean) => {
  if (typeof id === 'string') {
    const artifact = await zhipathPlatformApi.feedbackResource(id, useful);
    return {
      code: 200,
      message: 'success',
      data: {
        id: artifact.id,
        userId: undefined,
        resourceType: artifact.type,
        title: artifact.title,
        source: artifact.source || 'queue',
        resourceStatus: artifact.status === 'completed' ? 'success' : artifact.status,
        payload: artifact.content,
        previewMeta: artifact.feedbackUseful === null || artifact.feedbackUseful === undefined
          ? artifact.provenance?.previewMeta || null
          : { ...(artifact.provenance?.previewMeta as any || {}), feedbackUseful: artifact.feedbackUseful },
      } as GeneratedResource,
    } as ApiResponse<GeneratedResource>;
  }
  return client.post(`/user/generated-resources/${id}/feedback`, { useful }) as Promise<ApiResponse<GeneratedResource | null>>;
};

/** 保存项目经历 */
export const saveProject = (data: any) =>
  client.post('/user/projects/save', data);

/** 异步任务状态 */
export const getTaskStatus = (taskId: string) =>
  client.get(`/user/tasks/${taskId}`) as Promise<ApiResponse<any>>;

/** 视频生成任务进度：优先读取规范 durable job，旧内存任务仅作兼容回退。 */
export const getVideoTaskStatus = async (taskId: string) => {
  try {
    const job = await zhipathPlatformApi.getJob(String(taskId));
    const status = String(job.status);
    const mapped = status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : status === 'cancelled' ? 'failed' : 'pending';
    return {
      code: 200,
      message: 'success',
      data: {
        status: mapped,
        progress: Number(job.progress || 0),
        message: mapped === 'completed' ? '视频生成完成' : mapped === 'failed' ? ((job.error as any)?.message || '视频生成失败') : '视频生成中…',
        result: job.result,
        error: job.error,
        taskId,
      },
    } as ApiResponse<any>;
  } catch (error) {
    if (!isLegacyFallbackError(error)) throw error;
    return client.get(`/user/video-task/${taskId}`) as Promise<ApiResponse<any>>;
  }
};

/** 直接触发视频生成（跳过 IntentRouter）；有 assets 时走素材展示视频，否则走教学视频 */
export const createVideoTask = async (data: {
  skillName?: string;
  difficulty?: string;
  assets?: string;
  projectName?: string;
  prompt?: string;
  targetDurationSec?: number;
  voice?: string;
  visualStyle?: string;
  llmProvider?: string;
}) => {
  try {
    const queued = await zhipathPlatformApi.createJob(
      { jobType: 'resource.video', payload: data },
      createIdempotencyKey('zhipath-video-task'),
    );
    return {
      code: 202,
      message: '视频任务已提交',
      data: {
        type: 'video_pending',
        data: {
          taskId: queued.id,
          skillName: data.skillName || data.projectName || '',
          projectName: data.projectName,
          showcase: Boolean(data.assets),
          message: '视频任务已进入统一作业队列，可在任务中心查看进度',
        },
      },
    } as ApiResponse<any>;
  } catch (error) {
    if (!isLegacyFallbackError(error)) throw error;
    return client.post('/user/video-task', data) as Promise<ApiResponse<any>>;
  }
};

// ── 技能相关 API ──────────────────────────────────

/** 获取用户所有技能 */
export const getSkills = async () => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any[]>('/v1/me/skills') } as ApiResponse<any[]>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/skills') as Promise<ApiResponse<any[]>>; }
};

/** 获取用户技能统计 */
export const getSkillStats = async () => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<{ total: number; bySource: Record<string, number>; avgMastery: number }>('/v1/me/skills/stats') } as ApiResponse<{ total: number; bySource: Record<string, number>; avgMastery: number }>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/skills/stats') as Promise<ApiResponse<{ total: number; bySource: Record<string, number>; avgMastery: number }>>; }
};

/** 获取加权后的有效技能 */
export const getEffectiveSkills = async () => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any[]>('/v1/me/skills/effective') } as ApiResponse<any[]>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/skills/effective') as Promise<ApiResponse<any[]>>; }
};

/** 添加技能 */
export const addSkill = (data: { name: string; source?: string; trustWeight?: number; planId?: number }) =>
  client.post('/user/skills', data) as Promise<ApiResponse<any>>;

/** 更新技能掌握度 */
export const updateSkillMastery = (skillName: string, data: { delta?: number; masteryPct?: number }) =>
  client.post(`/user/skills/${encodeURIComponent(skillName)}/mastery`, data) as Promise<ApiResponse<any>>;

/** 从 students_v3.skills 迁移到 user_skills_v3 */
export const syncSkillsFromStudent = () =>
  client.post('/user/skills/sync') as Promise<ApiResponse<{ migrated: number }>>;

// ── 匹配度相关 API ──────────────────────────────────

/** 计算用户与岗位的匹配度（§7 分场景 6 因子） */
export const calculateMatch = async (jobId: number) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/match/${jobId}`) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get(`/user/match/${jobId}`) as Promise<ApiResponse<{
    totalScore: number;
    scenario: 'campus' | 'social';
    weights: {
      requiredSkills: number; preferredSkills: number; projects: number;
      exams: number; learningProgress: number; learningSpeed: number;
    };
    breakdown: any;
    gapAnalysis: Array<{ skill: string; type: 'required' | 'preferred'; currentMastery: number }>;
    canApply: boolean;
    deliveryThreshold: number;
    requirement: {
      level: string; coverageNeeded: number; coverageActual: number;
      extraConditionMet: boolean; extraConditionLabel: string; reason: string;
    };
  }>>; }
};

/** 计算用户与所有岗位的匹配度 */
export const calculateMatchAll = async () => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any[]>('/v1/match/all') } as ApiResponse<any[]>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/match-all') as Promise<ApiResponse<any[]>>; }
};

/** 技能变化后重新计算匹配度 */
export const recalculateMatch = async () => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/match/recalculate', { method: 'POST' }) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post('/user/match/recalculate') as Promise<ApiResponse<any>>; }
};

/** 获取用户最佳匹配岗位（Dashboard 用） */
export const getBestMatch = async () => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/match/best') } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/match/best') as Promise<ApiResponse<any>>; }
};

/** 获取匹配度趋势 */
export const getMatchTrend = async (jobId: number, days?: number) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/match/${jobId}/trend`, { query: days ? { days } : {} }) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get(`/user/match/trend/${jobId}`, { params: days ? { days } : {} }) as Promise<ApiResponse<any>>; }
};

// ── 学习任务相关 API ──────────────────────────────────

/** 获取今日学习任务 */
export const getTodayTasks = async (planId?: number) => {
  try {
    const result = await zhipathPlatformApi.request<any>('/v1/learning-tasks/today', {
      query: planId ? { planId } : {},
    });
    return { code: 200, message: 'success', data: result } as any;
  } catch (error) {
    if (!isLegacyFallbackError(error)) throw error;
    try {
      // 兼容极旧后端：规范任务投影不存在时再读取活动列表。
      const activities = await zhipathPlatformApi.listLearningActivities(1, 100);
      const mapped = activities.items
        .filter((item: any) => !planId || Number(item.legacyPlanId) === planId)
        .map((item: any) => ({ id: Number(item.legacyTaskId || 0), canonicalId: item.id, title: item.title, skillName: item.title, taskType: item.type, status: item.status === 'completed' ? 'done' : item.status, taskStatus: item.status === 'completed' ? 'done' : item.status, estimatedMin: item.estimatedMinutes || 30, planId: Number(item.legacyPlanId || 0) }));
      const mainTasks = mapped.filter((task: any) => activities.items.find((item: any) => item.id === task.canonicalId)?.pathKind !== 'side');
      const sideTasks = mapped.filter((task: any) => !mainTasks.includes(task));
      return { code: 200, message: 'success', data: { planId: planId || 0, planName: '', mainTasks, sideTasks, totalEstimatedMin: mapped.reduce((sum: number, task: any) => sum + Number(task.estimatedMin || 0), 0), completedMin: mapped.filter((task: any) => task.status === 'done').reduce((sum: number, task: any) => sum + Number(task.estimatedMin || 0), 0), progressPct: mapped.length ? Math.round(mapped.filter((task: any) => task.status === 'done').length / mapped.length * 100) : 0 } } as any;
    } catch (fallbackError) {
      if (!isLegacyFallbackError(fallbackError)) throw fallbackError;
      return client.get('/user/learning-tasks/today', { params: planId ? { planId } : {} }) as Promise<ApiResponse<{
    planId: number;
    planName: string;
    mainTasks: any[];
    sideTasks: any[];
    totalEstimatedMin: number;
    completedMin: number;
    progressPct: number;
      }>>;
    }
  }
};

/** 更新学习任务状态 */
export const updateTaskStatus = (taskId: number | string, status: string) =>
  typeof taskId === 'string'
    ? zhipathPlatformApi.updateLearningActivityStatus(taskId, { status: status === 'done' ? 'completed' : status }, createIdempotencyKey('zhipath-activity')) as any
    : client.post(`/user/learning-tasks/${taskId}/status`, { status }) as Promise<ApiResponse<any>>;

/** 调整学习速度 */
export const adjustLearningSpeed = async (planId: number) => {
  try {
    const result = await zhipathPlatformApi.request<{ adjusted: boolean; changes: string[] }>('/v1/learning-tasks/adjust-speed', {
      method: 'POST',
      body: { planId },
      headers: { 'Idempotency-Key': createIdempotencyKey(`zhipath-adjust-speed-${planId}`) },
    });
    return { code: 200, message: 'success', data: result } as ApiResponse<{ adjusted: boolean; changes: string[] }>;
  } catch (error) {
    if (!isLegacyFallbackError(error)) throw error;
    return client.post('/user/learning-tasks/adjust-speed', { planId }) as Promise<ApiResponse<{ adjusted: boolean; changes: string[] }>>;
  }
};

// ── 5 个 Agent API ──────────────────────────────────

async function runPlatformAgent(data: { jobType: string; payload: Record<string, unknown> }, timeoutMs = 240_000) {
  const queued = await zhipathPlatformApi.createJob(data, createIdempotencyKey(`zhipath-${data.jobType}`));
  const finished = await zhipathPlatformApi.waitForJob(queued.id, { timeoutMs });
  if (finished.status !== 'completed') throw new Error((finished.error as any)?.message || '智能体作业执行失败');
  return { code: 200, message: 'success', data: finished.result } as ApiResponse<any>;
}

async function runPlatformResource(data: { resourceType: string; payload: Record<string, unknown> }, timeoutMs = 240_000) {
  const queued = await zhipathPlatformApi.createJob({ jobType: `resource.${data.resourceType}`, payload: data.payload }, createIdempotencyKey(`zhipath-resource-${data.resourceType}`));
  const finished = await zhipathPlatformApi.waitForJob(queued.id, { timeoutMs });
  if (finished.status !== 'completed') throw new Error((finished.error as any)?.message || '资源作业执行失败');
  return { code: 200, message: 'success', data: finished.result } as ApiResponse<any>;
}

/** Agent 生成统一走 /api/v1/jobs，旧同步接口仅作兼容回退。 */
export const generateLecture = async (data: { skillName: string; level?: string; extra?: string }) => {
  try { return await runPlatformAgent({ jobType: 'agent.lecture', payload: data }); }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post('/user/agents/lecture', data) as Promise<ApiResponse<any>>; }
};

export const generateReading = async (data: { skillName: string; count?: number; focus?: string }) => {
  try { return await runPlatformAgent({ jobType: 'agent.reading', payload: data }); }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post('/user/agents/reading', data) as Promise<ApiResponse<any>>; }
};

export const generateCode = async (data: { skillName: string; language?: string; count?: number }) => {
  try { return await runPlatformAgent({ jobType: 'agent.code', payload: data }); }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post('/user/agents/code', data) as Promise<ApiResponse<any>>; }
};

export const generateLearningPath = async (data: { goal: string; currentLevel?: string; availableTime?: string; preferences?: string }) => {
  try { return await runPlatformAgent({ jobType: 'agent.path', payload: data }); }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post('/user/agents/path', data) as Promise<ApiResponse<any>>; }
};

export const assessLearning = async (data: { learningData: string; goal?: string; currentProgress?: string; skillName?: string }) => {
  try { return await runPlatformAgent({ jobType: 'agent.assess', payload: data }); }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post('/user/agents/assess', data) as Promise<ApiResponse<any>>; }
};

// ── 多模态智能体 API (T5) ──────────────────────────────────

/** 生成 HTML 动画演示 */
export const generateAnimation = (data: { skillName: string; difficulty?: string }) =>
  runPlatformResource({ resourceType: 'animation', payload: data }).catch((error) => {
    if (!isLegacyFallbackError(error)) throw error;
    return client.post('/user/multimodal/animation', data) as Promise<ApiResponse<any>>;
  });

/** 生成 Mermaid 图表 */
export const generateDiagram = (data: { skillName: string; diagramType?: string }) =>
  runPlatformResource({ resourceType: 'diagram', payload: data }).catch((error) => {
    if (!isLegacyFallbackError(error)) throw error;
    return client.post('/user/multimodal/diagram', data) as Promise<ApiResponse<any>>;
  });

/** 生成短视频（智谱 AI） */
export const generateVideo = (data: { skillName: string }) =>
  runPlatformResource({ resourceType: 'video', payload: data }, 240_000).catch((error) => {
    if (!isLegacyFallbackError(error)) throw error;
    return client.post('/user/multimodal/video', data) as Promise<ApiResponse<any>>;
  });

/** 生成数字人讲解（讯飞） */
export const generateAvatar = (data: { skillName: string }) =>
  runPlatformResource({ resourceType: 'avatar', payload: data }).catch((error) => {
    if (!isLegacyFallbackError(error)) throw error;
    return client.post('/user/multimodal/avatar', data) as Promise<ApiResponse<any>>;
  });

/** 创建数字人会话（独立端点） */
export const createAvatarSession = (data?: { voiceId?: string }) =>
  client.post('/user/multimodal/avatar/session', data || {}) as Promise<ApiResponse<{
    sessionId: string;
    streamUrl: string;
    token: string;
    roomId: string;
    userId: string;
  }>>;

/** 向数字人会话发送文本驱动生成 */
export const avatarSpeak = (data: { sessionId: string; text: string }) =>
  client.post('/user/multimodal/avatar/speak', data) as Promise<ApiResponse<{ ok: boolean }>>;

/** 关闭数字人会话 */
export const closeAvatarSession = (sessionId: string) =>
  client.delete(`/user/multimodal/avatar/session/${sessionId}`) as Promise<ApiResponse<{ ok: boolean }>>;

/** 聚合查询某技能已有的全部多模态资源 */
export const getMultimodal = async (skill: string) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/multimodal/${encodeURIComponent(skill)}`) } as ApiResponse<any>; }
  catch { return client.get(`/user/multimodal/${encodeURIComponent(skill)}`) as Promise<ApiResponse<{
    skill: string;
    animation: any | null;
    diagram: any | null;
    video: any | null;
    avatar: any | null;
}>>; }
};

// ── 学习会话 API ──────────────────────────────────

/** 开始学习会话 */
export const startSession = async (planId?: number) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/sessions/start', { method: 'POST', body: { planId } }) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post('/user/sessions/start', { planId }) as Promise<ApiResponse<any>>; }
};

/** 结束学习会话 */
export const endSession = async (sessionId: number) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/sessions/${sessionId}/end`, { method: 'POST' }) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post(`/user/sessions/${sessionId}/end`) as Promise<ApiResponse<any>>; }
};

/** 获取学习历史 */
export const getSessionHistory = async (page?: number, pageSize?: number) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/sessions/history', { query: { page, pageSize } }) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/sessions/history', { params: { page, pageSize } }) as Promise<ApiResponse<any>>; }
};

/** 获取学习统计 */
export const getSessionStats = async () => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/sessions/stats') } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/sessions/stats') as Promise<ApiResponse<any>>; }
};

/** 对比两个日期的技能变化 */
export const diffSessions = async (dateA: string, dateB: string) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/sessions/diff', { query: { dateA, dateB } }) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/sessions/diff', { params: { dateA, dateB } }) as Promise<ApiResponse<any>>; }
};

/** 回退到目标日期 */
export const rollbackSession = async (targetDate: string) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/sessions/rollback', { method: 'POST', body: { targetDate } }) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post('/user/sessions/rollback', { targetDate }) as Promise<ApiResponse<any>>; }
};

/** 记录学习进度到会话 */
export const recordSessionProgress = async (sessionId: number, data: { taskId: number; skillName: string; masteryBefore: number; masteryAfter: number }) => {
  try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/sessions/${sessionId}/progress`, { method: 'POST', body: data }) } as ApiResponse<any>; }
  catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post(`/user/sessions/${sessionId}/progress`, data) as Promise<ApiResponse<any>>; }
};

// ── 通知 API ──────────────────────────────────

/** 获取未读通知数 */
export const getUnreadCount = async () => {
  try {
    return { code: 200, message: 'success', data: await zhipathPlatformApi.request<{ count: number }>('/v1/notifications/unread-count') } as ApiResponse<{ count: number }>;
  } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/notifications/unread-count') as Promise<ApiResponse<{ count: number }>>; }
};

/** 获取未读通知列表 */
export const getUnreadNotifications = async (limit?: number) => {
  try {
    const result = await zhipathPlatformApi.request<{ items: any[] }>('/v1/notifications/unread', { query: { limit } });
    return { code: 200, message: 'success', data: result.items || [] } as ApiResponse<any[]>;
  } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/notifications/unread', { params: { limit } }) as Promise<ApiResponse<any[]>>; }
};

/** 获取所有通知 */
export const getNotifications = async (page?: number, pageSize?: number) => {
  try {
    const result = await zhipathPlatformApi.request<any>('/v1/notifications', { query: { page, pageSize } });
    return { code: 200, message: 'success', data: result } as ApiResponse<any>;
  } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.get('/user/notifications', { params: { page, pageSize } }) as Promise<ApiResponse<any>>; }
};

/** 标记通知为已读 */
export const markNotificationRead = async (id: number) => {
  try {
    return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/notifications/${id}/read`, { method: 'POST', headers: { 'Idempotency-Key': createIdempotencyKey(`zhipath-notification-read-${id}`) } }) } as ApiResponse<any>;
  } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post(`/user/notifications/${id}/read`) as Promise<ApiResponse<any>>; }
};

/** 标记所有通知为已读 */
export const markAllNotificationsRead = async () => {
  try {
    return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/notifications/read-all', { method: 'POST', headers: { 'Idempotency-Key': createIdempotencyKey('zhipath-notifications-read-all') } }) } as ApiResponse<any>;
  } catch (error) { if (!isLegacyFallbackError(error)) throw error; return client.post('/user/notifications/read-all') as Promise<ApiResponse<any>>; }
};

// ── 简历 API ──────────────────────────────────

/** 获取用户所有简历 */
export const getResumes = async () => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any[]>('/v1/resumes') } as ApiResponse<any[]>; } catch { return client.get('/user/resumes') as Promise<ApiResponse<any[]>>; } };

/** 获取简历详情 */
export const getResume = async (id: number) => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/resumes/${id}`) } as ApiResponse<any>; } catch { return client.get(`/user/resumes/${id}`) as Promise<ApiResponse<any>>; } };

/** 生成简历 */
export const generateResume = async (targetJobId?: number) => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>('/v1/resumes/generate', { method: 'POST', body: { targetJobId } }) } as ApiResponse<any>; } catch { return client.post('/user/resumes/generate', { targetJobId }) as Promise<ApiResponse<any>>; } };

/** 更新简历 */
export const updateResume = async (id: number, data: { content?: any; htmlContent?: string }) => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/resumes/${id}`, { method: 'PUT', body: data }) } as ApiResponse<any>; } catch { return client.post(`/user/resumes/${id}/update`, data) as Promise<ApiResponse<any>>; } };

/** 从基础简历创建岗位版本 */
export const branchResume = async (id: number, targetJobId: number) => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/resumes/${id}/branch`, { method: 'POST', body: { targetJobId } }) } as ApiResponse<any>; } catch { return client.post(`/user/resumes/${id}/branch`, { targetJobId }) as Promise<ApiResponse<any>>; } };

/** 删除简历 */
export const deleteResume = async (id: number) => { try { return { code: 200, message: 'success', data: await zhipathPlatformApi.request<any>(`/v1/resumes/${id}`, { method: 'DELETE' }) } as ApiResponse<any>; } catch { return client.post(`/user/resumes/${id}/delete`) as Promise<ApiResponse<any>>; } };

/** 导出简历 PDF（返回 Blob URL） */
export const exportResumePdf = async (id: number): Promise<string> => {
  let response: any;
  try {
    response = await zhipathPlatformApi.request<Blob>(`/v1/resumes/${id}/pdf`, { responseType: 'blob' });
  } catch {
    response = await client.get(`/user/resumes/${id}/pdf`, { responseType: 'blob' });
  }
  const blob = response instanceof Blob ? response : new Blob([response?.data || response as BlobPart], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
};

// ── 智能体办公室 API ──────────────────────────────────

/** 获取 Agent 办公室统计 */
export const getAgentOfficeStats = () =>
  zhipathPlatformApi.listJobs(1, 100).then((page) => ({ code: 200, message: 'success', data: {
    total: page.items.length,
    pending: page.items.filter((x) => ['queued', 'running'].includes(x.status)).length,
    completed: page.items.filter((x) => x.status === 'completed').length,
    failed: page.items.filter((x) => x.status === 'failed').length,
  } })).catch(() => client.get('/user/agent-office/stats')) as Promise<ApiResponse<any>>;

/** 获取可用 Agent 类型 */
export const getAgentTypes = () =>
  client.get('/user/agent-office/agent-types') as Promise<ApiResponse<Record<string, { label: string; defaultRole: string }>>>;

/** 获取 Agent 任务队列 */
export const getAgentOfficeTasks = (status?: string) =>
  zhipathPlatformApi.listJobs(1, 100).then((page) => ({ code: 200, message: 'success', data: page.items.filter((x) => !status || x.status === status).map((x) => ({ id: x.id, agentType: x.type, title: x.type, taskStatus: x.status, progress: x.progress, result: x.result, errorMessage: (x.error as any)?.message })) })).catch(() => client.get('/user/agent-office/tasks', { params: status ? { status } : {} })) as Promise<ApiResponse<any[]>>;

/** 获取 Agent 任务详情 */
export const getAgentOfficeTask = (taskId: number) =>
  zhipathPlatformApi.getJob(String(taskId)).then((x) => ({ code: 200, message: 'success', data: { id: x.id, agentType: x.type, title: x.type, taskStatus: x.status, progress: x.progress, result: x.result, errorMessage: (x.error as any)?.message } })).catch(() => client.get(`/user/agent-office/tasks/${taskId}`)) as Promise<ApiResponse<any>>;

/** 创建 Agent 任务（派发模式） */
export const createAgentOfficeTask = (data: { agentType: string; title: string; params?: Record<string, any>; description?: string }) =>
  zhipathPlatformApi.createJob({ jobType: data.agentType.startsWith('agent.') ? data.agentType : `agent.${data.agentType}`, payload: { ...(data.params || {}), title: data.title, description: data.description } }, createIdempotencyKey('zhipath-office-create')).then((x) => ({ code: 202, message: 'accepted', data: x })).catch(() => client.post('/user/agent-office/tasks', data)) as Promise<ApiResponse<any>>;

/** 标记任务紧急 */
export const markAgentTaskUrgent = (taskId: number) =>
  zhipathPlatformApi.markJobUrgent(String(taskId), createIdempotencyKey('zhipath-office-urgent')).then((x) => ({ code: 200, message: 'success', data: x })).catch(() => client.post(`/user/agent-office/tasks/${taskId}/urgent`)) as Promise<ApiResponse<any>>;

/** 跳过任务 */
export const skipAgentTask = (taskId: number) =>
  zhipathPlatformApi.skipJob(String(taskId), createIdempotencyKey('zhipath-office-skip')).then((x) => ({ code: 200, message: 'success', data: x })).catch(() => client.post(`/user/agent-office/tasks/${taskId}/skip`)) as Promise<ApiResponse<any>>;

/** 批量重排任务顺序 */
export const reorderAgentTasks = (taskIds: number[]) =>
  zhipathPlatformApi.reorderJobs(taskIds.map(String), createIdempotencyKey('zhipath-office-reorder')).then((x) => ({ code: 200, message: 'success', data: x })).catch(() => client.post('/user/agent-office/tasks/reorder', { taskIds })) as Promise<ApiResponse<any>>;

/** 取消任务 */
export const cancelAgentTask = (taskId: number) =>
  zhipathPlatformApi.cancelJob(String(taskId), createIdempotencyKey('zhipath-office-cancel')).then((x) => ({ code: 200, message: 'success', data: x })).catch(() => client.post(`/user/agent-office/tasks/${taskId}/cancel`)) as Promise<ApiResponse<any>>;

/** 重试任务 */
export const retryAgentTask = (taskId: number) =>
  zhipathPlatformApi.retryJob(String(taskId), createIdempotencyKey('zhipath-office-retry')).then((x) => ({ code: 200, message: 'success', data: x })).catch(() => client.post(`/user/agent-office/tasks/${taskId}/retry`)) as Promise<ApiResponse<any>>;

/** 删除任务 */
export const deleteAgentTask = (taskId: number) =>
  zhipathPlatformApi.deleteJob(String(taskId), createIdempotencyKey('zhipath-office-delete')).then((x) => ({ code: 200, message: 'success', data: x })).catch(() => client.post(`/user/agent-office/tasks/${taskId}/delete`)) as Promise<ApiResponse<any>>;

/** 获取最近完成的任务 */
export const getAgentOfficeHistory = (limit?: number) =>
  client.get('/user/agent-office/history', { params: limit ? { limit } : {} }) as Promise<ApiResponse<any[]>>;

/** 获取所有员工配置 */
export const getAgentProfiles = () =>
  client.get('/user/agent-office/profiles') as Promise<ApiResponse<any[]>>;

/** 招聘新员工 */
export const hireAgent = (data: { agentType: string; animalType: string; color: string; nickname: string; displayRole: string }) =>
  client.post('/user/agent-office/profiles', data) as Promise<ApiResponse<any>>;

/** 更新员工配置 */
export const updateAgentProfile = (profileId: number, data: { animalType?: string; color?: string; nickname?: string; displayRole?: string }) =>
  client.put(`/user/agent-office/profiles/${profileId}`, data) as Promise<ApiResponse<any>>;

/** 解雇员工 */
export const fireAgent = (profileId: number) =>
  client.delete(`/user/agent-office/profiles/${profileId}`) as Promise<ApiResponse<any>>;

/** 分配/移除工位 */
export const assignAgentStation = (profileId: number, stationId: number | null) =>
  client.post(`/user/agent-office/profiles/${profileId}/station`, { stationId }) as Promise<ApiResponse<any>>;

/** 直接使用员工执行任务 */
export const directUseAgent = (profileId: number, prompt: string, params?: Record<string, any>) =>
  client.post(`/user/agent-office/profiles/${profileId}/use`, { prompt, params }) as Promise<ApiResponse<any>>;

// ── 资讯增强 API ──────────────────────────────────

/** 个性化推荐资讯 */
export const getNewsRecommend = (limit?: number) =>
  client.get('/user/news/recommend', { params: limit ? { limit } : {} }) as Promise<ApiResponse<any[]>>;

/** 获取技术趋势 */
export const getTechTrends = (direction?: string) =>
  client.get('/user/news/trends', { params: direction ? { direction } : {} }) as Promise<ApiResponse<any>>;

// ── 5分钟速测 API ──────────────────────────────────

/** 获取速测题目 */
export const getQuickTestQuestions = async (direction?: string) => {
  try {
    const result = await zhipathPlatformApi.request<{ questions: any[]; skillName: string }>('/v1/assessments/quick-test', {
      query: { direction },
    });
    return { code: 200, message: 'success', data: result } as ApiResponse<{ questions: any[]; skillName: string }>;
  } catch {
    return client.get('/user/quick-test', { params: direction ? { direction } : {} }) as Promise<ApiResponse<{ questions: any[]; skillName: string }>>;
  }
};

/** 提交速测答案 */
export const submitQuickTest = async (data: { skillName: string; answers: Record<string, any>; questions: any[] }) => {
  try {
    const result = await zhipathPlatformApi.request<any>('/v1/assessments/quick-test/submit', {
      method: 'POST',
      body: data,
      headers: { 'Idempotency-Key': createIdempotencyKey('zhipath-quick-test') },
      timeoutMs: 120_000,
    });
    return { code: 200, message: 'success', data: result } as ApiResponse<any>;
  } catch {
    return client.post('/user/quick-test/submit', data) as Promise<ApiResponse<any>>;
  }
};

// ── 考试重试 ──────────────────────────────
export const getRetryableExams = () =>
  client.get('/user/exams/retryable') as Promise<ApiResponse<any>>;
export const retryExam = (examId: number) =>
  client.post(`/user/exams/${examId}/retry`) as Promise<ApiResponse<any>>;

// ── 课程章节 ──────────────────────────────
export const getChapters = (planId: number) =>
  client.get(`/user/courses/${planId}/chapters`) as Promise<ApiResponse<any>>;
export const generateChapters = (planId: number) =>
  client.post(`/user/courses/${planId}/chapters/generate`) as Promise<ApiResponse<any>>;
export const parseChapters = (planId: number, treeText: string) =>
  client.post(`/user/courses/${planId}/chapters/parse`, { treeText }) as Promise<ApiResponse<any>>;
export const updateChapter = (planId: number, id: number, data: any) =>
  client.put(`/user/courses/${planId}/chapters/${id}`, data) as Promise<ApiResponse<any>>;
export const deleteChapter = (planId: number, id: number) =>
  client.delete(`/user/courses/${planId}/chapters/${id}`) as Promise<ApiResponse<any>>;

// ── 能力模型 ──────────────────────────────
export const getAbilities = (planId: number) =>
  client.get(`/user/courses/${planId}/abilities`) as Promise<ApiResponse<any>>;
export const generateAbilities = (planId: number) =>
  client.post(`/user/courses/${planId}/abilities/generate`) as Promise<ApiResponse<any>>;
export const saveAbilities = (planId: number, abilities: any[]) =>
  client.post(`/user/courses/${planId}/abilities/save`, { abilities }) as Promise<ApiResponse<any>>;
export const matchChapterAbility = (planId: number) =>
  client.post(`/user/courses/${planId}/abilities/match`) as Promise<ApiResponse<any>>;

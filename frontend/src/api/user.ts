import client from './client';
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
  ProgressSummary,
  UserProfile,
} from '../types';

/** 登录 */
export const login = (username: string, password: string) =>
  client.post('/admin/auth/login', { username, password }) as Promise<ApiResponse<{ token: string; userId: number; username: string; realName: string; role: 'student' | 'admin'; onboardingCompleted: boolean }>>;

/** 注册 */
export const register = (data: { username: string; password: string; realName?: string }) =>
  client.post('/admin/auth/register', data) as Promise<ApiResponse<any>>;

/** 获取当前用户 */
export const getMe = (token: string) =>
  client.get('/admin/auth/me', { params: { token } }) as Promise<ApiResponse<any>>;

/** Onboarding 状态 */
export const getOnboardingStatus = () =>
  client.get('/user/onboarding/status') as Promise<ApiResponse<{ completed: boolean }>>;

/** 提交 Onboarding（只保存资料） */
export const submitOnboarding = (data: {
  name: string;
  school?: string;
  major: string;
  grade: string;
  direction: string;
  dailyHours: number;
  skills: Array<{ name: string; level: string }>;
}) =>
  client.post('/user/onboarding', data) as Promise<ApiResponse<{ completed: boolean }>>;

/** 获取用户所有计划 */
export const getMyPlans = () =>
  client.get('/user/plans') as Promise<ApiResponse<Array<{
    id: number;
    planName: string;
    planType: 'main' | 'side';
    targetJobId: number | null;
    currentPhase: number;
    dailyHours: number;
    estimatedDate: string;
    totalSkills: number;
    doneSkills: number;
    matchScore: number;
  }>>>;

/** 创建新计划 */
export const createPlan = (data: {
  direction: string;
  dailyHours?: number;
  importFromPlanId?: number;
}) =>
  client.post('/user/plans', data) as Promise<ApiResponse<{
    id: number;
    planName: string;
    estimatedDate: string;
    totalSkills: number;
    todayTasks: Array<{ skillName: string; estimatedMin: number; taskType: string }>;
  }>>;

/** Dashboard */
export const getDashboard = () =>
  client.get('/user/dashboard') as Promise<ApiResponse<DashboardData>>;

/** 用户画像 */
export const getProfile = () =>
  client.get('/user/profile') as Promise<ApiResponse<UserProfile>>;

/** 更新画像 */
export const updateProfile = (data: Partial<UserProfile>) =>
  client.put('/user/profile', data) as Promise<ApiResponse<any>>;

/** 岗位列表 */
export const getJobs = (params?: { page?: number; pageSize?: number; keyword?: string; level?: string }) =>
  client.get('/user/jobs', { params }) as Promise<PaginatedResponse<Job>>;

/** 岗位详情 */
export const getJobDetail = (id: number) =>
  client.get(`/user/jobs/${id}`) as Promise<ApiResponse<Job>>;

/** 岗位匹配分析 */
export const getJobMatch = (id: number) =>
  client.get(`/user/jobs/${id}/match`) as Promise<ApiResponse<any>>;

/** 申请岗位 */
export const applyJob = (id: number) =>
  client.post(`/user/jobs/${id}/apply`) as Promise<ApiResponse<any>>;

/** 将岗位缺少技能导入学习计划 */
export const importJobSkills = (id: number, target?: 'main' | 'side') =>
  client.post(`/user/jobs/${id}/import-skills`, { target }) as Promise<ApiResponse<any>>;

/** 学习路径列表 */
export const getLearningPaths = (params?: { page?: number; pageSize?: number }) =>
  client.get('/user/learning-paths', { params }) as Promise<PaginatedResponse<LearningPath>>;

/** 学习路径详情 */
export const getLearningPathDetail = (id: number) =>
  client.get(`/user/learning-paths/${id}`) as Promise<ApiResponse<LearningPath>>;

/** 知识库资源 */
export const getKnowledge = (skill: string) =>
  client.get(`/user/learning-paths/knowledge/${skill}`) as Promise<ApiResponse<any>>;

/** 阅读完成 */
export const markRead = (skill: string, pathId: number) =>
  client.post('/user/progress/read', { skill, path_id: pathId });

/** 习题完成 */
export const submitQuiz = (skill: string, total: number, correct: number, pathId: number) =>
  client.post('/user/progress/quiz', { skill, total, correct, path_id: pathId });

/** 技能完成 */
export const markComplete = (skill: string, pathId: number) =>
  client.post('/user/progress/complete', { skill, path_id: pathId });

/** 编程题完成 */
export const markCodeComplete = (skill: string, pathId: number) =>
  client.post('/user/progress/code', { skill, path_id: pathId });

/** 获取技能掌握度明细 */
export const getMasteryBreakdown = (skill: string) =>
  client.get(`/user/progress/mastery/${encodeURIComponent(skill)}`) as Promise<ApiResponse<any>>;

/** 进度汇总 */
export const getProgressSummary = () =>
  client.get('/user/progress/summary') as Promise<ApiResponse<ProgressSummary>>;

/** 考试列表 */
export const getExams = (params?: { page?: number; pageSize?: number; exam_type?: number }) =>
  client.get('/user/exams', { params }) as Promise<PaginatedResponse<ExamRecord>>;

/** 考试详情 */
export const getExamDetail = (id: number) =>
  client.get(`/user/exams/${id}`) as Promise<ApiResponse<ExamRecord>>;

/** 开始考试 — 随机抽题+选项乱序（§24.1），返回题目+时限 */
export const startExam = (id: number, count?: number) =>
  client.get(`/user/exams/${id}/take`, { params: count ? { count } : {} }) as Promise<ApiResponse<{
    examId: number;
    examType: number;
    skillName: string | null;
    questions: any[];
    timeLimitSec: number;
    startedAt: number;
  } | null>>;

/** 提交考试（含每题用时，用于防作弊检测） */
export const submitExam = (data: {
  examId?: number;
  exam_type: number;
  skill_name: string;
  answers: any;
  questionTimings?: Record<string, number>;
}) =>
  client.post('/user/exams/submit', data) as Promise<ApiResponse<any>>;

/** 获取错题本 */
export const getWrongAnswers = (skillName?: string) =>
  client.get('/user/exams/wrong-answers', { params: skillName ? { skillName } : {} }) as Promise<ApiResponse<any>>;

/** 资讯列表 */
export const getNews = (params?: { page?: number; pageSize?: number; type?: string }) =>
  client.get('/user/news', { params }) as Promise<PaginatedResponse<NewsItem>>;

/** 资讯详情 */
export const getNewsDetail = (id: number) =>
  client.get(`/user/news/${id}`) as Promise<ApiResponse<NewsItem>>;

/** 知识图谱 */
export const getGraph = (params?: { skill?: string; job_id?: number; limit?: number }) =>
  client.get('/user/graph', { params }) as Promise<ApiResponse<any>>;

/** AI 对话 */
export const sendChat = async (message: string, sessionId?: string, pageContext?: string) => {
  const res: ApiResponse<any> = await client.post('/user/chat', {
    message,
    session_id: sessionId,
    page_context: pageContext,
  });
  return { ...res, data: snakeToCamel<ChatReply>(res.data) } as ApiResponse<ChatReply>;
};

/** 对话历史列表 */
export const getChatSessions = async (params?: { page?: number; pageSize?: number }) => {
  const res: PaginatedResponse<any> = await client.get('/user/chat-sessions', { params });
  return { ...res, data: res.data.map(snakeToCamel<ChatSession>) } as PaginatedResponse<ChatSession>;
};

/** 对话详情 */
export const getChatSession = async (sessionId: string) => {
  const res: ApiResponse<any> = await client.get(`/user/chat-sessions/${sessionId}`);
  return { ...res, data: snakeToCamel<ChatSession>(res.data) } as ApiResponse<ChatSession>;
};

/** 删除对话 */
export const deleteChatSession = (sessionId: string) =>
  client.delete(`/user/chat-sessions/${sessionId}`);

/** 保存项目经历 */
export const saveProject = (data: any) =>
  client.post('/user/projects/save', data);

/** 异步任务状态 */
export const getTaskStatus = (taskId: string) =>
  client.get(`/user/tasks/${taskId}`) as Promise<ApiResponse<any>>;

/** 视频生成任务进度 */
export const getVideoTaskStatus = (taskId: string) =>
  client.get(`/user/video-task/${taskId}`) as Promise<ApiResponse<any>>;

/** 直接触发视频生成（跳过 IntentRouter） */
export const createVideoTask = (data: { skillName: string; difficulty?: string }) =>
  client.post('/user/video-task', data) as Promise<ApiResponse<any>>;

// ── 技能相关 API ──────────────────────────────────

/** 获取用户所有技能 */
export const getSkills = () =>
  client.get('/user/skills') as Promise<ApiResponse<any[]>>;

/** 获取用户技能统计 */
export const getSkillStats = () =>
  client.get('/user/skills/stats') as Promise<ApiResponse<{ total: number; bySource: Record<string, number>; avgMastery: number }>>;

/** 获取加权后的有效技能 */
export const getEffectiveSkills = () =>
  client.get('/user/skills/effective') as Promise<ApiResponse<any[]>>;

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
export const calculateMatch = (jobId: number) =>
  client.get(`/user/match/${jobId}`) as Promise<ApiResponse<{
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
  }>>;

/** 计算用户与所有岗位的匹配度 */
export const calculateMatchAll = () =>
  client.get('/user/match-all') as Promise<ApiResponse<Array<{ jobId: number; jobTitle: string; matchScore: number; canApply: boolean }>>>;

/** 技能变化后重新计算匹配度 */
export const recalculateMatch = () =>
  client.post('/user/match/recalculate') as Promise<ApiResponse<any>>;

/** 获取用户最佳匹配岗位（Dashboard 用） */
export const getBestMatch = () =>
  client.get('/user/match/best') as Promise<ApiResponse<{ jobId: number; jobTitle: string; matchScore: number; canApply: boolean } | null>>;

/** 获取匹配度趋势 */
export const getMatchTrend = (jobId: number, days?: number) =>
  client.get(`/user/match/trend/${jobId}`, { params: days ? { days } : {} }) as Promise<ApiResponse<Array<{ score: number; createdAt: string }>>>;

// ── 学习任务相关 API ──────────────────────────────────

/** 获取今日学习任务 */
export const getTodayTasks = (planId?: number) =>
  client.get('/user/learning-tasks/today', { params: planId ? { planId } : {} }) as Promise<ApiResponse<{
    planId: number;
    planName: string;
    mainTasks: any[];
    sideTasks: any[];
    totalEstimatedMin: number;
    completedMin: number;
    progressPct: number;
  }>>;

/** 更新学习任务状态 */
export const updateTaskStatus = (taskId: number, status: string) =>
  client.post(`/user/learning-tasks/${taskId}/status`, { status }) as Promise<ApiResponse<any>>;

/** 调整学习速度 */
export const adjustLearningSpeed = (planId: number) =>
  client.post('/user/learning-tasks/adjust-speed', { planId }) as Promise<ApiResponse<{ adjusted: boolean; changes: string[] }>>;

// ── 5 个 Agent API ──────────────────────────────────

/** 生成讲义 */
export const generateLecture = (data: { skillName: string; level?: string; extra?: string }) =>
  client.post('/user/agents/lecture', data) as Promise<ApiResponse<any>>;

/** 生成拓展阅读 */
export const generateReading = (data: { skillName: string; count?: number; focus?: string }) =>
  client.post('/user/agents/reading', data) as Promise<ApiResponse<any>>;

/** 生成代码案例 */
export const generateCode = (data: { skillName: string; language?: string; count?: number }) =>
  client.post('/user/agents/code', data) as Promise<ApiResponse<any>>;

/** 生成学习路径 */
export const generateLearningPath = (data: { goal: string; currentLevel?: string; availableTime?: string; preferences?: string }) =>
  client.post('/user/agents/path', data) as Promise<ApiResponse<any>>;

/** 评估学习效果 */
export const assessLearning = (data: { learningData: string; goal?: string; currentProgress?: string }) =>
  client.post('/user/agents/assess', data) as Promise<ApiResponse<any>>;

// ── 多模态智能体 API (T5) ──────────────────────────────────

/** 生成 HTML 动画演示 */
export const generateAnimation = (data: { skillName: string; difficulty?: string }) =>
  client.post('/user/multimodal/animation', data) as Promise<ApiResponse<any>>;

/** 生成 Mermaid 图表 */
export const generateDiagram = (data: { skillName: string; diagramType?: string }) =>
  client.post('/user/multimodal/diagram', data) as Promise<ApiResponse<any>>;

/** 生成短视频（智谱 AI） */
export const generateVideo = (data: { skillName: string }) =>
  client.post('/user/multimodal/video', data) as Promise<ApiResponse<any>>;

/** 生成数字人讲解（讯飞） */
export const generateAvatar = (data: { skillName: string }) =>
  client.post('/user/multimodal/avatar', data) as Promise<ApiResponse<any>>;

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
export const getMultimodal = (skill: string) =>
  client.get(`/user/multimodal/${encodeURIComponent(skill)}`) as Promise<ApiResponse<{
    skill: string;
    animation: any | null;
    diagram: any | null;
    video: any | null;
    avatar: any | null;
  }>>;

// ── 学习会话 API ──────────────────────────────────

/** 开始学习会话 */
export const startSession = (planId?: number) =>
  client.post('/user/sessions/start', { planId }) as Promise<ApiResponse<any>>;

/** 结束学习会话 */
export const endSession = (sessionId: number) =>
  client.post(`/user/sessions/${sessionId}/end`) as Promise<ApiResponse<any>>;

/** 获取学习历史 */
export const getSessionHistory = (page?: number, pageSize?: number) =>
  client.get('/user/sessions/history', { params: { page, pageSize } }) as Promise<ApiResponse<any>>;

/** 获取学习统计 */
export const getSessionStats = () =>
  client.get('/user/sessions/stats') as Promise<ApiResponse<any>>;

/** 对比两个日期的技能变化 */
export const diffSessions = (dateA: string, dateB: string) =>
  client.get('/user/sessions/diff', { params: { dateA, dateB } }) as Promise<ApiResponse<any>>;

/** 回退到目标日期 */
export const rollbackSession = (targetDate: string) =>
  client.post('/user/sessions/rollback', { targetDate }) as Promise<ApiResponse<any>>;

/** 记录学习进度到会话 */
export const recordSessionProgress = (sessionId: number, data: { taskId: number; skillName: string; masteryBefore: number; masteryAfter: number }) =>
  client.post(`/user/sessions/${sessionId}/progress`, data) as Promise<ApiResponse<any>>;

// ── 通知 API ──────────────────────────────────

/** 获取未读通知数 */
export const getUnreadCount = () =>
  client.get('/user/notifications/unread-count') as Promise<ApiResponse<{ count: number }>>;

/** 获取未读通知列表 */
export const getUnreadNotifications = (limit?: number) =>
  client.get('/user/notifications/unread', { params: { limit } }) as Promise<ApiResponse<any[]>>;

/** 获取所有通知 */
export const getNotifications = (page?: number, pageSize?: number) =>
  client.get('/user/notifications', { params: { page, pageSize } }) as Promise<ApiResponse<any>>;

/** 标记通知为已读 */
export const markNotificationRead = (id: number) =>
  client.post(`/user/notifications/${id}/read`) as Promise<ApiResponse<any>>;

/** 标记所有通知为已读 */
export const markAllNotificationsRead = () =>
  client.post('/user/notifications/read-all') as Promise<ApiResponse<any>>;

// ── 简历 API ──────────────────────────────────

/** 获取用户所有简历 */
export const getResumes = () =>
  client.get('/user/resumes') as Promise<ApiResponse<any[]>>;

/** 获取简历详情 */
export const getResume = (id: number) =>
  client.get(`/user/resumes/${id}`) as Promise<ApiResponse<any>>;

/** 生成简历 */
export const generateResume = (targetJobId?: number) =>
  client.post('/user/resumes/generate', { targetJobId }) as Promise<ApiResponse<any>>;

/** 更新简历 */
export const updateResume = (id: number, data: { content?: any; htmlContent?: string }) =>
  client.post(`/user/resumes/${id}/update`, data) as Promise<ApiResponse<any>>;

/** 从基础简历创建岗位版本 */
export const branchResume = (id: number, targetJobId: number) =>
  client.post(`/user/resumes/${id}/branch`, { targetJobId }) as Promise<ApiResponse<any>>;

/** 删除简历 */
export const deleteResume = (id: number) =>
  client.post(`/user/resumes/${id}/delete`) as Promise<ApiResponse<any>>;

/** 导出简历 PDF（返回 Blob URL） */
export const exportResumePdf = async (id: number): Promise<string> => {
  const response = await client.get(`/user/resumes/${id}/pdf`, { responseType: 'blob' });
  const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
};

// ── 智能体办公室 API ──────────────────────────────────

/** 获取 Agent 办公室统计 */
export const getAgentOfficeStats = () =>
  client.get('/user/agent-office/stats') as Promise<ApiResponse<any>>;

/** 获取可用 Agent 类型 */
export const getAgentTypes = () =>
  client.get('/user/agent-office/agent-types') as Promise<ApiResponse<Record<string, { label: string; defaultRole: string }>>>;

/** 获取 Agent 任务队列 */
export const getAgentOfficeTasks = (status?: string) =>
  client.get('/user/agent-office/tasks', { params: status ? { status } : {} }) as Promise<ApiResponse<any[]>>;

/** 获取 Agent 任务详情 */
export const getAgentOfficeTask = (taskId: number) =>
  client.get(`/user/agent-office/tasks/${taskId}`) as Promise<ApiResponse<any>>;

/** 创建 Agent 任务（派发模式） */
export const createAgentOfficeTask = (data: { agentType: string; title: string; params?: Record<string, any>; description?: string }) =>
  client.post('/user/agent-office/tasks', data) as Promise<ApiResponse<any>>;

/** 标记任务紧急 */
export const markAgentTaskUrgent = (taskId: number) =>
  client.post(`/user/agent-office/tasks/${taskId}/urgent`) as Promise<ApiResponse<any>>;

/** 跳过任务 */
export const skipAgentTask = (taskId: number) =>
  client.post(`/user/agent-office/tasks/${taskId}/skip`) as Promise<ApiResponse<any>>;

/** 批量重排任务顺序 */
export const reorderAgentTasks = (taskIds: number[]) =>
  client.post('/user/agent-office/tasks/reorder', { taskIds }) as Promise<ApiResponse<any>>;

/** 取消任务 */
export const cancelAgentTask = (taskId: number) =>
  client.post(`/user/agent-office/tasks/${taskId}/cancel`) as Promise<ApiResponse<any>>;

/** 删除任务 */
export const deleteAgentTask = (taskId: number) =>
  client.post(`/user/agent-office/tasks/${taskId}/delete`) as Promise<ApiResponse<any>>;

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
export const getQuickTestQuestions = (direction?: string) =>
  client.get('/user/quick-test', { params: direction ? { direction } : {} }) as Promise<ApiResponse<{ questions: any[]; skillName: string }>>;

/** 提交速测答案 */
export const submitQuickTest = (data: { skillName: string; answers: Record<string, any>; questions: any[] }) =>
  client.post('/user/quick-test/submit', data) as Promise<ApiResponse<any>>;

/** 统一 API 响应 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  code: number;
  message: string;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  meta?: Record<string, any>;
}

/** 用户 */
export interface User {
  id: number;
  username: string;
  realName: string;
  phone: string;
  email: string;
  avatar: string;
  role: 'student' | 'admin';
  onboardingCompleted: boolean;
}

/** 学生信息 */
export interface Student {
  id: number;
  userId: number;
  name: string;
  school: string;
  studentNo: string;
  major: string;
  grade: string;
  targetJobId: number | null;
  dailyHours: number;
  mainRatio?: number;
  interests: string[];
  skills: Skill[];
  projects: Project[];
  onboardingCompleted: number;
}

/** 技能 */
export interface Skill {
  name: string;
  level: '了解' | '熟悉' | '精通';
  source?: string;
}

/** 项目经历 */
export interface Project {
  name: string;
  description: string;
  role: string;
  tech: string[];
  time: string;
  githubUrl: string;
  highlights: string[];
}

/** 岗位 */
export interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  salaryRange: string;
  level: 'junior' | 'mid' | 'senior';
  requiredSkills: Array<{ name: string; weight?: number }>;
  preferredSkills: Array<{ name: string; weight?: number }>;
  matchScore: number;
  jdText?: string;
  deliveryThreshold: number;
  source: string;
  url?: string;
  host?: string;
  snippet?: string;
  searchMeta?: {
    source: 'local' | 'online';
    origin?: 'web' | 'ai_generated';
    matchedFields: string[];
  };
  enterpriseId?: number;
  enterpriseName?: string;
  enterpriseIndustry?: string;
}

/** 岗位差距卡（P0-1）— GET /api/user/jobs/:id/gap-card */
export interface GapCardTopGap {
  skill: string;
  type: 'required' | 'preferred';
  currentMastery: number;
  recommendedAction: string;
  actionTarget: 'learning' | 'quick-test' | 'project' | 'resume' | 'plan';
  estimatedImpact: number;
  /** P1-2：缺口判断依据 — Evidence RAG 证据覆盖状态 */
  evidence?: {
    hasEvidence: boolean;
    count: number;
    items: Array<{ chunkId: number; sourceType: string; title: string }>;
  };
}

export interface GapCard {
  jobId: number;
  jobTitle: string;
  company: string;
  level: 'junior' | 'mid' | 'senior';
  score: number;
  canApply: boolean;
  applyAdvice: string;
  reason: string;
  topGaps: GapCardTopGap[];
  totalEstimatedImpact: number;
  hasProfile: boolean;
  message: string;
}

/** 今日行动推荐（P0-2）— GET /api/user/today-actions */
export interface TodayAction {
  id: number;
  title: string;
  taskType: 'learning' | 'continue' | 'quick-test' | 'project' | 'review' | 'onboarding';
  estimatedMin: number;
  reason: string;
  estimatedImpact: number;
  impactLabel: string;
  evidence: string;
  path: string;
}

export interface TodayActions {
  main: TodayAction;
  subs: TodayAction[];
}

/** 技能证据链（P1-1）— GET /api/user/skills/:skillName/evidence */
export interface SkillEvidence {
  skill: string;
  mastery: number;
  hasSkill: boolean;
  source: string;
  counts: { learning: number; evaluation: number; project: number; resume: number };
  summary: string;
  evidence: {
    learning: Array<{ commitId: number; type: string; message: string; delta: number; time: number }>;
    evaluation: Array<{ resultId: number; skillName: string | null; score: number; passed: boolean; level: string | null; summary: string | null; time: number }>;
    project: Array<{ name: string; description: string; skills: string[]; period: string }>;
    resume: Array<{ resumeId: number; versionName: string; targetJobTitle: string; expression: string }>;
    impact: { matchDelta: number; commitId: number | null; message: string; jobTitle: string };
  };
}

export type LearningGoalType = 'career' | 'course' | 'exam' | 'certificate' | 'project' | 'interest';

export interface StarterLearningPath {
  id: string;
  title: string;
  description: string;
  goalType: LearningGoalType;
  phases: Array<{
    name: string;
    abilities: Array<{ id: string; name: string; estimatedMin: number; priority: number }>;
  }>;
}

export interface LearningDomain {
  id: string;
  name: string;
  description: string;
  goalTypes: LearningGoalType[];
  terminology: Record<string, string>;
  assessmentModes: string[];
  evidenceTypes: string[];
  starterPaths: StarterLearningPath[];
}

/** 学习路径 */
export interface LearningPath {
  id: number;
  userId: number;
  planName: string;
  planType: 'main' | 'side';
  targetJobId: number | null;
  domainId: string;
  goalType: LearningGoalType;
  goalTitle: string;
  planStatus: 'active' | 'paused' | 'archived';
  scheduleEnabled: number;
  branchId?: number;
  currentPhase: number;
  matchScore: number;
  estimatedDate: string;
  dailyHours: number;
  pathData: {
    domainId?: string;
    domainName?: string;
    goalType?: LearningGoalType;
    goalTitle?: string;
    terminology?: Record<string, string>;
    assessmentModes?: string[];
    evidenceTypes?: string[];
    phases: Phase[];
  } | null;
  status: number;
  createTime: number;
}

/** 计划摘要（用于计划切换器） */
export interface PlanSummary {
  id: number;
  planName: string;
  planType: 'main' | 'side';
  currentPhase: number;
  estimatedDate: string;
  totalSkills: number;
}

/** 学习阶段 */
export interface Phase {
  name: string;
  skills: SkillNode[];
  status?: string;
}

/** 技能节点 */
export interface SkillNode {
  abilityId?: string;
  name: string;
  status: 'pending' | 'done';
  duration?: string;
  estimatedMin?: number;
  readAt?: number;
  lecture_done?: boolean;
  quizScore?: number;
  quizPassed?: boolean;
  quiz_at?: number;
  code_done?: boolean;
  code_at?: number;
  exam_done?: boolean;
  exam_at?: number;
  completedAt?: number;
}

/** 考试记录 */
export interface ExamRecord {
  id: number;
  userId: number;
  examType: number;
  skillName: string;
  jobId: number | null;
  score: number;
  passed: number;
  answers: {
    skill: string;
    questions: Question[];
    examId?: number;
  };
  retryCount: number;
  createTime: number;
}

/** 考试题目 */
export interface Question {
  type: 'choice' | 'coding';
  question: string;
  options?: string[];
  answer?: number;
  explanation?: string;
  template?: string;
  hint?: string;
}

/** 资讯 */
export interface NewsItem {
  id: number;
  title: string;
  content: string;
  summary?: string;
  image: string;
  type: 'industry' | 'tech' | 'recruit';
  tags?: string[];
  source: string;
  sourceUrl: string;
  publishTime: number;
}

/** Dashboard 数据 */
export interface DashboardData {
  student: Student;
  target_job: Job | null;
  plans: PlanSummary[];
  learning_path: LearningPath | null;
  stats: {
    total_skills: number;
    done_skills: number;
    exam_count: number;
    job_count: number;
    total_learned_hours: number;
    active_days: number;
  };
  today_tasks: TodayTask[];
  recent_news: NewsItem[];
  golden_path?: GoldenPathProgress;
}

export interface GoldenPathProgress {
  steps: Array<{
    key: string;
    label: string;
    path: string;
    completed: boolean;
    current: boolean;
    summary: string;
  }>;
  completedCount: number;
  totalCount: number;
  completionRate: number;
  currentKey: string | null;
  nextAction: {
    label: string;
    path: string;
    summary: string;
  };
}

/** 今日任务 */
export interface TodayTask {
  id: number;
  title: string;
  taskType: 'main' | 'side';
  estimatedMin: number;
  status: string;
  planDate: string;
}

/** AI 对话 action */
export interface ChatAction {
  type: 'jobs' | 'target_set' | 'path_generating' | 'path_generated' | 'resources' | 'exam' | 'progress' | 'today_tasks'
    | 'animation' | 'diagram' | 'video' | 'video_pending' | 'avatar' | 'skill_gap' | 'error';
  data: any;
  key?: string;
}

/** 资源侧边栏条目 */
export interface ResourceItem {
  id: string;
  skill: string;
  type: 'lecture' | 'quiz' | 'coding' | 'animation' | 'diagram' | 'video';
  title: string;
  data: any;
  savedAt: number;
  source: 'chat' | 'sse';
}

export interface GeneratedResource {
  id: number;
  userId: number;
  resourceType: string;
  title: string;
  skillName?: string | null;
  source: 'chat' | 'agent_office' | 'knowledge' | 'queue' | 'manual';
  sourceTaskId?: number | null;
  externalId?: string | null;
  chatSessionId?: string | null;
  chatMessageId?: string | null;
  agentType?: string | null;
  resourceStatus: 'pending' | 'running' | 'success' | 'failed';
  payload?: any;
  previewMeta?: Record<string, any> | null;
  provider?: string | null;
  rawRequest?: any;
  rawResponse?: any;
  errorMessage?: string | null;
  createTime?: number;
  updateTime?: number;
}

export interface RadarDimension {
  name: string;
  category: string;
  skills: string[];
  score: number;
  trend: 'up' | 'down' | 'stable';
  lastCommitId?: number | null;
}

export interface AbilityMetrics {
  overallScore: number;
  frontendScore: number;
  backendScore: number;
  toolingScore: number;
  softSkillScore: number;
  depth: number;
  breadth: number;
  balance: number;
  learningSpeed: number;
  consistency: number;
  domainId?: string;
  domainName?: string;
  goalTitle?: string;
}

export interface CommitDelta {
  skillChanges: Array<{ name: string; before: number; after: number; delta: number }>;
  metricsChange: {
    overallScore: number;
    matchScore: number;
    depthScore: number;
    breadthScore: number;
  };
  radarChanges: Array<{ dimension: string; before: number; after: number; delta: number }>;
}

export interface LearningBranch {
  id: number;
  userId: number;
  branchName: string;
  branchType: 'main' | 'plan' | 'side' | 'experiment';
  baseCommitId: number | null;
  headCommitId: number | null;
  sourceBranchId: number | null;
  mergedAt: number | null;
  status: number;
  createTime: number;
  updateTime: number;
}

export interface LearningCommit {
  id: number;
  userId: number;
  branchId: number;
  parentCommitId: number | null;
  mergeSourceCommitId: number | null;
  commitType: 'baseline' | 'lecture_read' | 'quiz_passed' | 'quiz_failed' | 'code_done' | 'skill_complete' | 'task_done' | 'manual' | 'merge' | 'rollback';
  skillName: string | null;
  message: string;
  payloadJson: Record<string, any> | null;
  snapshotId: number | null;
  deltaJson: CommitDelta | null;
  status: number;
  createTime: number;
  updateTime: number;
}

export interface SkillSnapshot {
  id: number;
  userId: number;
  branchId: number;
  commitId: number;
  skillsJson: any[];
  radarJson: RadarDimension[];
  abilityMetricsJson: AbilityMetrics | null;
  matchSummaryJson: any;
  totalMastery: number;
  skillCount: number;
  depthScore: number;
  breadthScore: number;
  balanceScore: number;
  status: number;
  createTime: number;
  updateTime: number;
}

export interface RadarComparison {
  before: SkillSnapshot;
  after: SkillSnapshot;
  delta: CommitDelta;
}

export interface EvaluationAttempt {
  id: number;
  userId: number;
  attemptType: 'progress_read' | 'progress_quiz' | 'progress_code' | 'skill_complete' | 'quick_test' | 'exam' | 'ai_assessment' | 'chat_resource' | 'manual';
  sourceType: string | null;
  sourceId: string | null;
  skillName: string | null;
  goal: string | null;
  attemptStatus: 'started' | 'graded' | 'committed' | 'failed';
  rubricKey: string;
  rubricVersion: string;
  startedAt: number | null;
  completedAt: number | null;
  metadataJson: Record<string, any> | null;
}

export interface EvaluationResult {
  id: number;
  userId: number;
  attemptId: number;
  skillName: string | null;
  evaluatorType: 'objective' | 'llm' | 'hybrid' | 'system';
  evaluatorName: string | null;
  score: number;
  maxScore: number;
  normalizedScore: number;
  level: string | null;
  passed: number | null;
  confidence: number;
  summary: string | null;
  feedbackJson: Record<string, any> | null;
  rawResultJson: Record<string, any> | null;
  rubricKey: string;
  rubricVersion: string;
}

export interface EvaluationImpact {
  id: number;
  userId: number;
  attemptId: number;
  resultId: number | null;
  commitId: number | null;
  snapshotId: number | null;
  branchId: number | null;
  skillChangesJson: CommitDelta['skillChanges'] | null;
  radarChangesJson: CommitDelta['radarChanges'] | null;
  metricsChangeJson: CommitDelta['metricsChange'] | null;
  matchScoreDelta: number;
  nextActionsJson: any[] | null;
}

export interface EvaluationListItem {
  attempt: EvaluationAttempt;
  result: EvaluationResult | null;
  impact: EvaluationImpact | null;
}

/** 多模态资源状态 */
export type MultimodalStatus = 'ready' | 'pending' | 'not_configured' | 'failed';

/** 动画资源 */
export interface AnimationData {
  skill: string;
  title: string;
  html: string;
  status: MultimodalStatus;
}

/** 图表资源 */
export interface DiagramData {
  skill: string;
  title: string;
  mermaid: string;
  diagramType?: string;
  status: MultimodalStatus;
}

/** 短视频资源 */
export interface VideoData {
  skill: string;
  title: string;
  status: MultimodalStatus;
  provider?: string;
  url?: string;
  poster?: string;
  text?: string;
  script?: string;
  taskId?: string;
}

/** 数字人资源 */
export interface AvatarData {
  skill: string;
  title: string;
  status: MultimodalStatus;
  provider?: string;
  url?: string;
  poster?: string;
  text?: string;
  script?: string;
  appId?: string;
  avatarId?: string;
}

/** AI 对话响应 */
export interface ChatReply {
  reply: string;
  sessionId: string;
  agent: string;
  profileVersion: number;
  actions: ChatAction[];
}

/** 对话消息 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  agent?: string;
  timestamp: number;
  actions?: ChatAction[];
  /** Evidence RAG（P0）：回答引用的个人证据 */
  evidence?: Array<{
    chunkId: number;
    sourceType: string;
    title: string;
    snippet: string;
    score: number;
  }>;
  /** 有召回证据但回答未实际引用（护栏标记，前端展示提示） */
  citationMiss?: boolean;
}

/** 对话会话 */
export interface ChatSession {
  sessionId: string;
  userId: string;
  pageContext: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

/** 进度汇总 */
export interface ProgressSummary {
  paths: Array<{
    pathId: number;
    targetJobId: number;
    totalSkills: number;
    doneSkills: number;
    readSkills: number;
    quizPassed: number;
    currentPhase: number;
    matchScore: number;
    estimatedDate: string;
  }>;
}

/** 用户画像 */
export interface UserProfile {
  userId: number;
  name: string;
  studentNo: string;
  major: string;
  grade: string;
  skills: Skill[];
  targetJobId: number | null;
  onboardingCompleted: number;
  projects: Project[];
  profileVersion: number;
  traits: {
    interests: string[];
    strengths: string[];
    weaknesses: string[];
  };
  chatInsights: Array<{
    content: string;
    source: string;
    extractedAt: number;
  }>;
  goals: {
    targetJobTitle: string;
    direction: string;
  };
  radarDimensions?: RadarDimension[];
  abilityMetrics?: AbilityMetrics | null;
  latestSnapshot?: SkillSnapshot | null;
  activeBranch?: LearningBranch | null;
}

/** 代码示例 */
export interface CodeExample {
  title: string;
  description: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  language: string;
  setup: string;
  task: string;
  hint: string;
  solution: string;
  solutionExplanation: string[];
  expectedOutput: string;
  commonMistakes: string[];
  keyPoints: string[];
  relatedConcepts: string[];
}

/** 代码数据 */
export interface CodeData {
  skill: string;
  language: string;
  totalExamples: number;
  examples: CodeExample[];
  bestPractices: string[];
  commonMistakes: string[];
}

/** 拓展阅读项 */
export interface ReadingItem {
  title: string;
  type: 'why' | 'practice' | 'deep' | 'compare';
  content: string;
  keyConcepts: string[];
  difficulty: 'basic' | 'intermediate' | 'advanced';
  readTime: string;
  relatedTopics: string[];
  questions: string[];
}

/** 拓展阅读数据 */
export interface ReadingData {
  skill: string;
  totalItems: number;
  items: ReadingItem[];
  studyAdvice: string;
}

/** 评估维度分数 */
export interface DimensionScore {
  dimension: string;
  score: number;
  maxScore: number;
  detail: string;
  trend: 'up' | 'stable' | 'down';
}

/** 薄弱点 */
export interface WeakPoint {
  skill: string;
  level: 'low' | 'medium';
  description: string;
  suggestion: string;
}

/** 改进建议 */
export interface Improvement {
  priority: 'high' | 'medium' | 'low';
  area: string;
  action: string;
  expectedEffect: string;
}

/** 学习评估数据 */
export interface AssessData {
  overallScore: number;
  level: string;
  dimensions: DimensionScore[];
  weakPoints: WeakPoint[];
  improvements: Improvement[];
  planAdjustment: string;
  encouragement: string;
  summary: string;
}

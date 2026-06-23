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
  enterpriseId?: number;
  enterpriseName?: string;
  enterpriseIndustry?: string;
}

/** 学习路径 */
export interface LearningPath {
  id: number;
  userId: number;
  planName: string;
  targetJobId: number;
  currentPhase: number;
  matchScore: number;
  estimatedDate: string;
  dailyHours: number;
  pathData: {
    phases: Phase[];
  };
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
  name: string;
  status: 'pending' | 'done';
  duration: string;
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
  image: string;
  type: 'industry' | 'tech' | 'recruit';
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

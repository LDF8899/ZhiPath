/** Agent 配置（后端持久化） */
export interface AgentProfile {
  id: number;
  userId: number;
  agentType: string; // lecture | reading | code | path | assess | exam | skillgap | resume | profile | news
  animalType: string;
  color: string;
  nickname: string;
  displayRole: string;
  stationId: number | null;
  agentStatus: 'idle' | 'busy';
  createTime: number;
  updateTime: number;
}

/** 工位 */
export interface Station {
  id: number;
}

/** 任务（复用后端 AgentTask） */
export interface AgentTask {
  id: number;
  agentType: string;
  title: string;
  description: string;
  params: Record<string, any> | null;
  taskStatus: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  progress: number;
  result: Record<string, any> | null;
  errorMessage: string;
  isUrgent: number;
  sortOrder: number;
  startedAt: number | null;
  completedAt: number | null;
  createTime: number;
}

/** 动物类型 */
export type AnimalType =
  | 'cat' | 'dog' | 'rabbit' | 'panda' | 'fox'
  | 'bear' | 'owl' | 'penguin' | 'hamster'
  | 'hedgehog' | 'raccoon' | 'deer' | 'parrot' | 'duck';

/** 配色方案 */
export interface ColorScheme {
  id: string;
  color: string;
  label: string;
}

/** Agent 类型配置 */
export interface AgentTypeConfig {
  label: string;
  desc: string;
}

/** 动物配色 */
export const ANIMAL_COLORS: Record<string, string> = {
  cat: '#f5a623',
  dog: '#7b68ee',
  rabbit: '#ff6b6b',
  panda: '#2ed573',
  fox: '#ffa502',
  bear: '#8b6b4a',
  owl: '#1e90ff',
  penguin: '#2b2620',
  hamster: '#ff69b4',
  hedgehog: '#5a5349',
  raccoon: '#888',
  deer: '#c9a06c',
  parrot: '#32cd32',
  duck: '#4169e1',
};

/** 场景类型 */
export type SceneType = 'village' | 'city' | 'forest' | 'office';

/** Agent 统一配置 */
export interface AgentConfig {
  id: string;
  animal: AnimalType;
  color: string;
  name: string;
  intent: string;
}

export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  'generate_path':      { id: 'path',      animal: 'cat',     color: '#f5a623', name: '路径规划师', intent: 'generate_path' },
  'generate_exam':      { id: 'exam',      animal: 'dog',     color: '#7b68ee', name: '出题专家',   intent: 'generate_exam' },
  'recommend_jobs':     { id: 'jobs',      animal: 'rabbit',  color: '#ff6b6b', name: '岗位顾问',   intent: 'recommend_jobs' },
  'generate_video':     { id: 'video',     animal: 'panda',   color: '#2ed573', name: '视频制作人', intent: 'generate_video' },
  'generate_animation': { id: 'animation', animal: 'fox',     color: '#ffa502', name: '动画设计师', intent: 'generate_animation' },
  'generate_diagram':   { id: 'diagram',   animal: 'fox',     color: '#ffa502', name: '动画设计师', intent: 'generate_diagram' },
  'show_progress':      { id: 'progress',  animal: 'owl',     color: '#1e90ff', name: '进度管理员', intent: 'show_progress' },
  'show_today_tasks':   { id: 'tasks',     animal: 'parrot',  color: '#ff4500', name: '任务调度员', intent: 'show_today_tasks' },
  'recommend_resources':{ id: 'resources', animal: 'hamster', color: '#ff69b4', name: '资源推荐官', intent: 'recommend_resources' },
  'set_target_job':     { id: 'target',    animal: 'rabbit',  color: '#ff6b6b', name: '岗位顾问',   intent: 'set_target_job' },
  'match_analysis':     { id: 'gap',       animal: 'duck',    color: '#4169e1', name: '差距分析师', intent: 'analyze_skill_gap' },
  'chat':               { id: 'chat',      animal: 'hamster', color: '#ff69b4', name: 'AI 助教',    intent: 'chat' },
};

export const DEFAULT_AGENT: AgentConfig = {
  id: 'chat',
  animal: 'hamster',
  color: '#ff69b4',
  name: 'AI 助教',
  intent: 'chat',
};

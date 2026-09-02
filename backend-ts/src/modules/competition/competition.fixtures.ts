export type CompetitionLearnerLevel = 'foundation' | 'project' | 'transition';

export interface CompetitionLearner {
  id: string;
  name: string;
  level: CompetitionLearnerLevel;
  title: string;
  background: string;
  targetRole: string;
  weeklyHours: number;
  theoryScore: number;
  practiceScore: number;
  strengths: string[];
  blindSpots: string[];
}

export interface CompetitionResource {
  type: 'lecture' | 'labGuide' | 'stagedQuiz';
  title: string;
  level: string;
  summary: string;
  sections: string[];
  evidence: string[];
}

export interface CompetitionLoopResult {
  learner: CompetitionLearner;
  domain: {
    id: string;
    name: string;
    knowledgeSlice: string;
    targetRole: string;
  };
  agents: Array<{
    id: string;
    name: string;
    role: string;
    status: 'success' | 'warning';
    output: string;
    confidence: number;
  }>;
  report: {
    matchScore: number;
    hallucinationRisk: number;
    citationCoverage: number;
    blindSpots: Array<{ skill: string; severity: number; reason: string }>;
    difficultyCurve: Array<{ week: string; target: number; adapted: number }>;
    pathNodes: Array<{ id: string; title: string; level: string; status: 'done' | 'active' | 'next' }>;
  };
  resources: CompetitionResource[];
  evidenceTrail: Array<{
    id: string;
    source: string;
    claim: string;
    coverage: number;
  }>;
  debate: Array<{
    agent: string;
    stance: string;
    verdict: 'pass' | 'revise';
  }>;
  decision: {
    action: '降维解释' | '补弱巩固' | '进阶挑战';
    reason: string;
    nextTasks: string[];
  };
}

export const competitionLearners: CompetitionLearner[] = [
  {
    id: 'freshman-foundation',
    name: '林澄',
    level: 'foundation',
    title: '大一零基础学习者',
    background: '计算机类大一学生，完成 C 语言入门，缺少 Web 工程经验。',
    targetRole: 'AI 原生全栈开发工程师',
    weeklyHours: 12,
    theoryScore: 48,
    practiceScore: 34,
    strengths: ['学习时间稳定', '基础语法概念清楚', '愿意按步骤练习'],
    blindSpots: ['React 组件状态', 'HTTP API 调用', '工程化调试'],
  },
  {
    id: 'undergrad-project',
    name: '许岚',
    level: 'project',
    title: '软件工程本科进阶学习者',
    background: '软件工程本科生，做过课程设计，能写前后端基础功能。',
    targetRole: '多智能体应用开发工程师',
    weeklyHours: 8,
    theoryScore: 76,
    practiceScore: 63,
    strengths: ['TypeScript 基础', '数据库建模', '接口联调经验'],
    blindSpots: ['RAG 检索评测', 'Agent 编排边界', '测试覆盖策略'],
  },
  {
    id: 'enterprise-transition',
    name: '周砚',
    level: 'transition',
    title: '企业转岗实训学习者',
    background: '制造业信息化实施人员，懂业务流程，代码与 AI 工程经验不足。',
    targetRole: '企业 AI 应用交付工程师',
    weeklyHours: 6,
    theoryScore: 62,
    practiceScore: 41,
    strengths: ['业务流程理解', '需求拆解', '现场交付意识'],
    blindSpots: ['NestJS 模块组织', '向量知识库接入', '验收脚本编写'],
  },
];

export const knowledgeSlice = [
  'React/Vite 前端工程：组件拆分、状态管理、路由、表单校验和构建发布。',
  'NestJS 后端工程：模块、Controller、Service、DTO、异常处理与鉴权边界。',
  'RAG 知识库工程：文档切片、召回、引用、无证据拒答和检索评测。',
  '多 Agent 协同：诊断、生成、审核、决策角色分工，使用中间状态解释决策。',
  '软件交付质量：单元测试、接口测试、演示数据、部署说明和可回滚变更。',
];

export const evidenceTrailBase: CompetitionLoopResult['evidenceTrail'] = [
  {
    id: 'react-vite',
    source: '软件开发知识库 / 前端工程切片',
    claim: 'React 学习路径应先稳定组件状态、路由和接口联调，再进入复杂状态管理。',
    coverage: 92,
  },
  {
    id: 'nestjs-api',
    source: '软件开发知识库 / 后端服务切片',
    claim: 'NestJS 训练任务需要显式验收 Controller、Service、DTO 与鉴权边界。',
    coverage: 89,
  },
  {
    id: 'rag-agent',
    source: '软件开发知识库 / RAG 与 Agent 切片',
    claim: '生成内容必须绑定检索证据，低置信条目进入审核裁判二次校验。',
    coverage: 94,
  },
];

export const basePathNodes: CompetitionLoopResult['report']['pathNodes'] = [
  { id: 'profile', title: '学情画像建模', level: 'L1', status: 'done' },
  { id: 'web', title: 'React/Vite 工程基础', level: 'L1-L2', status: 'active' },
  { id: 'api', title: 'NestJS API 与数据建模', level: 'L2', status: 'next' },
  { id: 'rag', title: 'RAG 知识库与引用校验', level: 'L3', status: 'next' },
  { id: 'agents', title: '多 Agent 编排与评测闭环', level: 'L3-L4', status: 'next' },
];

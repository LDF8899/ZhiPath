import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import * as mysql from 'mysql2/promise';
import { DataSource, In } from 'typeorm';
import { createHash } from 'crypto';
import { EvidenceChunk } from '../src/entities/evidence-chunk.entity';
import { EvidenceRagService } from '../src/services/evidence-rag.service';
import { ChromaService } from '../src/services/chroma.service';

type DemoSkill = {
  name: string;
  before: number;
  after: number;
  trust: number;
  source: 'self_report' | 'conversation' | 'github' | 'exam';
};

type DemoUser = {
  username: string;
  password: string;
  realName: string;
  email: string;
  school: string;
  major: string;
  grade: string;
  targetJob: string;
  goalTitle: string;
  dailyHours: number;
  interests: string[];
  summary: string;
  project: { name: string; role: string; desc: string; stack: string[] };
  skills: DemoSkill[];
  weakTopics: Array<{ label: string; beforeMastery: number }>;
  learningDays: Array<{
    dayOffset: number;
    minutes: number;
    matchBefore: number;
    matchAfter: number;
    tasks: Array<{ skill: string; status: string; type: 'main' | 'side'; minutes: number }>;
  }>;
  exams: Array<{
    skill: string;
    score: number;
    passed: boolean;
    wrong: Array<{ topic: string; reason: string; next: string }>;
  }>;
  resources: Array<{ type: string; title: string; skill: string; agent: string; summary: string }>;
  evidence: Array<{ sourceType: 'evaluation' | 'learning_commit' | 'agent_output' | 'resume' | 'project'; title: string; content: string; tags: string[]; confidence: number }>;
};

const DEMO_USERS: DemoUser[] = [
  {
    username: 'demo_zero_ai',
    password: '123456',
    realName: '林澄',
    email: 'demo_zero_ai@zhipath.local',
    school: '华南理工大学继续教育学院',
    major: '非计算机背景 / AI 应用入门',
    grade: '零基础转入',
    targetJob: 'AI 应用开发实习生',
    goalTitle: '8 周完成 AI 应用开发入门闭环',
    dailyHours: 1.5,
    interests: ['人工智能基础', 'Prompt Engineering', 'RAG 入门'],
    summary: '零基础用户，起点低但学习时间稳定。系统重点降低概念门槛，用可执行小任务建立信心。',
    project: { name: 'AI 学习助手入门 Demo', role: '学习者', desc: '完成一个可以提问、引用资料并展示来源的小型 RAG 页面。', stack: ['HTML', 'JavaScript', 'Cloud API'] },
    skills: [
      { name: '人工智能基础', before: 18, after: 48, trust: 0.72, source: 'exam' },
      { name: 'Prompt Engineering', before: 12, after: 44, trust: 0.68, source: 'conversation' },
      { name: 'RAG 基础', before: 8, after: 38, trust: 0.66, source: 'exam' },
      { name: 'JavaScript 基础', before: 22, after: 41, trust: 0.52, source: 'self_report' },
    ],
    weakTopics: [
      { label: '向量检索与关键词检索区别', beforeMastery: 28 },
      { label: 'HTTP 请求与响应结构', beforeMastery: 32 },
      { label: '模型输出引用校验', beforeMastery: 24 },
    ],
    learningDays: [
      { dayOffset: -5, minutes: 42, matchBefore: 31, matchAfter: 34, tasks: [{ skill: '人工智能基础', status: 'lecture_done', type: 'main', minutes: 22 }, { skill: 'JavaScript 基础', status: 'practice_done', type: 'side', minutes: 20 }] },
      { dayOffset: -3, minutes: 55, matchBefore: 34, matchAfter: 40, tasks: [{ skill: 'Prompt Engineering', status: 'done', type: 'main', minutes: 35 }, { skill: 'RAG 基础', status: 'lecture_done', type: 'main', minutes: 20 }] },
      { dayOffset: -1, minutes: 64, matchBefore: 40, matchAfter: 47, tasks: [{ skill: 'RAG 基础', status: 'exam_done', type: 'main', minutes: 38 }, { skill: '模型输出引用校验', status: 'practice_done', type: 'side', minutes: 26 }] },
    ],
    exams: [
      { skill: '人工智能基础', score: 72, passed: true, wrong: [{ topic: '监督学习和无监督学习', reason: '概念边界记忆不稳', next: '补一组分类示例题' }] },
      { skill: 'RAG 基础', score: 58, passed: false, wrong: [{ topic: '检索增强生成流程', reason: '把 embedding 和生成模型混在一起', next: '重做流程图讲义并安排补弱题' }] },
    ],
    resources: [
      { type: 'lecture', title: 'RAG 是怎么把资料变成回答依据的', skill: 'RAG 基础', agent: 'expert', summary: '用生活化比喻讲清切片、索引、召回、重排和引用。' },
      { type: 'quiz', title: 'AI 基础概念 10 分钟速测', skill: '人工智能基础', agent: 'exam', summary: '覆盖监督学习、生成式 AI、模型评估和应用边界。' },
    ],
    evidence: [
      { sourceType: 'resume', title: '林澄初始画像', tags: ['画像', '零基础', 'AI 应用'], confidence: 0.62, content: '用户是非计算机背景，能稳定投入每天 1.5 小时。初始访谈显示对 AI 概念有兴趣，但对模型训练、API、RAG 和前端交互缺少系统认识。建议先从可见结果的小型 AI 应用开始，再逐步补技术概念。' },
      { sourceType: 'evaluation', title: 'RAG 基础诊断结果', tags: ['RAG 基础', '测评'], confidence: 0.9, content: '用户在 RAG 基础测评中得分 58。错题集中在“向量库是否生成答案”“embedding 的作用”“引用证据与模型自信度的区别”。系统判定需要补充检索流程图和证据引用练习。' },
    ],
  },
  {
    username: 'demo_frontend_rag',
    password: '123456',
    realName: '周予安',
    email: 'demo_frontend_rag@zhipath.local',
    school: '广州软件学院',
    major: '前端开发 / AI 产品工程',
    grade: '大三',
    targetJob: 'RAG 前端工程师',
    goalTitle: '4 周做出可解释 RAG 前端作品',
    dailyHours: 2.0,
    interests: ['React', 'RAG', '可视化'],
    summary: '前端基础较好，缺后端检索链路和评估意识。系统重点把 UI 能力转化为 AI 应用完整链路。',
    project: { name: 'RAG 证据图谱工作台', role: '前端负责人', desc: '用 React + Three.js 展示知识库切片、来源、主题和搜索命中。', stack: ['React', 'TypeScript', 'Three.js', 'Vite'] },
    skills: [
      { name: 'React 状态管理', before: 64, after: 82, trust: 0.78, source: 'github' },
      { name: 'RAG 基础', before: 35, after: 69, trust: 0.86, source: 'exam' },
      { name: '前端工程化', before: 58, after: 76, trust: 0.74, source: 'github' },
      { name: '数据可视化', before: 42, after: 73, trust: 0.72, source: 'conversation' },
    ],
    weakTopics: [
      { label: '召回结果重排指标', beforeMastery: 46 },
      { label: '长文本切片策略', beforeMastery: 52 },
      { label: '前端错误态和空态设计', beforeMastery: 58 },
    ],
    learningDays: [
      { dayOffset: -6, minutes: 75, matchBefore: 58, matchAfter: 63, tasks: [{ skill: 'RAG 基础', status: 'lecture_done', type: 'main', minutes: 35 }, { skill: 'React 状态管理', status: 'code_done', type: 'main', minutes: 40 }] },
      { dayOffset: -4, minutes: 86, matchBefore: 63, matchAfter: 70, tasks: [{ skill: '数据可视化', status: 'code_done', type: 'main', minutes: 52 }, { skill: '前端工程化', status: 'practice_done', type: 'side', minutes: 34 }] },
      { dayOffset: -1, minutes: 92, matchBefore: 70, matchAfter: 78, tasks: [{ skill: 'RAG 基础', status: 'exam_done', type: 'main', minutes: 45 }, { skill: '召回结果重排指标', status: 'practice_done', type: 'side', minutes: 47 }] },
    ],
    exams: [
      { skill: 'RAG 基础', score: 86, passed: true, wrong: [{ topic: 'TopK 与重排', reason: '能解释流程但指标定义不精确', next: '补充重排指标对照题' }] },
      { skill: 'React 状态管理', score: 81, passed: true, wrong: [{ topic: '异步状态复用', reason: '边界状态考虑不足', next: '整理 loading/error/empty 模式' }] },
    ],
    resources: [
      { type: 'diagram', title: 'RAG 图谱节点与边设计说明', skill: '数据可视化', agent: 'maker', summary: '说明 core/source/cluster/chunk 四类节点以及 retrieved/tagged/contains 三类边。' },
      { type: 'lecture', title: '前端如何展示检索解释字段', skill: 'RAG 基础', agent: 'expert', summary: '把 vectorScore、keywordScore、tagScore、sourceConfidence 做成可读解释。' },
    ],
    evidence: [
      { sourceType: 'project', title: 'RAG 证据图谱工作台项目记录', tags: ['React', 'Three.js', 'RAG'], confidence: 0.86, content: '用户完成 RAG 图谱前端联调：图谱中心展示 Chroma 核心，外圈组织来源、主题和证据切片；搜索后高亮命中 chunk。项目体现较好的前端表达能力，但仍需补充召回评估指标。' },
      { sourceType: 'evaluation', title: 'RAG 前端工程测评', tags: ['RAG 基础', '前端工程化'], confidence: 0.94, content: '测评显示用户能正确解释切片、索引、召回和引用展示。主要弱点是 TopK 命中率、重排策略和失败兜底的量化表达。' },
    ],
  },
  {
    username: 'demo_python_agent',
    password: '123456',
    realName: '许明远',
    email: 'demo_python_agent@zhipath.local',
    school: '深圳职业技术大学',
    major: 'Python 后端 / Agent 工程',
    grade: '毕业设计阶段',
    targetJob: 'AI Agent 后端工程师',
    goalTitle: '6 周完成 Agent + RAG 后端闭环',
    dailyHours: 2.5,
    interests: ['Python', 'AI Agent', '后端 API'],
    summary: 'Python 基础扎实，后端工程化和 Agent 协作链路需要加强。系统重点训练任务拆解、工具调用和质量把关。',
    project: { name: '知识库智能体与质检员', role: '后端开发', desc: '实现资料清洗智能体、质检员智能体和通过后入库流程。', stack: ['NestJS', 'Python', 'MySQL', 'Chroma'] },
    skills: [
      { name: 'Python 基础', before: 72, after: 86, trust: 0.82, source: 'github' },
      { name: 'AI Agent 设计', before: 38, after: 74, trust: 0.84, source: 'exam' },
      { name: '后端 API 设计', before: 55, after: 78, trust: 0.8, source: 'github' },
      { name: '数据质检规则', before: 26, after: 67, trust: 0.76, source: 'conversation' },
    ],
    weakTopics: [
      { label: 'Agent 工具调用边界', beforeMastery: 44 },
      { label: '脏数据拦截规则', beforeMastery: 39 },
      { label: '异步任务状态机', beforeMastery: 51 },
    ],
    learningDays: [
      { dayOffset: -7, minutes: 80, matchBefore: 52, matchAfter: 59, tasks: [{ skill: '后端 API 设计', status: 'code_done', type: 'main', minutes: 48 }, { skill: 'AI Agent 设计', status: 'lecture_done', type: 'main', minutes: 32 }] },
      { dayOffset: -3, minutes: 104, matchBefore: 59, matchAfter: 69, tasks: [{ skill: '数据质检规则', status: 'done', type: 'main', minutes: 56 }, { skill: '异步任务状态机', status: 'practice_done', type: 'side', minutes: 48 }] },
      { dayOffset: 0, minutes: 96, matchBefore: 69, matchAfter: 77, tasks: [{ skill: 'AI Agent 设计', status: 'exam_done', type: 'main', minutes: 46 }, { skill: 'Agent 工具调用边界', status: 'practice_done', type: 'side', minutes: 50 }] },
    ],
    exams: [
      { skill: 'AI Agent 设计', score: 84, passed: true, wrong: [{ topic: '工具调用失败恢复', reason: '重试与降级策略描述不够完整', next: '补充错误恢复案例' }] },
      { skill: '数据质检规则', score: 78, passed: true, wrong: [{ topic: 'Prompt injection 检测', reason: '能识别明显指令，隐蔽污染识别不足', next: '增加 5 个对抗样本' }] },
    ],
    resources: [
      { type: 'code', title: 'Knowledge Inspector 规则清单', skill: '数据质检规则', agent: 'reviewer', summary: '包含来源、相关性、内容质量、安全、重复和版权摘要化六类检查。' },
      { type: 'lecture', title: 'Agent 工具调用失败后的降级路径', skill: 'AI Agent 设计', agent: 'expert', summary: '解释工具失败、空结果、超时、权限不足时的用户可读回复。' },
    ],
    evidence: [
      { sourceType: 'project', title: '知识库智能体后端闭环项目记录', tags: ['AI Agent', '数据质检', 'Chroma'], confidence: 0.88, content: '用户实现资料清洗智能体和质检员智能体，支持上传文本、URL 资料和资讯刷新。资料先进入暂存任务，清洗后由质检员检查来源、相关性、质量、安全和重复，通过后再写入 Evidence RAG。' },
      { sourceType: 'learning_commit', title: '质检规则学习提交', tags: ['数据质检规则', 'Prompt Injection'], confidence: 0.8, content: '用户完成 prompt injection、广告噪声、内容过短、来源缺失和版权长文本风险的规则整理，能够说明为什么质检员智能体不能和清洗智能体合并。' },
    ],
  },
  {
    username: 'demo_data_eval',
    password: '123456',
    realName: '陈芮',
    email: 'demo_data_eval@zhipath.local',
    school: '中山大学数据科学方向',
    major: '数据分析 / 模型评估',
    grade: '研一',
    targetJob: 'LLM 应用评估工程师',
    goalTitle: '建立 RAG 与出题质量评测基准',
    dailyHours: 2.0,
    interests: ['模型评估', 'RAG Benchmark', '数据分析'],
    summary: '数据分析能力强，适合承担评测指标和看板。系统重点训练如何把 AI 应用效果量化。',
    project: { name: 'RAG 检索质量 Benchmark', role: '评估负责人', desc: '构建 50 个标准问题，统计 TopK 命中、引用覆盖和无证据降级。', stack: ['SQL', 'Python', 'RAG', 'Dashboard'] },
    skills: [
      { name: '数据分析', before: 76, after: 88, trust: 0.86, source: 'github' },
      { name: 'RAG 评估', before: 34, after: 79, trust: 0.88, source: 'exam' },
      { name: 'LLM 质量评估', before: 40, after: 81, trust: 0.86, source: 'exam' },
      { name: 'SQL 查询', before: 70, after: 84, trust: 0.78, source: 'github' },
    ],
    weakTopics: [
      { label: '无证据回答统计', beforeMastery: 48 },
      { label: '引用覆盖率定义', beforeMastery: 54 },
      { label: '评测样本分层', beforeMastery: 57 },
    ],
    learningDays: [
      { dayOffset: -8, minutes: 70, matchBefore: 61, matchAfter: 66, tasks: [{ skill: 'RAG 评估', status: 'lecture_done', type: 'main', minutes: 40 }, { skill: 'SQL 查询', status: 'practice_done', type: 'side', minutes: 30 }] },
      { dayOffset: -4, minutes: 110, matchBefore: 66, matchAfter: 75, tasks: [{ skill: 'LLM 质量评估', status: 'done', type: 'main', minutes: 58 }, { skill: '评测样本分层', status: 'practice_done', type: 'main', minutes: 52 }] },
      { dayOffset: -1, minutes: 98, matchBefore: 75, matchAfter: 83, tasks: [{ skill: 'RAG 评估', status: 'exam_done', type: 'main', minutes: 48 }, { skill: '引用覆盖率定义', status: 'done', type: 'side', minutes: 50 }] },
    ],
    exams: [
      { skill: 'RAG 评估', score: 91, passed: true, wrong: [{ topic: 'NDCG 与简单命中率', reason: '知道用途但公式表达不完整', next: '补充指标对照卡片' }] },
      { skill: 'LLM 质量评估', score: 88, passed: true, wrong: [{ topic: '拒答边界', reason: '安全边界和业务边界混淆', next: '整理无证据降级样例' }] },
    ],
    resources: [
      { type: 'report', title: 'RAG 检索质量评估模板', skill: 'RAG 评估', agent: 'reviewer', summary: '定义 Top1/Top3/Top5 命中率、引用覆盖率、关键词兜底成功率。' },
      { type: 'lecture', title: '从题目审核看 LLM 输出质量', skill: 'LLM 质量评估', agent: 'expert', summary: '解释结构完整性、答案唯一性、解析回证据、难度贴合。' },
    ],
    evidence: [
      { sourceType: 'evaluation', title: 'RAG Benchmark 评估记录', tags: ['RAG 评估', 'LLM 质量评估'], confidence: 0.95, content: '用户设计 50 个标准问题，按基础概念、流程理解、风险治理、工程实现、评估指标五类分层。每个问题绑定标准答案要点和应命中的证据 chunk，用于计算 TopK 命中与引用覆盖率。' },
      { sourceType: 'agent_output', title: '出题质量指标草案', tags: ['严格出题', '质量评估'], confidence: 0.76, content: '指标包括生成成功率、结构校验通过率、引用真实率、答案唯一性、解析可回溯率、用户正确率和错题归因覆盖率。建议在报告页展示趋势而不是只展示单次得分。' },
    ],
  },
  {
    username: 'demo_backend_cloud',
    password: '123456',
    realName: '何子墨',
    email: 'demo_backend_cloud@zhipath.local',
    school: '东莞理工学院',
    major: '后端开发 / 云开发部署',
    grade: '大四',
    targetJob: '全栈云开发工程师',
    goalTitle: '5 周完成前后端部署与运维闭环',
    dailyHours: 2.2,
    interests: ['NestJS', '数据库', '云部署'],
    summary: '后端基础较好，部署和运维经验不足。系统重点训练服务联调、数据库状态、日志和公网访问。',
    project: { name: 'CodeNova 本地到公网演示链路', role: '全栈开发', desc: '打通 Vite、NestJS、MySQL、Chroma、Cloudflare Tunnel 的演示环境。', stack: ['NestJS', 'MySQL', 'Chroma', 'Cloudflare Tunnel'] },
    skills: [
      { name: 'NestJS 模块化', before: 58, after: 80, trust: 0.8, source: 'github' },
      { name: 'MySQL 数据建模', before: 54, after: 77, trust: 0.76, source: 'exam' },
      { name: '云开发部署', before: 31, after: 70, trust: 0.74, source: 'conversation' },
      { name: '服务可观测性', before: 28, after: 66, trust: 0.72, source: 'exam' },
    ],
    weakTopics: [
      { label: '端口冲突诊断', beforeMastery: 52 },
      { label: '公网访问 Host 校验', beforeMastery: 43 },
      { label: '向量库健康检查', beforeMastery: 47 },
    ],
    learningDays: [
      { dayOffset: -6, minutes: 88, matchBefore: 54, matchAfter: 62, tasks: [{ skill: 'NestJS 模块化', status: 'code_done', type: 'main', minutes: 50 }, { skill: 'MySQL 数据建模', status: 'practice_done', type: 'main', minutes: 38 }] },
      { dayOffset: -3, minutes: 94, matchBefore: 62, matchAfter: 71, tasks: [{ skill: '云开发部署', status: 'done', type: 'main', minutes: 52 }, { skill: '端口冲突诊断', status: 'practice_done', type: 'side', minutes: 42 }] },
      { dayOffset: 0, minutes: 102, matchBefore: 71, matchAfter: 79, tasks: [{ skill: '服务可观测性', status: 'exam_done', type: 'main', minutes: 44 }, { skill: '向量库健康检查', status: 'done', type: 'side', minutes: 58 }] },
    ],
    exams: [
      { skill: '云开发部署', score: 82, passed: true, wrong: [{ topic: 'Vite Host 校验', reason: '知道现象但首次没有定位到请求头', next: '补充 tunnel 参数复盘' }] },
      { skill: 'MySQL 数据建模', score: 76, passed: true, wrong: [{ topic: '幂等种子脚本', reason: '缺少重复执行清理策略', next: '整理 upsert 和软删除模式' }] },
    ],
    resources: [
      { type: 'runbook', title: 'Chroma 与 MySQL 健康检查手册', skill: '服务可观测性', agent: 'reviewer', summary: '列出端口、容器、集合、embedding provider 和降级检索检查步骤。' },
      { type: 'lecture', title: '从本机 IP 到公网 Tunnel 的部署链路', skill: '云开发部署', agent: 'expert', summary: '解释 0.0.0.0 监听、代理、Host Header 和公网临时域名。' },
    ],
    evidence: [
      { sourceType: 'project', title: '公网访问链路排障记录', tags: ['云开发部署', '服务可观测性'], confidence: 0.87, content: '用户定位 Vite dev server 在 Cloudflare Tunnel 下返回 Host 校验错误，通过 cloudflared 的 http-host-header 指向 localhost:5180 解决。该过程体现端口监听、代理请求头和公网访问诊断能力。' },
      { sourceType: 'learning_commit', title: 'Chroma 健康检查提交', tags: ['Chroma', 'RAG', '服务可观测性'], confidence: 0.82, content: '用户发现 8000 端口被 Python 进程占用，避免直接杀进程，改用 8001 映射 Chroma，并通过 check:chroma 验证集合、写入和搜索。' },
    ],
  },
];

const AGENTS = [
  { type: 'diagnose', animal: 'cat', color: '#dbeafe', nickname: 'Mira', role: 'Learning Diagnostician', station: 1 },
  { type: 'expert', animal: 'owl', color: '#dcfce7', nickname: 'Sage', role: 'Domain Expert', station: 2 },
  { type: 'maker', animal: 'rabbit', color: '#ede9fe', nickname: 'Nova', role: 'Resource Maker', station: 3 },
  { type: 'reviewer', animal: 'fox', color: '#fef3c7', nickname: 'Guard', role: 'Quality Reviewer', station: 4 },
  { type: 'planner', animal: 'deer', color: '#fce7f3', nickname: 'Pathy', role: 'Path Planner', station: 5 },
  { type: 'knowledge', animal: 'owl', color: '#dbeafe', nickname: 'Indexa', role: 'Knowledge Curator', station: 6 },
  { type: 'inspector', animal: 'fox', color: '#fee2e2', nickname: 'Guard', role: 'Quality Inspector', station: 7 },
];

function loadEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function envConfig() {
  return { get: (key: string, def?: any) => process.env[key] ?? def };
}

function json(value: unknown) {
  return JSON.stringify(value);
}

function day(offset: number) {
  const d = new Date(Date.now() + offset * 86400000);
  return d.toISOString().slice(0, 10);
}

function ts(daysOffset = 0, hour = 9) {
  const d = new Date(Date.now() + daysOffset * 86400000);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

function hash(content: string) {
  return createHash('md5').update(content).digest('hex');
}

async function tableExists(conn: mysql.Connection, table: string) {
  const [rows] = await conn.query('SHOW TABLES LIKE ?', [table]);
  return (rows as any[]).length > 0;
}

async function ensureTable(conn: mysql.Connection, name: string, ddl: string) {
  if (!(await tableExists(conn, name))) await conn.query(ddl);
}

async function ensureTables(conn: mysql.Connection) {
  await ensureTable(conn, 'users_v3', `CREATE TABLE users_v3 (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 1, create_time BIGINT NULL, update_time BIGINT NULL,
    username VARCHAR(100) NOT NULL, password VARCHAR(255) NOT NULL, real_name VARCHAR(100) NULL, phone VARCHAR(20) NULL,
    email VARCHAR(200) NULL, avatar VARCHAR(500) NULL, role ENUM('admin','student') NOT NULL DEFAULT 'student', PRIMARY KEY(id), UNIQUE KEY uk_users_v3_username(username)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureTable(conn, 'students_v3', `CREATE TABLE students_v3 (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 1, create_time BIGINT NULL, update_time BIGINT NULL,
    user_id BIGINT NOT NULL, name VARCHAR(100) NULL, student_no VARCHAR(50) NULL, school VARCHAR(100) NULL, major VARCHAR(100) NULL,
    grade VARCHAR(20) NULL, phone VARCHAR(20) NULL, email VARCHAR(200) NULL, target_job_id BIGINT NULL, interests JSON NULL,
    skills JSON NULL, projects JSON NULL, github_username VARCHAR(100) NULL, work_experience JSON NULL, awards JSON NULL,
    self_intro TEXT NULL, daily_hours DECIMAL(3,1) NULL, target_deadline VARCHAR(50) NULL, onboarding_completed TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY(id), KEY idx_students_v3_user(user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureTable(conn, 'job_positions_v3', `CREATE TABLE job_positions_v3 (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 1, create_time BIGINT NULL, update_time BIGINT NULL,
    title VARCHAR(200) NOT NULL, company VARCHAR(200) NULL, level ENUM('junior','mid','senior') NOT NULL DEFAULT 'junior', jd_text TEXT NULL,
    required_skills JSON NULL, preferred_skills JSON NULL, salary_range VARCHAR(100) NULL, location VARCHAR(200) NULL,
    delivery_threshold TINYINT NOT NULL DEFAULT 60, source VARCHAR(50) NOT NULL DEFAULT 'manual', confidence_score DECIMAL(3,2) NULL,
    enterprise_id BIGINT NULL, neo4j_node_id VARCHAR(100) NULL, PRIMARY KEY(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureTable(conn, 'learning_plans_v3', `CREATE TABLE learning_plans_v3 (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 1, create_time BIGINT NULL, update_time BIGINT NULL,
    user_id BIGINT NOT NULL, plan_name VARCHAR(100) NOT NULL DEFAULT 'Default Plan', plan_type ENUM('main','side') NOT NULL DEFAULT 'main', target_job_id BIGINT NULL,
    domain_id VARCHAR(80) NOT NULL DEFAULT 'software-engineering', goal_type ENUM('career','course','exam','certificate','project','interest') NOT NULL DEFAULT 'interest',
    goal_title VARCHAR(160) NOT NULL DEFAULT '', plan_status ENUM('active','paused','archived') NOT NULL DEFAULT 'active', schedule_enabled TINYINT NOT NULL DEFAULT 1,
    path_data JSON NULL, current_phase INT NOT NULL DEFAULT 0, daily_hours DECIMAL(3,1) NULL, main_ratio TINYINT NOT NULL DEFAULT 80,
    match_score DECIMAL(5,2) NULL, estimated_date VARCHAR(50) NULL, branch_from BIGINT NULL, PRIMARY KEY(id), KEY idx_learning_plans_user(user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureTable(conn, 'learning_tasks_v3', `CREATE TABLE learning_tasks_v3 (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 1, create_time BIGINT NULL, update_time BIGINT NULL,
    user_id BIGINT NOT NULL, plan_id BIGINT NOT NULL, skill_name VARCHAR(100) NOT NULL, task_type ENUM('main','side') NOT NULL DEFAULT 'main',
    task_status ENUM('pending','in_progress','lecture_done','practice_done','code_done','exam_done','skipped','done') NOT NULL DEFAULT 'pending',
    estimated_min INT NULL, actual_min INT NULL, sort_order INT NOT NULL DEFAULT 0, priority TINYINT NOT NULL DEFAULT 5, plan_date VARCHAR(20) NULL,
    start_time BIGINT NULL, complete_time BIGINT NULL, is_active TINYINT NOT NULL DEFAULT 1, PRIMARY KEY(id), KEY idx_learning_tasks_user_date(user_id, plan_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureTable(conn, 'learning_sessions_v3', `CREATE TABLE learning_sessions_v3 (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 1, create_time BIGINT NULL, update_time BIGINT NULL,
    user_id BIGINT NOT NULL, plan_id BIGINT NULL, session_date VARCHAR(20) NOT NULL, started_at BIGINT NULL, ended_at BIGINT NULL, total_duration_ms BIGINT NOT NULL DEFAULT 0,
    tasks_snapshot JSON NULL, skill_changes JSON NULL, match_score_before DECIMAL(5,2) NULL, match_score_after DECIMAL(5,2) NULL,
    PRIMARY KEY(id), KEY idx_learning_sessions_user(user_id, session_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureTable(conn, 'user_skills_v3', `CREATE TABLE user_skills_v3 (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 1, create_time BIGINT NULL, update_time BIGINT NULL,
    user_id BIGINT NOT NULL, skill_name VARCHAR(100) NOT NULL, mastery_pct DECIMAL(5,2) NOT NULL DEFAULT 0, trust_weight DECIMAL(3,2) NOT NULL DEFAULT 0.30,
    source ENUM('self_report','conversation','github','exam') NOT NULL DEFAULT 'self_report', last_activity BIGINT NULL, decay_start BIGINT NULL,
    PRIMARY KEY(id), KEY idx_user_skills_user(user_id, skill_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureTable(conn, 'learning_branches_v3', `CREATE TABLE learning_branches_v3 (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 1, create_time BIGINT NULL, update_time BIGINT NULL,
    user_id BIGINT NOT NULL, branch_name VARCHAR(120) NOT NULL, branch_type ENUM('main','plan','side','experiment') NOT NULL DEFAULT 'main', plan_id BIGINT NULL,
    base_commit_id BIGINT NULL, head_commit_id BIGINT NULL, source_branch_id BIGINT NULL, merged_at BIGINT NULL, PRIMARY KEY(id), KEY idx_learning_branches_user(user_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureTable(conn, 'learning_commits_v3', `CREATE TABLE learning_commits_v3 (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 1, create_time BIGINT NULL, update_time BIGINT NULL,
    user_id BIGINT NOT NULL, branch_id BIGINT NOT NULL, parent_commit_id BIGINT NULL, merge_source_commit_id BIGINT NULL,
    commit_type ENUM('baseline','lecture_read','quiz_passed','quiz_failed','code_done','skill_complete','task_done','manual','merge','rollback') NOT NULL DEFAULT 'manual',
    skill_name VARCHAR(120) NULL, message VARCHAR(240) NOT NULL, payload_json JSON NULL, snapshot_id BIGINT NULL, delta_json JSON NULL,
    PRIMARY KEY(id), KEY idx_learning_commits_user_branch(user_id, branch_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureTable(conn, 'skill_snapshots_v3', `CREATE TABLE skill_snapshots_v3 (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 1, create_time BIGINT NULL, update_time BIGINT NULL,
    user_id BIGINT NOT NULL, branch_id BIGINT NOT NULL, commit_id BIGINT NOT NULL, skills_json JSON NOT NULL, radar_json JSON NOT NULL, ability_metrics_json JSON NULL,
    match_summary_json JSON NULL, total_mastery INT NOT NULL DEFAULT 0, skill_count INT NOT NULL DEFAULT 0, depth_score INT NOT NULL DEFAULT 0,
    breadth_score INT NOT NULL DEFAULT 0, balance_score INT NOT NULL DEFAULT 0, PRIMARY KEY(id), KEY idx_skill_snapshots_user_branch(user_id, branch_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureTable(conn, 'exam_questions_v3', `CREATE TABLE exam_questions_v3 (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 0, create_time BIGINT NULL, update_time BIGINT NULL,
    generation_task_id BIGINT NULL, source_order INT NULL, exam_type TINYINT NOT NULL, skill_name VARCHAR(100) NULL, job_id BIGINT NULL,
    question_type ENUM('choice','fill','coding','essay') NOT NULL, title VARCHAR(500) NOT NULL, content JSON NOT NULL, answer JSON NULL,
    difficulty TINYINT NOT NULL DEFAULT 1, confidence_score DECIMAL(3,2) NULL, pass_rate DECIMAL(5,2) NULL,
    created_by ENUM('agent','manual','enterprise') NOT NULL DEFAULT 'agent', reviewed_by BIGINT NULL, reviewed_at BIGINT NULL,
    PRIMARY KEY(id), KEY idx_exam_questions_skill(skill_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureTable(conn, 'exam_records_v3', `CREATE TABLE exam_records_v3 (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 1, create_time BIGINT NULL, update_time BIGINT NULL,
    user_id BIGINT NOT NULL, exam_type TINYINT NOT NULL DEFAULT 1, skill_name VARCHAR(100) NULL, job_id BIGINT NULL, question_ids JSON NULL,
    score DECIMAL(5,2) NULL, passed TINYINT NULL DEFAULT 0, answers JSON NULL, wrong_analysis JSON NULL, retry_count INT NOT NULL DEFAULT 0, next_retry_time BIGINT NULL,
    PRIMARY KEY(id), KEY idx_exam_records_user(user_id, create_time)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureTable(conn, 'generated_resources_v3', `CREATE TABLE generated_resources_v3 (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 1, create_time BIGINT NULL, update_time BIGINT NULL,
    user_id BIGINT NOT NULL, resource_type VARCHAR(40) NOT NULL, title VARCHAR(200) NOT NULL, skill_name VARCHAR(120) NULL, source VARCHAR(30) NOT NULL DEFAULT 'manual',
    source_task_id BIGINT NULL, external_id VARCHAR(160) NULL, chat_session_id VARCHAR(128) NULL, chat_message_id VARCHAR(128) NULL, agent_type VARCHAR(30) NULL,
    resource_status ENUM('pending','running','success','failed') NOT NULL DEFAULT 'pending', payload JSON NULL, preview_meta JSON NULL, provider VARCHAR(50) NULL,
    raw_request JSON NULL, raw_response JSON NULL, cost_tokens INT NOT NULL DEFAULT 0, cost_credits DECIMAL(10,4) NOT NULL DEFAULT 0, duration_ms INT NULL, error_message TEXT NULL,
    PRIMARY KEY(id), UNIQUE KEY uk_generated_resources_external_id(external_id), KEY idx_generated_resources_user(user_id, create_time)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureTable(conn, 'agent_profiles_v3', `CREATE TABLE agent_profiles_v3 (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 1, create_time BIGINT NULL, update_time BIGINT NULL,
    user_id BIGINT NOT NULL, agent_type VARCHAR(30) NOT NULL, animal_type VARCHAR(20) NOT NULL, color VARCHAR(10) NOT NULL, nickname VARCHAR(20) NOT NULL,
    display_role VARCHAR(30) NOT NULL, station_id INT NULL, agent_status ENUM('idle','busy') NOT NULL DEFAULT 'idle', PRIMARY KEY(id), KEY idx_agent_profiles_user(user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureTable(conn, 'agent_tasks_v3', `CREATE TABLE agent_tasks_v3 (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 1, create_time BIGINT NULL, update_time BIGINT NULL,
    user_id BIGINT NOT NULL, agent_type VARCHAR(30) NOT NULL, title VARCHAR(200) NOT NULL, description TEXT NULL, params JSON NULL,
    task_status ENUM('pending','running','success','failed','cancelled') NOT NULL DEFAULT 'pending', progress INT NOT NULL DEFAULT 0, result JSON NULL, error_message TEXT NULL,
    is_urgent TINYINT NOT NULL DEFAULT 0, sort_order INT NOT NULL DEFAULT 0, started_at BIGINT NULL, completed_at BIGINT NULL,
    group_id VARCHAR(64) NULL, external_id VARCHAR(128) NULL, output_type VARCHAR(40) NULL, target_entity JSON NULL,
    PRIMARY KEY(id), UNIQUE KEY uk_agent_tasks_external_id(external_id), KEY idx_agent_tasks_user(user_id, create_time)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureTable(conn, 'remediation_runs', `CREATE TABLE remediation_runs (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 1, create_time BIGINT NULL, update_time BIGINT NULL,
    user_id BIGINT NOT NULL, topics JSON NULL, task_id BIGINT NULL, run_status VARCHAR(20) NOT NULL DEFAULT 'pending', PRIMARY KEY(id), KEY idx_remediation_run_user_time(user_id, create_time)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureTable(conn, 'question_generation_tasks', `CREATE TABLE question_generation_tasks (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 1, create_time BIGINT NULL, update_time BIGINT NULL,
    user_id BIGINT NOT NULL, subject VARCHAR(120) NOT NULL DEFAULT '', curriculum VARCHAR(120) NOT NULL DEFAULT '', locale VARCHAR(20) NOT NULL DEFAULT 'zh-CN',
    grade VARCHAR(80) NOT NULL DEFAULT '', question_types JSON NOT NULL, question_count TINYINT NOT NULL, difficulty TINYINT NOT NULL DEFAULT 5,
    difficulty_mix JSON NULL, topics JSON NULL, instructions TEXT NOT NULL, metadata JSON NULL, reference_library TINYINT NOT NULL DEFAULT 0,
    task_status ENUM('pending','running','completed','failed','cancelled') NOT NULL DEFAULT 'pending', progress JSON NULL, result_count INT NOT NULL DEFAULT 0,
    error_message TEXT NULL, started_at BIGINT NULL, completed_at BIGINT NULL, PRIMARY KEY(id), KEY idx_question_generation_user_time(user_id, create_time)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureTable(conn, 'question_generation_snapshots', `CREATE TABLE question_generation_snapshots (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 1, create_time BIGINT NULL, update_time BIGINT NULL,
    task_id BIGINT NOT NULL, user_id BIGINT NOT NULL, questions JSON NOT NULL, config JSON NULL, review_statuses JSON NULL, version INT NOT NULL DEFAULT 1,
    PRIMARY KEY(id), UNIQUE KEY uq_question_generation_snapshot_task(task_id), KEY idx_question_generation_snapshot_user(user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureTable(conn, 'knowledge_ingestion_tasks', `CREATE TABLE knowledge_ingestion_tasks (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 1, create_time BIGINT NULL, update_time BIGINT NULL,
    task_id VARCHAR(64) NOT NULL, user_id BIGINT NOT NULL, source_kind VARCHAR(30) NOT NULL, ingestion_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    title VARCHAR(220) NOT NULL, source_url VARCHAR(1000) NULL, source_name VARCHAR(160) NULL, raw_text MEDIUMTEXT NULL, cleaned_text MEDIUMTEXT NULL,
    summary TEXT NULL, skill_tags JSON NULL, chunk_preview JSON NULL, curator_result JSON NULL, inspection_result JSON NULL, ingested_chunk_ids JSON NULL,
    failure_reason TEXT NULL, PRIMARY KEY(id), UNIQUE KEY uk_knowledge_ingestion_task_id(task_id), KEY idx_knowledge_ingestion_user_time(user_id, create_time),
    KEY idx_knowledge_ingestion_status(user_id, ingestion_status, create_time)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureTable(conn, 'evidence_chunks', `CREATE TABLE evidence_chunks (
    id BIGINT NOT NULL AUTO_INCREMENT, status TINYINT NOT NULL DEFAULT 1, create_time BIGINT NULL, update_time BIGINT NULL,
    user_id BIGINT NOT NULL, source_type VARCHAR(30) NOT NULL, source_id VARCHAR(120) NOT NULL, chunk_index INT NOT NULL DEFAULT 0, title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL, content_hash VARCHAR(64) NOT NULL, skill_tags JSON NULL, job_target_id BIGINT NULL, confidence DECIMAL(4,2) NOT NULL DEFAULT 0.70,
    visibility VARCHAR(20) NOT NULL DEFAULT 'private', vector_status VARCHAR(20) NOT NULL DEFAULT 'pending', PRIMARY KEY(id), KEY idx_evidence_user_source(user_id, source_type, source_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

async function upsertJob(conn: mysql.Connection, demo: DemoUser) {
  const now = Date.now();
  const [rows] = await conn.query('SELECT id FROM job_positions_v3 WHERE title = ? AND source = ? LIMIT 1', [demo.targetJob, 'award_demo_seed']);
  const existing = rows as Array<{ id: number }>;
  const required = demo.skills.slice(0, 4).map((skill) => ({ name: skill.name, weight: Math.max(0.55, Math.min(1, skill.after / 100)) }));
  if (existing.length) {
    await conn.query('UPDATE job_positions_v3 SET jd_text=?, required_skills=?, preferred_skills=?, delivery_threshold=?, confidence_score=?, status=1, update_time=? WHERE id=?', [
      `${demo.targetJob} 需要 ${demo.skills.map((s) => s.name).join('、')} 等能力，要求能完成真实项目闭环并说明质量指标。`,
      json(required),
      json([{ name: '作品复盘', weight: 0.7 }, { name: '数据看板', weight: 0.65 }]),
      68,
      0.88,
      now,
      existing[0].id,
    ]);
    return Number(existing[0].id);
  }
  const [insert] = await conn.query(
    'INSERT INTO job_positions_v3 (title, company, level, jd_text, required_skills, preferred_skills, salary_range, location, delivery_threshold, source, confidence_score, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
    [demo.targetJob, 'CodeNova Demo Lab', 'junior', `${demo.targetJob} 需要 ${demo.skills.map((s) => s.name).join('、')} 等能力，要求能完成真实项目闭环并说明质量指标。`, json(required), json([{ name: '作品复盘', weight: 0.7 }, { name: '数据看板', weight: 0.65 }]), '8k-15k', '广州/深圳/远程', 68, 'award_demo_seed', 0.88, now, now],
  );
  return Number((insert as any).insertId);
}

async function upsertUser(conn: mysql.Connection, demo: DemoUser) {
  const now = Date.now();
  const passwordHash = await bcrypt.hash(demo.password, 10);
  const [rows] = await conn.query('SELECT id FROM users_v3 WHERE username = ? LIMIT 1', [demo.username]);
  const existing = rows as Array<{ id: number }>;
  if (existing.length) {
    await conn.query('UPDATE users_v3 SET password=?, real_name=?, email=?, role=?, status=1, update_time=? WHERE id=?', [passwordHash, demo.realName, demo.email, 'student', now, existing[0].id]);
    return Number(existing[0].id);
  }
  const [insert] = await conn.query(
    'INSERT INTO users_v3 (username, password, real_name, email, role, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
    [demo.username, passwordHash, demo.realName, demo.email, 'student', now, now],
  );
  return Number((insert as any).insertId);
}

async function resetDemoData(conn: mysql.Connection, userId: number) {
  const tables = [
    'students_v3', 'learning_tasks_v3', 'learning_sessions_v3', 'user_skills_v3', 'learning_plans_v3', 'learning_branches_v3',
    'learning_commits_v3', 'skill_snapshots_v3', 'exam_records_v3', 'question_generation_snapshots', 'question_generation_tasks',
    'knowledge_ingestion_tasks', 'generated_resources_v3', 'agent_profiles_v3', 'agent_tasks_v3', 'remediation_runs', 'evidence_chunks',
  ];
  for (const table of tables) {
    if (await tableExists(conn, table)) await conn.query(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
  }
}

async function seedOne(conn: mysql.Connection, rag: EvidenceRagService, chroma: ChromaService, demo: DemoUser) {
  const now = Date.now();
  const lastLearningDay = demo.learningDays[demo.learningDays.length - 1];
  const userId = await upsertUser(conn, demo);
  const jobId = await upsertJob(conn, demo);
  await resetDemoData(conn, userId);

  const projectSkills = demo.skills.map((skill) => ({ name: skill.name, level: skill.after >= 80 ? '熟练' : skill.after >= 60 ? '进阶' : '入门', source: skill.source }));
  await conn.query(
    'INSERT INTO students_v3 (user_id, name, student_no, school, major, grade, email, target_job_id, interests, skills, projects, work_experience, awards, self_intro, daily_hours, target_deadline, onboarding_completed, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)',
    [
      userId,
      demo.realName,
      `DEMO-${demo.username.replace('demo_', '').toUpperCase()}`,
      demo.school,
      demo.major,
      demo.grade,
      demo.email,
      jobId,
      json(demo.interests),
      json(projectSkills),
      json([demo.project]),
      json([{ company: 'CodeNova Demo Lab', role: demo.project.role, period: '2026.08-2026.09', description: demo.project.desc }]),
      json([{ name: 'CodeNova 阶段性学习闭环优秀样本', date: '2026-09' }]),
      demo.summary,
      demo.dailyHours,
      '2026-10-30',
      now,
      now,
    ],
  );

  for (const skill of demo.skills) {
    await conn.query(
      'INSERT INTO user_skills_v3 (user_id, skill_name, mastery_pct, trust_weight, source, last_activity, decay_start, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      [userId, skill.name, skill.after, skill.trust, skill.source, ts(0, 18), ts(14, 0), now, now],
    );
  }

  const pathData = {
    phases: [
      { title: '画像诊断', status: 'done', skills: demo.skills.slice(0, 2).map((skill) => skill.name) },
      { title: '证据学习', status: 'done', skills: demo.skills.slice(1, 4).map((skill) => skill.name) },
      { title: '严格出题', status: 'active', skills: demo.weakTopics.map((topic) => topic.label) },
      { title: '项目复盘', status: 'next', skills: ['作品表达', '数据看板'] },
    ],
    evidence: { generatedBy: 'award_demo_seed', userSummary: demo.summary },
  };
  const [planInsert] = await conn.query(
    'INSERT INTO learning_plans_v3 (user_id, plan_name, plan_type, target_job_id, domain_id, goal_type, goal_title, plan_status, schedule_enabled, path_data, current_phase, daily_hours, main_ratio, match_score, estimated_date, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
    [userId, `${demo.realName} · ${demo.targetJob} 主线`, 'main', jobId, 'ai-native-engineering', 'career', demo.goalTitle, 'active', json(pathData), 2, demo.dailyHours, 80, lastLearningDay?.matchAfter || 70, '2026-10-30', now, now],
  );
  const planId = Number((planInsert as any).insertId);

  for (const [dayIndex, learningDay] of demo.learningDays.entries()) {
    const sessionDate = day(learningDay.dayOffset);
    const taskSnapshot: any[] = [];
    for (const [taskIndex, task] of learningDay.tasks.entries()) {
      const complete = ['done', 'exam_done', 'practice_done', 'code_done', 'lecture_done'].includes(task.status);
      const [taskInsert] = await conn.query(
        'INSERT INTO learning_tasks_v3 (user_id, plan_id, skill_name, task_type, task_status, estimated_min, actual_min, sort_order, priority, plan_date, start_time, complete_time, is_active, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)',
        [userId, planId, task.skill, task.type, task.status, task.minutes + 8, task.minutes, dayIndex * 10 + taskIndex, task.type === 'main' ? 8 : 5, sessionDate, ts(learningDay.dayOffset, 19), complete ? ts(learningDay.dayOffset, 20) : null, now, now],
      );
      taskSnapshot.push({ id: Number((taskInsert as any).insertId), skillName: task.skill, status: task.status, minutes: task.minutes });
    }
    await conn.query(
      'INSERT INTO learning_sessions_v3 (user_id, plan_id, session_date, started_at, ended_at, total_duration_ms, tasks_snapshot, skill_changes, match_score_before, match_score_after, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      [
        userId,
        planId,
        sessionDate,
        ts(learningDay.dayOffset, 19),
        ts(learningDay.dayOffset, 21),
        learningDay.minutes * 60000,
        json(taskSnapshot),
        json(demo.skills.slice(0, 3).map((skill) => ({ name: skill.name, before: Math.max(skill.before, skill.after - 8 - dayIndex * 3), after: Math.min(skill.after, skill.before + (dayIndex + 1) * 12) }))),
        learningDay.matchBefore,
        learningDay.matchAfter,
        now + learningDay.dayOffset,
        now + learningDay.dayOffset,
      ],
    );
  }

  const [branchInsert] = await conn.query(
    'INSERT INTO learning_branches_v3 (user_id, branch_name, branch_type, plan_id, base_commit_id, head_commit_id, status, create_time, update_time) VALUES (?, ?, ?, ?, NULL, NULL, 1, ?, ?)',
    [userId, `${demo.realName} 能力主干`, 'main', planId, now, now],
  );
  const branchId = Number((branchInsert as any).insertId);
  let parentCommitId: number | null = null;
  for (const [index, skill] of demo.skills.entries()) {
    const [commitInsert] = await conn.query(
      'INSERT INTO learning_commits_v3 (user_id, branch_id, parent_commit_id, merge_source_commit_id, commit_type, skill_name, message, payload_json, snapshot_id, delta_json, status, create_time, update_time) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, NULL, ?, 1, ?, ?)',
      [
        userId,
        branchId,
        parentCommitId,
        index === 0 ? 'baseline' : skill.after >= 70 ? 'skill_complete' : 'quiz_passed',
        skill.name,
        `${skill.name} 从 ${skill.before}% 提升到 ${skill.after}%`,
        json({ before: skill.before, after: skill.after, trust: skill.trust, source: skill.source, generatedBy: 'award_demo_seed' }),
        json({ masteryPct: skill.after - skill.before, trustWeight: skill.trust }),
        now + index,
        now + index,
      ],
    );
    parentCommitId = Number((commitInsert as any).insertId);
  }
  await conn.query('UPDATE learning_branches_v3 SET head_commit_id=?, update_time=? WHERE id=?', [parentCommitId, now, branchId]);
  const avgMastery = Math.round(demo.skills.reduce((sum, skill) => sum + skill.after, 0) / demo.skills.length);
  await conn.query(
    'INSERT INTO skill_snapshots_v3 (user_id, branch_id, commit_id, skills_json, radar_json, ability_metrics_json, match_summary_json, total_mastery, skill_count, depth_score, breadth_score, balance_score, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
    [
      userId,
      branchId,
      parentCommitId,
      json(demo.skills.map((skill) => ({ name: skill.name, masteryPct: skill.after, trustWeight: skill.trust, source: skill.source }))),
      json(demo.skills.map((skill) => ({ name: skill.name, value: skill.after }))),
      json({ avgMastery, reliableEvidenceCount: demo.evidence.length + demo.exams.length, weakTopicCount: demo.weakTopics.length, dailyHours: demo.dailyHours }),
      json({ targetJob: demo.targetJob, matchBefore: demo.learningDays[0]?.matchBefore, matchAfter: lastLearningDay?.matchAfter, delta: Math.round((lastLearningDay?.matchAfter || 0) - (demo.learningDays[0]?.matchBefore || 0)) }),
      avgMastery,
      demo.skills.length,
      Math.max(...demo.skills.map((skill) => skill.after)),
      demo.skills.length * 20,
      Math.max(50, 100 - (Math.max(...demo.skills.map((skill) => skill.after)) - Math.min(...demo.skills.map((skill) => skill.after)))),
      now,
      now,
    ],
  );

  const [generationTaskInsert] = await conn.query(
    'INSERT INTO question_generation_tasks (user_id, subject, curriculum, locale, grade, question_types, question_count, difficulty, difficulty_mix, topics, instructions, metadata, reference_library, task_status, progress, result_count, started_at, completed_at, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 1, ?, ?)',
    [
      userId,
      `${demo.targetJob} 严格出题`,
      'CodeNova Demo Curriculum',
      'zh-CN',
      demo.grade,
      json(['choice']),
      demo.exams.length,
      4,
      json({ easy: 0.2, medium: 0.6, hard: 0.2 }),
      json(demo.weakTopics.map((topic) => topic.label)),
      '基于用户画像、错题和 Evidence RAG 证据生成，题目必须有唯一答案和可回溯解析。',
      json({ generatedBy: 'award_demo_seed', targetJob: demo.targetJob, qualityGate: ['结构完整', '答案唯一', '解析可回证据', '难度贴合'] }),
      'completed',
      json({ current: demo.exams.length, total: demo.exams.length, failed: 0, message: '演示样本题目已生成并通过审核' }),
      demo.exams.length,
      ts(-1, 16),
      ts(-1, 17),
      now,
      now,
    ],
  );
  const generationTaskId = Number((generationTaskInsert as any).insertId);

  const questionIds: number[] = [];
  const snapshotQuestions: any[] = [];
  for (const [examIndex, exam] of demo.exams.entries()) {
    const qContent = {
      stem: `${exam.skill} 场景题：下面哪一项最符合 ${demo.targetJob} 的真实工作要求？`,
      options: ['只看模型输出是否流畅', '结合证据、用户目标和质量指标做判断', '只要能调用大模型 API 就完成', '忽略失败样例'],
      citations: demo.evidence.slice(0, 2).map((_, idx) => `证据#${idx + 1}`),
      generatedBy: 'award_demo_seed',
    };
    const [qInsert] = await conn.query(
      'INSERT INTO exam_questions_v3 (generation_task_id, source_order, exam_type, skill_name, job_id, question_type, title, content, answer, difficulty, confidence_score, pass_rate, status, created_by, reviewed_by, reviewed_at, create_time, update_time) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NULL, ?, ?, ?)',
      [generationTaskId, examIndex + 1, exam.skill, jobId, 'choice', `${exam.skill} 严格出题样例`, json(qContent), json({ correct: 1, explanation: '需要结合证据链、用户目标和质量指标，而不是只看模型输出。', citationRequired: true }), Math.min(5, Math.max(2, Math.round(exam.score / 20))), 0.86, exam.score, 'agent', ts(-1, 17), now, now],
    );
    const questionId = Number((qInsert as any).insertId);
    questionIds.push(questionId);
    snapshotQuestions.push({
      id: questionId,
      type: 'choice',
      skillName: exam.skill,
      title: `${exam.skill} 严格出题样例`,
      content: qContent,
      answer: { correct: 1, explanation: '需要结合证据链、用户目标和质量指标，而不是只看模型输出。', citationRequired: true },
      review: { status: 'approved', citationValid: true, answerUnique: true, difficultyFit: true, score: exam.score },
    });
    await conn.query(
      'INSERT INTO exam_records_v3 (user_id, exam_type, skill_name, job_id, question_ids, score, passed, answers, wrong_analysis, retry_count, next_retry_time, status, create_time, update_time) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      [
        userId,
        exam.skill,
        jobId,
        json([Number((qInsert as any).insertId)]),
        exam.score,
        exam.passed ? 1 : 0,
        json({ [String((qInsert as any).insertId)]: exam.passed ? 1 : 0, submittedAt: ts(-1, 20) }),
        json({ wrong: exam.wrong, weakTopics: exam.wrong.map((item) => item.topic), nextAction: exam.wrong[0]?.next, evidenceBound: true, citationValid: true }),
        exam.passed ? 0 : 1,
        exam.passed ? null : ts(2, 20),
        ts(-examIndex - 1, 20),
        now,
      ],
    );
  }

  await conn.query(
    'INSERT INTO question_generation_snapshots (task_id, user_id, questions, config, review_statuses, version, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)',
    [
      generationTaskId,
      userId,
      json(snapshotQuestions),
      json({ subject: `${demo.targetJob} 严格出题`, topics: demo.weakTopics, referenceLibrary: true, generatedBy: 'award_demo_seed' }),
      json(snapshotQuestions.map(() => 'approved')),
      now,
      now,
    ],
  );

  for (const [index, resource] of demo.resources.entries()) {
    await conn.query(
      'INSERT INTO generated_resources_v3 (user_id, resource_type, title, skill_name, source, external_id, agent_type, resource_status, payload, preview_meta, provider, cost_tokens, cost_credits, duration_ms, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      [
        userId,
        resource.type,
        resource.title,
        resource.skill,
        'manual',
        `award-demo:${demo.username}:resource:${index}`,
        resource.agent,
        'success',
        json({ summary: resource.summary, outline: ['学习目标', '关键概念', '练习任务', '检查标准'], evidenceChunkIds: [], generatedBy: 'award_demo_seed' }),
        json({ display: 'demo', skill: resource.skill, user: demo.realName }),
        'seed',
        1200 + index * 160,
        0,
        800 + index * 120,
        now,
        now,
      ],
    );
  }

  for (const [index, agent] of AGENTS.entries()) {
    await conn.query(
      'INSERT INTO agent_profiles_v3 (user_id, agent_type, animal_type, color, nickname, display_role, station_id, agent_status, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      [userId, agent.type, agent.animal, agent.color, agent.nickname, agent.role, agent.station, index === 5 ? 'busy' : 'idle', now, now],
    );
  }
  const agentTasks = [
    { agent: 'diagnose', title: '更新用户能力画像', desc: `根据最近 ${demo.exams.length} 次考试与 ${demo.learningDays.length} 天学习记录更新能力雷达。`, outputType: 'evaluation' },
    { agent: 'knowledge', title: '整理个人学习证据', desc: '把项目记录、错题分析和生成资源摘要写入 Evidence RAG。', outputType: 'knowledge' },
    { agent: 'reviewer', title: '审核出题质量', desc: '检查题目结构、答案唯一性和解析引用有效性。', outputType: 'evaluation' },
    { agent: 'planner', title: '生成下一步补弱计划', desc: `围绕 ${demo.weakTopics.map((topic) => topic.label).join('、')} 安排补弱。`, outputType: 'plan' },
  ];
  for (const [index, task] of agentTasks.entries()) {
    await conn.query(
      'INSERT INTO agent_tasks_v3 (user_id, agent_type, title, description, params, task_status, progress, result, is_urgent, sort_order, started_at, completed_at, group_id, external_id, output_type, target_entity, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      [userId, task.agent, task.title, task.desc, json({ demoUser: demo.username, targetJob: demo.targetJob }), 'success', 100, json({ summary: task.desc, quality: 'passed' }), index === 2 ? 1 : 0, index, ts(0, 9), ts(0, 10), `award-demo-${demo.username}`, `award-demo:${demo.username}:agent-task:${index}`, task.outputType, json({ skillName: demo.skills[index % demo.skills.length].name, planId }), now, now],
    );
  }

  await conn.query(
    'INSERT INTO remediation_runs (user_id, topics, task_id, run_status, status, create_time, update_time) VALUES (?, ?, ?, ?, 1, ?, ?)',
    [userId, json(demo.weakTopics), questionIds[0] || null, demo.weakTopics.length ? 'completed' : 'pending', now, now],
  );

  const sourceIds = demo.evidence.map((item, index) => `award-demo:${demo.username}:${item.sourceType}:${index}`);
  for (const sourceId of sourceIds) await chroma.deleteBySource(userId, sourceId);
  await conn.query('DELETE FROM evidence_chunks WHERE user_id = ? AND source_id LIKE ?', [userId, `award-demo:${demo.username}:%`]);
  let chunkCount = 0;
  const ingestedChunkIds: number[] = [];
  for (const [index, item] of demo.evidence.entries()) {
    const sourceId = sourceIds[index];
    const content = [item.content, `用户：${demo.realName}`, `目标岗位：${demo.targetJob}`, `相关项目：${demo.project.name}`, `技能标签：${item.tags.join('、')}`].join('\n');
    const chunks = await rag.ingest(userId, {
      sourceType: item.sourceType,
      sourceId,
      title: item.title,
      content,
      skillTags: item.tags,
      jobTargetId: jobId,
      confidence: item.confidence,
      visibility: 'private',
    });
    const chunkIds = chunks.map((chunk) => Number(chunk.id));
    ingestedChunkIds.push(...chunkIds);
    await conn.query(
      'INSERT INTO knowledge_ingestion_tasks (task_id, user_id, source_kind, ingestion_status, title, source_url, source_name, raw_text, cleaned_text, summary, skill_tags, chunk_preview, curator_result, inspection_result, ingested_chunk_ids, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      [
        `award-demo:${demo.username}:knowledge:${index}`,
        userId,
        index % 2 === 0 ? 'upload_text' : 'news_manual',
        'ingested',
        item.title,
        null,
        'CodeNova Demo Evidence',
        item.content,
        content,
        `${item.title} 已由知识库智能体清洗，并经质检员确认可作为 ${demo.targetJob} 的学习证据。`,
        json(item.tags),
        json(chunks.map((chunk) => ({ title: chunk.title, content: chunk.content.slice(0, 160), chunkType: item.sourceType, tags: item.tags }))),
        json({ agent: 'knowledge-curator', status: 'approved', normalizedTitle: item.title, removedNoise: ['重复寒暄', '无关营销'], chunkCount: chunks.length }),
        json({ agent: 'knowledge-inspector', status: 'approved', checks: { relevance: true, sourceTraceable: true, safety: true, duplicate: false, citationReady: true }, score: Math.round(item.confidence * 100) }),
        json(chunkIds),
        now,
        now,
      ],
    );
    chunkCount += chunks.length;
  }

  return { userId, username: demo.username, password: demo.password, realName: demo.realName, targetJob: demo.targetJob, planId, jobId, questionCount: questionIds.length, evidenceChunks: chunkCount, knowledgeChunks: ingestedChunkIds.length, avgMastery, matchScore: lastLearningDay?.matchAfter || null };
}

async function main() {
  loadEnv(path.join(__dirname, '..', '.env'));
  const mysqlOptions = {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3307),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root123',
    database: process.env.MYSQL_DATABASE || 'zhipath',
  };

  const conn = await mysql.createConnection(mysqlOptions);
  await ensureTables(conn);
  await conn.query(
    "DELETE FROM exam_questions_v3 WHERE created_by = 'agent' AND title LIKE '%严格出题样例' AND JSON_UNQUOTE(JSON_EXTRACT(content, '$.generatedBy')) = 'award_demo_seed'",
  );

  const dataSource = new DataSource({
    type: 'mysql',
    host: mysqlOptions.host,
    port: mysqlOptions.port,
    username: mysqlOptions.user,
    password: mysqlOptions.password,
    database: mysqlOptions.database,
    synchronize: false,
    entities: [EvidenceChunk],
  });
  await dataSource.initialize();
  const chunkRepo = dataSource.getRepository(EvidenceChunk);
  const chroma = new ChromaService(envConfig() as any);
  const rag = new EvidenceRagService(chunkRepo, chroma, envConfig() as any);

  const results = [];
  for (const demo of DEMO_USERS) {
    results.push(await seedOne(conn, rag, chroma, demo));
  }

  const benchmarkRows = [];
  for (const result of results) {
    const probes = ['RAG 评估', '严格出题质量', 'AI Agent 设计', '云开发部署', '模型输出引用校验'];
    for (const query of probes) {
      const items = await rag.search(result.userId, query, { limit: 3, explain: true });
      benchmarkRows.push({ username: result.username, query, hits: items.length, top: items[0]?.title || '', score: items[0]?.score || 0, mode: items[0]?.retrieval?.mode || 'none' });
    }
  }

  console.log(JSON.stringify({
    ok: true,
    users: results,
    accounts: results.map((item) => ({ username: item.username, password: item.password, realName: item.realName, targetJob: item.targetJob })),
    summary: {
      userCount: results.length,
      totalQuestions: results.reduce((sum, item) => sum + item.questionCount, 0),
      totalEvidenceChunks: results.reduce((sum, item) => sum + item.evidenceChunks, 0),
      avgMastery: Math.round(results.reduce((sum, item) => sum + item.avgMastery, 0) / Math.max(1, results.length)),
      chromaEnabled: chroma.enabled,
      embeddingProvider: process.env.EMBEDDING_PROVIDER || 'off',
    },
    benchmark: benchmarkRows,
  }, null, 2));

  await dataSource.destroy();
  await conn.end();
}

main().catch((error) => {
  console.error('[SeedAwardDemoUsers] Failed:', error);
  process.exit(1);
});

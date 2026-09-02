import { useEffect, useMemo, useState, type ReactNode } from 'react';
import heroImage from '../assets/hero.png';
import {
  IconBook,
  IconChart,
  IconCheck,
  IconCode,
  IconDocument,
  IconDownload,
  IconGraph,
  IconRefresh,
  IconRobot,
  IconSearch,
  IconTarget,
  IconWarning,
} from '../components/icons';
import './competition.css';

type LearnerLevel = 'foundation' | 'project' | 'transition';
type DecisionAction = '降维解释' | '补弱巩固' | '进阶挑战';
type ModuleKey = 'cockpit' | 'profile' | 'agents' | 'knowledge' | 'factory' | 'report';

type Learner = {
  id: string;
  name: string;
  level: LearnerLevel;
  title: string;
  background: string;
  targetRole: string;
  weeklyHours: number;
  theoryScore: number;
  practiceScore: number;
  strengths: string[];
  blindSpots: string[];
};

type AgentStage = {
  id: string;
  name: string;
  role: string;
  status: 'success' | 'warning';
  output: string;
  confidence: number;
};

type Resource = {
  type: 'lecture' | 'labGuide' | 'stagedQuiz';
  title: string;
  level: string;
  summary: string;
  sections: string[];
  evidence: string[];
};

type LoopResult = {
  learner: Learner;
  domain: {
    id: string;
    name: string;
    knowledgeSlice: string;
    targetRole: string;
  };
  agents: AgentStage[];
  report: {
    matchScore: number;
    hallucinationRisk: number;
    citationCoverage: number;
    blindSpots: Array<{ skill: string; severity: number; reason: string }>;
    difficultyCurve: Array<{ week: string; target: number; adapted: number }>;
    pathNodes: Array<{ id: string; title: string; level: string; status: 'done' | 'active' | 'next' }>;
  };
  resources: Resource[];
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
    action: DecisionAction;
    reason: string;
    nextTasks: string[];
  };
};

const fallbackLearners: Learner[] = [
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

const moduleItems: Array<{ key: ModuleKey; label: string; desc: string; icon: ReactNode }> = [
  { key: 'cockpit', label: '总览指挥台', desc: '一屏完成演示', icon: <IconGraph size={18} /> },
  { key: 'profile', label: '学情诊断', desc: '画像与盲区', icon: <IconTarget size={18} /> },
  { key: 'agents', label: '协同决策舱', desc: '多 Agent 闭环', icon: <IconRobot size={18} /> },
  { key: 'knowledge', label: '知识工坊', desc: 'RAG 与溯源', icon: <IconSearch size={18} /> },
  { key: 'factory', label: '资源工厂', desc: '讲义/实操/题目', icon: <IconCode size={18} /> },
  { key: 'report', label: '决策报告', desc: '路径与反馈', icon: <IconChart size={18} /> },
];

const knowledgeTags = ['React/Vite', 'NestJS', 'RAG', '多 Agent', '测试交付'];

function getDecision(quizAccuracy: number): DecisionAction {
  if (quizAccuracy < 60) return '降维解释';
  if (quizAccuracy >= 85) return '进阶挑战';
  return '补弱巩固';
}

function makeFallbackLoop(learnerId: string, quizAccuracy: number): LoopResult {
  const learner = fallbackLearners.find((item) => item.id === learnerId) || fallbackLearners[0];
  const action = getDecision(quizAccuracy);
  const matchScore = Math.max(45, Math.min(94, Math.round((learner.theoryScore + learner.practiceScore + quizAccuracy) / 3)));
  const citationCoverage = learner.level === 'project' ? 94 : learner.level === 'transition' ? 91 : 89;
  const hallucinationRisk = learner.level === 'foundation' ? 4.8 : learner.level === 'transition' ? 4.2 : 3.6;
  const resourceLevel = action === '进阶挑战' ? 'L3 挑战' : action === '降维解释' ? 'L1 入门' : 'L2 巩固';

  return {
    learner,
    domain: {
      id: 'ai-native-software-development',
      name: 'AI 原生软件开发技能培训',
      knowledgeSlice: 'React/Vite + NestJS + RAG + 多 Agent 编排 + 软件交付质量',
      targetRole: learner.targetRole,
    },
    agents: [
      {
        id: 'profile',
        name: '学情诊断 Agent',
        role: '读取画像与测评记录，定位理论底盘和技能盲区。',
        status: 'success',
        output: `${learner.name} 优先补齐 ${learner.blindSpots[0]}，实践分 ${learner.practiceScore} 低于目标基线。`,
        confidence: 91,
      },
      {
        id: 'domain',
        name: '领域专家 Agent',
        role: '基于软件开发知识库提供可追溯依据。',
        status: 'success',
        output: '命中前端工程、后端服务、RAG、多 Agent 编排与交付质量 5 类知识片段。',
        confidence: 94,
      },
      {
        id: 'generator',
        name: '资源生成 Agent',
        role: '生成定制讲义、实操指南和分阶测试题。',
        status: 'success',
        output: `已生成${action === '进阶挑战' ? '挑战型' : action === '降维解释' ? '入门型' : '巩固型'}资源包。`,
        confidence: 88,
      },
      {
        id: 'reviewer',
        name: '审核裁判 Agent',
        role: '交叉验证事实、引用、难度和格式。',
        status: action === '降维解释' ? 'warning' : 'success',
        output: `引用覆盖率 ${citationCoverage}%，幻觉风险 ${hallucinationRisk}%。`,
        confidence: 90,
      },
      {
        id: 'decision',
        name: '路径决策 Agent',
        role: '融合反馈并给出下一轮导学策略。',
        status: 'success',
        output: `本轮决策为“${action}”。`,
        confidence: 89,
      },
    ],
    report: {
      matchScore,
      hallucinationRisk,
      citationCoverage,
      blindSpots: learner.blindSpots.map((skill, index) => ({
        skill,
        severity: Math.min(95, 66 + index * 8),
        reason: index === 0 ? '先验测评与实操记录共同指向该短板' : '任务完成度低于目标岗位基线',
      })),
      difficultyCurve: ['第1周', '第2周', '第3周', '第4周'].map((week, index) => ({
        week,
        target: 42 + index * 12,
        adapted: Math.max(28, Math.min(92, 42 + index * 10 + (quizAccuracy >= 85 ? 12 : quizAccuracy < 60 ? -6 : 4))),
      })),
      pathNodes: [
        { id: 'profile', title: '学情画像建模', level: 'L1', status: 'done' },
        { id: 'web', title: 'React/Vite 工程基础', level: 'L1-L2', status: 'active' },
        { id: 'api', title: 'NestJS API 与数据建模', level: 'L2', status: 'next' },
        { id: 'rag', title: 'RAG 知识库与引用校验', level: 'L3', status: 'next' },
        { id: 'agents', title: '多 Agent 编排与评测闭环', level: 'L3-L4', status: 'next' },
      ],
    },
    resources: [
      {
        type: 'lecture',
        title: `${learner.blindSpots[0]}定制讲义`,
        level: resourceLevel,
        summary: '用学习者熟悉的背景解释核心概念，并标注必须掌握的知识边界。',
        sections: ['学习目标', '核心概念', '常见误区', '复盘问题'],
        evidence: ['React/Vite 前端工程', '多 Agent 协同：诊断、生成、审核、决策角色分工'],
      },
      {
        type: 'labGuide',
        title: `${learner.targetRole}实操指南`,
        level: resourceLevel,
        summary: '把知识点转成可验收的工程任务，包含环境、步骤、检查点和提交证据。',
        sections: ['环境准备', '任务步骤', '验收标准', '故障排查'],
        evidence: ['NestJS 后端工程', '软件交付质量'],
      },
      {
        type: 'stagedQuiz',
        title: `${learner.blindSpots[1]}分阶测试题`,
        level: resourceLevel,
        summary: '按基础题、应用题、挑战题组织，答题反馈会驱动下一轮路径调整。',
        sections: ['基础理解', '工程应用', '挑战迁移', '错因标签'],
        evidence: ['RAG 知识库工程', '软件交付质量'],
      },
    ],
    evidenceTrail: [
      {
        id: 'react-vite',
        source: '软件开发知识库 / 前端工程切片',
        claim: `${learner.name} 的首要盲区是 ${learner.blindSpots[0]}，资源难度需与当前工程前置知识保持一致。`,
        coverage: learner.level === 'project' ? 94 : 92,
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
        coverage: learner.level === 'project' ? 96 : 94,
      },
    ],
    debate: [
      {
        agent: '领域专家 Agent',
        stance: `资源必须围绕 ${learner.blindSpots[0]}，不得跳到未掌握的高阶框架细节。`,
        verdict: 'pass',
      },
      {
        agent: '审核裁判 Agent',
        stance:
          learner.level === 'foundation' || action === '降维解释'
            ? '检测到生成内容难度偏高，要求改写为概念图 + 最小可运行样例。'
            : '证据链完整，允许保留进阶任务，但需附带验收脚本。',
        verdict: learner.level === 'foundation' || action === '降维解释' ? 'revise' : 'pass',
      },
      {
        agent: '路径决策 Agent',
        stance: `采纳“${action}”策略，并把下一轮测试结果写回学习者画像。`,
        verdict: 'pass',
      },
    ],
    decision: {
      action,
      reason:
        action === '降维解释'
          ? `本轮正确率 ${quizAccuracy}% 低于 60%，先把 ${learner.blindSpots[0]} 拆成概念图和最小样例。`
          : action === '进阶挑战'
            ? `本轮正确率 ${quizAccuracy}% 达到进阶阈值，可以进入跨模块工程交付挑战。`
            : `本轮正确率 ${quizAccuracy}% 处于巩固区间，优先修复关键盲区。`,
      nextTasks:
        action === '降维解释'
          ? ['生成 10 分钟微讲义', '补 3 道基础诊断题', '安排带提示的最小实操']
          : action === '进阶挑战'
            ? ['生成跨模块挑战任务', '加入测试与验收标准', '提交项目证据并进入审核']
            : ['生成错因复盘卡', '补充同构变式练习', '保持当前难度并缩短反馈周期'],
    },
  };
}

function ensureLoopResult(result: LoopResult, learnerId: string, quizAccuracy: number): LoopResult {
  const fallback = makeFallbackLoop(learnerId, quizAccuracy);
  return {
    ...fallback,
    ...result,
    evidenceTrail: result.evidenceTrail?.length ? result.evidenceTrail : fallback.evidenceTrail,
    debate: result.debate?.length ? result.debate : fallback.debate,
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const payload = await res.json();
  return payload.data as T;
}

function Competition() {
  const [activeModule, setActiveModule] = useState<ModuleKey>('cockpit');
  const [learners, setLearners] = useState<Learner[]>(fallbackLearners);
  const [selectedLearnerId, setSelectedLearnerId] = useState(fallbackLearners[1].id);
  const [quizAccuracy, setQuizAccuracy] = useState(90);
  const [loop, setLoop] = useState<LoopResult>(() => makeFallbackLoop(fallbackLearners[1].id, 90));
  const [apiState, setApiState] = useState<'checking' | 'connected' | 'fallback'>('checking');
  const [notice, setNotice] = useState('比赛演示环境已就绪');

  const selectedLearner = useMemo(
    () => learners.find((learner) => learner.id === selectedLearnerId) || learners[0],
    [learners, selectedLearnerId],
  );

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ learners: Learner[] }>('/api/competition/demo-cases')
      .then((data) => {
        if (cancelled) return;
        setLearners(data.learners);
        setSelectedLearnerId((current) => data.learners.some((item) => item.id === current) ? current : data.learners[0]?.id || current);
        setApiState('connected');
      })
      .catch(() => {
        if (cancelled) return;
        setApiState('fallback');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runLoop = async (learnerId = selectedLearnerId, accuracy = quizAccuracy) => {
    setNotice('多智能体正在重新编排学习路径');
    try {
      const result = await fetchJson<LoopResult>('/api/competition/run-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, quizAccuracy: accuracy }),
      });
      setLoop(ensureLoopResult(result, learnerId, accuracy));
      setApiState('connected');
      setNotice(`已生成“${result.decision.action}”决策`);
    } catch {
      const fallback = makeFallbackLoop(learnerId, accuracy);
      setLoop(fallback);
      setApiState('fallback');
      setNotice(`离线演示已生成“${fallback.decision.action}”决策`);
    }
  };

  useEffect(() => {
    runLoop(selectedLearnerId, quizAccuracy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLearnerId]);

  const handleAccuracyChange = (value: number) => {
    setQuizAccuracy(value);
    setLoop((current) => makeFallbackLoop(current.learner.id, value));
    setNotice(`交互反馈已更新为 ${value}%`);
  };

  const exportReport = () => {
    const content = JSON.stringify({ learner: loop.learner, report: loop.report, decision: loop.decision, resources: loop.resources }, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CodeNova-${loop.learner.name}-decision-report.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('决策报告已导出');
  };

  const activeModuleItem = moduleItems.find((item) => item.key === activeModule) || moduleItems[0];

  return (
    <main className="nova-app">
      <aside className="nova-sidebar">
        <div className="nova-brand">
          <span>CN</span>
          <div>
            <strong>焕星·码枢</strong>
            <small>CodeNova Competition</small>
          </div>
        </div>

        <nav className="nova-module-nav" aria-label="CodeNova 模块导航">
          {moduleItems.map((item) => (
            <button
              type="button"
              key={item.key}
              className={activeModule === item.key ? 'active' : ''}
              onClick={() => setActiveModule(item.key)}
            >
              {item.icon}
              <span>
                <strong>{item.label}</strong>
                <small>{item.desc}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="nova-side-card">
          <span className={`nova-status ${apiState}`}>{apiState === 'connected' ? 'API 已连接' : apiState === 'checking' ? '连接中' : '离线演示'}</span>
          <p>{notice}</p>
        </div>
      </aside>

      <section className="nova-main">
        <header className="nova-topbar">
          <div>
            <span className="nova-kicker">上海云之脑智能科技有限公司 · 领域知识个性化生成与多智能体协同决策系统研究</span>
            <h1>{activeModuleItem.label}</h1>
          </div>
          <div className="nova-actions">
            <button type="button" onClick={() => runLoop()} className="nova-primary">
              <IconRefresh size={16} /> 运行闭环
            </button>
            <button type="button" onClick={exportReport} className="nova-secondary">
              <IconDownload size={16} /> 导出报告
            </button>
          </div>
        </header>

        <section className="nova-control-strip" aria-label="演示控制台">
          <div className="nova-learner-tabs">
            {learners.map((learner) => (
              <button
                type="button"
                key={learner.id}
                className={selectedLearnerId === learner.id ? 'active' : ''}
                onClick={() => setSelectedLearnerId(learner.id)}
              >
                <strong>{learner.name}</strong>
                <span>{learner.title}</span>
              </button>
            ))}
          </div>
          <div className="nova-feedback-control">
            <div>
              <span>交互反馈正确率</span>
              <strong>{quizAccuracy}%</strong>
            </div>
            <input
              type="range"
              min="35"
              max="96"
              value={quizAccuracy}
              onChange={(event) => handleAccuracyChange(Number(event.target.value))}
              onMouseUp={() => runLoop(selectedLearnerId, quizAccuracy)}
              onTouchEnd={() => runLoop(selectedLearnerId, quizAccuracy)}
            />
          </div>
        </section>

        {activeModule === 'cockpit' && <CockpitView loop={loop} selectedLearner={selectedLearner} setActiveModule={setActiveModule} />}
        {activeModule === 'profile' && <ProfileView loop={loop} />}
        {activeModule === 'agents' && <AgentsView loop={loop} />}
        {activeModule === 'knowledge' && <KnowledgeView loop={loop} />}
        {activeModule === 'factory' && <FactoryView loop={loop} />}
        {activeModule === 'report' && <ReportView loop={loop} />}
      </section>
    </main>
  );
}

function CockpitView({
  loop,
  selectedLearner,
  setActiveModule,
}: {
  loop: LoopResult;
  selectedLearner: Learner;
  setActiveModule: (module: ModuleKey) => void;
}) {
  return (
    <div className="nova-view">
      <section className="nova-hero-system">
        <div className="nova-hero-copy">
          <span>垂直软件开发按需导学决策系统</span>
          <h2>从学习者画像到可信资源生成，一套闭环完成。</h2>
          <p>
            CodeNova 将 ZhiPath 的画像、路径、Agent、RAG、题库和成长报告底座收束成比赛版完整系统，服务 AI 原生软件开发技能培训。
          </p>
          <div className="nova-metric-row">
            <Metric value="5+" label="协同 Agent" />
            <Metric value={String(loop.resources.length)} label="资源形态" />
            <Metric value={`${loop.report.citationCoverage}%`} label="引用覆盖" />
            <Metric value={`<${Math.ceil(loop.report.hallucinationRisk)}%`} label="幻觉风险" />
          </div>
        </div>
        <div className="nova-orbit">
          <img src={heroImage} alt="" />
          <button type="button" className="orbit-node node-profile" onClick={() => setActiveModule('profile')}>画像</button>
          <button type="button" className="orbit-node node-rag" onClick={() => setActiveModule('knowledge')}>RAG</button>
          <button type="button" className="orbit-node node-agent" onClick={() => setActiveModule('agents')}>Agent</button>
          <button type="button" className="orbit-node node-report" onClick={() => setActiveModule('report')}>报告</button>
        </div>
      </section>

      <section className="nova-cockpit-grid">
        <Panel title="当前学习者" icon={<IconTarget size={18} />} badge={selectedLearner.targetRole}>
          <div className="nova-profile-summary">
            <h3>{selectedLearner.name}</h3>
            <p>{selectedLearner.background}</p>
            <div className="nova-mini-metrics">
              <Metric value={String(selectedLearner.theoryScore)} label="理论" />
              <Metric value={String(selectedLearner.practiceScore)} label="实操" />
              <Metric value={`${selectedLearner.weeklyHours}h`} label="周投入" />
            </div>
          </div>
        </Panel>

        <Panel title="本轮系统决策" icon={<IconWarning size={18} />} badge={loop.decision.action}>
          <div className="nova-decision-brief">
            <strong>{loop.decision.action}</strong>
            <p>{loop.decision.reason}</p>
            <div className="nova-task-stack">
              {loop.decision.nextTasks.map((task) => (
                <span key={task}><IconCheck size={14} />{task}</span>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Agent 运行态" icon={<IconRobot size={18} />} badge="实时编排">
          <div className="nova-agent-mini">
            {loop.agents.map((agent, index) => (
              <button type="button" key={agent.id} onClick={() => setActiveModule('agents')}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{agent.name.replace(' Agent', '')}</strong>
                <em>{agent.confidence}%</em>
              </button>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function ProfileView({ loop }: { loop: LoopResult }) {
  return (
    <div className="nova-view nova-two-col">
      <Panel title="画像档案" icon={<IconTarget size={18} />} badge={loop.learner.title}>
        <div className="nova-profile-detail">
          <div>
            <h2>{loop.learner.name}</h2>
            <p>{loop.learner.background}</p>
          </div>
          <div className="nova-skill-tags">
            {loop.learner.strengths.map((item) => <span key={item}>{item}</span>)}
          </div>
          <div className="nova-diagnostic-grid">
            <Diagnostic label="理论测评" value={loop.learner.theoryScore} />
            <Diagnostic label="实践测评" value={loop.learner.practiceScore} />
            <Diagnostic label="资源匹配" value={loop.report.matchScore} />
          </div>
        </div>
      </Panel>
      <Panel title="知识盲区定位" icon={<IconChart size={18} />} badge="优先级排序">
        <BlindSpotList loop={loop} />
      </Panel>
    </div>
  );
}

function AgentsView({ loop }: { loop: LoopResult }) {
  return (
    <div className="nova-view nova-two-col wide-left">
      <Panel title="协同编排流水线" icon={<IconRobot size={18} />} badge="分析-生成-校验-决策">
        <div className="nova-agent-pipeline">
          {loop.agents.map((agent, index) => (
            <article className={`nova-agent-card ${agent.status}`} key={agent.id}>
              <div className="nova-agent-index">{String(index + 1).padStart(2, '0')}</div>
              <div>
                <div className="nova-agent-title">
                  <h3>{agent.name}</h3>
                  <span>{agent.confidence}%</span>
                </div>
                <p>{agent.role}</p>
                <strong>{agent.output}</strong>
              </div>
            </article>
          ))}
        </div>
      </Panel>
      <Panel title="辩论与交叉验证" icon={<IconWarning size={18} />} badge="幻觉防控">
        <DebateList loop={loop} />
      </Panel>
    </div>
  );
}

function KnowledgeView({ loop }: { loop: LoopResult }) {
  return (
    <div className="nova-view">
      <section className="nova-knowledge-layout">
        <Panel title="领域知识库" icon={<IconBook size={18} />} badge={loop.domain.name}>
          <div className="nova-knowledge-map">
            {knowledgeTags.map((tag, index) => (
              <article key={tag}>
                <span>KB-{String(index + 1).padStart(2, '0')}</span>
                <strong>{tag}</strong>
                <p>{index < loop.evidenceTrail.length ? loop.evidenceTrail[index].claim : '训练资源按岗位能力要求进行约束生成。'}</p>
              </article>
            ))}
          </div>
        </Panel>
        <Panel title="证据链溯源" icon={<IconSearch size={18} />} badge="约束生成">
          <EvidenceTrail loop={loop} />
        </Panel>
      </section>
    </div>
  );
}

function FactoryView({ loop }: { loop: LoopResult }) {
  return (
    <div className="nova-view">
      <section className="nova-resource-grid">
        {loop.resources.map((resource) => (
          <article className="nova-resource-card" key={resource.type}>
            <div className="nova-resource-head">
              <span>{resource.type === 'lecture' ? <IconBook size={21} /> : resource.type === 'labGuide' ? <IconCode size={21} /> : <IconDocument size={21} />}</span>
              <em>{resource.level}</em>
            </div>
            <h3>{resource.title}</h3>
            <p>{resource.summary}</p>
            <div className="nova-resource-sections">
              {resource.sections.map((section) => <span key={section}>{section}</span>)}
            </div>
            <div className="nova-evidence-lines">
              {resource.evidence.map((item) => <small key={item}>依据：{item}</small>)}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function ReportView({ loop }: { loop: LoopResult }) {
  return (
    <div className="nova-view nova-two-col wide-left">
      <Panel title="个人学情与资源匹配度报告" icon={<IconChart size={18} />} badge={loop.domain.targetRole}>
        <div className="nova-report-board">
          <div className="nova-score-ring" style={{ ['--score' as string]: `${loop.report.matchScore * 3.6}deg` }}>
            <div>
              <strong>{loop.report.matchScore}</strong>
              <span>资源匹配</span>
            </div>
          </div>
          <div className="nova-report-metrics">
            <Metric value={`${loop.report.citationCoverage}%`} label="知识引用覆盖率" />
            <Metric value={`${loop.report.hallucinationRisk}%`} label="幻觉风险评估" />
            <Metric value={String(loop.report.blindSpots.length)} label="关键盲区" />
          </div>
        </div>
        <PathMap loop={loop} />
      </Panel>
      <Panel title="动态迭代策略" icon={<IconRefresh size={18} />} badge={loop.decision.action}>
        <div className="nova-decision-brief">
          <strong>{loop.decision.action}</strong>
          <p>{loop.decision.reason}</p>
          <div className="nova-task-stack">
            {loop.decision.nextTasks.map((task) => <span key={task}><IconCheck size={14} />{task}</span>)}
          </div>
        </div>
        <DifficultyCurve loop={loop} />
      </Panel>
    </div>
  );
}

function Panel({ title, icon, badge, children }: { title: string; icon: ReactNode; badge?: string; children: ReactNode }) {
  return (
    <section className="nova-panel">
      <header>
        <div>
          <span>{icon}</span>
          <h2>{title}</h2>
        </div>
        {badge && <em>{badge}</em>}
      </header>
      {children}
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="nova-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Diagnostic({ label, value }: { label: string; value: number }) {
  return (
    <div className="nova-diagnostic">
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
      <i><b style={{ width: `${value}%` }} /></i>
    </div>
  );
}

function BlindSpotList({ loop }: { loop: LoopResult }) {
  return (
    <div className="nova-blind-list">
      {loop.report.blindSpots.map((spot) => (
        <article key={spot.skill}>
          <div>
            <strong>{spot.skill}</strong>
            <span>{spot.severity}</span>
          </div>
          <i><b style={{ width: `${spot.severity}%` }} /></i>
          <p>{spot.reason}</p>
        </article>
      ))}
    </div>
  );
}

function DebateList({ loop }: { loop: LoopResult }) {
  return (
    <div className="nova-debate-list">
      {loop.debate.map((item) => (
        <article className={item.verdict} key={`${item.agent}-${item.stance}`}>
          <span>{item.agent}</span>
          <p>{item.stance}</p>
          <strong>{item.verdict === 'pass' ? '通过' : '要求修订'}</strong>
        </article>
      ))}
    </div>
  );
}

function EvidenceTrail({ loop }: { loop: LoopResult }) {
  return (
    <div className="nova-evidence-trail">
      {loop.evidenceTrail.map((item) => (
        <article key={item.id}>
          <div>
            <span>{item.source}</span>
            <strong>{item.coverage}%</strong>
          </div>
          <p>{item.claim}</p>
        </article>
      ))}
    </div>
  );
}

function PathMap({ loop }: { loop: LoopResult }) {
  return (
    <div className="nova-path-map">
      {loop.report.pathNodes.map((node) => (
        <article className={node.status} key={node.id}>
          <span>{node.level}</span>
          <strong>{node.title}</strong>
        </article>
      ))}
    </div>
  );
}

function DifficultyCurve({ loop }: { loop: LoopResult }) {
  return (
    <div className="nova-curve">
      {loop.report.difficultyCurve.map((point) => (
        <article key={point.week}>
          <div>
            <i className="target" style={{ height: `${point.target}%` }} />
            <i className="adapted" style={{ height: `${point.adapted}%` }} />
          </div>
          <span>{point.week}</span>
        </article>
      ))}
    </div>
  );
}

export default Competition;

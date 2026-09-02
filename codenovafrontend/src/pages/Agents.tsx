import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  Bot,
  CheckCircle2,
  Clock3,
  Code2,
  FileCheck2,
  FileSearch,
  FileText,
  Gauge,
  GitBranch,
  Library,
  Loader2,
  Newspaper,
  Play,
  RefreshCw,
  RotateCcw,
  Route as RouteIcon,
  Search,
  Send,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { officeApi, type OfficeTask } from '../lib/api';
import { setPendingQuestionConfig } from '../lib/questionGeneratorConfig';
import { EVENT_TYPES, useStreamEvents, useStreamStatus } from '../lib/sse';
import { toast } from '../store/toast';
import {
  Banner,
  Button,
  Card,
  CardBody,
  CardHead,
  Empty,
  Field,
  Input,
  LoadingBlock,
  Modal,
  StatCard,
  Tag,
  useAsync,
} from '../components/ui';
import { useStagger } from '../lib/motion';
import { AgentTrace, mapOfficeAgentType, type TraceStep } from '../components/AgentTrace';
import { AgentParamsView, AgentResultView } from '../components/AgentResult';

type AgentCardConfig = {
  type: string;
  label: string;
  role: string;
  desc: string;
  icon: ReactNode;
  category: 'diagnosis' | 'content' | 'assessment' | 'decision' | 'career' | 'platform';
  dispatchable: boolean;
  needsSkill?: boolean;
  badge?: string;
};

const CATEGORY_META: Record<AgentCardConfig['category'], { title: string; desc: string }> = {
  diagnosis: { title: '学情与画像', desc: '把用户状态、证据和目标先看清' },
  content: { title: '内容与资源', desc: '生成讲义、阅读、代码和多媒体资源' },
  assessment: { title: '测评与审核', desc: '出题、评分、纠错和可信校验' },
  decision: { title: '路径与编排', desc: '规划路线、安排任务、协调多 Agent' },
  career: { title: '职业与岗位', desc: '岗位解析、技能差距和简历输出' },
  platform: { title: '平台支撑', desc: '缓存、成本、资源沉淀等运行底座' },
};

const AGENT_CATALOG: AgentCardConfig[] = [
  {
    type: 'profile',
    label: '画像分析',
    role: '学情诊断 Agent',
    desc: '汇总背景、阶段、目标和历史对话，生成学习者画像。',
    icon: <Bot size={15} />,
    category: 'diagnosis',
    dispatchable: true,
    badge: '可派发',
  },
  {
    type: 'assess',
    label: '学习评估',
    role: '评估官 Agent',
    desc: '读取学习记录与测评表现，输出分维度掌握度。',
    icon: <Gauge size={15} />,
    category: 'diagnosis',
    dispatchable: true,
    badge: '可派发',
  },
  {
    type: 'lecture',
    label: '讲义生成',
    role: '领域专家 Agent',
    desc: '围绕一个能力项生成结构化讲义和关键例子。',
    icon: <BookOpen size={15} />,
    category: 'content',
    dispatchable: true,
    needsSkill: true,
    badge: '可派发',
  },
  {
    type: 'reading',
    label: '拓展阅读',
    role: '阅读向导 Agent',
    desc: '生成延展阅读清单，并说明每份材料适合读什么。',
    icon: <Library size={15} />,
    category: 'content',
    dispatchable: true,
    needsSkill: true,
    badge: '可派发',
  },
  {
    type: 'code',
    label: '代码案例',
    role: '实操生成 Agent',
    desc: '生成渐进式实操任务、起点代码、验收点和参考解法。',
    icon: <Code2 size={15} />,
    category: 'content',
    dispatchable: true,
    needsSkill: true,
    badge: '可派发',
  },
  {
    type: 'video',
    label: '教学视频',
    role: '视频生成 Agent',
    desc: '把知识内容整理成脚本、配音和可渲染教学视频。',
    icon: <Play size={15} />,
    category: 'content',
    dispatchable: false,
    badge: '对话触发',
  },
  {
    type: 'resource',
    label: '资源沉淀',
    role: '资源归档 Agent',
    desc: '把任务产物统一写入资源库，关联会话、任务和反馈。',
    icon: <FileText size={15} />,
    category: 'content',
    dispatchable: false,
    badge: '流程内置',
  },
  {
    type: 'exam',
    label: '考试出题',
    role: '分阶测评 Agent',
    desc: '先确定能力项、难度和题型，再进入严格出题器走生成、草稿审核和入库。',
    icon: <FileCheck2 size={15} />,
    category: 'assessment',
    dispatchable: true,
    needsSkill: true,
    badge: '可派发',
  },
  {
    type: 'reviewer',
    label: '审核纠偏',
    role: '审核裁判 Agent',
    desc: '检查事实、引用覆盖、格式、难度和错题原因。',
    icon: <FileSearch size={15} />,
    category: 'assessment',
    dispatchable: false,
    badge: '流程内置',
  },
  {
    type: 'path',
    label: '学习路径',
    role: '路径决策 Agent',
    desc: '根据目标和可投入时间重新规划阶段、能力项和排期。',
    icon: <RouteIcon size={15} />,
    category: 'decision',
    dispatchable: true,
    badge: '可派发',
  },
  {
    type: 'daily-task',
    label: '每日任务',
    role: '日程安排 Agent',
    desc: '把长期路径拆成今天可执行的主任务和辅助任务。',
    icon: <Clock3 size={15} />,
    category: 'decision',
    dispatchable: false,
    badge: '流程内置',
  },
  {
    type: 'orchestrator',
    label: '协同编排',
    role: '中控编排 Agent',
    desc: '选择该叫谁、先做什么、失败时怎么降级和修订。',
    icon: <GitBranch size={15} />,
    category: 'decision',
    dispatchable: false,
    badge: '流程内置',
  },
  {
    type: 'skillgap',
    label: '技能差距',
    role: '差距分析 Agent',
    desc: '对照目标岗位，输出缺口、优先级和补齐路线。',
    icon: <Target size={15} />,
    category: 'career',
    dispatchable: true,
    badge: '可派发',
  },
  {
    type: 'resume',
    label: '简历生成',
    role: '简历顾问 Agent',
    desc: '把画像、项目和目标岗位转成更聚焦的简历内容。',
    icon: <FileText size={15} />,
    category: 'career',
    dispatchable: true,
    badge: '可派发',
  },
  {
    type: 'jd-parser',
    label: 'JD 解析',
    role: '岗位解析 Agent',
    desc: '解析岗位描述，抽取硬性技能、偏好技能和隐含要求。',
    icon: <Search size={15} />,
    category: 'career',
    dispatchable: false,
    badge: '岗位流程',
  },
  {
    type: 'news',
    label: '资讯推荐',
    role: '资讯编辑 Agent',
    desc: '围绕技术方向生成趋势分析和延展学习提醒。',
    icon: <Newspaper size={15} />,
    category: 'career',
    dispatchable: true,
    badge: '可派发',
  },
  {
    type: 'token-tracker',
    label: '成本追踪',
    role: 'Token 追踪 Agent',
    desc: '记录模型调用量、耗时和内容生成成本。',
    icon: <Gauge size={15} />,
    category: 'platform',
    dispatchable: false,
    badge: '平台支撑',
  },
  {
    type: 'cache',
    label: '缓存协调',
    role: '缓存 Agent',
    desc: '复用已生成资源，减少重复请求和等待时间。',
    icon: <RefreshCw size={15} />,
    category: 'platform',
    dispatchable: false,
    badge: '平台支撑',
  },
];

const DISPATCHABLE = AGENT_CATALOG.filter((agent) => agent.dispatchable);

const STATUS_META: Record<string, { label: string; tone: 'neutral' | 'brand' | 'green' | 'rose' | 'amber' }> = {
  pending: { label: '排队中', tone: 'neutral' },
  running: { label: '执行中', tone: 'brand' },
  success: { label: '已完成', tone: 'green' },
  completed: { label: '已完成', tone: 'green' },
  failed: { label: '失败', tone: 'rose' },
  cancelled: { label: '已取消', tone: 'neutral' },
  skipped: { label: '已跳过', tone: 'amber' },
};

function statusOf(task: OfficeTask) {
  return STATUS_META[String(task.taskStatus || '').toLowerCase()] || {
    label: String(task.taskStatus || '未知'),
    tone: 'neutral' as const,
  };
}

export default function Agents() {
  const navigate = useNavigate();
  const metricRef = useStagger<HTMLDivElement>();
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [agentType, setAgentType] = useState(DISPATCHABLE[0].type);
  const [skillName, setSkillName] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [category, setCategory] = useState<AgentCardConfig['category']>('diagnosis');
  const online = useStreamStatus();
  const [detailTask, setDetailTask] = useState<OfficeTask | null>(null);
  const [detailData, setDetailData] = useState<OfficeTask | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (task: OfficeTask) => {
    setDetailTask(task);
    setDetailData(null);
    setDetailLoading(true);
    try {
      setDetailData(await officeApi.task(task.id));
    } catch (err: any) {
      toast.error('任务详情读取失败', err?.message || '');
      setDetailTask(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const tasks = useAsync<OfficeTask[]>(() => officeApi.tasks(), []);
  const stats = useAsync<any>(() => officeApi.stats(), []);

  // 实时刷新：Agent 一有动静就更新台账，不用用户手动点
  useStreamEvents(
    [
      EVENT_TYPES.AGENT_PROGRESS,
      EVENT_TYPES.AGENT_STATUS,
      EVENT_TYPES.TASK_PROGRESS,
      EVENT_TYPES.BATCH_TASK_UPDATE,
      EVENT_TYPES.RESOURCE_READY,
    ],
    () => {
      tasks.reload();
      stats.reload();
    },
  );

  const list = tasks.data || [];
  const running = list.filter((task) => ['pending', 'running'].includes(String(task.taskStatus || '').toLowerCase()));
  const done = list.filter((task) => ['success', 'completed'].includes(String(task.taskStatus || '').toLowerCase()));
  const failed = list.filter((task) => String(task.taskStatus || '').toLowerCase() === 'failed');

  const activeSteps: TraceStep[] = running.slice(0, 5).map((task) => ({
    id: String(task.id),
    role: mapOfficeAgentType(task.agentType),
    output: task.title || '正在处理任务',
    status: 'working',
    meta: `任务 #${task.id} · ${statusOf(task).label}`,
  }));

  const visibleAgents = AGENT_CATALOG.filter((agent) => agent.category === category);
  const openDispatch = (type: string) => {
    setAgentType(type);
    setDispatchOpen(true);
  };

  const dispatch = async () => {
    const meta = DISPATCHABLE.find((item) => item.type === agentType);
    if (!meta) return;
    if (meta.needsSkill && !skillName.trim()) {
      toast.warn('请填写能力项名称', '比如：RAG 检索链路');
      return;
    }
    if (agentType === 'exam') {
      setPendingQuestionConfig({
        subject: skillName.trim(),
        count: 5,
        difficulty: 5,
        questionTypes: ['choice', 'fill', 'coding'],
        referenceLibrary: true,
        metadata: { fromAgentMatrix: true },
      });
      setDispatchOpen(false);
      navigate('/questions');
      return;
    }
    setDispatching(true);
    try {
      await officeApi.create({
        agentType,
        title: `${meta.label}: ${skillName.trim() || '综合能力评估'}`,
        params: skillName.trim() ? { skillName: skillName.trim() } : {},
        description: meta.desc,
      });
      toast.success('任务已派发', '完成后会出现在资源库');
      setDispatchOpen(false);
      setSkillName('');
      tasks.reload();
      stats.reload();
    } catch (err: any) {
      toast.error('派发失败', err?.message || '');
    } finally {
      setDispatching(false);
    }
  };

  const retry = async (task: OfficeTask) => {
    try {
      await officeApi.retry(task.id);
      toast.info('已重新派发', `任务 #${task.id}`);
      tasks.reload();
    } catch (err: any) {
      toast.error('重试失败', err?.message || '');
    }
  };

  const cancel = async (task: OfficeTask) => {
    try {
      await officeApi.cancel(task.id);
      toast.info('已取消', `任务 #${task.id}`);
      tasks.reload();
    } catch (err: any) {
      toast.error('取消失败', err?.message || '');
    }
  };

  return (
    <div className="page page--wide">
      <div className="page-head">
        <div className="row-between wrap">
          <div>
            <h1>Agent 工作台</h1>
            <p>
              学情诊断、领域专家、资源生成、审核纠偏、路径决策 —— 五个角色在这里留下完整的工作记录。
              每一步做了什么、成没成、产出是什么，都可以追溯。
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Tag tone={online ? 'green' : 'neutral'} dot>
              {online ? '实时通道已连接' : '实时通道未连接'}
            </Tag>
            <Button variant="ghost" size="sm" onClick={() => { tasks.reload(); stats.reload(); }}>
              <RefreshCw size={14} />
              刷新
            </Button>
            <Button variant="primary" size="sm" onClick={() => setDispatchOpen(true)}>
              <Send size={14} />
              派发任务
            </Button>
          </div>
        </div>
      </div>

      {tasks.error && <Banner tone="error">{tasks.error}</Banner>}

      <div className="grid grid--4 stagger" ref={metricRef}>
        <StatCard
          gradient="linear-gradient(90deg,#22d3ee,#6366f1)"
          icon={<Clock3 size={14} />}
          label="进行中"
          value={running.length}
        />
        <StatCard
          gradient="linear-gradient(90deg,#34d399,#22d3ee)"
          icon={<CheckCircle2 size={14} />}
          label="已完成"
          value={done.length}
        />
        <StatCard
          gradient="linear-gradient(90deg,#f43f5e,#ec4899)"
          icon={<AlertCircle size={14} />}
          label="失败"
          value={failed.length}
        />
        <StatCard
          gradient="var(--grad-nova)"
          icon={<Gauge size={14} />}
          label="累计任务"
          value={stats.data?.total ?? list.length}
        />
      </div>

      <Card>
        <CardHead
          icon={<Sparkles size={15} />}
          title="智能体矩阵"
          extra={<span className="tiny faint">{AGENT_CATALOG.length} 个角色 · {DISPATCHABLE.length} 个可直接派发</span>}
        />
        <CardBody className="col" style={{ gap: 14 }}>
          <div className="agent-category-tabs">
            {(Object.keys(CATEGORY_META) as AgentCardConfig['category'][]).map((key) => (
              <button
                key={key}
                type="button"
                className="agent-category-tab"
                aria-pressed={category === key}
                onClick={() => setCategory(key)}
              >
                <span>{CATEGORY_META[key].title}</span>
                <small>{AGENT_CATALOG.filter((agent) => agent.category === key).length}</small>
              </button>
            ))}
          </div>

          <div className="agent-matrix">
            {visibleAgents.map((agent) => (
              <article className="agent-tile" key={agent.type}>
                <div className="agent-tile__head">
                  <span className="agent-tile__icon">{agent.icon}</span>
                  <Tag tone={agent.dispatchable ? 'green' : 'neutral'}>{agent.badge || (agent.dispatchable ? '可派发' : '流程内置')}</Tag>
                </div>
                <h3>{agent.role}</h3>
                <div className="small strong">{agent.label}</div>
                <p>{agent.desc}</p>
                <Button
                  size="sm"
                  variant={agent.dispatchable ? 'soft' : 'quiet'}
                  disabled={!agent.dispatchable}
                  onClick={() => agent.dispatchable && openDispatch(agent.type)}
                >
                  {agent.dispatchable ? (
                    <>
                      <Send size={13} />
                      {agent.type === 'exam' ? '严格出题' : '派发'}
                    </>
                  ) : (
                    '随流程触发'
                  )}
                </Button>
              </article>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid--sidebar">
        <Card>
          <CardHead
            icon={<Bot size={15} />}
            title="任务台账"
            extra={<span className="tiny faint">最近 {list.length} 条</span>}
          />
          {tasks.loading && !tasks.data ? (
            <LoadingBlock text="正在读取任务台账" />
          ) : list.length === 0 ? (
            <Empty
              icon={<Bot size={22} />}
              title="Agent 还没有接过任务"
              desc="开始学习某个能力项、或向教练提问，都会触发 Agent 工作。你也可以现在手动派发一个任务。"
              action={
                <Button variant="primary" onClick={() => setDispatchOpen(true)}>
                  <Send size={15} />
                  派发第一个任务
                </Button>
              }
            />
          ) : (
            <div className="ledger">
              {list.map((task) => {
                const status = statusOf(task);
                const target = task.targetEntity;
                return (
                  <div className="ledger__row" key={task.id}>
                    <span
                      className="ledger__icon"
                      style={{
                        background:
                          status.tone === 'green'
                            ? 'var(--green-100)'
                            : status.tone === 'rose'
                              ? 'var(--rose-100)'
                              : status.tone === 'brand'
                                ? 'var(--brand-100)'
                                : 'var(--bg-sunken)',
                        color:
                          status.tone === 'green'
                            ? 'var(--green-600)'
                            : status.tone === 'rose'
                              ? 'var(--rose-600)'
                              : status.tone === 'brand'
                                ? 'var(--brand-600)'
                                : 'var(--text-muted)',
                      }}
                    >
                      {status.tone === 'brand' ? (
                        <Loader2 size={14} className="btn__spinner" style={{ borderWidth: 2 }} />
                      ) : status.tone === 'green' ? (
                        <CheckCircle2 size={14} />
                      ) : status.tone === 'rose' ? (
                        <AlertCircle size={14} />
                      ) : (
                        <Bot size={14} />
                      )}
                    </span>

                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="ledger__title truncate" style={{ display: 'block' }}>
                        {task.title || '未命名任务'}
                      </span>
                      <span className="ledger__meta">
                        <Tag tone={status.tone}>{status.label}</Tag>
                        <span>#{task.id}</span>
                        <span>·</span>
                        <span>{task.agentType}</span>
                        {task.errorMessage && (
                          <Tag tone="rose" icon={<AlertCircle size={10} />}>
                            {task.errorMessage}
                          </Tag>
                        )}
                      </span>
                    </span>

                    <div className="row" style={{ gap: 7 }}>
                      <Button size="sm" variant="quiet" onClick={() => openDetail(task)}>
                        <Search size={13} />
                        详情
                      </Button>
                      {target?.skillName && status.tone === 'green' && (
                        <Button
                          size="sm"
                          variant="quiet"
                          onClick={() => navigate(`/skill/${encodeURIComponent(target.skillName!)}`)}
                        >
                          <Play size={13} />
                          去学习
                        </Button>
                      )}
                      {status.tone === 'rose' && (
                        <Button size="sm" variant="ghost" onClick={() => retry(task)}>
                          <RotateCcw size={13} />
                          重试
                        </Button>
                      )}
                      {status.tone === 'rose' && (
                        <Button
                          size="sm"
                          variant="quiet"
                          onClick={async () => {
                            if (!window.confirm(`删除失败任务 #${task.id}？删除后不可恢复。`)) return;
                            try {
                              await officeApi.remove(task.id);
                              toast.success('任务已删除');
                              tasks.reload();
                              stats.reload();
                            } catch (err: any) {
                              toast.error('删除失败', err?.message || '');
                            }
                          }}
                        >
                          <X size={13} />
                          删除
                        </Button>
                      )}
                      {['brand', 'neutral'].includes(status.tone) && (
                        <Button size="sm" variant="quiet" onClick={() => cancel(task)}>
                          <X size={13} />
                          取消
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="col" style={{ gap: 16 }}>
          <Card>
            <CardHead
              icon={<Loader2 size={15} className={running.length ? 'btn__spinner' : ''} />}
              title="正在执行"
              extra={<Tag tone={running.length ? 'brand' : 'neutral'}>{running.length}</Tag>}
            />
            <CardBody>
              {activeSteps.length === 0 ? (
                <Empty
                  icon={<Sparkles size={20} />}
                  title="当前没有进行中的任务"
                  desc="Agent 空闲时，这里会保持空白。触发学习或提问后，实时进度会立刻出现。"
                />
              ) : (
                <AgentTrace steps={activeSteps} compact />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHead icon={<Sparkles size={15} />} title="五个角色各司其职" />
            <CardBody className="col" style={{ gap: 10 }}>
              {[
                ['学情诊断 Agent', '整合背景、测评与实践记录，定位最该补的缺口'],
                ['领域专家 Agent', '从知识库召回可信片段，限定生成边界'],
                ['资源生成 Agent', '把知识转成讲义、实操指南和分阶测试题'],
                ['审核纠偏 Agent', '校验事实、引用、难度，拦住低可信内容'],
                ['路径决策 Agent', '按反馈决定降维解释、补弱巩固或进阶挑战'],
              ].map(([name, desc]) => (
                <div key={name} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <Bot size={14} style={{ color: 'var(--brand-600)', marginTop: 3, flexShrink: 0 }} />
                  <div>
                    <div className="small strong">{name}</div>
                    <div className="tiny muted" style={{ lineHeight: 1.6 }}>
                      {desc}
                    </div>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        open={detailTask !== null}
        title={`任务详情 #${detailTask?.id ?? ''}`}
        onClose={() => setDetailTask(null)}
        width={640}
      >
        {!detailTask || detailLoading ? (
          <LoadingBlock text="正在读取任务中间数据" />
        ) : (
          <div className="col" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <Tag tone={statusOf(detailTask).tone}>{statusOf(detailTask).label}</Tag>
              <Tag tone="neutral">{detailTask.agentType}</Tag>
              {detailTask.errorMessage && <Tag tone="rose">{detailTask.errorMessage}</Tag>}
            </div>
            <p className="small" style={{ fontWeight: 600 }}>{detailTask.title}</p>
            {detailTask.description && (
              <p className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{detailTask.description}</p>
            )}

            <div className="col" style={{ gap: 4 }}>
              <span className="tiny" style={{ fontWeight: 600 }}>输入参数</span>
              <div style={{ padding: '8px 10px', background: 'var(--bg-sunken)', borderRadius: 8 }}>
                <AgentParamsView params={detailData?.params || {}} />
              </div>
            </div>

            <div className="col" style={{ gap: 4 }}>
              <span className="tiny" style={{ fontWeight: 600 }}>产出结果</span>
              {detailData?.result ? (
                <AgentResultView agentType={detailTask.agentType} result={detailData.result} />
              ) : (
                <p className="small muted">
                  {detailData?.errorMessage || '（暂无产出，任务可能仍在执行）'}
                </p>
              )}
            </div>

            {detailData?.result && (
              <details>
                <summary className="tiny muted" style={{ cursor: 'pointer' }}>查看原始 JSON（开发调试视图）</summary>
                <pre className="tiny muted" style={{ margin: '8px 0 0', padding: '8px 10px', background: 'var(--bg-sunken)', borderRadius: 8, overflow: 'auto', maxHeight: 220, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                  {JSON.stringify(detailData.result, null, 2).slice(0, 4000)}
                </pre>
              </details>
            )}

            <p className="tiny faint">
              这里展示的是多智能体协同的中间数据：调度参数与各 Agent 产物。生成资源会同步沉淀到资源库。
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={dispatchOpen}
        title="派发一个 Agent 任务"
        onClose={() => setDispatchOpen(false)}
        width={520}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDispatchOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={dispatch} loading={dispatching}>
              <Send size={14} />
              {agentType === 'exam' ? '进入严格出题器' : '派发'}
            </Button>
          </>
        }
      >
        <div className="col" style={{ gap: 16 }}>
          <Field label="选择 Agent">
            <div className="choice-grid choice-grid--2">
              {DISPATCHABLE.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  className="choice"
                  aria-pressed={agentType === item.type}
                  onClick={() => setAgentType(item.type)}
                >
                  {agentType === item.type && (
                    <span className="choice__check">
                      <CheckCircle2 size={12} strokeWidth={3} />
                    </span>
                  )}
                  <span className="choice__title">{item.label}</span>
                  <span className="choice__desc">{item.desc}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="能力项名称"
            required={DISPATCHABLE.find((item) => item.type === agentType)?.needsSkill}
            hint={
              DISPATCHABLE.find((item) => item.type === agentType)?.needsSkill
                ? '例如：RAG 检索链路、多智能体分工、引用校验'
                : '该 Agent 不需要指定能力项，留空即可'
            }
          >
            <Input
              value={skillName}
              onChange={(event) => setSkillName(event.target.value)}
              placeholder="例如：RAG 检索链路"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

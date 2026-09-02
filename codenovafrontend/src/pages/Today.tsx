import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Flame,
  Gauge,
  Layers3,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import {
  matchApi,
  officeApi,
  workbenchApi,
  type DashboardData,
  type LearningPlan,
  type TodayAction,
  type TodayActionsResult,
} from '../lib/api';
import { useStreamEvents, EVENT_TYPES } from '../lib/sse';
import { toast } from '../store/toast';
import {
  Bar,
  Banner,
  Button,
  Card,
  CardBody,
  CardHead,
  Empty,
  LoadingBlock,
  StatCard,
  Tag,
  useAsync,
} from '../components/ui';
import { useStagger } from '../lib/motion';
import { AgentTrace, mapOfficeAgentType, type TraceStep } from '../components/AgentTrace';

type Action = TodayAction;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

/** 后端返回的是旧前端路由，这里映射到新前端的页面 */
function resolveActionPath(action: Action): string {
  // 「学习 X 并完成练习」/「学习 X」→ 直接进入该能力项的学习闭环
  const learned = action.title?.match(/^学习\s*(.+?)(?:\s*并完成练习)?$/);
  if (learned) return `/skill/${encodeURIComponent(learned[1])}`;
  if (action.taskType === 'quick-test') return '/path';
  if (action.path?.includes('jobs')) return '/report';
  return '/path';
}

export default function Today() {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const metricRef = useStagger<HTMLDivElement>();

  const dashboard = useAsync<DashboardData>(() => workbenchApi.dashboard(), [tick]);
  const actions = useAsync<TodayActionsResult>(() => workbenchApi.todayActions(), [tick]);
  const todayTasksData = useAsync<any>(() => workbenchApi.todayTasks(), [tick]);
  const bestMatch = useAsync<any>(() => matchApi.best(), [tick]);
  const officeTasks = useAsync<any[]>(() => officeApi.tasks(), [tick]);

  // 后端有变化时静默刷新，不让用户手动点
  useStreamEvents(
    [
      EVENT_TYPES.MATCH_UPDATE,
      EVENT_TYPES.RESOURCE_READY,
      EVENT_TYPES.TASK_PROGRESS,
      EVENT_TYPES.AGENT_PROGRESS,
      EVENT_TYPES.PROFILE_UPDATED,
      EVENT_TYPES.EVALUATION_UPDATED,
      EVENT_TYPES.NOTIFICATION,
    ],
    (event) => {
      setTick((value) => value + 1);
      if (event.type === EVENT_TYPES.MATCH_UPDATE && event.data?.reason) {
        toast.info('匹配度更新', `${event.data.reason}（当前 ${event.data.newScore}%）`);
      }
    },
  );

  const data = dashboard.data;
  const plan: LearningPlan | null = data?.learning_path ?? null;
  const stats = data?.stats;
  const hasPlan = Boolean(plan?.pathData?.phases?.length);

  const phases = plan?.pathData?.phases || [];
  const phaseStats = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const phase of phases) {
      for (const skill of phase.skills || []) {
        total += 1;
        if (skill.status === 'done') done += 1;
      }
    }
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [phases]);

  // Agent 动态：取最近 5 条办公室任务，映射成产品叙事里的五个角色
  const agentSteps: TraceStep[] = useMemo(() => {
    const tasks = (officeTasks.data || []).slice(0, 5);
    if (tasks.length === 0) {
      return [];
    }
    return tasks.map((task: any) => ({
      id: String(task.id),
      role: mapOfficeAgentType(task.agentType),
      output: task.title || '生成学习资源',
      status:
        task.taskStatus === 'success'
          ? 'done'
          : task.taskStatus === 'failed'
            ? 'pending'
            : 'working',
      meta: task.errorMessage
        ? `失败：${task.errorMessage}`
        : task.taskStatus === 'success'
          ? '已完成并入库'
          : '处理中',
    }));
  }, [officeTasks.data]);

  const todayTasks = data?.today_tasks || [];

  /**
   * 今日导学判断的兜底
   *
   * 后端的 today-actions 是为"岗位驱动"设计的：没有绑定目标岗位时，
   * 它只会回一句「先去选岗位」。但本项目聚焦的是项目型训练路径
   * （goalType=project），用户不一定有目标岗位 —— 这时必须退回到
   * 路径真实排出来的今日任务，否则首页就是一句废话。
   */
  const derivedMain = useMemo<Action | null>(() => {
    const tasks = [
      ...(todayTasksData.data?.mainTasks || []),
      ...(todayTasksData.data?.sideTasks || []),
    ];
    const pending = tasks.find(
      (task: any) =>
        !['done', 'exam_done', 'lecture_done', 'practice_done', 'code_done'].includes(task.taskStatus),
    );
    if (!pending) return null;

    const doneCount = tasks.filter((task: any) =>
      ['done', 'exam_done', 'lecture_done', 'practice_done', 'code_done'].includes(task.taskStatus),
    ).length;

    return {
      id: Number(pending.id) || 0,
      title: `学习 ${pending.skillName}`,
      taskType: 'learning',
      estimatedMin: Number(pending.estimatedMin) || 30,
      reason: `路径「${plan?.goalTitle || plan?.planName || '当前路径'}」今天排给你的第 ${
        doneCount + 1
      } 项，预计 ${Number(pending.estimatedMin) || 30} 分钟。读完讲义掌握度 +30%，通过测验再 +25%。`,
      estimatedImpact: 0,
      impactLabel: '',
      evidence: '完成后写入学习 commit 并更新能力档案',
      path: '',
    };
  }, [todayTasksData.data, plan]);

  const backendMain = actions.data?.main;
  // 后端给的是"引导去绑岗位"这种无效建议时，用路径真实任务兜底
  const main: Action | undefined =
    backendMain && backendMain.taskType !== 'onboarding' ? backendMain : derivedMain || backendMain;
  const subs = main?.taskType === 'onboarding' ? [] : actions.data?.subs || [];

  if (dashboard.loading && !dashboard.data) {
    return (
      <div className="page">
        <LoadingBlock text="正在汇总今天的训练情况" sub="画像、路径进度、Agent 动态和匹配度会一起加载" />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="row-between">
          <div>
            <h1>
              {greeting()}
              {data?.student?.name ? `，${data.student.name}` : ''}
            </h1>
            <p>
              {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
              {stats?.active_days ? ` · 已连续活跃 ${stats.active_days} 天` : ''}
            </p>
          </div>
          {!hasPlan && (
            <Button variant="primary" onClick={() => navigate('/plan/new')}>
              <Sparkles size={15} />
              生成训练路径
            </Button>
          )}
        </div>
      </div>

      {dashboard.error && (
        <Banner tone="error">
          {dashboard.error}
          <br />
          请确认后端服务已在 http://localhost:3000 启动，且 vite 代理配置正确。
        </Banner>
      )}

      {/* 还没有路径：给出明确的下一步，而不是空白看板 */}
      {!hasPlan && !dashboard.loading && (
        <Card>
          <Empty
            icon={<Target size={22} />}
            title="还没有训练路径"
            desc="先选一个方向和目标，五个 Agent 会协作生成分阶段的训练计划。整个过程大约半分钟，生成后立刻能看到今天该做什么。"
            action={
              <Button variant="primary" onClick={() => navigate('/plan/new')}>
                <Sparkles size={15} />
                现在生成
              </Button>
            }
          />
        </Card>
      )}

      {hasPlan && (
        <>
          <div className="grid grid--hero">
            {/* 今日导学判断 */}
            <Card>
              <CardHead
                icon={<Sparkles size={15} />}
                title="今日导学判断"
                extra={main?.estimatedImpact ? <Tag tone="green">{main.impactLabel}</Tag> : undefined}
              />
              <CardBody className="col" style={{ gap: 14 }}>
                {actions.loading && !main ? (
                  <LoadingBlock text="正在判断今天最该做什么" />
                ) : main ? (
                  <>
                    <div>
                      <h2 style={{ fontSize: 19, lineHeight: 1.45 }}>{main.title}</h2>
                      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 7, lineHeight: 1.7 }}>
                        {main.reason}
                      </p>
                    </div>

                    <div className="row wrap" style={{ gap: 8 }}>
                      <Tag tone="neutral" icon={<Clock3 size={11} />}>
                        约 {main.estimatedMin} 分钟
                      </Tag>
                      {main.evidence && (
                        <Tag tone="brand" icon={<CheckCircle2 size={11} />}>
                          {main.evidence}
                        </Tag>
                      )}
                    </div>

                    <div className="row" style={{ gap: 9 }}>
                      <Button
                        variant="primary"
                        onClick={() => navigate(resolveActionPath(main))}
                      >
                        开始这一项
                        <ArrowRight size={15} />
                      </Button>
                      <Button variant="ghost" onClick={() => navigate('/coach')}>
                        先聊聊为什么
                      </Button>
                    </div>

                    {subs.length > 0 && (
                      <div
                        className="col"
                        style={{ gap: 8, marginTop: 4, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}
                      >
                        <span className="tiny faint" style={{ letterSpacing: '0.05em' }}>
                          今天还可以顺手做
                        </span>
                        {subs.map((sub) => (
                          <button
                            key={sub.title}
                            type="button"
                            className="row"
                            style={{
                              gap: 10,
                              padding: '9px 12px',
                              borderRadius: 'var(--r-md)',
                              border: '1px solid var(--border-soft)',
                              textAlign: 'left',
                              width: '100%',
                            }}
                            onClick={() => navigate(resolveActionPath(sub))}
                          >
                            <span
                              className="tag tag--outline"
                              style={{ padding: '0 6px', fontSize: 10 }}
                            >
                              {sub.estimatedMin}′
                            </span>
                            <span className="grow">
                              <span className="small strong" style={{ display: 'block' }}>
                                {sub.title}
                              </span>
                              <span className="tiny muted clamp-2">{sub.reason}</span>
                            </span>
                            <ArrowRight size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Empty
                    icon={<CalendarCheck size={20} />}
                    title="今天没有待办"
                    desc="路径上的任务都完成了，或者后端还没生成今日任务。可以去路径页看看下一阶段。"
                  />
                )}
              </CardBody>
            </Card>

            {/* 关键指标（数字滚动态） */}
            <div className="grid stagger" ref={metricRef} style={{ gridTemplateRows: 'auto auto auto', gap: 12 }}>
              <StatCard
                gradient="var(--grad-nova)"
                icon={<Gauge size={15} />}
                label="目标岗位匹配度"
                value={bestMatch.data?.totalScore ?? data?.learning_path?.matchScore ?? 0}
                unit="%"
                foot={
                  bestMatch.data?.job?.title
                    ? `对照：${bestMatch.data.job.title}`
                    : data?.target_job?.title
                      ? `对照：${data.target_job.title}`
                      : '未绑定目标岗位'
                }
              />

              <div className="grid grid--2" style={{ gap: 12 }}>
                <StatCard
                  gradient="linear-gradient(90deg,#22d3ee,#6366f1)"
                  icon={<Layers3 size={14} />}
                  label="能力项"
                  value={stats?.done_skills ?? phaseStats.done}
                  unit={`/${stats?.total_skills ?? phaseStats.total}`}
                />
                <StatCard
                  gradient="linear-gradient(90deg,#f59e0b,#ec4899)"
                  icon={<Flame size={14} />}
                  label="累计学时"
                  value={stats?.total_learned_hours ?? 0}
                  unit="h"
                />
              </div>

              <div className="grid grid--2" style={{ gap: 12 }}>
                <StatCard
                  gradient="linear-gradient(90deg,#34d399,#22d3ee)"
                  icon={<CalendarCheck size={14} />}
                  label="活跃天数"
                  value={stats?.active_days ?? 0}
                  unit="天"
                />
                <StatCard
                  gradient="linear-gradient(90deg,#a855f7,#6366f1)"
                  icon={<TrendingUp size={14} />}
                  label="测评次数"
                  value={stats?.exam_count ?? 0}
                  unit="次"
                />
              </div>
            </div>
          </div>

          <div className="grid grid--sidebar">
            <div className="col" style={{ gap: 16 }}>
              {/* 路径进度 */}
              <Card>
                <CardHead
                  icon={<Target size={15} />}
                  title={plan?.goalTitle || plan?.planName || '当前训练路径'}
                  extra={
                    <Link to="/path" className="btn btn--quiet btn--sm">
                      查看完整路径
                      <ArrowRight size={13} />
                    </Link>
                  }
                />
                <CardBody className="col" style={{ gap: 14 }}>
                  <div className="row-between">
                    <span className="small muted">
                      第 {(plan?.currentPhase ?? 0) + 1} / {phases.length} 阶段 · 已完成 {phaseStats.done}/
                      {phaseStats.total} 个能力项
                    </span>
                    <strong className="small">{phaseStats.pct}%</strong>
                  </div>
                  <Bar value={phaseStats.pct} tone={phaseStats.pct >= 100 ? 'green' : undefined} />

                  <div className="row wrap" style={{ gap: 8, marginTop: 2 }}>
                    {phases.map((phase, index) => {
                      const phaseDone = (phase.skills || []).every((skill) => skill.status === 'done');
                      const isCurrent = index === (plan?.currentPhase ?? 0);
                      return (
                        <span
                          key={phase.name}
                          className={`tag ${phaseDone ? 'tag--green' : isCurrent ? 'tag--brand' : 'tag--outline'}`}
                        >
                          {phaseDone && <CheckCircle2 size={11} />}
                          {index + 1}. {phase.name}
                        </span>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>

              {/* 今日任务 */}
              <Card>
                <CardHead
                  icon={<CalendarCheck size={15} />}
                  title="今日任务"
                  extra={
                    <span className="tiny faint">
                      {todayTasks.filter((task) => !['done', 'exam_done'].includes(task.status)).length} 项待完成
                    </span>
                  }
                />
                {todayTasks.length === 0 ? (
                  <Empty
                    icon={<CalendarCheck size={20} />}
                    title="今天还没有排任务"
                    desc="任务由后端按你的路径和每天投入时间自动排期，通常在你首次进入路径页后生成。"
                    action={
                      <Button variant="soft" onClick={() => navigate('/path')}>
                        去路径看看
                      </Button>
                    }
                  />
                ) : (
                  <div className="ledger">
                    {todayTasks.map((task) => {
                      const done = ['done', 'exam_done', 'lecture_done', 'practice_done', 'code_done'].includes(
                        task.status,
                      );
                      return (
                        <div className="ledger__row" key={task.id}>
                          <span
                            className="ledger__icon"
                            style={{
                              background: done ? 'var(--green-100)' : 'var(--bg-sunken)',
                              color: done ? 'var(--green-600)' : 'var(--text-muted)',
                            }}
                          >
                            {done ? <CheckCircle2 size={15} /> : <BookOpen size={15} />}
                          </span>
                          <span className="grow">
                            <span
                              className="ledger__title"
                              style={{
                                textDecoration: done ? 'line-through' : undefined,
                                color: done ? 'var(--text-muted)' : undefined,
                              }}
                            >
                              {task.title}
                            </span>
                            <span className="ledger__meta">
                              <span>约 {task.estimatedMin} 分钟</span>
                              <span>·</span>
                              <span>{task.taskType}</span>
                            </span>
                          </span>
                          {!done && (
                            <Button
                              size="sm"
                              variant="soft"
                              onClick={() => navigate(`/skill/${encodeURIComponent(task.title)}`)}
                            >
                              去学习
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Agent 动态 */}
            <Card>
              <CardHead
                icon={<Sparkles size={15} />}
                title="Agent 在做什么"
                extra={<span className="tiny faint">实时</span>}
              />
              <CardBody>
                {officeTasks.loading && agentSteps.length === 0 ? (
                  <LoadingBlock text="正在读取 Agent 动态" />
                ) : agentSteps.length === 0 ? (
                  <Empty
                    icon={<Sparkles size={20} />}
                    title="Agent 暂时空闲"
                    desc="当你开始学习某个能力项、或向教练提问时，这里会实时显示五个 Agent 的分工与进度。"
                  />
                ) : (
                  <AgentTrace steps={agentSteps} compact />
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

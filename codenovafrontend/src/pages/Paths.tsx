import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  Clock3,
  GitMerge,
  Layers3,
  Loader2,
  Pause,
  Play,
  Plus,
  Route as RouteIcon,
  Sparkles,
} from 'lucide-react';
import {
  planApi,
  workbenchApi,
  type LearningPlan,
  type PlanPhase,
} from '../lib/api';
import { toast } from '../store/toast';
import { useStagger } from '../lib/motion';
import {
  Bar,
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
  Segmented,
  Tag,
  useAsync,
} from '../components/ui';

type PlanFilter = 'main' | 'side';

export default function Paths() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<PlanFilter>('main');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newTopic, setNewTopic] = useState('');

  const plans = useAsync<LearningPlan[]>(() => planApi.list(100), []);
  const todayTasks = useAsync<any>(() => workbenchApi.todayTasks(), []);
  const phaseRef = useStagger<HTMLDivElement>();

  const mainPlans = (plans.data || []).filter((plan) => plan.planType === 'main');
  const sidePlans = (plans.data || []).filter((plan) => plan.planType === 'side');
  const visible = filter === 'main' ? mainPlans : sidePlans;

  const active = useMemo(() => {
    if (selectedId) {
      const found = visible.find((plan) => plan.id === selectedId);
      if (found) return found;
    }
    return visible.find((plan) => plan.planStatus === 'active') || visible[0] || null;
  }, [visible, selectedId]);

  const phases: PlanPhase[] = active?.pathData?.phases || [];

  const refresh = () => {
    plans.reload();
    todayTasks.reload();
  };

  const setStatus = async (planStatus: 'active' | 'paused' | 'archived') => {
    if (!active) return;
    setBusy(true);
    try {
      await planApi.setStatus(active.id, planStatus);
      toast.success(
        planStatus === 'active' ? '已恢复' : planStatus === 'paused' ? '已暂停' : '已归档',
        planStatus === 'archived' ? '归档后不再排今日任务，可随时恢复' : undefined,
      );
      refresh();
    } catch (err: any) {
      toast.error('操作失败', err?.message || '');
    } finally {
      setBusy(false);
    }
  };

  const merge = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const result = await planApi.merge(active.id);
      toast.success('能力档案已更新', result?.message || '本次路径的完成情况已并入能力档案');
      refresh();
    } catch (err: any) {
      toast.error('合并失败', err?.message || '');
    } finally {
      setBusy(false);
    }
  };

  const adjustSpeed = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const result = await workbenchApi.adjustSpeed(active.id);
      toast.success('已重新排期', result?.message || '按你最近的完成情况调整了任务密度');
      refresh();
    } catch (err: any) {
      toast.error('调整失败', err?.message || '');
    } finally {
      setBusy(false);
    }
  };

  const addTopic = async () => {
    if (!active || !newTopic.trim()) return;
    setBusy(true);
    try {
      await planApi.addSkill(active.id, { skillName: newTopic.trim(), estimatedMin: 120 });
      toast.success('已加入', `「${newTopic.trim()}」已加入自选补充阶段`);
      setNewTopic('');
      setAddOpen(false);
      refresh();
    } catch (err: any) {
      toast.error('添加失败', err?.message || '');
    } finally {
      setBusy(false);
    }
  };

  if (plans.loading && !plans.data) {
    return (
      <div className="page">
        <LoadingBlock text="正在读取训练路径" />
      </div>
    );
  }

  return (
    <div className="page page--wide">
      <div className="page-head">
        <div className="row-between">
          <div>
            <h1>学习路径</h1>
            <p>
              主线是你要拿下的目标，自选是临时补的内容。点任意能力项进入学习闭环：
              讲义 → 测验 → 实操 → 评估。
            </p>
          </div>
          <Button variant="primary" onClick={() => navigate('/plan/new')}>
            <Sparkles size={15} />
            新建路径
          </Button>
        </div>
      </div>

      {plans.error && <Banner tone="error">{plans.error}</Banner>}

      {visible.length === 0 ? (
        <Card>
          <Empty
            icon={<RouteIcon size={22} />}
            title={filter === 'main' ? '还没有主线路径' : '还没有自选内容'}
            desc={
              filter === 'main'
                ? '主线路径是你训练的主干。生成后会自动排出今日任务，并按完成情况调整难度。'
                : '自选内容适合临时补一个具体主题，不影响主线排期。'
            }
            action={
              <Button variant="primary" onClick={() => navigate('/plan/new')}>
                <Sparkles size={15} />
                生成路径
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="row-between wrap">
            <Segmented
              value={filter}
              onChange={(next) => {
                setFilter(next);
                setSelectedId(null);
              }}
              options={[
                { value: 'main', label: `主线 ${mainPlans.length}` },
                { value: 'side', label: `自选 ${sidePlans.length}` },
              ]}
            />

            {active && (
              <div className="row wrap" style={{ gap: 8 }}>
                {active.planType === 'side' && active.planStatus !== 'archived' && (
                  <Button size="sm" variant="ghost" onClick={() => setAddOpen(true)}>
                    <Plus size={14} />
                    加学习内容
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={adjustSpeed} disabled={busy}>
                  <Clock3 size={14} />
                  按进度重新排期
                </Button>
                <Button size="sm" variant="ghost" onClick={merge} disabled={busy}>
                  <GitMerge size={14} />
                  更新能力档案
                </Button>
                {active.planStatus === 'active' ? (
                  <Button size="sm" variant="ghost" onClick={() => setStatus('paused')} disabled={busy}>
                    <Pause size={14} />
                    暂停
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setStatus('active')} disabled={busy}>
                    <Play size={14} />
                    恢复
                  </Button>
                )}
                {active.planStatus !== 'archived' && (
                  <Button size="sm" variant="quiet" onClick={() => setStatus('archived')} disabled={busy}>
                    <Archive size={14} />
                    归档
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid--sidebar">
            <div className="col" style={{ gap: 16 }}>
              {/* 计划切换 */}
              {visible.length > 1 && (
                <div className="row wrap" style={{ gap: 9 }}>
                  {visible.map((plan) => {
                    const isActive = active?.id === plan.id;
                    const total = (plan.pathData?.phases || []).reduce(
                      (sum, phase) => sum + (phase.skills?.length || 0),
                      0,
                    );
                    const done = (plan.pathData?.phases || []).reduce(
                      (sum, phase) =>
                        sum + (phase.skills || []).filter((skill) => skill.status === 'done').length,
                      0,
                    );
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedId(plan.id)}
                        className={`card card--pad card--interactive plan-chip ${isActive ? 'is-active' : ''}`}
                        style={{
                          padding: '12px 15px',
                          minWidth: 190,
                          textAlign: 'left',
                        }}
                      >
                        <span className="row" style={{ gap: 7 }}>
                          <strong className="small strong truncate">
                            {plan.goalTitle || plan.planName}
                          </strong>
                          {plan.planStatus === 'paused' && <Tag tone="amber">暂停</Tag>}
                          {plan.planStatus === 'archived' && <Tag tone="neutral">归档</Tag>}
                        </span>
                        <span className="tiny faint" style={{ display: 'block', marginTop: 2 }}>
                          {done}/{total} 项
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 阶段与能力项 */}
              {active && (
                <Card>
                  <CardHead
                    icon={<Layers3 size={15} />}
                    title={active.goalTitle || active.planName || '训练路径'}
                    extra={
                      <span className="tiny faint">
                        第 {(active.currentPhase ?? 0) + 1} / {phases.length} 阶段
                      </span>
                    }
                  />
                  <CardBody className="col" style={{ gap: 20 }}>
                    <div className="col stagger" ref={phaseRef} style={{ gap: 20 }}>
                    {phases.length === 0 ? (
                      <Empty
                        icon={<Layers3 size={20} />}
                        title="这条路径还没有阶段数据"
                        desc="后端可能仍在生成。稍等几秒后刷新，或重新生成一条路径。"
                        action={
                          <Button variant="soft" onClick={refresh}>
                            刷新
                          </Button>
                        }
                      />
                    ) : (
                      phases.map((phase, index) => {
                        const skills = phase.skills || [];
                        const doneCount = skills.filter((skill) => skill.status === 'done').length;
                        const phaseDone = skills.length > 0 && doneCount === skills.length;
                        const isCurrent = index === (active.currentPhase ?? 0) && !phaseDone;
                        const pct = skills.length ? Math.round((doneCount / skills.length) * 100) : 0;

                        return (
                          <div
                            key={`${phase.name}-${index}`}
                            className={`phase ${phaseDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}
                          >
                            <div className="phase__head">
                              <span className="phase__marker">
                                {phaseDone ? <CheckCircle2 size={14} /> : index + 1}
                              </span>
                              <span className="grow">
                                <span className="phase__name">{phase.name}</span>
                                <span className="tiny faint" style={{ display: 'block' }}>
                                  {doneCount}/{skills.length} 项 ·{' '}
                                  {Math.round(
                                    skills.reduce((sum, skill) => sum + (skill.estimatedMin || 60), 0) / 60,
                                  )}
                                  h
                                </span>
                              </span>
                              <div style={{ width: 96 }}>
                                <Bar value={pct} tone={phaseDone ? 'green' : undefined} />
                              </div>
                            </div>

                            <div className="phase__spine">
                              {skills.map((skill) => {
                                const done = skill.status === 'done';
                                const read = Boolean(skill.read_at);
                                const quizPassed = Boolean(skill.quiz_passed);
                                const codeDone = Boolean(skill.code_done);
                                return (
                                  <button
                                    key={skill.name}
                                    type="button"
                                    className={`skill-row ${done ? 'is-done' : ''}`}
                                    onClick={() =>
                                      navigate(
                                        `/skill/${encodeURIComponent(skill.name)}?plan=${active.id}`,
                                      )
                                    }
                                  >
                                    <span className="skill-row__mark">
                                      <CheckCircle2 size={13} strokeWidth={3} />
                                    </span>
                                    <span className="grow">
                                      <span className="skill-row__name">{skill.name}</span>
                                      <span className="skill-row__meta">
                                        {[
                                          read ? '讲义已读' : null,
                                          quizPassed ? '测验通过' : null,
                                          codeDone ? '实操完成' : null,
                                        ]
                                          .filter(Boolean)
                                          .join(' · ') || `约 ${skill.estimatedMin || 60} 分钟`}
                                      </span>
                                    </span>
                                    <ArrowRight
                                      size={14}
                                      style={{ color: 'var(--text-faint)', flexShrink: 0 }}
                                    />
                                  </button>
                                );
                              })}
                              {skills.length === 0 && (
                                <span className="tiny faint">这个阶段暂无能力项</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    </div>
                  </CardBody>
                </Card>
              )}
            </div>

            {/* 今日任务 */}
            <Card>
              <CardHead icon={<Clock3 size={15} />} title="今日组合任务" />
              <CardBody>
                {todayTasks.loading && !todayTasks.data ? (
                  <LoadingBlock text="读取今日任务" />
                ) : (() => {
                  const all = [
                    ...(todayTasks.data?.mainTasks || []),
                    ...(todayTasks.data?.sideTasks || []),
                  ];
                  if (all.length === 0) {
                    return (
                      <Empty
                        icon={<Clock3 size={20} />}
                        title="今天没有排任务"
                        desc="任务由后端按路径和每天投入时间自动排期。"
                      />
                    );
                  }
                  return (
                    <div className="ledger">
                      {all.map((task: any) => {
                        const done = ['done', 'exam_done', 'lecture_done', 'practice_done', 'code_done'].includes(
                          task.taskStatus,
                        );
                        return (
                          <div className="ledger__row" key={task.id} style={{ padding: '11px 0' }}>
                            <span
                              className="ledger__icon"
                              style={{
                                width: 26,
                                height: 26,
                                background: done ? 'var(--green-100)' : 'var(--bg-sunken)',
                                color: done ? 'var(--green-600)' : 'var(--text-muted)',
                              }}
                            >
                              {done ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}
                            </span>
                            <span className="grow">
                              <span className="ledger__title small">{task.skillName}</span>
                              <span className="ledger__meta">
                                <span className={`tag tag--${task.planType === 'main' ? 'brand' : 'outline'}`} style={{ padding: '0 6px', fontSize: 10 }}>
                                  {task.planType === 'main' ? '主线' : '自选'}
                                </span>
                                <span>{task.estimatedMin}′</span>
                              </span>
                            </span>
                            {!done && (
                              <Button
                                size="sm"
                                variant="quiet"
                                onClick={() => navigate(`/skill/${encodeURIComponent(task.skillName)}`)}
                              >
                                开始
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardBody>
            </Card>
          </div>
        </>
      )}

      <Modal
        open={addOpen}
        title="加入一个学习主题"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={addTopic} disabled={!newTopic.trim() || busy} loading={busy}>
              加入
            </Button>
          </>
        }
      >
        <Field label="主题名称" hint="会作为一个能力项加入「自选补充」阶段，约 2 小时">
          <Input
            value={newTopic}
            onChange={(event) => setNewTopic(event.target.value)}
            placeholder="例如：引用覆盖率指标设计"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && newTopic.trim()) addTopic();
            }}
          />
        </Field>
      </Modal>
    </div>
  );
}

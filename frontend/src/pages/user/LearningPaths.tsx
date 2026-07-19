import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  getLearningPaths,
  getTodayTasks,
  mergeLearningPath,
  setLearningPathStatus,
} from '../../api/user';
import { useSession } from '../../hooks/useSession';
import { useWorkspaceStore } from '../../stores/workspace';
import AddCourseModal from '../../components/AddCourseModal';
import type { LearningPath, SkillNode } from '../../types';
import '../../styles/hand-draw.css';
import './learning-paths.css';
import {
  IconBook,
  IconBriefcase,
  IconCalendar,
  IconCheck,
  IconClock,
  IconGraph,
  IconPlus,
  IconRefresh,
  IconTarget,
} from '../../components/icons';

type LearningTab = 'job' | 'self';
type PlanStatus = 'active' | 'paused' | 'archived';

const STATUS_TEXT: Record<PlanStatus, string> = {
  active: '执行中',
  paused: '已暂停',
  archived: '已归档',
};

function progressOf(plan: LearningPath) {
  const skills = (plan.pathData?.phases || []).flatMap((phase) => phase.skills || []);
  const done = skills.filter((skill) => skill.status === 'done').length;
  return { total: skills.length, done, percent: skills.length ? Math.round(done / skills.length * 100) : 0 };
}

function TaskRow({ task, planName, onOpen }: { task: any; planName: string; onOpen: () => void }) {
  const done = task.taskStatus === 'done' || task.taskStatus === 'skipped';
  return (
    <button className={`lp-task-row${done ? ' done' : ''}`} onClick={onOpen}>
      <span className="lp-task-check">{done ? <IconCheck size={14} /> : <IconClock size={14} />}</span>
      <span className="lp-task-copy">
        <strong>{task.skillName}</strong>
        <small>{planName}</small>
      </span>
      <span className={`lp-type-badge ${task.taskType}`}>{task.taskType === 'main' ? '主线' : '自选'}</span>
      <span className="lp-task-time">{task.estimatedMin || 0} min</span>
    </button>
  );
}

export default function LearningPaths() {
  const navigate = useNavigate();
  const { pathId } = useParams();
  const [searchParams] = useSearchParams();
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState<LearningTab>(searchParams.get('type') === 'side' ? 'self' : 'job');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [todayTasks, setTodayTasks] = useState<any>(null);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  useSession(selectedId || undefined);

  const fetchPaths = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const response = await getLearningPaths({ pageSize: 100 });
      setPaths(response.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || '学习计划加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPaths(); }, [fetchPaths]);
  useEffect(() => {
    getTodayTasks().then((response) => setTodayTasks(response.data)).catch(() => setTodayTasks(null));
  }, [paths]);
  useEffect(() => useWorkspaceStore.subscribe(
    (state) => state.lastEvent,
    (event) => {
      if (event?.type === 'path_generated' || event?.type === 'today_tasks_refresh') fetchPaths(true);
    },
  ), [fetchPaths]);

  const mainPlans = useMemo(() => paths.filter((plan) => plan.planType === 'main'), [paths]);
  const sidePlans = useMemo(() => paths.filter((plan) => plan.planType === 'side'), [paths]);
  const visiblePlans = activeTab === 'job' ? mainPlans : sidePlans;
  const selectedPlan = paths.find((plan) => plan.id === selectedId) || null;

  useEffect(() => {
    const requestedId = Number(pathId || searchParams.get('planId'));
    const requested = visiblePlans.find((plan) => plan.id === requestedId);
    if (requested) {
      setSelectedId(requested.id);
      return;
    }
    if (!visiblePlans.some((plan) => plan.id === selectedId)) {
      setSelectedId(visiblePlans.find((plan) => plan.planStatus !== 'archived')?.id || visiblePlans[0]?.id || null);
    }
  }, [activeTab, pathId, searchParams, selectedId, visiblePlans]);

  const switchTab = (tab: LearningTab) => {
    setActiveTab(tab);
    setNotice('');
  };

  const changeStatus = async (planStatus: PlanStatus) => {
    if (!selectedPlan) return;
    setActionBusy(true);
    try {
      await setLearningPathStatus(selectedPlan.id, planStatus);
      setNotice(`计划已${planStatus === 'active' ? '恢复' : planStatus === 'paused' ? '暂停' : '归档'}`);
      await fetchPaths(true);
    } catch (err: any) {
      setNotice(err?.response?.data?.message || '操作失败');
    } finally {
      setActionBusy(false);
    }
  };

  const mergeAbility = async () => {
    if (!selectedPlan) return;
    setActionBusy(true);
    try {
      await mergeLearningPath(selectedPlan.id);
      setNotice('已将验证过的能力变化更新到个人能力档案');
    } catch (err: any) {
      setNotice(err?.response?.data?.message || '当前没有可更新的能力变化');
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return <div className="hd-page"><div className="hd-page-wrap"><div className="hd-loading"><IconBook size={30} /> 正在整理学习组合...</div></div></div>;
  }

  const phases = selectedPlan?.pathData?.phases || [];
  const progress = selectedPlan ? progressOf(selectedPlan) : { total: 0, done: 0, percent: 0 };
  const activeMain = mainPlans.find((plan) => plan.planStatus === 'active');
  const activeSides = sidePlans.filter((plan) => plan.planStatus === 'active');
  const allTodayTasks = [...(todayTasks?.mainTasks || []), ...(todayTasks?.sideTasks || [])];
  const mainTaskMinutes = (todayTasks?.mainTasks || []).reduce((sum: number, task: any) => sum + Number(task.estimatedMin || 0), 0);
  const sideTaskMinutes = (todayTasks?.sideTasks || []).reduce((sum: number, task: any) => sum + Number(task.estimatedMin || 0), 0);
  const currentPhase = selectedPlan ? phases[selectedPlan.currentPhase] : null;
  const pendingSkills = Math.max(0, progress.total - progress.done);

  return (
    <div className="hd-page lp-page">
      <div className="hd-page-wrap">
        <header className="hd-header lp-header">
          <div>
            <h1>学习组合</h1>
            <p>能力主干持续记录，计划按目标独立推进</p>
          </div>
          <button className="hd-btn" onClick={() => navigate(`/plan/create?type=${activeTab === 'job' ? 'main' : 'side'}`)}>
            <IconPlus size={16} /> 新建{activeTab === 'job' ? '岗位主线' : '自选计划'}
          </button>
        </header>

        {error && <div className="lp-alert">{error}<button onClick={() => fetchPaths()}><IconRefresh size={15} />重试</button></div>}
        {notice && <div className="lp-notice" role="status">{notice}</div>}

        <section className="lp-spine" aria-label="学习组合概览">
          <div className="lp-spine-node canonical"><IconGraph size={18} /><span><strong>个人能力主干</strong><small>已验证能力</small></span></div>
          <span className="lp-spine-line" />
          <div className="lp-spine-node"><IconBriefcase size={18} /><span><strong>{activeMain ? '1 条岗位主线' : '暂无岗位主线'}</strong><small>{activeMain?.planName || '等待创建'}</small></span></div>
          <span className="lp-spine-line" />
          <div className="lp-spine-node"><IconBook size={18} /><span><strong>{activeSides.length} 条自选计划</strong><small>{activeSides.length ? '共享支线时间预算' : '暂未排期'}</small></span></div>
        </section>

        <div className="hd-tabs lp-tabs">
          <button className={`hd-tab${activeTab === 'job' ? ' active' : ''}`} onClick={() => switchTab('job')}>
            <IconBriefcase size={16} /> 岗位驱动 <span>{mainPlans.length}</span>
          </button>
          <button className={`hd-tab${activeTab === 'self' ? ' active' : ''}`} onClick={() => switchTab('self')}>
            <IconBook size={16} /> 自选学习 <span>{sidePlans.length}</span>
          </button>
        </div>

        {visiblePlans.length === 0 ? (
          <section className="lp-empty">
            {activeTab === 'job' ? <IconTarget size={42} /> : <IconBook size={42} />}
            <h2>{activeTab === 'job' ? '还没有岗位主线' : '还没有自选计划'}</h2>
            <button className="hd-btn" onClick={() => navigate(`/plan/create?type=${activeTab === 'job' ? 'main' : 'side'}`)}>
              创建{activeTab === 'job' ? '岗位主线' : '自选计划'}
            </button>
          </section>
        ) : (
          <div className="lp-workspace">
            <aside className="lp-plan-rail" aria-label="计划列表">
              {visiblePlans.map((plan) => {
                const itemProgress = progressOf(plan);
                return (
                  <button key={plan.id} className={`lp-plan-item${plan.id === selectedId ? ' active' : ''}`} onClick={() => setSelectedId(plan.id)}>
                    <span className="lp-plan-item-top"><strong>{plan.planName}</strong><em className={plan.planStatus}>{STATUS_TEXT[plan.planStatus]}</em></span>
                    <span className="lp-plan-item-meta">{itemProgress.done}/{itemProgress.total} 项 · {itemProgress.percent}%</span>
                    <span className="lp-mini-progress"><i style={{ width: `${itemProgress.percent}%` }} /></span>
                  </button>
                );
              })}
              {selectedPlan && (
                <>
                  <section className="lp-rail-panel">
                    <div className="lp-rail-title"><strong>计划概览</strong><span>{progress.percent}%</span></div>
                    <div className="lp-rail-metrics">
                      <div><strong>{phases.length}</strong><span>学习阶段</span></div>
                      <div><strong>{pendingSkills}</strong><span>待完成项</span></div>
                      <div><strong>{selectedPlan.dailyHours || 2}h</strong><span>每日投入</span></div>
                      <div><strong>{selectedPlan.matchScore || 0}%</strong><span>{selectedPlan.planType === 'main' ? '岗位匹配' : '目标进度'}</span></div>
                    </div>
                    <div className="lp-rail-current">
                      <span>当前阶段</span>
                      <strong>{currentPhase?.name || '等待开始'}</strong>
                    </div>
                  </section>

                  <section className="lp-rail-panel">
                    <div className="lp-rail-title"><strong>今日排期</strong><span>{mainTaskMinutes + sideTaskMinutes} min</span></div>
                    <div className="lp-allocation-bar" aria-label="今日主线与自选任务时间分配">
                      <i className="main" style={{ flexGrow: mainTaskMinutes || 0 }} />
                      <i className="side" style={{ flexGrow: sideTaskMinutes || 0 }} />
                      {mainTaskMinutes + sideTaskMinutes === 0 && <i className="empty" />}
                    </div>
                    <div className="lp-allocation-legend">
                      <span><i className="main" />主线 {mainTaskMinutes} min</span>
                      <span><i className="side" />自选 {sideTaskMinutes} min</span>
                    </div>
                  </section>

                  <section className="lp-rail-panel lp-branch-panel">
                    <div className="lp-rail-title"><strong>计划分支</strong><span>Git</span></div>
                    <div className="lp-branch-line"><IconGraph size={16} /><span><strong>plan/{selectedPlan.id}</strong><small>分支 #{selectedPlan.branchId || '--'}</small></span></div>
                    <div className="lp-branch-connection"><i /><span>连接个人能力主干</span></div>
                  </section>
                </>
              )}
            </aside>

            {selectedPlan && (
              <main className="lp-plan-main">
                <section className="lp-plan-heading">
                  <div>
                    <span className={`lp-plan-kicker ${selectedPlan.planType}`}>{selectedPlan.planType === 'main' ? '岗位主线' : '自选计划'} · #{selectedPlan.branchId || '--'}</span>
                    <h2>{selectedPlan.planName}</h2>
                    <div className="lp-plan-facts">
                      {selectedPlan.planType === 'main' && <span><IconTarget size={14} />岗位 #{selectedPlan.targetJobId}</span>}
                      <span><IconClock size={14} />每日 {selectedPlan.dailyHours || 2} 小时</span>
                      <span><IconCalendar size={14} />{selectedPlan.estimatedDate || '待估算'}</span>
                    </div>
                  </div>
                  <div className="lp-actions">
                    {selectedPlan.planType === 'side' && selectedPlan.planStatus !== 'archived' && (
                      <button className="hd-btn secondary small" onClick={() => setShowAddCourse(true)}><IconPlus size={14} />学习内容</button>
                    )}
                    <button className="hd-btn secondary small" onClick={mergeAbility} disabled={actionBusy}>更新能力档案</button>
                    {selectedPlan.planStatus === 'active' ? (
                      <button className="hd-btn secondary small" onClick={() => changeStatus('paused')} disabled={actionBusy}>暂停</button>
                    ) : selectedPlan.planStatus === 'paused' ? (
                      <button className="hd-btn secondary small" onClick={() => changeStatus('active')} disabled={actionBusy}>恢复</button>
                    ) : null}
                    {selectedPlan.planStatus !== 'archived' && (
                      <button className="hd-btn secondary small" onClick={() => changeStatus('archived')} disabled={actionBusy}>归档</button>
                    )}
                  </div>
                </section>

                <div className="lp-overview-grid">
                  <section className="hd-card lp-progress-card">
                    <div className="lp-section-title"><strong>计划进度</strong><span>{progress.done}/{progress.total}</span></div>
                    <div className="hd-progress"><div className="hd-progress-bar" style={{ width: `${progress.percent}%` }} /></div>
                    <div className="lp-progress-caption"><span>{phases[selectedPlan.currentPhase]?.name || '未开始'}</span><strong>{progress.percent}%</strong></div>
                  </section>
                  <section className="hd-card lp-today-card">
                    <div className="lp-section-title"><strong>今日组合任务</strong><span>{todayTasks?.totalEstimatedMin || 0} min</span></div>
                    {allTodayTasks.length === 0 ? <p className="lp-muted">今天没有待处理任务</p> : (
                      <div className="lp-task-list">
                        {allTodayTasks.slice(0, 4).map((task: any) => (
                          <TaskRow key={task.id} task={task} planName={paths.find((plan) => Number(plan.id) === Number(task.planId))?.planName || '学习计划'} onOpen={() => navigate(`/user/knowledge/${encodeURIComponent(task.skillName)}`)} />
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <section className="lp-phases">
                  <div className="lp-section-title"><strong>学习阶段</strong><span>{phases.length} 个阶段</span></div>
                  {phases.length === 0 ? <p className="lp-muted">计划正在生成学习路径</p> : phases.map((phase, phaseIndex) => (
                    <div className={`lp-phase${phaseIndex === selectedPlan.currentPhase ? ' current' : ''}`} key={`${phase.name}-${phaseIndex}`}>
                      <div className="lp-phase-marker">{phaseIndex < selectedPlan.currentPhase ? <IconCheck size={13} /> : phaseIndex + 1}</div>
                      <div className="lp-phase-content">
                        <header><h3>{phase.name}</h3><span>{(phase.skills || []).filter((skill) => skill.status === 'done').length}/{phase.skills?.length || 0}</span></header>
                        <div className="lp-skill-list">
                          {(phase.skills || []).map((skill: SkillNode) => (
                            <button key={skill.name} className={`lp-skill${skill.status === 'done' ? ' done' : ''}`} onClick={() => navigate(`/user/knowledge/${encodeURIComponent(skill.name)}`)}>
                              {skill.status === 'done' ? <IconCheck size={15} /> : <span className="lp-skill-dot" />}
                              <strong>{skill.name}</strong>
                              <span>{skill.estimatedMin ? `${skill.estimatedMin} min` : skill.duration || '待估算'}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </section>
              </main>
            )}
          </div>
        )}
      </div>

      {showAddCourse && selectedPlan?.planType === 'side' && (
        <AddCourseModal planId={selectedPlan.id} onClose={() => setShowAddCourse(false)} onAdded={async () => { setShowAddCourse(false); await fetchPaths(true); }} />
      )}
    </div>
  );
}

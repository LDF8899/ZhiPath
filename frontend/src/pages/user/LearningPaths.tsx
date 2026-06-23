import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLearningPaths, getTodayTasks } from '../../api/user';
import { useSession } from '../../hooks/useSession';
import { useWorkspaceStore } from '../../stores/workspace';
import AddCourseModal from '../../components/AddCourseModal';
import type { LearningPath } from '../../types';
import '../../styles/hand-draw.css';
import {
  IconBook,
  IconBriefcase,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconGradCap,
  IconRefresh,
  IconTarget,
} from '../../components/icons';

export default function LearningPaths() {
  const navigate = useNavigate();
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'job' | 'self'>('job');
  const [todayTasks, setTodayTasks] = useState<any>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showAddCourse, setShowAddCourse] = useState(false);

  // 学习会话生命周期 — 进入页面自动开始，退出自动保存
  const currentPlanId = paths[selectedIdx]?.id;
  useSession(currentPlanId);

  const fetchPaths = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getLearningPaths();
      setPaths(res.data || []);
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaths();
  }, []);

  useEffect(() => {
    if (paths.length === 0) return;
    const planId = paths[selectedIdx]?.id;
    if (!planId) return;
    getTodayTasks(planId)
      .then((res) => setTodayTasks(res.data))
      .catch(() => {});
  }, [paths, selectedIdx]);

  // 订阅工作区事件：路径生成或任务刷新时自动刷新数据
  useEffect(() => {
    return useWorkspaceStore.subscribe(
      (state) => state.lastEvent,
      (event) => {
        if (!event) return;
        if (event.type === 'path_generated' || event.type === 'today_tasks_refresh') {
          fetchPaths();
        }
      },
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Loading ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-canvas">
            <div className="hd-loading">
              <IconBook size={32} style={{ marginBottom: 8 }} />
              <div>正在加载学习路径...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error ───────────────────────────────────────────────── */
  if (error) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-canvas">
            <div className="hd-empty">
              <div style={{ marginBottom: 12 }}>{error}</div>
              <button className="hd-btn small" onClick={fetchPaths}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconRefresh size={16} /> 重试
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const path = paths[selectedIdx] as (typeof paths)[number] & { planType?: 'main' | 'side' };

  /* ── Empty ───────────────────────────────────────────────── */
  if (!path) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-canvas">
            <div className="hd-empty">
              <IconGradCap size={48} style={{ marginBottom: 12, color: 'var(--pencil)' }} />
              <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 6 }}>
                还没有学习路径
              </div>
              <div style={{ marginBottom: 20 }}>
                在 AI 助教对话中设定目标岗位后，系统会自动生成学习路径
              </div>
              <button
                className="hd-btn"
                onClick={() => navigate('/user/chat')}
              >
                去设定目标 &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Data computations ───────────────────────────────────── */
  const totalSkills = path.pathData.phases.reduce((sum, p) => sum + p.skills.length, 0);
  const doneSkills = path.pathData.phases.reduce(
    (sum, p) => sum + p.skills.filter((s) => s.status === 'done').length,
    0,
  );
  const percent = totalSkills > 0 ? Math.round((doneSkills / totalSkills) * 100) : 0;
  const currentPhaseName = path.pathData.phases[path.currentPhase]?.name || '未开始';

  /* ── Main render ─────────────────────────────────────────── */
  return (
    <div className="hd-page">
      <div className="hd-page-wrap">
        <div className="hd-canvas">
          {/* Header */}
          <div className="hd-header">
            <h1>学习路径</h1>
            <div className="hd-flex" style={{ gap: 10 }}>
              <span className="hd-pill">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <IconTarget size={14} /> 匹配度 {path.matchScore || 0}%
                </span>
              </span>
              <button
                className="hd-btn small"
                onClick={() => setShowAddCourse(true)}
              >
                + 添加课程
              </button>
              <button
                className="hd-btn small"
                onClick={() => navigate('/plan/create')}
              >
                创建计划
              </button>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="hd-tabs">
            <button
              className={`hd-tab${activeTab === 'job' ? ' active' : ''}`}
              onClick={() => setActiveTab('job')}
            >
              <IconBriefcase size={16} />
              岗位驱动
            </button>
            <button
              className={`hd-tab${activeTab === 'self' ? ' active' : ''}`}
              onClick={() => setActiveTab('self')}
            >
              <IconBook size={16} />
              自选学习
            </button>
          </div>

          {/* Multi-plan switcher */}
          {paths.length > 1 && (
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <select
                className="hd-select"
                value={selectedIdx}
                onChange={(e) => setSelectedIdx(Number(e.target.value))}
                style={{
                  width: '100%',
                  maxWidth: 420,
                  font: '15px/1 var(--hand-bold)',
                  paddingLeft: 14,
                  paddingRight: 36,
                }}
              >
                {paths.map((p, idx) => {
                  const pType = (p as any).planType || 'main';
                  return (
                    <option key={p.id} value={idx}>
                      {p.planName} ({pType === 'main' ? '主线' : '支线'})
                    </option>
                  );
                })}
              </select>
              <IconChevronDown
                size={16}
                style={{
                  position: 'absolute',
                  right: 14,
                  top: '50%',
                  marginTop: -8,
                  pointerEvents: 'none',
                  color: 'var(--pencil)',
                }}
              />
            </div>
          )}

          {/* Plan info card */}
          <div className="hd-card" style={{ marginBottom: 16 }}>
            <div className="hd-flex-between">
              <div>
                <div style={{ font: '13px/1 var(--mono)', color: 'var(--pencil)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
                  当前计划
                </div>
                <div style={{ font: '800 22px/1.2 var(--serif)' }}>
                  {path.planName || currentPhaseName}
                </div>
                {/* 绑定的智能体标识 */}
                {(path as any).boundAgentType && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, padding: '2px 8px', borderRadius: 4, background: 'var(--note-blue, #e8f0fe)', border: '1px solid #a0c4ff', font: '12px/1 var(--hand)', color: '#1a56db' }}>
                    <span style={{ fontSize: 14 }}>🤖</span>
                    <span>{(path as any).boundAgentType}</span>
                  </div>
                )}
              </div>
              <div className="hd-flex" style={{ gap: 16 }}>
                <div style={{ textAlign: 'right' }}>
                  <div className="hd-kpi-label">每日学习</div>
                  <div style={{ font: '700 18px/1 var(--hand-bold)', color: 'var(--ink)', marginTop: 4 }}>
                    {path.dailyHours || 2}h
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="hd-kpi-label">预计完成</div>
                  <div style={{ font: '700 18px/1 var(--hand-bold)', color: 'var(--ink)', marginTop: 4 }}>
                    {path.estimatedDate || '--'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Progress overview */}
          <div className="hd-card" style={{ marginBottom: 20 }}>
            <div className="hd-flex-between" style={{ marginBottom: 10 }}>
              <div className="hd-flex" style={{ gap: 8 }}>
                <IconGradCap size={18} style={{ color: 'var(--accent)' }} />
                <span style={{ font: '700 16px/1 var(--hand-bold)' }}>
                  总体进度
                </span>
              </div>
              <span className="hd-badge accent">{doneSkills}/{totalSkills} 技能</span>
            </div>
            <div className="hd-progress">
              <div
                className="hd-progress-bar"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ font: '12px/1 var(--mono)', color: 'var(--pencil)' }}>
                当前阶段：{currentPhaseName}
              </span>
              <span style={{ font: '800 14px/1 var(--hand-bold)', color: 'var(--accent)' }}>
                {percent}%
              </span>
            </div>
          </div>

          {/* Today's tasks card */}
          {todayTasks && (todayTasks.mainTasks?.length > 0 || todayTasks.sideTasks?.length > 0) && (
            <div className="hd-card" style={{ marginBottom: 20 }}>
              <div className="hd-flex-between" style={{ marginBottom: 12 }}>
                <div style={{ font: '700 17px/1 var(--hand-bold)' }}>
                  📅 今日任务
                </div>
                {todayTasks.totalEstimatedMin > 0 && (
                  <span className="hd-pill">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <IconClock size={12} /> {todayTasks.totalEstimatedMin}min
                    </span>
                  </span>
                )}
              </div>

              {/* Main tasks */}
              {todayTasks.mainTasks?.length > 0 && (
                <div className="hd-flex-col" style={{ gap: 6, marginBottom: todayTasks.sideTasks?.length > 0 ? 10 : 0 }}>
                  {todayTasks.mainTasks.map((task: any) => {
                    const done = task.taskStatus === 'done' || task.taskStatus === 'skipped';
                    const active = task.taskStatus !== 'pending' && task.taskStatus !== 'done' && task.taskStatus !== 'skipped';
                    return (
                      <div
                        key={task.id}
                        className="hd-flex"
                        onClick={() => navigate(`/user/knowledge/${encodeURIComponent(task.skillName)}`)}
                        style={{
                          gap: 10,
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: done ? 'var(--note-green)' : 'var(--paper)',
                          border: done ? '1px solid #a3d9a3' : '1px dashed var(--rule)',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { if (!done) e.currentTarget.style.borderColor = 'var(--accent)'; }}
                        onMouseLeave={e => { if (!done) e.currentTarget.style.borderColor = 'var(--rule)'; }}
                      >
                        {done ? (
                          <IconCheck size={16} style={{ color: '#3a7d3a', flexShrink: 0 }} />
                        ) : active ? (
                          <IconClock size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        ) : (
                          <div
                            style={{
                              width: 14,
                              height: 14,
                              border: '1.5px solid var(--rule)',
                              borderRadius: '50%',
                              background: 'var(--paper)',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span
                          style={{
                            font: '15px/1.3 var(--hand)',
                            flex: 1,
                            color: done ? 'var(--pencil)' : 'var(--ink)',
                            textDecoration: done ? 'line-through' : 'none',
                            textDecorationColor: 'var(--rule)',
                          }}
                        >
                          {task.skillName}
                        </span>
                        <span
                          className="hd-badge accent"
                          style={{ flexShrink: 0 }}
                        >
                          主线
                        </span>
                        {task.estimatedMin > 0 && (
                          <span style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)', flexShrink: 0 }}>
                            {task.estimatedMin}min
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Side tasks */}
              {todayTasks.sideTasks?.length > 0 && (
                <div className="hd-flex-col" style={{ gap: 6 }}>
                  {todayTasks.sideTasks.map((task: any) => {
                    const done = task.taskStatus === 'done' || task.taskStatus === 'skipped';
                    const active = task.taskStatus !== 'pending' && task.taskStatus !== 'done' && task.taskStatus !== 'skipped';
                    return (
                      <div
                        key={task.id}
                        className="hd-flex"
                        onClick={() => navigate(`/user/knowledge/${encodeURIComponent(task.skillName)}`)}
                        style={{
                          gap: 10,
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: done ? 'var(--note-green)' : 'var(--paper)',
                          border: done ? '1px solid #a3d9a3' : '1px dashed var(--rule)',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { if (!done) e.currentTarget.style.borderColor = 'var(--accent)'; }}
                        onMouseLeave={e => { if (!done) e.currentTarget.style.borderColor = 'var(--rule)'; }}
                      >
                        {done ? (
                          <IconCheck size={16} style={{ color: '#3a7d3a', flexShrink: 0 }} />
                        ) : active ? (
                          <IconClock size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        ) : (
                          <div
                            style={{
                              width: 14,
                              height: 14,
                              border: '1.5px solid var(--rule)',
                              borderRadius: '50%',
                              background: 'var(--paper)',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span
                          style={{
                            font: '15px/1.3 var(--hand)',
                            flex: 1,
                            color: done ? 'var(--pencil)' : 'var(--ink)',
                            textDecoration: done ? 'line-through' : 'none',
                            textDecorationColor: 'var(--rule)',
                          }}
                        >
                          {task.skillName}
                        </span>
                        <span
                          style={{
                            font: '11px/1 var(--mono)',
                            padding: '3px 8px',
                            border: '1.5px solid var(--pencil)',
                            borderRadius: 4,
                            color: 'var(--pencil)',
                            flexShrink: 0,
                          }}
                        >
                          支线
                        </span>
                        {task.estimatedMin > 0 && (
                          <span style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)', flexShrink: 0 }}>
                            {task.estimatedMin}min
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Progress bar */}
              {todayTasks.totalEstimatedMin > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="hd-progress">
                    <div
                      className="hd-progress-bar"
                      style={{ width: `${todayTasks.progressPct || 0}%` }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)' }}>
                      {todayTasks.completedMin || 0}/{todayTasks.totalEstimatedMin}min
                    </span>
                    <span style={{ font: '700 12px/1 var(--hand-bold)', color: 'var(--accent)' }}>
                      {todayTasks.progressPct || 0}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section label */}
          <div className="hd-section-label">
            <h3>学习阶段</h3>
            <span className="hd-pill">{path.pathData.phases.length} 阶段</span>
          </div>

          {/* Timeline */}
          <div style={{ position: 'relative', paddingLeft: 40 }}>
            {/* Vertical timeline line */}
            <div
              style={{
                position: 'absolute',
                left: 15,
                top: 8,
                bottom: 8,
                width: 2,
                background: 'repeating-linear-gradient(180deg, var(--pencil) 0 6px, transparent 6px 12px)',
              }}
            />

            <div className="hd-flex-col" style={{ gap: 16 }}>
              {path.pathData.phases.map((phase, phaseIdx) => {
                const phaseDone = phase.skills.filter((s) => s.status === 'done').length;
                const isCurrent = phaseIdx === path.currentPhase;
                const isPhaseComplete = phaseDone === phase.skills.length;
                const isPast = phaseIdx < path.currentPhase;

                return (
                  <div key={phaseIdx} style={{ position: 'relative' }}>
                    {/* Timeline dot */}
                    <div
                      style={{
                        position: 'absolute',
                        left: -32,
                        top: 18,
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: `2.5px solid ${isPhaseComplete || isPast ? 'var(--accent)' : isCurrent ? 'var(--ink)' : 'var(--rule)'}`,
                        background: isPhaseComplete || isPast ? 'var(--accent)' : isCurrent ? 'var(--highlight)' : 'var(--paper)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2,
                      }}
                    >
                      {(isPhaseComplete || isPast) && (
                        <IconCheck size={11} className="" />
                      )}
                    </div>

                    {/* Phase card */}
                    <div
                      className={`hd-card${isCurrent ? ' hd-card-accent' : ''}`}
                      style={{
                        borderColor: isCurrent ? 'var(--ink)' : undefined,
                        background: isCurrent ? 'var(--paper)' : isPast ? 'var(--paper-tint)' : 'var(--paper)',
                      }}
                    >
                      {/* Phase header */}
                      <div className="hd-flex-between" style={{ marginBottom: 10 }}>
                        <div className="hd-flex" style={{ gap: 8 }}>
                          <h3
                            style={{
                              font: isCurrent ? '800 18px/1 var(--serif)' : '700 18px/1 var(--serif)',
                              margin: 0,
                              color: isCurrent ? 'var(--accent)' : 'var(--ink)',
                            }}
                          >
                            {phase.name}
                          </h3>
                          {isCurrent && (
                            <span className="hd-badge accent">进行中</span>
                          )}
                          {isPhaseComplete && (
                            <span className="hd-badge green">已完成</span>
                          )}
                        </div>
                        <span
                          style={{
                            font: '12px/1 var(--mono)',
                            color: 'var(--pencil)',
                          }}
                        >
                          {phaseDone}/{phase.skills.length}
                        </span>
                      </div>

                      {/* Skills list */}
                      <div className="hd-flex-col" style={{ gap: 6 }}>
                        {phase.skills.map((skill, skillIdx) => {
                          const isDone = skill.status === 'done';
                          return (
                            <div
                              key={skillIdx}
                              className="hd-flex"
                              onClick={() => !isDone && navigate(`/user/knowledge/${encodeURIComponent(skill.name)}`)}
                              style={{
                                gap: 10,
                                padding: '8px 10px',
                                borderRadius: 6,
                                background: isDone ? 'var(--note-green)' : isCurrent ? 'var(--paper-tint)' : 'var(--paper)',
                                border: isDone ? '1px solid #a3d9a3' : '1px dashed var(--rule)',
                                cursor: isDone ? 'default' : 'pointer',
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => { if (!isDone) e.currentTarget.style.borderColor = 'var(--accent)'; }}
                              onMouseLeave={e => { if (!isDone) e.currentTarget.style.borderColor = 'var(--rule)'; }}
                            >
                              {/* Status icon */}
                              <div style={{ flexShrink: 0 }}>
                                {isDone ? (
                                  <IconCheck size={16} style={{ color: '#3a7d3a' }} />
                                ) : isCurrent ? (
                                  <IconClock size={16} style={{ color: 'var(--accent)' }} />
                                ) : (
                                  <div
                                    style={{
                                      width: 14,
                                      height: 14,
                                      border: '1.5px solid var(--rule)',
                                      borderRadius: 3,
                                      background: 'var(--paper)',
                                    }}
                                  />
                                )}
                              </div>

                              {/* Skill name */}
                              <span
                                style={{
                                  font: '15px/1.3 var(--hand)',
                                  flex: 1,
                                  color: isDone ? 'var(--pencil)' : 'var(--ink)',
                                  textDecoration: isDone ? 'line-through' : 'none',
                                  textDecorationColor: 'var(--rule)',
                                }}
                              >
                                {skill.name}
                                {!isDone && isCurrent && (
                                  <span style={{ font: '11px/1 var(--mono)', color: 'var(--accent)', marginLeft: 8, opacity: 0.7 }}>点击学习 →</span>
                                )}
                              </span>

                              {/* Mastery indicator */}
                              {!isDone && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                  {skill.readAt && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3a7d3a' }} title="讲义已读" />}
                                  {skill.quizPassed && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#8a6d00' }} title="测验通过" />}
                                  {skill.code_done && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} title="编程完成" />}
                                </div>
                              )}

                              {/* Duration */}
                              <span
                                style={{
                                  font: '11px/1 var(--mono)',
                                  color: 'var(--pencil)',
                                  flexShrink: 0,
                                }}
                              >
                                {skill.duration}
                              </span>

                              {/* Completion date */}
                              {isDone && skill.completedAt && (
                                <span
                                  style={{
                                    font: '11px/1 var(--mono)',
                                    color: 'var(--pencil)',
                                    flexShrink: 0,
                                  }}
                                >
                                  <IconCalendar size={12} style={{ verticalAlign: -2, marginRight: 3 }} />
                                  {new Date(skill.completedAt * 1000).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showAddCourse && currentPlanId && (
        <AddCourseModal
          planId={currentPlanId}
          onClose={() => setShowAddCourse(false)}
          onAdded={() => {
            setShowAddCourse(false);
            fetchPaths();
          }}
        />
      )}
    </div>
  );
}

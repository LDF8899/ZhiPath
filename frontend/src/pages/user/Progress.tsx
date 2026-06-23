import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getLearningPaths,
  getSessionHistory,
  getSessionStats,
  diffSessions,
  rollbackSession,
  getSkills,
} from '../../api/user';
import RadarChart from '../../components/RadarChart';
import type { LearningPath } from '../../types';
import '../../styles/hand-draw.css';

/* ── SVG icons ─────────────────────────────────────────── */
const IconClock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconRefresh = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);
const IconHistory = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);
const IconDiff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18" /><path d="M5 12h14" /><rect x="2" y="7" width="6" height="6" rx="1" /><rect x="16" y="11" width="6" height="6" rx="1" />
  </svg>
);
const IconRise = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);
const IconFall = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
  </svg>
);
const IconRollback = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
  </svg>
);
const IconProgress = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
  </svg>
);
const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);
const IconTarget = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
  </svg>
);

/* ── Helpers ────────────────────────────────────────────── */
const STATUS_LABEL: Record<string, string> = {
  pending: '待开始', in_progress: '进行中', lecture_done: '讲义完成',
  practice_done: '练习完成', code_done: '编程完成', exam_done: '考试通过',
  done: '已完成', skipped: '已跳过',
};

type ViewMode = 'path' | 'history' | 'diff';

/* ── Main component ────────────────────────────────────── */
export default function ProgressPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<LearningPath | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [skills, setSkills] = useState<any[]>([]);
  const [view, setView] = useState<ViewMode>('path');

  // Diff state
  const [diffDateA, setDiffDateA] = useState('');
  const [diffDateB, setDiffDateB] = useState('');
  const [diffResult, setDiffResult] = useState<any>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  // Rollback state
  const [rollbackTarget, setRollbackTarget] = useState('');
  const [rollbackModal, setRollbackModal] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pathRes, sessionRes, statsRes, skillsRes] = await Promise.all([
        getLearningPaths().catch(() => ({ data: [] })),
        getSessionHistory().catch(() => ({ data: { sessions: [] } })),
        getSessionStats().catch(() => ({ data: null })),
        getSkills().catch(() => ({ data: [] })),
      ]);
      setPath(pathRes.data?.[0] || null);
      setSessions(sessionRes.data?.sessions || []);
      setStats(statsRes.data);
      setSkills(skillsRes.data || []);
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDiff = async () => {
    if (!diffDateA || !diffDateB) return;
    setDiffLoading(true);
    try {
      const res = await diffSessions(diffDateA, diffDateB);
      setDiffResult(res.data);
    } catch (e: any) {
      console.error('Diff failed:', e.message);
    } finally {
      setDiffLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!rollbackTarget) return;
    try {
      await rollbackSession(rollbackTarget);
      setRollbackModal(false);
      fetchData();
    } catch (e: any) {
      console.error('Rollback failed:', e.message);
    }
  };

  /* ── Loading ──────────────────────────────────────── */
  if (loading) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-loading">
            <div className="hd-skeleton w60" style={{ margin: '0 auto 8px' }} />
            <div className="hd-skeleton w40" style={{ margin: '0 auto' }} />
            <p style={{ marginTop: 16 }}>正在加载学习记录...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-empty">
            <p style={{ marginBottom: 12 }}>{error}</p>
            <button className="hd-btn small" onClick={fetchData}>
              <span className="hd-flex" style={{ gap: 6 }}><IconRefresh /> 重试</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const radarData = skills.slice(0, 8).map((s: any) => ({
    label: s.skillName?.substring(0, 6) || '',
    value: Number(s.masteryPct) || 0,
    max: 100,
  }));

  return (
    <div className="hd-page">
      <div className="hd-page-wrap">
        {/* ── Header ─────────────────────────────────── */}
        <div className="hd-header">
          <div className="hd-flex" style={{ gap: 14 }}>
            <span style={{ color: 'var(--accent)' }}><IconProgress /></span>
            <h1>学习记录</h1>
          </div>
          <div className="hd-flex" style={{ gap: 8 }}>
            <button
              className={`hd-tab${view === 'history' ? ' active' : ''}`}
              onClick={() => setView(view === 'history' ? 'path' : 'history')}
            >
              <IconHistory /> {view === 'history' ? '返回路径' : '学习记录'}
            </button>
            <button
              className={`hd-tab${view === 'diff' ? ' active' : ''}`}
              onClick={() => setView(view === 'diff' ? 'path' : 'diff')}
            >
              <IconDiff /> {view === 'diff' ? '返回路径' : '技能对比'}
            </button>
          </div>
        </div>

        {/* ── KPIs ───────────────────────────────────── */}
        {stats && (
          <div className="hd-kpis">
            <div className="hd-kpi hd-tilt-1">
              <div className="hd-kpi-label">学习次数</div>
              <div className="hd-kpi-value ink">{stats.totalSessions ?? 0}</div>
              <div className="hd-kpi-small">次</div>
            </div>
            <div className="hd-kpi hd-tilt-2">
              <div className="hd-kpi-label">累计时长</div>
              <div className="hd-kpi-value">{stats.totalDurationHours ?? 0}</div>
              <div className="hd-kpi-small">小时</div>
            </div>
            <div className="hd-kpi hd-tilt-3">
              <div className="hd-kpi-label">技能提升</div>
              <div className="hd-kpi-value blue">{stats.totalSkillsImproved ?? 0}</div>
              <div className="hd-kpi-small">次</div>
            </div>
            <div className="hd-kpi hd-tilt-4">
              <div className="hd-kpi-label">连续学习</div>
              <div className="hd-kpi-value ink">{stats.streakDays ?? 0}</div>
              <div className="hd-kpi-small">天</div>
            </div>
          </div>
        )}

        {/* ── View content ───────────────────────────── */}
        {view === 'path' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, marginTop: 20 }}>
            <PathView path={path} />
            <div className="hd-card-accent">
              <div className="hd-section-label">
                <h3>技能雷达</h3>
              </div>
              {radarData.length >= 3 ? (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <RadarChart data={radarData} size={220} color="var(--accent)" bgColor="var(--note-yellow)" />
                </div>
              ) : (
                <div className="hd-empty" style={{ padding: '24px 0' }}>暂无技能数据</div>
              )}
            </div>
          </div>
        )}

        {view === 'history' && (
          <HistoryView
            sessions={sessions}
            onRollback={(d) => { setRollbackTarget(d); setRollbackModal(true); }}
          />
        )}

        {view === 'diff' && (
          <DiffView
            sessions={sessions}
            dateA={diffDateA}
            dateB={diffDateB}
            result={diffResult}
            loading={diffLoading}
            onDateAChange={setDiffDateA}
            onDateBChange={setDiffDateB}
            onDiff={handleDiff}
          />
        )}

        {/* ── Rollback modal ─────────────────────────── */}
        {rollbackModal && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(43,38,32,0.3)',
            }}
            onClick={() => setRollbackModal(false)}
          >
            <div
              className="hd-card-accent"
              style={{ maxWidth: 400, width: '90%', background: 'var(--paper)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ font: "800 22px/1 var(--serif)", marginBottom: 12 }}>确认回退</h3>
              <div className="hd-divider" />
              <p style={{ marginBottom: 8 }}>
                确定要回退到 <strong>{rollbackTarget}</strong> 的技能状态吗？
              </p>
              <p style={{ fontSize: 14, color: 'var(--pencil)', marginBottom: 20 }}>
                此操作会将你的技能掌握度恢复到该日期的状态。
              </p>
              <div className="hd-flex" style={{ justifyContent: 'flex-end', gap: 8 }}>
                <button className="hd-btn secondary small" onClick={() => setRollbackModal(false)}>
                  取消
                </button>
                <button className="hd-btn small" onClick={handleRollback}>
                  确认回退
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Path View ─────────────────────────────────────────── */
function PathView({ path }: { path: LearningPath | null }) {
  const navigate = useNavigate();

  if (!path) {
    return (
      <div className="hd-empty">
        <p style={{ marginBottom: 12 }}>还没有学习计划</p>
        <button className="hd-btn small" onClick={() => navigate('/plan/create')}>创建计划</button>
      </div>
    );
  }

  const totalSkills = path.pathData.phases.reduce((s, p) => s + p.skills.length, 0);
  const doneSkills = path.pathData.phases.reduce((s, p) => s + p.skills.filter(sk => sk.status === 'done').length, 0);
  const percent = totalSkills > 0 ? Math.round((doneSkills / totalSkills) * 100) : 0;

  return (
    <div className="hd-flex-col" style={{ gap: 14 }}>
      {/* Overview card */}
      <div className="hd-card-accent">
        <div className="hd-flex" style={{ gap: 20 }}>
          <div
            style={{
              width: 72, height: 72, borderRadius: '50%',
              border: '3px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              font: "800 28px/1 var(--serif)", color: 'var(--accent)',
              background: 'var(--note-yellow)',
            }}
          >
            {percent}%
          </div>
          <div>
            <div style={{ font: "700 18px/1.2 var(--hand-bold)", marginBottom: 4 }}>
              {doneSkills}/{totalSkills} 技能已掌握
            </div>
            <div style={{ fontSize: 14, color: 'var(--pencil)' }}>
              匹配度 {path.matchScore || 0}% · 预计 {path.estimatedDate} 达成
            </div>
          </div>
        </div>
      </div>

      {/* Phase list */}
      {path.pathData.phases.map((phase, i) => {
        const done = phase.skills.filter(s => s.status === 'done').length;
        const total = phase.skills.length;
        const isCurrent = i === path.currentPhase;
        const isComplete = done === total;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        return (
          <div key={i} className="hd-card">
            <div className="hd-flex-between" style={{ marginBottom: 10 }}>
              <div className="hd-flex" style={{ gap: 10 }}>
                {isComplete ? (
                  <span style={{ color: '#3a7d3a' }}><IconCheck /></span>
                ) : isCurrent ? (
                  <span style={{ color: 'var(--accent)' }}><IconTarget /></span>
                ) : (
                  <span
                    style={{
                      width: 16, height: 16, borderRadius: '50%',
                      border: '1.5px solid var(--pencil)', display: 'inline-block',
                    }}
                  />
                )}
                <span style={{ font: "600 16px/1 var(--hand)", color: isCurrent ? 'var(--accent)' : 'var(--ink)' }}>
                  {phase.name}
                </span>
                {isCurrent && <span className="hd-badge accent">当前</span>}
                {isComplete && <span className="hd-badge green">完成</span>}
              </div>
              <span style={{ font: "12px/1 var(--mono)", color: 'var(--pencil)' }}>{done}/{total}</span>
            </div>
            <div className="hd-progress" style={{ marginBottom: 10 }}>
              <div
                className={`hd-progress-bar${isComplete ? ' green' : ' blue'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="hd-flex" style={{ gap: 6, flexWrap: 'wrap' }}>
              {phase.skills.map((skill, j) => (
                <span
                  key={j}
                  className={`hd-tag${skill.status === 'done' ? ' hot' : ''}`}
                >
                  {skill.name}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── History View ──────────────────────────────────────── */
function HistoryView({ sessions, onRollback }: { sessions: any[]; onRollback: (date: string) => void }) {
  if (sessions.length === 0) {
    return <div className="hd-empty">暂无学习记录</div>;
  }

  return (
    <div className="hd-flex-col" style={{ gap: 12, marginTop: 20 }}>
      {sessions.map((s) => {
        const durationMin = Math.round((s.totalDurationMs || 0) / 60000);
        const skillChanges = s.skillChanges || [];

        return (
          <div key={s.id} className="hd-card">
            <div className="hd-flex-between" style={{ marginBottom: 8 }}>
              <div className="hd-flex" style={{ gap: 10 }}>
                <span style={{ color: 'var(--data-blue)' }}><IconHistory /></span>
                <span style={{ font: "600 16px/1 var(--hand)" }}>{s.sessionDate}</span>
                <span className="hd-pill">{durationMin} 分钟</span>
              </div>
              <button
                className="hd-btn secondary small"
                onClick={() => onRollback(s.sessionDate)}
              >
                <span className="hd-flex" style={{ gap: 4 }}><IconRollback /> 回退到此日期</span>
              </button>
            </div>

            {skillChanges.length > 0 && (
              <div className="hd-flex" style={{ gap: 6, flexWrap: 'wrap' }}>
                {skillChanges.map((c: any, i: number) => {
                  const up = c.after > c.before;
                  return (
                    <span
                      key={i}
                      className={`hd-badge ${up ? 'green' : 'red'}`}
                      title={`${c.before}% -> ${c.after}%`}
                    >
                      {c.name} {up ? <IconRise /> : <IconFall />} {Math.round(c.after - c.before)}%
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Diff View ─────────────────────────────────────────── */
function DiffView({
  sessions, dateA, dateB, result, loading,
  onDateAChange, onDateBChange, onDiff,
}: {
  sessions: any[];
  dateA: string;
  dateB: string;
  result: any;
  loading: boolean;
  onDateAChange: (d: string) => void;
  onDateBChange: (d: string) => void;
  onDiff: () => void;
}) {
  const dates = sessions.map(s => s.sessionDate);

  return (
    <div className="hd-flex-col" style={{ gap: 16, marginTop: 20 }}>
      <div className="hd-card-accent">
        <div className="hd-section-label">
          <h3>选择对比日期</h3>
        </div>
        <div className="hd-flex" style={{ gap: 10, flexWrap: 'wrap' }}>
          <select
            title="起始日期"
            className="hd-select"
            style={{ flex: 1, minWidth: 160 }}
            value={dateA}
            onChange={(e) => onDateAChange(e.target.value)}
          >
            <option value="">选择起始日期</option>
            {dates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <span style={{ color: 'var(--pencil)', font: "16px/1 var(--hand)" }}>→</span>
          <select
            title="结束日期"
            className="hd-select"
            style={{ flex: 1, minWidth: 160 }}
            value={dateB}
            onChange={(e) => onDateBChange(e.target.value)}
          >
            <option value="">选择结束日期</option>
            {dates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button
            className="hd-btn small"
            onClick={onDiff}
            disabled={loading || !dateA || !dateB}
          >
            {loading ? '对比中...' : '对比'}
          </button>
        </div>
      </div>

      {result && (
        <div className="hd-card-accent">
          <div className="hd-section-label">
            <h3>{result.dateA} → {result.dateB} 技能变化</h3>
          </div>
          {result.changes.length > 0 ? (
            <div className="hd-flex-col" style={{ gap: 8 }}>
              {result.changes.map((c: any, i: number) => (
                <div key={i} className="hd-card">
                  <div className="hd-flex-between">
                    <span style={{ flex: 1 }}>{c.skill}</span>
                    <div className="hd-flex" style={{ gap: 6 }}>
                      <span style={{ font: "12px/1 var(--mono)", color: 'var(--pencil)' }}>{c.before}%</span>
                      <span style={{ color: 'var(--pencil)' }}>→</span>
                      <span style={{ font: "12px/1 var(--mono)", color: 'var(--pencil)' }}>{c.after}%</span>
                      <span className={`hd-badge ${c.delta > 0 ? 'green' : 'red'}`}>
                        {c.delta > 0 ? '+' : ''}{c.delta}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--pencil)' }}>两个日期之间没有技能变化</p>
          )}
        </div>
      )}
    </div>
  );
}

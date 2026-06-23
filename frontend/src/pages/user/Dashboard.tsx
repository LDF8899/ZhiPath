import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboard, getBestMatch } from '../../api/user';
import { useSSE } from '../../hooks/useSSE';
import { useMatchScoreToast, useCelebration, StreakBanner } from '../../components/MatchScoreToast';
import PlanWelcomeModal from '../../components/PlanWelcomeModal';
import '../../styles/hand-draw.css';
import {
  IconCheck,
  IconClock,
  IconBook,
  IconTrophy,
  IconFire,
  IconBriefcase,
  IconRefresh,
  IconArrowRight,
  IconNewspaper,
  IconGradCap,
  IconTarget,
} from '../../components/icons';
import type { DashboardData } from '../../types';

/* ── 问候语 ── */
function getGreeting(name: string): string {
  const hour = new Date().getHours();
  if (hour < 6) return `夜深了，${name || '同学'}，注意休息`;
  if (hour < 12) return `早上好，${name || '同学'} ☀`;
  if (hour < 18) return `下午好，${name || '同学'}`;
  return `晚上好，${name || '同学'}`;
}

/* ── 鼓励语 ── */
const ENCOURAGEMENTS = [
  '每天进步一点点，离目标更近一步！',
  '坚持就是胜利，继续加油！',
  '知识就是力量，学无止境！',
  '今天也要元气满满地学习哦！',
  '每一步都算数，别停下脚步！',
  '慢一点没关系，方向对就好。',
  '今天的努力是明天的底气。',
];

function getEncouragement(): string {
  return ENCOURAGEMENTS[Math.floor(Date.now() / 86400000) % ENCOURAGEMENTS.length];
}

/* ── 状态中文映射 ── */
const STATUS_LABEL: Record<string, string> = {
  pending: '待开始',
  in_progress: '进行中',
  lecture_done: '讲义完成',
  practice_done: '练习完成',
  code_done: '编程完成',
  exam_done: '考试通过',
  done: '已完成',
  skipped: '已跳过',
};

/* ── 迷你火花线 ── */
function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  const w = 80, h = 28;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'url(#sketch)' }}
      />
      {/* 最后一个点高亮 */}
      {values.length > 0 && (() => {
        const lastX = ((values.length - 1) / (values.length - 1)) * w;
        const lastY = h - (values[values.length - 1] / max) * (h - 4) - 2;
        return <circle cx={lastX} cy={lastY} r="3" fill={color} />;
      })()}
      <defs>
        <filter id="sketch">
          <feTurbulence baseFrequency="0.04" numOctaves="4" seed="2" />
          <feDisplacementMap in="SourceGraphic" scale="1.5" />
        </filter>
      </defs>
    </svg>
  );
}

/* ── 手绘圆弧进度 ── */
function HandProgress({ pct, size = 64 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--rule)" strokeWidth="3.5"
          strokeDasharray="4 3"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--accent)" strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${offset} ${circumference - offset}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <span
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          font: `800 ${size * 0.26}px/1 var(--serif)`, color: 'var(--accent)',
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

/* ── 涂鸦装饰 ── */
function DoodleArrow({ style }: { style?: React.CSSProperties }) {
  return (
    <svg width="48" height="24" viewBox="0 0 48 24" style={{ ...style, display: 'block' }}>
      <path
        d="M2 18 C10 6, 30 4, 42 10 M38 6 L42 10 L36 13"
        fill="none" stroke="var(--pencil)" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"
        opacity="0.35"
      />
    </svg>
  );
}

function DoodleCircle({ size = 32, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ ...style, display: 'block' }}>
      <circle
        cx="16" cy="16" r="12"
        fill="none" stroke="var(--accent)" strokeWidth="1.5"
        strokeDasharray="3 2" opacity="0.3"
        transform="rotate(-8 16 16)"
      />
    </svg>
  );
}

function DoodleUnderline({ width = 120, color = 'var(--accent)' }: { width?: number; color?: string }) {
  return (
    <svg width={width} height="8" viewBox={`0 0 ${width} 8`} style={{ display: 'block', marginTop: -4 }}>
      <path
        d={`M2 6 C${width * 0.2} 2 ${width * 0.5} 7 ${width * 0.8} 3 L${width - 2} 5`}
        fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.5"
      />
    </svg>
  );
}

/* ── 小火苗动画 ── */
function FireDoodle() {
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" style={{ display: 'block' }}>
      <path
        d="M8 2 C10 6, 14 8, 12 14 C11 17, 9 18, 8 18 C7 18, 5 17, 4 14 C2 8, 6 6, 8 2Z"
        fill="var(--highlight)" stroke="var(--accent)" strokeWidth="1.2"
        strokeLinecap="round" opacity="0.7"
      >
        <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [hoveredTask, setHoveredTask] = useState<number | null>(null);
  const [bestMatch, setBestMatch] = useState<{ jobId: number; jobTitle: string; matchScore: number } | null>(null);
  const prevMatchRef = useRef<number>(0);

  // 计划欢迎弹窗 — 首次进入时显示
  const [showPlanModal, setShowPlanModal] = useState(() => !sessionStorage.getItem('hasSeenPlanHub'));

  // SSE 连接 — 监听匹配度变化
  const { latestEvent } = useSSE({ autoConnect: true });

  // 匹配度 Toast + 庆祝动画
  const { contextHolder: matchToast, showMatchScoreChange } = useMatchScoreToast();
  const { celebrate, CelebrationOverlay } = useCelebration();

  // 监听 SSE match_update 事件
  useEffect(() => {
    if (latestEvent?.type === 'match_update') {
      const { newScore, jobId } = latestEvent.data;
      const oldScore = prevMatchRef.current;
      if (oldScore > 0 && newScore !== oldScore) {
        showMatchScoreChange(oldScore, newScore, bestMatch?.jobTitle);
        // 阶段性庆祝（每提升 10%）
        if (newScore > oldScore && Math.floor(newScore / 10) > Math.floor(oldScore / 10)) {
          celebrate(`匹配度达到 ${Math.floor(newScore)}%！`);
        }
      }
      prevMatchRef.current = newScore;
      // 更新最佳匹配
      setBestMatch(prev => prev ? { ...prev, matchScore: newScore } : prev);
    }
  }, [latestEvent]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, matchRes] = await Promise.all([
        getDashboard(),
        getBestMatch().catch(() => null),
      ]);
      setData(dashRes.data);
      if (dashRes.data.learning_path) {
        setSelectedPlanId(dashRes.data.learning_path.id);
      }
      if (matchRes?.data) {
        setBestMatch(matchRes.data);
        prevMatchRef.current = matchRes.data.matchScore;
      }
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="hd-empty" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="var(--rule)" strokeWidth="2.5" strokeDasharray="6 4" />
            <circle cx="24" cy="24" r="20" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="30 96" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="1.2s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>
        <p style={{ font: '16px/1 var(--hand)', color: 'var(--pencil)' }}>正在加载你的学习数据…</p>
      </div>
    );
  }

  /* ── Error ── */
  if (error || !data) {
    return (
      <div className="hd-empty" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ font: '18px/1.6 var(--hand)', color: 'var(--pencil)', marginBottom: 12 }}>{error || '暂无数据'}</p>
        <button className="hd-btn small" onClick={fetchData}>
          <span className="hd-flex" style={{ gap: 6 }}>
            <IconRefresh size={14} /> 重试
          </span>
        </button>
      </div>
    );
  }

  const totalSkills = data.stats.total_skills || 1;
  const donePct = Math.round((data.stats.done_skills / totalSkills) * 100);
  const currentPhaseName = data.learning_path?.pathData.phases[data.learning_path.currentPhase]?.name || '—';

  /* 模拟火花线数据（真实数据到位后替换） */
  const weekActivity = [2, 3, 1, 4, 3, 2, 5];
  const weekHours = [1.5, 2, 1, 3, 2.5, 1.5, 3.5];

  /* 计算今日任务完成度 */
  const doneTasks = data.today_tasks.filter(t => t.status === 'done' || t.status === 'exam_done').length;
  const totalTasks = data.today_tasks.length;
  const taskPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  /* 星期标签 */
  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

  return (
    <div>
      {/* SSE 匹配度 Toast + 庆祝动画 */}
      {matchToast}
      {CelebrationOverlay}

      {/* 计划欢迎弹窗 — 首次进入时显示 */}
      {showPlanModal && <PlanWelcomeModal onDone={() => setShowPlanModal(false)} />}

      {/* 连续学习天数 */}
      {data.stats.active_days > 0 && <StreakBanner days={data.stats.active_days} />}

      {/* ═══════════════════════════════════════
          GREETING — 有温度的欢迎区
         ═══════════════════════════════════════ */}
      <div className="dash-greeting">
        <div className="dash-greeting-main">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <h2 style={{ font: '800 32px/1.2 var(--serif)', margin: 0 }}>
              {getGreeting(data.student?.name)}
            </h2>
            <DoodleCircle size={28} style={{ marginTop: -4 }} />
          </div>
          <p style={{ font: '16px/1.5 var(--hand)', color: 'var(--pencil)', marginTop: 6, maxWidth: '50ch' }}>
            {getEncouragement()}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10, alignItems: 'center' }}>
            {data.student?.school && (
              <span className="hd-pill">{data.student.school}</span>
            )}
            {data.student?.major && (
              <span className="hd-pill">{data.student.major}</span>
            )}
            {data.student?.grade && (
              <span className="hd-pill">{data.student.grade}</span>
            )}
            {data.target_job && (
              <span className="hd-pin" style={{ marginLeft: 4 }}>
                目标：{data.target_job.title}
              </span>
            )}
          </div>
        </div>

        {/* 右侧：迷你周活跃 + 计划切换 */}
        <div className="dash-greeting-side">
          {/* 周活跃小卡片 */}
          <div className="dash-week-card">
            <div style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)', letterSpacing: '0.12em', marginBottom: 8 }}>本周活跃</div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 28 }}>
              {weekActivity.map((v, i) => (
                <div
                  key={i}
                  style={{
                    width: 10,
                    height: `${(v / 5) * 100}%`,
                    minHeight: 4,
                    background: i === 6 ? 'var(--accent)' : 'var(--pencil)',
                    borderRadius: 2,
                    opacity: i === 6 ? 1 : 0.3,
                    transition: 'height 0.3s',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {weekDays.map((d, i) => (
                <span key={i} style={{ width: 10, textAlign: 'center', font: '9px/1 var(--mono)', color: 'var(--pencil)' }}>{d}</span>
              ))}
            </div>
          </div>

          {/* 计划切换 + 新建计划 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {data.plans && data.plans.length > 1 && (
              <>
                <IconBook size={16} />
                <select
                  className="hd-select"
                  style={{ width: 220, padding: '8px 12px', fontSize: 13 }}
                  value={selectedPlanId ?? data.learning_path?.id ?? ''}
                  onChange={e => setSelectedPlanId(Number(e.target.value))}
                >
                  {data.plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.planName} {p.planType === 'main' ? '（主线）' : '（支线）'}
                    </option>
                  ))}
                </select>
              </>
            )}
            <button
              className="hd-btn small"
              style={{ fontSize: 12, padding: '6px 12px' }}
              onClick={() => navigate('/plan/create')}
            >
              + 新建计划
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          KPI — 有手绘感的数据卡
         ═══════════════════════════════════════ */}
      <div className="hd-kpis" style={{ marginTop: 20 }}>
        {/* 已掌握技能 */}
        <div className="dash-kpi dash-kpi-tilt-1">
          <div className="dash-kpi-icon"><IconBook size={18} /></div>
          <div className="hd-kpi-label">已掌握技能</div>
          <div className="hd-kpi-value">
            {data.stats.done_skills}
            <span style={{ font: '15px/1 var(--hand)', color: 'var(--pencil)' }}>/{data.stats.total_skills}</span>
          </div>
          <div className="dash-kpi-spark">
            <MiniSparkline values={[3, 5, 4, 7, 6, 8, data.stats.done_skills]} color="var(--accent)" />
          </div>
          <div className="hd-kpi-small">完成率 {donePct}%</div>
        </div>

        {/* 累计学习 */}
        <div className="dash-kpi dash-kpi-tilt-2">
          <div className="dash-kpi-icon"><FireDoodle /></div>
          <div className="hd-kpi-label">累计学习</div>
          <div className="hd-kpi-value blue">
            {data.stats.total_learned_hours}
            <span style={{ font: '15px/1 var(--hand)', color: 'var(--pencil)' }}>h</span>
          </div>
          <div className="dash-kpi-spark">
            <MiniSparkline values={weekHours} color="var(--data-blue)" />
          </div>
          <div className="hd-kpi-small">活跃 {data.stats.active_days} 天</div>
        </div>

        {/* 考试次数 */}
        <div className="dash-kpi dash-kpi-tilt-3">
          <div className="dash-kpi-icon"><IconGradCap size={18} /></div>
          <div className="hd-kpi-label">考试次数</div>
          <div className="hd-kpi-value ink">{data.stats.exam_count}</div>
          <div className="dash-kpi-spark">
            <MiniSparkline values={[0, 1, 0, 2, 1, 0, data.stats.exam_count]} color="var(--ink)" />
          </div>
          <div className="hd-kpi-small">已完成考试</div>
        </div>

        {/* 匹配岗位 */}
        <div className="dash-kpi dash-kpi-tilt-4">
          <div className="dash-kpi-icon"><IconBriefcase size={18} /></div>
          <div className="hd-kpi-label">匹配岗位</div>
          <div className="hd-kpi-value">{data.stats.job_count}</div>
          <div className="dash-kpi-spark">
            <MiniSparkline values={[2, 3, 3, 4, 5, 4, data.stats.job_count]} color="var(--accent)" />
          </div>
          <div className="hd-kpi-small">推荐职位</div>
        </div>

        {/* 最佳匹配度 — 仅在有目标岗位时显示 */}
        {bestMatch && (
          <div className="dash-kpi" style={{ cursor: 'pointer' }} onClick={() => navigate(`/user/jobs/${bestMatch.jobId}`)}>
            <div className="dash-kpi-icon"><IconTarget size={18} /></div>
            <div className="hd-kpi-label">最佳匹配</div>
            <div className="hd-kpi-value" style={{ color: bestMatch.matchScore >= 60 ? '#3a7d3a' : 'var(--accent)' }}>
              {bestMatch.matchScore}<span style={{ font: '15px/1 var(--hand)', color: 'var(--pencil)' }}>%</span>
            </div>
            <div className="hd-kpi-small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
              {bestMatch.jobTitle}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════
          MAIN: 左右两列
         ═══════════════════════════════════════ */}
      <div className="dash-main-grid" style={{ marginTop: 20 }}>

        {/* ── 左列：学习路径 ── */}
        <div className="hd-card-accent" style={{ position: 'relative', overflow: 'visible' }}>
          {/* 便签装饰 */}
          <div className="hd-note yellow" style={{ position: 'absolute', top: -16, right: 16, maxWidth: 160, zIndex: 2 }}>
            <div className="hd-note-tape" />
            <b>继续加油！</b>
            <br />当前阶段进行中
          </div>

          <div className="hd-section-label" style={{ marginBottom: 16 }}>
            <IconBook size={18} />
            <h3>{data.learning_path?.planName || '学习路径'}</h3>
            <DoodleUnderline width={80} />
          </div>

          {data.learning_path ? (
            <>
              {/* 整体进度 + 当前阶段 */}
              <div style={{ display: 'flex', gap: 20, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <HandProgress pct={donePct} size={72} />
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ font: '18px/1.3 var(--hand-bold)', color: 'var(--ink)', marginBottom: 4 }}>
                    当前阶段：<span style={{ color: 'var(--accent)' }}>{currentPhaseName}</span>
                  </div>
                  <div style={{ font: '14px/1.5 var(--hand)', color: 'var(--pencil)' }}>
                    预计 {data.learning_path.estimatedDate} 达成目标
                    {data.learning_path.dailyHours > 0 && ` · 每日 ${data.learning_path.dailyHours}h`}
                  </div>
                  <DoodleArrow style={{ marginTop: 4 }} />
                </div>
              </div>

              {/* 阶段列表 — 带连接线 */}
              <div className="dash-phase-list">
                {data.learning_path.pathData.phases.map((phase, i) => {
                  const done = phase.skills.filter(s => s.status === 'done').length;
                  const total = phase.skills.length;
                  const isCurrent = i === data.learning_path!.currentPhase;
                  const isDone = done === total;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  const isPast = i < data.learning_path!.currentPhase;

                  return (
                    <div key={i} className={`dash-phase-item ${isCurrent ? 'current' : ''} ${isDone ? 'done' : ''}`}>
                      {/* 连接线 */}
                      {i < data.learning_path!.pathData.phases.length - 1 && (
                        <div className={`dash-phase-line ${isPast || isDone ? 'filled' : ''}`} />
                      )}

                      {/* 节点 */}
                      <div className={`dash-phase-dot ${isDone ? 'done' : isCurrent ? 'current' : ''}`}>
                        {isDone ? (
                          <IconCheck size={14} />
                        ) : isCurrent ? (
                          <IconClock size={14} />
                        ) : (
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--rule)', display: 'block' }} />
                        )}
                      </div>

                      {/* 内容 */}
                      <div style={{ flex: 1 }}>
                        <div style={{
                          font: isCurrent ? '700 16px/1.3 var(--hand-bold)' : '15px/1.3 var(--hand)',
                          color: isCurrent ? 'var(--accent)' : isDone ? 'var(--pencil)' : 'var(--ink)',
                        }}>
                          {phase.name}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                          <div className="hd-progress" style={{ width: 64, height: 8 }}>
                            <div
                              className={`hd-progress-bar ${isDone ? 'green' : 'blue'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)' }}>
                            {done}/{total}
                          </span>
                        </div>
                      </div>

                      {/* 当前标记 */}
                      {isCurrent && (
                        <span className="dash-phase-badge">当前</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 查看全部 */}
              <div style={{ textAlign: 'right', marginTop: 16 }}>
                <button
                  className="hd-link"
                  style={{ font: '14px/1 var(--hand)', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => navigate('/user/learning')}
                >
                  查看全部路径 <IconArrowRight size={14} />
                </button>
              </div>
            </>
          ) : (
            <div className="hd-empty" style={{ padding: '32px 16px' }}>
              <p style={{ marginBottom: 12 }}>还没有学习计划</p>
              <button className="hd-btn small" onClick={() => navigate('/plan/create')}>
                创建计划
              </button>
            </div>
          )}
        </div>

        {/* ── 右列：今日任务 + 快速入口 + 资讯 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 今日任务 */}
          <div className="hd-card" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div className="hd-section-label" style={{ marginBottom: 0 }}>
                <IconCheck size={16} />
                <h3 style={{ fontSize: 18 }}>今日任务</h3>
                <span style={{
                  font: '12px/1 var(--mono)', color: 'var(--pencil)',
                  padding: '3px 8px', border: '1.5px solid var(--rule)',
                  borderRadius: 6, marginLeft: 4,
                }}>
                  {doneTasks}/{totalTasks}
                </span>
              </div>
              {data.student?.dailyHours > 0 && (
                <span className="hd-pill">{data.student.dailyHours}h/天</span>
              )}
            </div>

            {/* 今日进度条 */}
            {totalTasks > 0 && (
              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="hd-progress" style={{ flex: 1, height: 8 }}>
                  <div
                    className="hd-progress-bar"
                    style={{ width: `${taskPct}%`, transition: 'width 0.5s ease' }}
                  />
                </div>
                <span style={{ font: '11px/1 var(--mono)', color: taskPct === 100 ? '#4a9d4a' : 'var(--pencil)' }}>
                  {taskPct === 100 ? '全部完成！' : `${taskPct}%`}
                </span>
              </div>
            )}

            {data.today_tasks.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.today_tasks.map(task => {
                  const isDone = task.status === 'done' || task.status === 'exam_done';
                  const isActive = task.status === 'in_progress';
                  const isHovered = hoveredTask === task.id;

                  return (
                    <div
                      key={task.id}
                      className={`dash-task ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}
                      onMouseEnter={() => setHoveredTask(task.id)}
                      onMouseLeave={() => setHoveredTask(null)}
                    >
                      {/* Checkbox */}
                      <div className={`dash-task-check ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                        {isDone ? (
                          <svg width="14" height="14" viewBox="0 0 14 14">
                            <path d="M3 7 L6 10 L11 4" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : isActive ? (
                          <svg width="14" height="14" viewBox="0 0 14 14">
                            <circle cx="7" cy="7" r="4" fill="var(--accent)" opacity="0.3">
                              <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.5s" repeatCount="indefinite" />
                            </circle>
                            <circle cx="7" cy="7" r="2" fill="var(--accent)" />
                          </svg>
                        ) : (
                          <span style={{ width: 12, height: 12, border: '1.5px solid var(--pencil)', borderRadius: 3, display: 'block' }} />
                        )}
                      </div>

                      {/* 标题 */}
                      <span style={{
                        font: '15px/1.3 var(--hand)',
                        color: isDone ? 'var(--pencil)' : 'var(--ink)',
                        textDecoration: isDone ? 'line-through' : 'none',
                        flex: 1,
                        transition: 'color 0.15s',
                      }}>
                        {task.title}
                      </span>

                      {/* 标签 */}
                      <span className={`hd-badge ${task.taskType === 'main' ? 'accent' : ''}`}>
                        {task.taskType === 'main' ? '主线' : '支线'}
                      </span>

                      {/* 时间 */}
                      <span style={{
                        font: '11px/1 var(--mono)', color: 'var(--pencil)',
                        flexShrink: 0, minWidth: 40, textAlign: 'right',
                      }}>
                        {task.estimatedMin}min
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="hd-empty" style={{ padding: '24px 12px' }}>
                <p>暂无任务，开始学习吧！</p>
              </div>
            )}

            {/* 全部完成时的鼓励便签 */}
            {totalTasks > 0 && taskPct === 100 && (
              <div className="hd-note green" style={{ marginTop: 14, maxWidth: '100%', position: 'relative' }}>
                <div className="hd-note-tape" />
                <b>今日任务全部完成！</b> 休息一下，明天继续。
              </div>
            )}
          </div>

          {/* 快速入口 */}
          <div className="dash-quick-grid">
            <button className="dash-quick-btn" onClick={() => navigate('/user/learning')}>
              <IconBook size={20} />
              <span>学习路径</span>
            </button>
            <button className="dash-quick-btn" onClick={() => navigate('/user/jobs')}>
              <IconBriefcase size={20} />
              <span>岗位匹配</span>
            </button>
            <button className="dash-quick-btn" onClick={() => navigate('/user/exams')}>
              <IconGradCap size={20} />
              <span>考试中心</span>
            </button>
            <button className="dash-quick-btn" onClick={() => navigate('/user/chat')}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 4h14a1 1 0 011 1v8a1 1 0 01-1 1H6l-3 3V5a1 1 0 011-1z" />
                <circle cx="7" cy="9" r="0.8" fill="currentColor" />
                <circle cx="10" cy="9" r="0.8" fill="currentColor" />
                <circle cx="13" cy="9" r="0.8" fill="currentColor" />
              </svg>
              <span>AI 助手</span>
            </button>
          </div>

          {/* 最新资讯 */}
          <div className="hd-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="hd-section-label" style={{ marginBottom: 0 }}>
                <IconNewspaper size={16} />
                <h3 style={{ fontSize: 18 }}>最新资讯</h3>
              </div>
              <button
                className="hd-link"
                style={{ font: '13px/1 var(--hand)', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => navigate('/user/news')}
              >
                更多 →
              </button>
            </div>

            {data.recent_news.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.recent_news.map(news => (
                  <div
                    key={news.id}
                    className="dash-news-item"
                    onClick={() => navigate(`/user/news/${news.id}`)}
                  >
                    <div style={{
                      font: '14px/1.3 var(--hand)', color: 'var(--ink)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {news.title}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 3, alignItems: 'center' }}>
                      <span className={`hd-tag ${news.type === 'tech' ? 'hot' : ''}`}>
                        {news.type === 'tech' ? '技术' : news.type === 'recruit' ? '招聘' : '行业'}
                      </span>
                      <span style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)' }}>
                        {news.source}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="hd-empty" style={{ padding: '24px 12px' }}>
                <p>暂无资讯</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          底部：学习小贴士（便签风格）
         ═══════════════════════════════════════ */}
      <div className="dash-tips-bar">
        <div className="hd-note pink" style={{ position: 'relative', maxWidth: '100%' }}>
          <div className="hd-note-tape" />
          <b>学习小贴士：</b>番茄工作法（25分钟专注 + 5分钟休息）可以有效提升学习效率。试试在学习路径中设定每日目标，坚持打卡！
        </div>
      </div>
    </div>
  );
}

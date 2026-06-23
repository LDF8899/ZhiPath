import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { createPlan, getMyPlans, getProfile } from '../api/user';
import { IconBook, IconRobot, IconEdit, IconChart, IconTarget, IconCode } from '../components/icons';
import './plan-create.css';
import '../styles/hand-draw.css';

/* ── 方向图标 SVG ── */
const s = 20;
const IconPalette = () => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" /><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" /><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" /><circle cx="6.5" cy="12" r="0.5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.7-.7 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7H16c3.3 0 6-2.7 6-6 0-5.5-4.5-9.8-10-9.8z" />
  </svg>
);
const IconGear = () => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 01-1.4 3.4 2 2 0 01-1.4-.6l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5v.2a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 01-3.4-1.4 2 2 0 01.6-1.4l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1h-.2a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 013.4-1.4l.1.1a1.7 1.7 0 001.8.3h.1a1.7 1.7 0 001-1.5v-.2a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 013.4 1.4 2 2 0 01-.6 1.4l-.1.1a1.7 1.7 0 00-.3 1.8v.1a1.7 1.7 0 001.5 1h.2a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </svg>
);
const IconLink = () => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7" />
  </svg>
);
const IconPhone = () => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);
const IconRocket = () => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8 1-2 1-3s-.3-2.2-1-3c-.8-.7-2-1-3-1s-2.2.3-3 1z" /><path d="M12 15l-3-3 5.1-5.1a2.1 2.1 0 013 3L12 15z" /><path d="M15 12l3 3c.6.6 1.4 1 2.2 1l1.8-.5" /><path d="M9.3 21.3L12 18.6" />
  </svg>
);
const IconSparkle = () => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
  </svg>
);
const IconLightning = () => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const DIRECTION_OPTIONS = [
  { value: 'frontend', label: '前端开发', Icon: IconPalette },
  { value: 'backend', label: '后端开发', Icon: IconGear },
  { value: 'fullstack', label: '全栈开发', Icon: IconLink },
  { value: 'mobile', label: '移动端开发', Icon: IconPhone },
  { value: 'ai', label: 'AI / 机器学习', Icon: IconRobot },
  { value: 'data', label: '数据分析', Icon: IconChart },
  { value: 'devops', label: 'DevOps', Icon: IconRocket },
  { value: 'design', label: 'UI/UX 设计', Icon: IconSparkle },
];

interface PlanSummary {
  id: number;
  planName: string;
  planType: string;
  currentPhase: number;
  dailyHours: number;
  estimatedDate: string;
  totalSkills: number;
  doneSkills: number;
  matchScore: number;
}

function usePcMessage() {
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    clearTimeout(timer.current);
    setMsg({ text, type });
    timer.current = setTimeout(() => setMsg(null), 2500);
  }, []);
  return { el: msg ? <div className={`pc-toast pc-toast-${msg.type}`}>{msg.text}</div> : null, show };
}

export default function PlanCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { el: msgEl, show: showMsg } = usePcMessage();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [direction, setDirection] = useState('frontend');
  const [dailyHours, setDailyHours] = useState(2);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [mode, setMode] = useState<'quick' | 'ai'>('quick');
  const [importFromExisting, setImportFromExisting] = useState(false);
  const [customDirection, setCustomDirection] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const isFromExisting = searchParams.get('from') === 'existing';
  const customInputRef = useRef<HTMLInputElement>(null);

  // 滑块
  const sliderRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const hoursToPercent = (h: number) => ((h - 0.5) / 5.5) * 100;
  const percentToHours = (p: number) => Math.round((0.5 + (p / 100) * 5.5) * 2) / 2;
  const handleSliderMove = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setDailyHours(percentToHours(pct));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => handleSliderMove(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, handleSliderMove]);

  // 加载数据
  useEffect(() => {
    const load = async () => {
      try {
        const [plansRes, profileRes] = await Promise.all([getMyPlans(), getProfile()]);
        setPlans(plansRes.data || []);
        const p = profileRes.data;
        if (p?.interests?.length) setDirection(p.interests[0]);
        if (p?.dailyHours) setDailyHours(p.dailyHours);
      } catch { /* ignore */ }
      setProfileLoaded(true);
    };
    load();
  }, []);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const payload: any = { direction, dailyHours };
      // 如果用户选择导入旧计划，传入最旧计划的 ID
      if (importFromExisting && plans.length > 0) {
        payload.importFromPlanId = plans[plans.length - 1].id;
      }
      const res = await createPlan(payload);
      showMsg(`计划已创建！共 ${res.data.totalSkills} 个技能点`);
      sessionStorage.setItem('hasSeenPlanHub', '1');
      setTimeout(() => navigate('/user/home'), 1000);
    } catch (err: any) {
      showMsg(err?.response?.data?.message || '创建失败', 'error');
    }
    setLoading(false);
  };

  const handleAICreate = () => {
    const dirLabel = showCustomInput && customDirection.trim()
      ? customDirection.trim()
      : DIRECTION_OPTIONS.find(o => o.value === direction)?.label || direction;
    navigate('/user/chat', {
      state: {
        prefill: `我想制定一个详细的学习计划。我的目标方向是${dirLabel}，每天可以学习${dailyHours}小时。请帮我深度分析我的技能水平，制定个性化学习路径。`,
      },
    });
  };

  const handleContinue = (planId: number) => {
    navigate('/user/home'); // TODO: 切换到指定计划
  };

  return (
    <div className="pc">
      {msgEl}

      <nav className="pc-nav">
        <Link className="pc-nav-brand" to="/">
          <span className="logo-mark">智</span>
          <span>智途</span>
        </Link>
      </nav>

      <div className="pc-page">
        {/* 已有计划列表 */}
        {plans.length > 0 && (
          <div className="pc-existing">
            <h3 className="pc-existing-title"><IconBook size={20} style={{ marginRight: 6, verticalAlign: -4 }} />你的学习计划</h3>
            <div className="pc-plan-list">
              {plans.map((p) => (
                <div key={p.id} className="pc-plan-card" onClick={() => handleContinue(p.id)}>
                  <div className="pc-plan-header">
                    <span className="pc-plan-name">{p.planName}</span>
                    <span className={`pc-plan-type pc-type-${p.planType}`}>
                      {p.planType === 'main' ? '主线' : '支线'}
                    </span>
                  </div>
                  <div className="pc-plan-stats">
                    <span>进度 {p.doneSkills}/{p.totalSkills}</span>
                    <span>匹配度 {p.matchScore}%</span>
                    <span>每日 {p.dailyHours}h</span>
                  </div>
                  <div className="pc-plan-bar">
                    <div className="pc-plan-bar-fill" style={{ width: `${p.totalSkills > 0 ? Math.round(p.doneSkills / p.totalSkills * 100) : 0}%` }} />
                  </div>
                  <div className="pc-plan-date">预计 {p.estimatedDate} 达成</div>
                </div>
              ))}
            </div>
            <div className="pc-divider">
              <span>或者创建新计划</span>
            </div>
          </div>
        )}

        {/* 创建新计划 */}
        <div className="pc-card">
          {/* 模式选择 tab */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid var(--rule)' }}>
            <button
              onClick={() => setMode('quick')}
              style={{
                flex: 1, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
                font: mode === 'quick' ? '700 15px/1 var(--hand-bold)' : '15px/1 var(--hand)',
                color: mode === 'quick' ? 'var(--accent)' : 'var(--pencil)',
                borderBottom: mode === 'quick' ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -2, transition: 'all 0.2s',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <IconLightning /> 快速开始
            </button>
            <button
              onClick={() => setMode('ai')}
              style={{
                flex: 1, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
                font: mode === 'ai' ? '700 15px/1 var(--hand-bold)' : '15px/1 var(--hand)',
                color: mode === 'ai' ? 'var(--accent)' : 'var(--pencil)',
                borderBottom: mode === 'ai' ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -2, transition: 'all 0.2s',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <IconRobot size={18} /> 详细计划（AI 对话）
            </button>
          </div>

          <div className="pc-card-header">
            <h2 className="pc-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {mode === 'quick' ? <><IconLightning /> 快速开始</> : <><IconRobot size={22} /> AI 深度规划</>}
            </h2>
            <p className="pc-card-desc">{mode === 'quick' ? '选择方向和时长，立即生成学习计划' : '与 AI 助教对话，深度分析你的技能水平，定制专属计划'}</p>
          </div>

          {/* 方向选择 */}
          <div className="pc-section">
            <label className="pc-label">学习方向</label>
            <div className="pc-direction-grid">
              {DIRECTION_OPTIONS.map((opt) => {
                const DirIcon = opt.Icon;
                return (
                  <button
                    key={opt.value}
                    className={`pc-direction-card ${direction === opt.value && !showCustomInput ? 'selected' : ''}`}
                    onClick={() => { setDirection(opt.value); setShowCustomInput(false); setCustomDirection(''); }}
                  >
                    <span className="pc-direction-icon"><DirIcon /></span>
                    <span className="pc-direction-text">{opt.label}</span>
                  </button>
                );
              })}
              {/* 自定义方向 */}
              {showCustomInput ? (
                <div className="pc-direction-card selected" style={{ gridColumn: 'span 2', padding: '8px 12px' }}>
                  <input
                    ref={customInputRef}
                    type="text"
                    value={customDirection}
                    onChange={e => {
                      setCustomDirection(e.target.value);
                      setDirection(e.target.value.trim() || 'custom');
                    }}
                    placeholder="输入方向，如：网络安全、游戏开发…"
                    autoFocus
                    style={{
                      width: '100%', border: 'none', outline: 'none', background: 'transparent',
                      font: '14px/1.3 var(--hand)', color: 'var(--ink)',
                    }}
                  />
                </div>
              ) : (
                <button
                  className="pc-direction-card"
                  onClick={() => {
                    setShowCustomInput(true);
                    setDirection('custom');
                    setTimeout(() => customInputRef.current?.focus(), 50);
                  }}
                  style={{ borderStyle: 'dashed' }}
                >
                  <span className="pc-direction-icon"><IconEdit size={20} /></span>
                  <span className="pc-direction-text">自定义方向</span>
                </button>
              )}
            </div>
          </div>

          {/* 时长选择 */}
          <div className="pc-section">
            <label className="pc-label">
              每日学习时长：<span className="pc-hours-value">{dailyHours} 小时</span>
            </label>
            <div
              className="pc-slider-track"
              ref={sliderRef}
              onMouseDown={(e) => { setDragging(true); handleSliderMove(e.clientX); }}
              onTouchMove={(e) => handleSliderMove(e.touches[0].clientX)}
            >
              <div className="pc-slider-fill" style={{ width: `${hoursToPercent(dailyHours)}%` }} />
              <div className="pc-slider-thumb" style={{ left: `${hoursToPercent(dailyHours)}%` }} />
            </div>
            <div className="pc-slider-marks">
              {[0.5, 1, 2, 3, 4, 5, 6].map((h) => <span key={h}>{h}h</span>)}
            </div>
          </div>

          {/* 导入旧计划开关 */}
          {isFromExisting && plans.length > 0 && (
            <div className="pc-section" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--paper)', borderRadius: 10, border: '1.5px solid var(--rule)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                <input
                  type="checkbox"
                  checked={importFromExisting}
                  onChange={e => setImportFromExisting(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
                />
                <span style={{ font: '14px/1.3 var(--hand)', color: 'var(--ink)' }}>
                  导入旧计划的技能进度
                </span>
              </label>
              <span style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)' }}>
                已有 {plans[plans.length - 1].doneSkills} 个技能
              </span>
            </div>
          )}

          {/* 创建按钮 */}
          <div className="pc-actions">
            {mode === 'quick' ? (
              <button
                className={`pc-btn pc-btn-create ${loading ? 'loading' : ''}`}
                onClick={handleCreate}
                disabled={loading || !profileLoaded}
              >
                {loading ? '生成中...' : '创建学习计划'}
              </button>
            ) : (
              <button
                className="pc-btn pc-btn-create"
                onClick={handleAICreate}
              >
                与 AI 助教对话制定计划
              </button>
            )}
          </div>
        </div>

        <div className="pc-footer">智途 ZhiPath — 智能职业规划平台</div>
      </div>
    </div>
  );
}

import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { submitOnboarding } from '../api/user';
import './onboarding.css';
import '../styles/hand-draw.css';

/* ──────────────────────────────────────────
   智途 ZhiPath — Onboarding Page
   Hand-drawn wireframe style, matches landing.css
   ────────────────────────────────────────── */

const STEPS = [
  { title: '基本信息', description: '告诉我们你的学校和专业，以便精准规划', badge: 'STEP 01 / 03' },
  { title: '技能评估', description: '选择你已掌握的技能，我们会据此调整学习路径', badge: 'STEP 02 / 03' },
  { title: '求职方向', description: '选择目标岗位方向，生成专属学习计划', badge: 'STEP 03 / 03' },
];

const SKILL_OPTIONS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'Go',
  'React', 'Vue', 'Angular', 'Node.js', 'HTML/CSS', 'SQL',
  'Git', 'Docker', 'Linux', 'Figma',
];

const SKILL_LEVELS = [
  { value: '了解', label: '了解', desc: '听说过，了解基本概念' },
  { value: '熟悉', label: '熟悉', desc: '用过，能独立完成基础任务' },
  { value: '熟练', label: '熟练', desc: '深入使用，有项目经验' },
];

/* SVG 图标组件 — 手绘线条风格 */
const IconFrontend = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
);

const IconBackend = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconFullstack = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const IconMobile = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const IconAI = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a4 4 0 0 0-4 4v2h-1a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V6a4 4 0 0 0-4-4z" />
    <circle cx="9" cy="14" r="1.5" fill="currentColor" />
    <circle cx="15" cy="14" r="1.5" fill="currentColor" />
  </svg>
);

const IconData = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const IconDevOps = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const IconDesign = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const DIRECTION_OPTIONS = [
  { value: 'frontend', label: '前端开发', icon: <IconFrontend /> },
  { value: 'backend', label: '后端开发', icon: <IconBackend /> },
  { value: 'fullstack', label: '全栈开发', icon: <IconFullstack /> },
  { value: 'mobile', label: '移动端开发', icon: <IconMobile /> },
  { value: 'ai', label: 'AI / 机器学习', icon: <IconAI /> },
  { value: 'data', label: '数据分析', icon: <IconData /> },
  { value: 'devops', label: 'DevOps', icon: <IconDevOps /> },
  { value: 'design', label: 'UI/UX 设计', icon: <IconDesign /> },
];

const HOURS_MARKS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];

function useObMessage() {
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    clearTimeout(timer.current);
    setMsg({ text, type });
    timer.current = setTimeout(() => setMsg(null), 2500);
  }, []);

  const el = msg ? (
    <div className={`ob-toast ob-toast-${msg.type}`}>{msg.text}</div>
  ) : null;

  return { el, show };
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { updateUser } = useAuthStore();
  const { el: msgEl, show: showMsg } = useObMessage();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    school: '',
    major: '',
    grade: '',
    skills: [] as { name: string; level: string }[],
    direction: '',
    dailyHours: 2,
  });
  const [loading, setLoading] = useState(false);

  // 滑块拖拽状态
  const sliderRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const updateForm = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleSkill = (skill: string) => {
    setForm((prev) => {
      const existing = prev.skills.find((s) => s.name === skill);
      if (existing) {
        return { ...prev, skills: prev.skills.filter((s) => s.name !== skill) };
      }
      return { ...prev, skills: [...prev.skills, { name: skill, level: '了解' }] };
    });
  };

  const setSkillLevel = (skill: string, level: string) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.map((s) => (s.name === skill ? { ...s, level } : s)),
    }));
  };

  const canNext = () => {
    if (step === 0) return form.name && form.major && form.grade;
    if (step === 1) return form.skills.length > 0;
    if (step === 2) return form.direction;
    return false;
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      await submitOnboarding({
        name: form.name,
        school: form.school,
        major: form.major,
        grade: form.grade,
        direction: form.direction,
        dailyHours: form.dailyHours,
        skills: form.skills,
      });
      updateUser({ onboardingCompleted: true, realName: form.name });
      showMsg('信息已保存！');
      setTimeout(() => navigate('/plan/create'), 800);
    } catch {
      // Mock 模式：即使 API 失败也标记完成
      updateUser({ onboardingCompleted: true, realName: form.name });
      showMsg('信息已保存！');
      setTimeout(() => navigate('/plan/create'), 800);
    }
    setLoading(false);
  };

  // ── 滑块交互 ──
  const hoursToPercent = (h: number) => ((h - 0.5) / 5.5) * 100;
  const percentToHours = (p: number) => {
    const raw = 0.5 + (p / 100) * 5.5;
    return Math.round(raw * 2) / 2; // 四舍五入到 0.5
  };

  const handleSliderMove = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    updateForm('dailyHours', percentToHours(pct));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => handleSliderMove(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, handleSliderMove]);

  // 触摸支持
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    handleSliderMove(e.touches[0].clientX);
  }, [handleSliderMove]);

  return (
    <div className="ob">
      {msgEl}

      {/* 导航栏 */}
      <nav className="ob-nav">
        <Link className="ob-nav-brand" to="/">
          <span className="logo-mark">智</span>
          <span>智途</span>
        </Link>
        <Link className="ob-nav-back" to="/">
          ← 返回首页
        </Link>
      </nav>

      <div className="ob-page">
        {/* 进度条 */}
        <div className="ob-progress">
          <div className="ob-steps">
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <div className={`ob-step-dot ${i < step ? 'done' : i === step ? 'active' : ''}`}>
                  {i < step ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`ob-step-line ${i < step ? 'done' : ''}`} />
                )}
              </div>
            ))}
          </div>
          <div className="ob-step-label">
            <span className={step === 0 ? 'ob-active-label' : ''}>基本信息</span>
            <span> → </span>
            <span className={step === 1 ? 'ob-active-label' : ''}>技能评估</span>
            <span> → </span>
            <span className={step === 2 ? 'ob-active-label' : ''}>求职方向</span>
          </div>
        </div>

        {/* 主卡片 */}
        <div className="ob-card ob-fade-in" key={step}>
          {/* 便签注释 */}
          {step === 0 && (
            <div className="ob-note ob-note-yellow" style={{ top: -20, right: 30 }}>
              <div className="ob-tape" />
              <b>第一步</b><br />填写基本学籍信息
            </div>
          )}
          {step === 1 && (
            <div className="ob-note ob-note-pink" style={{ top: -20, right: 30 }}>
              <div className="ob-tape" />
              <b>多选</b><br />勾选你掌握的技能
            </div>
          )}
          {step === 2 && (
            <div className="ob-note ob-note-green" style={{ top: -20, right: 30 }}>
              <div className="ob-tape" />
              <b>最后一步</b><br />选择目标方向
            </div>
          )}

          {/* 卡片标题 */}
          <div className="ob-card-header">
            <div className="ob-card-badge">{STEPS[step].badge}</div>
            <h2 className="ob-card-title">{STEPS[step].title}</h2>
            <p className="ob-card-desc">{STEPS[step].description}</p>
          </div>

          {/* Step 0: 基本信息 */}
          {step === 0 && (
            <div className="ob-fade-in">
              <div className="ob-form-group">
                <label className="ob-form-label">
                  你的名字 <span className="ob-required">*</span>
                </label>
                <input
                  className="ob-form-input"
                  placeholder="例如：张三"
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                />
              </div>
              <div className="ob-form-row">
                <div className="ob-form-group">
                  <label className="ob-form-label">学校</label>
                  <input
                    className="ob-form-input"
                    placeholder="例如：北京大学"
                    value={form.school}
                    onChange={(e) => updateForm('school', e.target.value)}
                  />
                </div>
                <div className="ob-form-group">
                  <label className="ob-form-label">
                    专业 <span className="ob-required">*</span>
                  </label>
                  <input
                    className="ob-form-input"
                    placeholder="例如：软件工程"
                    value={form.major}
                    onChange={(e) => updateForm('major', e.target.value)}
                  />
                </div>
              </div>
              <div className="ob-form-group">
                <label className="ob-form-label">
                  年级 <span className="ob-required">*</span>
                </label>
                <select
                  className="ob-form-select"
                  value={form.grade}
                  onChange={(e) => updateForm('grade', e.target.value)}
                >
                  <option value="">选择年级</option>
                  {['大一', '大二', '大三', '大四', '研一', '研二', '研三'].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 1: 技能评估 */}
          {step === 1 && (
            <div className="ob-fade-in">
              <div className="ob-form-group">
                <label className="ob-form-label">选择你掌握的技能（可多选）</label>
                <div className="ob-skills-grid">
                  {SKILL_OPTIONS.map((skill) => {
                    const selected = form.skills.find((s) => s.name === skill);
                    return (
                      <button
                        key={skill}
                        className={`ob-skill-chip ${selected ? 'selected' : ''}`}
                        onClick={() => toggleSkill(skill)}
                      >
                        <span className="ob-check">
                          {selected ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : null}
                        </span>
                        {skill}
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.skills.length > 0 && (
                <div className="ob-skill-levels">
                  <div className="ob-skill-levels-title">
                    已选择 {form.skills.length} 项技能 — 为每项选择掌握程度
                  </div>
                  {form.skills.map((sk) => (
                    <div className="ob-skill-level-row" key={sk.name}>
                      <span className="ob-skill-level-name">{sk.name}</span>
                      <div className="ob-skill-level-btns">
                        {SKILL_LEVELS.map((lv) => (
                          <button
                            key={lv.value}
                            className={`ob-level-btn ${sk.level === lv.value ? 'active' : ''}`}
                            onClick={() => setSkillLevel(sk.name, lv.value)}
                            title={lv.desc}
                          >
                            {lv.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: 求职方向 */}
          {step === 2 && (
            <div className="ob-fade-in">
              <div className="ob-form-group">
                <label className="ob-form-label">你期望的求职方向</label>
                <div className="ob-direction-grid">
                  {DIRECTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`ob-direction-card ${form.direction === opt.value ? 'selected' : ''}`}
                      onClick={() => updateForm('direction', opt.value)}
                    >
                      <div className="ob-direction-icon">{opt.icon}</div>
                      <div className="ob-direction-text">{opt.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="ob-slider-group">
                <div className="ob-slider-label">
                  每日学习时长：<span className="ob-slider-value">{form.dailyHours} 小时</span>
                </div>
                <div
                  className="ob-slider-track"
                  ref={sliderRef}
                  onMouseDown={(e) => {
                    setDragging(true);
                    handleSliderMove(e.clientX);
                  }}
                  onTouchMove={handleTouchMove}
                >
                  <div
                    className="ob-slider-fill"
                    style={{ width: `${hoursToPercent(form.dailyHours)}%` }}
                  />
                  <div
                    className="ob-slider-thumb"
                    style={{ left: `${hoursToPercent(form.dailyHours)}%` }}
                  />
                </div>
                <div className="ob-slider-marks">
                  <span className="ob-slider-mark">0.5h</span>
                  <span className="ob-slider-mark">1h</span>
                  <span className="ob-slider-mark">2h</span>
                  <span className="ob-slider-mark">3h</span>
                  <span className="ob-slider-mark">4h</span>
                  <span className="ob-slider-mark">5h</span>
                  <span className="ob-slider-mark">6h</span>
                </div>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="ob-actions">
            <button
              className="ob-btn ob-btn-back"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
            >
              ← 上一步
            </button>
            {step < STEPS.length - 1 ? (
              <button
                className="ob-btn ob-btn-next"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext()}
              >
                下一步 →
              </button>
            ) : (
              <button
                className={`ob-btn ob-btn-submit ${loading ? 'loading' : ''}`}
                onClick={handleFinish}
                disabled={!canNext() || loading}
              >
                {loading ? '保存中...' : '保存并继续'}
              </button>
            )}
          </div>
        </div>

        {/* 页脚 */}
        <div className="ob-footer">
          智途 ZhiPath — 智能职业规划平台
        </div>
      </div>
    </div>
  );
}

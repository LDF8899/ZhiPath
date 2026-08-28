import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getLearningDomains, submitOnboarding } from '../api/user';
import { IconBook, IconCheck, IconClock, IconTarget } from '../components/icons';
import { useAuthStore } from '../stores/auth';
import type { LearningDomain, LearningGoalType, StarterLearningPath } from '../types';
import './onboarding.css';
import '../styles/hand-draw.css';

const STEPS = [
  { title: '个人背景', description: '了解你的学习环境与专业背景', badge: 'STEP 01 / 03' },
  { title: '学习目标', description: '选择现在最想推进的领域与目标', badge: 'STEP 02 / 03' },
  { title: '当前基础', description: '标记已经具备的能力，也可以从零开始', badge: 'STEP 03 / 03' },
];

const GOAL_LABELS: Record<LearningGoalType, string> = {
  career: '职业发展',
  course: '课程学习',
  exam: '考试备考',
  certificate: '证书认证',
  project: '项目实践',
  interest: '兴趣探索',
};

const SKILL_LEVELS = [
  { value: '了解', label: '接触过', desc: '理解基本概念，需要提示才能完成' },
  { value: '熟悉', label: '能完成', desc: '可以独立完成典型任务' },
  { value: '熟练', label: '熟练运用', desc: '可以迁移应用并解释方法' },
];

function useObMessage() {
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    clearTimeout(timer.current);
    setMsg({ text, type });
    timer.current = setTimeout(() => setMsg(null), 2500);
  }, []);
  return { el: msg ? <div className={`ob-toast ob-toast-${msg.type}`}>{msg.text}</div> : null, show };
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { updateUser } = useAuthStore();
  const { el: msgEl, show: showMsg } = useObMessage();
  const [step, setStep] = useState(0);
  const [domains, setDomains] = useState<LearningDomain[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    school: '',
    major: '',
    grade: '',
    domainId: '',
    goalType: '' as LearningGoalType | '',
    starterPathId: '',
    goalTitle: '',
    skills: [] as { name: string; level: string }[],
    dailyHours: 2,
  });

  const sliderRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    getLearningDomains()
      .then((response) => {
        const loaded = response.data || [];
        setDomains(loaded);
        const initialDomain = loaded.find((domain) => domain.id === 'english') || loaded[0];
        const initialPath = initialDomain?.starterPaths[0];
        if (initialDomain && initialPath) {
          setForm((current) => ({
            ...current,
            domainId: initialDomain.id,
            goalType: initialPath.goalType,
            starterPathId: initialPath.id,
            goalTitle: initialPath.title,
          }));
        }
      })
      .catch(() => showMsg('学习领域加载失败，请刷新后重试', 'error'))
      .finally(() => setDomainsLoading(false));
  }, [showMsg]);

  const selectedDomain = useMemo(
    () => domains.find((domain) => domain.id === form.domainId),
    [domains, form.domainId],
  );
  const selectedPath = useMemo(
    () => selectedDomain?.starterPaths.find((path) => path.id === form.starterPathId),
    [selectedDomain, form.starterPathId],
  );
  const suggestedAbilities = useMemo(
    () => (selectedPath?.phases || []).flatMap((phase) => phase.abilities).slice(0, 12),
    [selectedPath],
  );

  const updateForm = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const selectDomain = (domain: LearningDomain) => {
    const firstPath = domain.starterPaths[0];
    setForm((current) => ({
      ...current,
      domainId: domain.id,
      goalType: firstPath?.goalType || '',
      starterPathId: firstPath?.id || '',
      goalTitle: firstPath?.title || '',
      skills: [],
    }));
  };

  const selectPath = (path: StarterLearningPath) => {
    setForm((current) => ({
      ...current,
      goalType: path.goalType,
      starterPathId: path.id,
      goalTitle: path.title,
      skills: [],
    }));
  };

  const toggleSkill = (skill: string) => {
    setForm((current) => {
      const selected = current.skills.some((item) => item.name === skill);
      return {
        ...current,
        skills: selected
          ? current.skills.filter((item) => item.name !== skill)
          : [...current.skills, { name: skill, level: '了解' }],
      };
    });
  };

  const setSkillLevel = (skill: string, level: string) => {
    setForm((current) => ({
      ...current,
      skills: current.skills.map((item) => item.name === skill ? { ...item, level } : item),
    }));
  };

  const canNext = () => {
    if (step === 0) return Boolean(form.name.trim() && form.major.trim() && form.grade);
    if (step === 1) return Boolean(form.domainId && form.goalType && form.starterPathId);
    return true;
  };

  const handleFinish = async () => {
    if (!form.goalType) return;
    setLoading(true);
    try {
      await submitOnboarding({
        name: form.name.trim(),
        school: form.school.trim(),
        major: form.major.trim(),
        grade: form.grade,
        direction: form.domainId,
        domainId: form.domainId,
        goalType: form.goalType,
        starterPathId: form.starterPathId,
        goalTitle: form.goalTitle.trim() || selectedPath?.title || '',
        dailyHours: form.dailyHours,
        skills: form.skills,
      });
      updateUser({ onboardingCompleted: true, realName: form.name.trim() });
      showMsg('学习起点已保存');
      const params = new URLSearchParams({
        domainId: form.domainId,
        goalType: form.goalType,
        starterPathId: form.starterPathId,
      });
      setTimeout(() => navigate(`/plan/create?${params.toString()}`), 600);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      showMsg(err.response?.data?.message || '保存失败，请稍后重试', 'error');
    } finally {
      setLoading(false);
    }
  };

  const hoursToPercent = (hours: number) => ((hours - 0.5) / 5.5) * 100;
  const handleSliderMove = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const hours = Math.round((0.5 + (percent / 100) * 5.5) * 2) / 2;
    setForm((current) => ({ ...current, dailyHours: hours }));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: MouseEvent) => handleSliderMove(event.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, handleSliderMove]);

  return (
    <div className="ob">
      {msgEl}
      <nav className="ob-nav">
        <Link className="ob-nav-brand" to="/"><span className="logo-mark">智</span><span>智途</span></Link>
        <Link className="ob-nav-back" to="/">← 返回首页</Link>
      </nav>

      <div className="ob-page">
        <div className="ob-progress">
          <div className="ob-steps">
            {STEPS.map((item, index) => (
              <div key={item.title} style={{ display: 'flex', alignItems: 'center' }}>
                <div className={`ob-step-dot ${index < step ? 'done' : index === step ? 'active' : ''}`}>
                  {index < step ? <IconCheck size={18} /> : index + 1}
                </div>
                {index < STEPS.length - 1 && <div className={`ob-step-line ${index < step ? 'done' : ''}`} />}
              </div>
            ))}
          </div>
          <div className="ob-step-label">
            {STEPS.map((item, index) => (
              <span key={item.title} className={step === index ? 'ob-active-label' : ''}>{index > 0 ? ' → ' : ''}{item.title}</span>
            ))}
          </div>
        </div>

        <div className="ob-card ob-fade-in" key={step}>
          <div className={`ob-note ${step === 0 ? 'ob-note-yellow' : step === 1 ? 'ob-note-green' : 'ob-note-pink'}`} style={{ top: -20, right: 30 }}>
            <div className="ob-tape" />
            <b>{step === 0 ? '先认识你' : step === 1 ? '选一个起点' : '零基础也可以'}</b><br />
            {step === 0 ? '背景帮助调整解释方式' : step === 1 ? '以后可以随时添加目标' : '只标记真正掌握的能力'}
          </div>

          <div className="ob-card-header">
            <div className="ob-card-badge">{STEPS[step].badge}</div>
            <h2 className="ob-card-title">{STEPS[step].title}</h2>
            <p className="ob-card-desc">{STEPS[step].description}</p>
          </div>

          {step === 0 && (
            <div className="ob-fade-in">
              <div className="ob-form-group">
                <label className="ob-form-label" htmlFor="ob-name">你的名字 <span className="ob-required">*</span></label>
                <input id="ob-name" className="ob-form-input" placeholder="例如：张三" value={form.name} onChange={(event) => updateForm('name', event.target.value)} />
              </div>
              <div className="ob-form-row">
                <div className="ob-form-group">
                  <label className="ob-form-label" htmlFor="ob-school">学校</label>
                  <input id="ob-school" className="ob-form-input" placeholder="例如：北京大学" value={form.school} onChange={(event) => updateForm('school', event.target.value)} />
                </div>
                <div className="ob-form-group">
                  <label className="ob-form-label" htmlFor="ob-major">所学专业 <span className="ob-required">*</span></label>
                  <input id="ob-major" className="ob-form-input" placeholder="例如：法学、英语、软件工程" value={form.major} onChange={(event) => updateForm('major', event.target.value)} />
                </div>
              </div>
              <div className="ob-form-group">
                <label className="ob-form-label" htmlFor="ob-grade">当前阶段 <span className="ob-required">*</span></label>
                <select id="ob-grade" className="ob-form-select" value={form.grade} onChange={(event) => updateForm('grade', event.target.value)}>
                  <option value="">选择当前阶段</option>
                  {['大一', '大二', '大三', '大四', '研一', '研二', '研三', '在职学习', '其他'].map((grade) => <option key={grade} value={grade}>{grade}</option>)}
                </select>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="ob-fade-in">
              <div className="ob-form-group">
                <label className="ob-form-label">专业领域</label>
                {domainsLoading ? <div className="ob-inline-status">正在整理可用领域...</div> : (
                  <div className="ob-direction-grid ob-domain-grid">
                    {domains.map((domain) => (
                      <button key={domain.id} className={`ob-direction-card ${form.domainId === domain.id ? 'selected' : ''}`} onClick={() => selectDomain(domain)}>
                        <div className="ob-direction-icon"><IconBook size={22} /></div>
                        <div className="ob-direction-text">{domain.name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedDomain && (
                <div className="ob-form-group">
                  <label className="ob-form-label">学习目标</label>
                  <div className="ob-goal-paths">
                    {selectedDomain.starterPaths.map((path) => (
                      <button key={path.id} className={form.starterPathId === path.id ? 'selected' : ''} onClick={() => selectPath(path)}>
                        <span><strong>{path.title}</strong><small>{path.description}</small></span>
                        <em>{GOAL_LABELS[path.goalType]}</em>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="ob-form-group">
                <label className="ob-form-label" htmlFor="ob-goal-title"><IconTarget size={15} /> 目标名称</label>
                <input id="ob-goal-title" className="ob-form-input" value={form.goalTitle} onChange={(event) => updateForm('goalTitle', event.target.value)} placeholder={selectedPath?.title || '我的学习目标'} />
              </div>

              <div className="ob-slider-group">
                <div className="ob-slider-label"><IconClock size={15} /> 每日学习时长：<span className="ob-slider-value">{form.dailyHours} 小时</span></div>
                <div className="ob-slider-track" ref={sliderRef} onMouseDown={(event) => { setDragging(true); handleSliderMove(event.clientX); }} onTouchMove={(event) => handleSliderMove(event.touches[0].clientX)}>
                  <div className="ob-slider-fill" style={{ width: `${hoursToPercent(form.dailyHours)}%` }} />
                  <div className="ob-slider-thumb" style={{ left: `${hoursToPercent(form.dailyHours)}%` }} />
                </div>
                <div className="ob-slider-marks"><span>0.5h</span><span>2h</span><span>4h</span><span>6h</span></div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="ob-fade-in">
              <div className="ob-baseline-heading">
                <span>{selectedDomain?.name || '当前领域'}</span>
                <strong>{selectedPath?.title || form.goalTitle}</strong>
              </div>
              <div className="ob-form-group">
                <label className="ob-form-label">选择你已经具备的能力</label>
                <div className="ob-skills-grid">
                  {suggestedAbilities.map((ability) => {
                    const selected = form.skills.some((item) => item.name === ability.name);
                    return (
                      <button key={ability.id} className={`ob-skill-chip ${selected ? 'selected' : ''}`} onClick={() => toggleSkill(ability.name)}>
                        <span className="ob-check">{selected ? <IconCheck size={12} /> : null}</span>{ability.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.skills.length === 0 ? (
                <div className="ob-zero-state">还没有相关基础也没关系，计划会从第一个阶段开始。</div>
              ) : (
                <div className="ob-skill-levels">
                  <div className="ob-skill-levels-title">已选择 {form.skills.length} 项能力</div>
                  {form.skills.map((skill) => (
                    <div className="ob-skill-level-row" key={skill.name}>
                      <span className="ob-skill-level-name">{skill.name}</span>
                      <div className="ob-skill-level-btns">
                        {SKILL_LEVELS.map((level) => (
                          <button key={level.value} className={`ob-level-btn ${skill.level === level.value ? 'active' : ''}`} onClick={() => setSkillLevel(skill.name, level.value)} title={level.desc}>{level.label}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="ob-actions">
            <button className="ob-btn ob-btn-back" onClick={() => setStep((current) => current - 1)} disabled={step === 0}>← 上一步</button>
            {step < STEPS.length - 1 ? (
              <button className="ob-btn ob-btn-next" onClick={() => setStep((current) => current + 1)} disabled={!canNext()}>下一步 →</button>
            ) : (
              <button className={`ob-btn ob-btn-submit ${loading ? 'loading' : ''}`} onClick={handleFinish} disabled={loading}>{loading ? '保存中...' : '保存并规划路线'}</button>
            )}
          </div>
        </div>

        <div className="ob-footer">智途 ZhiPath — AI 个性化学习与能力成长平台</div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { createPlan, getJobs, getLearningDomains, getMyPlans, getProfile } from '../api/user';
import type { Job, LearningDomain, LearningGoalType } from '../types';
import { IconBook, IconBriefcase, IconCheck, IconClock, IconRobot, IconTarget } from '../components/icons';
import './plan-create.css';
import '../styles/hand-draw.css';

type Journey = 'domain' | 'career' | 'custom';

interface PlanSummary {
  id: number;
  planName: string;
  planType: 'main' | 'side';
  planStatus?: 'active' | 'paused' | 'archived';
  goalType?: LearningGoalType;
  dailyHours: number;
  estimatedDate: string;
  totalSkills: number;
  doneSkills: number;
  matchScore: number;
}

const GOAL_LABELS: Record<LearningGoalType, string> = {
  career: '职业发展',
  course: '课程学习',
  exam: '考试备考',
  certificate: '证书认证',
  project: '项目实践',
  interest: '兴趣探索',
};

function usePcMessage() {
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    clearTimeout(timer.current);
    setMessage({ text, type });
    timer.current = setTimeout(() => setMessage(null), 3000);
  }, []);
  return { element: message ? <div className={`pc-toast pc-toast-${message.type}`}>{message.text}</div> : null, show };
}

export default function PlanCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const suggested = (location.state || {}) as {
    suggestedPlanName?: string;
    suggestedTopics?: string;
    sourceJobTitle?: string;
    sourceTrustLabel?: string;
  };
  const { element: messageElement, show: showMessage } = usePcMessage();
  const initialJobId = Number(searchParams.get('targetJobId')) || 0;
  const requestedDomainId = searchParams.get('domainId') || '';
  const requestedStarterPathId = searchParams.get('starterPathId') || '';
  const [journey, setJourney] = useState<Journey>(initialJobId ? 'career' : 'domain');
  const [planType, setPlanType] = useState<'main' | 'side'>(searchParams.get('type') === 'side' ? 'side' : 'main');
  const [mode, setMode] = useState<'quick' | 'ai'>('quick');
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [domains, setDomains] = useState<LearningDomain[]>([]);
  const [targetJobId, setTargetJobId] = useState(initialJobId);
  const [domainId, setDomainId] = useState(requestedDomainId || 'english');
  const [goalType, setGoalType] = useState<LearningGoalType>('exam');
  const [starterPathId, setStarterPathId] = useState(requestedStarterPathId || 'cet-6');
  const [planName, setPlanName] = useState(suggested.suggestedPlanName || '');
  const [topics, setTopics] = useState(suggested.suggestedTopics || '');
  const [dailyHours, setDailyHours] = useState(2);
  const [importFromExisting, setImportFromExisting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.allSettled([getMyPlans(), getJobs({ pageSize: 60 }), getProfile(), getLearningDomains()])
      .then(([plansResult, jobsResult, profileResult, domainsResult]) => {
        if (plansResult.status === 'fulfilled') setPlans((plansResult.value.data || []) as PlanSummary[]);
        if (jobsResult.status === 'fulfilled') {
          const loadedJobs = jobsResult.value.data || [];
          setJobs(loadedJobs);
          if (!initialJobId && loadedJobs.length) setTargetJobId(loadedJobs[0].id);
        }
        if (profileResult.status === 'fulfilled') {
          const profile = profileResult.value.data;
          const preferredJob = initialJobId || Number(profile?.targetJobId) || 0;
          if (preferredJob) setTargetJobId(preferredJob);
          if (profile?.dailyHours) setDailyHours(Number(profile.dailyHours));
        }
        if (domainsResult.status === 'fulfilled') {
          const loadedDomains = domainsResult.value.data || [];
          setDomains(loadedDomains);
          const initialDomain = loadedDomains.find((domain) => domain.id === requestedDomainId)
            || loadedDomains.find((domain) => domain.id === 'english')
            || loadedDomains[0];
          const initialPath = initialDomain?.starterPaths.find((path) => path.id === requestedStarterPathId)
            || initialDomain?.starterPaths.find((path) => path.id === 'cet-6')
            || initialDomain?.starterPaths[0];
          if (initialDomain) setDomainId(initialDomain.id);
          if (initialPath) {
            setGoalType(initialPath.goalType);
            setStarterPathId(initialPath.id);
          }
        }
        if ([plansResult, jobsResult, profileResult, domainsResult].some((result) => result.status === 'rejected')) {
          showMessage('部分数据暂时不可用，仍可使用已加载的学习路线', 'error');
        }
      })
      .finally(() => setReady(true));
  }, [initialJobId, requestedDomainId, requestedStarterPathId, showMessage]);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === targetJobId), [jobs, targetJobId]);
  const selectedDomain = useMemo(() => domains.find((domain) => domain.id === domainId), [domains, domainId]);
  const availableGoalTypes = useMemo(() => Array.from(new Set(
    (selectedDomain?.starterPaths || []).map((path) => path.goalType),
  )), [selectedDomain]);
  const starterPaths = useMemo(() => (
    selectedDomain?.starterPaths.filter((path) => path.goalType === goalType) || []
  ), [selectedDomain, goalType]);
  const selectedStarterPath = useMemo(() => (
    starterPaths.find((path) => path.id === starterPathId) || starterPaths[0]
  ), [starterPaths, starterPathId]);
  const topicList = useMemo(() => Array.from(new Set(topics.split(/[,，、\n]/).map((topic) => topic.trim()).filter(Boolean))), [topics]);
  const canCreate = ready && !loading && (
    journey === 'career'
      ? targetJobId > 0
      : journey === 'domain'
        ? Boolean(selectedDomain && selectedStarterPath)
        : planName.trim().length > 0 && topicList.length > 0
  );

  const selectDomain = (nextDomainId: string) => {
    const domain = domains.find((item) => item.id === nextDomainId);
    const firstPath = domain?.starterPaths[0];
    setDomainId(nextDomainId);
    if (firstPath) {
      setGoalType(firstPath.goalType);
      setStarterPathId(firstPath.id);
    }
  };

  const selectGoalType = (nextGoalType: LearningGoalType) => {
    setGoalType(nextGoalType);
    const firstPath = selectedDomain?.starterPaths.find((path) => path.goalType === nextGoalType);
    if (firstPath) setStarterPathId(firstPath.id);
  };

  const handleCreate = async () => {
    if (!canCreate) return;
    setLoading(true);
    try {
      const response = await createPlan(journey === 'career' ? {
        planType: 'main',
        targetJobId,
        goalType: 'career',
        dailyHours,
        importFromPlanId: importFromExisting && plans.length ? plans[0].id : undefined,
      } : journey === 'domain' ? {
        planType,
        domainId: selectedDomain!.id,
        goalType,
        starterPathId: selectedStarterPath!.id,
        goalTitle: planName.trim() || selectedStarterPath!.title,
        dailyHours,
        importFromPlanId: importFromExisting && plans.length ? plans[0].id : undefined,
      } : {
        planType: 'side',
        planName: planName.trim(),
        skills: topicList,
        dailyHours,
        importFromPlanId: importFromExisting && plans.length ? plans[0].id : undefined,
      });
      showMessage(`学习计划已创建，共 ${response.data.totalSkills} 个能力项`);
      setTimeout(() => navigate(`/user/learning/${response.data.id}`), 700);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      showMessage(err?.response?.data?.message || '创建失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAICreate = () => {
    const goal = journey === 'career'
      ? `我的目标岗位是“${selectedJob?.title || '目标岗位'}”，请基于能力差距制定学习计划。`
      : journey === 'domain'
        ? `我想学习${selectedDomain?.name || '这个专业'}，目标是“${planName || selectedStarterPath?.title || GOAL_LABELS[goalType]}”。`
        : `我想创建学习计划“${planName || '新的学习目标'}”，主要学习：${topicList.join('、') || topics}。`;
    navigate('/user/chat', { state: { prefill: `${goal}每天可以投入${dailyHours}小时。` } });
  };

  return (
    <div className="pc">
      {messageElement}
      <nav className="pc-nav">
        <Link className="pc-nav-brand" to="/user/learning"><span className="logo-mark">智</span><span>智途</span></Link>
      </nav>

      <div className="pc-page">
        {plans.length > 0 && (
          <section className="pc-existing">
            <h3 className="pc-existing-title"><IconBook size={20} /> 当前学习组合</h3>
            <div className="pc-plan-list">
              {plans.slice(0, 4).map((plan) => (
                <button key={plan.id} className="pc-plan-card" onClick={() => navigate(`/user/learning/${plan.id}`)}>
                  <div className="pc-plan-header"><span className="pc-plan-name">{plan.planName}</span><span className={`pc-plan-type pc-type-${plan.planType}`}>{plan.goalType ? GOAL_LABELS[plan.goalType] : plan.planType === 'main' ? '核心目标' : '并行目标'}</span></div>
                  <div className="pc-plan-stats"><span>进度 {plan.doneSkills || 0}/{plan.totalSkills || 0}</span><span>每日 {plan.dailyHours || 0}h</span><span>{plan.planStatus === 'archived' ? '已归档' : '学习中'}</span></div>
                </button>
              ))}
            </div>
            <div className="pc-divider"><span>创建新计划</span></div>
          </section>
        )}

        <main className="pc-card">
          <div className="pc-card-header">
            <h1 className="pc-card-title">创建学习计划</h1>
            <p className="pc-card-desc">从专业、目标和可验证的能力出发</p>
          </div>

          <div className="pc-section">
            <label className="pc-label">学习目标</label>
            <div className="pc-path-switch pc-path-switch-three" role="tablist">
              <button className={journey === 'domain' ? 'selected' : ''} onClick={() => setJourney('domain')}>
                <IconBook size={19} /><span><strong>专业路线</strong><small>考试、课程与项目</small></span>{journey === 'domain' && <IconCheck size={15} />}
              </button>
              <button className={journey === 'career' ? 'selected' : ''} onClick={() => setJourney('career')}>
                <IconBriefcase size={19} /><span><strong>职业发展</strong><small>匹配目标岗位</small></span>{journey === 'career' && <IconCheck size={15} />}
              </button>
              <button className={journey === 'custom' ? 'selected' : ''} onClick={() => setJourney('custom')}>
                <IconTarget size={19} /><span><strong>自由探索</strong><small>自定义学习主题</small></span>{journey === 'custom' && <IconCheck size={15} />}
              </button>
            </div>
          </div>

          <div className="pc-mode-switch">
            <button className={mode === 'quick' ? 'active' : ''} onClick={() => setMode('quick')}><IconTarget size={16} />直接创建</button>
            <button className={mode === 'ai' ? 'active' : ''} onClick={() => setMode('ai')}><IconRobot size={17} />AI 对话规划</button>
          </div>

          {journey === 'career' && (
            <div className="pc-section">
              <label className="pc-label" htmlFor="target-job">目标岗位</label>
              <select id="target-job" className="hd-select pc-full-input" value={targetJobId} onChange={(event) => setTargetJobId(Number(event.target.value))}>
                <option value={0}>选择岗位</option>
                {jobs.map((job) => <option key={job.id} value={job.id}>{job.title} · {job.company}</option>)}
              </select>
              {selectedJob && <div className="pc-job-note"><IconBriefcase size={16} /><span><strong>{selectedJob.title}</strong><small>{selectedJob.company} · {selectedJob.location || '地点待确认'}</small></span></div>}
            </div>
          )}

          {journey === 'domain' && (
            <>
              <div className="pc-section">
                <label className="pc-label" htmlFor="learning-domain">专业领域</label>
                <select id="learning-domain" className="hd-select pc-full-input" value={domainId} onChange={(event) => selectDomain(event.target.value)}>
                  {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.name}</option>)}
                </select>
                {selectedDomain && <p className="pc-field-note">{selectedDomain.description}</p>}
              </div>
              <div className="pc-section">
                <label className="pc-label">目标类型</label>
                <div className="pc-goal-types">
                  {availableGoalTypes.map((type) => <button key={type} className={goalType === type ? 'selected' : ''} onClick={() => selectGoalType(type)}>{GOAL_LABELS[type]}</button>)}
                </div>
              </div>
              <div className="pc-section">
                <label className="pc-label">起步路线</label>
                <div className="pc-starter-list">
                  {starterPaths.map((path) => (
                    <button key={path.id} className={selectedStarterPath?.id === path.id ? 'selected' : ''} onClick={() => setStarterPathId(path.id)}>
                      <span><strong>{path.title}</strong><small>{path.description}</small></span>
                      <em>{path.phases.length} 阶段 · {path.phases.reduce((sum, phase) => sum + phase.abilities.length, 0)} 能力项</em>
                    </button>
                  ))}
                </div>
              </div>
              <div className="pc-section">
                <label className="pc-label" htmlFor="domain-goal-title">目标名称 <span>可选</span></label>
                <input id="domain-goal-title" className="hd-input pc-full-input" value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder={selectedStarterPath?.title || '我的学习目标'} />
              </div>
              <div className="pc-section">
                <label className="pc-label">排期优先级</label>
                <div className="pc-goal-types">
                  <button className={planType === 'main' ? 'selected' : ''} onClick={() => setPlanType('main')}>核心目标</button>
                  <button className={planType === 'side' ? 'selected' : ''} onClick={() => setPlanType('side')}>并行目标</button>
                </div>
              </div>
            </>
          )}

          {journey === 'custom' && (
            <>
              {suggested.sourceJobTitle && <div className="pc-job-note pc-source-note"><IconTarget size={16} /><span><strong>来自 {suggested.sourceTrustLabel || '岗位参考'}：{suggested.sourceJobTitle}</strong><small>作为独立学习目标保存</small></span></div>}
              <div className="pc-section">
                <label className="pc-label" htmlFor="plan-name">目标名称</label>
                <input id="plan-name" className="hd-input pc-full-input" value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="例如：城市摄影与后期" />
              </div>
              <div className="pc-section">
                <label className="pc-label" htmlFor="topics">学习主题</label>
                <textarea id="topics" className="hd-input pc-full-input pc-topics" value={topics} onChange={(event) => setTopics(event.target.value)} placeholder="构图、光线、色彩、后期" />
                {topicList.length > 0 && <div className="pc-topic-list">{topicList.map((topic) => <span key={topic}>{topic}</span>)}</div>}
              </div>
            </>
          )}

          <div className="pc-section">
            <label className="pc-label" htmlFor="daily-hours"><IconClock size={15} /> 每日投入 <span className="pc-hours-value">{dailyHours} 小时</span></label>
            <input id="daily-hours" className="pc-native-range" type="range" min="0.5" max="6" step="0.5" value={dailyHours} onChange={(event) => setDailyHours(Number(event.target.value))} />
            <div className="pc-slider-marks"><span>0.5h</span><span>2h</span><span>4h</span><span>6h</span></div>
          </div>

          {searchParams.get('from') === 'existing' && plans.length > 0 && (
            <label className="pc-import-row"><input type="checkbox" checked={importFromExisting} onChange={(event) => setImportFromExisting(event.target.checked)} /><span>沿用已有计划中已完成的学习记录</span></label>
          )}

          <div className="pc-actions">
            {mode === 'quick' ? (
              <button className={`pc-btn pc-btn-create${loading ? ' loading' : ''}`} onClick={handleCreate} disabled={!canCreate}>{loading ? '正在生成...' : '创建学习计划'}</button>
            ) : (
              <button className="pc-btn pc-btn-create" onClick={handleAICreate} disabled={!canCreate}>进入 AI 对话</button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

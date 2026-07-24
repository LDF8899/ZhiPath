import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { createPlan, getJobs, getMyPlans, getProfile } from '../api/user';
import type { Job } from '../types';
import { IconBook, IconBriefcase, IconCheck, IconClock, IconRobot, IconTarget } from '../components/icons';
import './plan-create.css';
import '../styles/hand-draw.css';

interface PlanSummary {
  id: number;
  planName: string;
  planType: 'main' | 'side';
  planStatus?: 'active' | 'paused' | 'archived';
  dailyHours: number;
  estimatedDate: string;
  totalSkills: number;
  doneSkills: number;
  matchScore: number;
}

function usePcMessage() {
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
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
  const [planType, setPlanType] = useState<'main' | 'side'>(searchParams.get('type') === 'side' ? 'side' : 'main');
  const [mode, setMode] = useState<'quick' | 'ai'>('quick');
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [targetJobId, setTargetJobId] = useState(Number(searchParams.get('targetJobId')) || 0);
  const [planName, setPlanName] = useState(suggested.suggestedPlanName || '');
  const [topics, setTopics] = useState(suggested.suggestedTopics || '');
  const [dailyHours, setDailyHours] = useState(2);
  const [importFromExisting, setImportFromExisting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([getMyPlans(), getJobs({ pageSize: 60 }), getProfile()])
      .then(([plansResponse, jobsResponse, profileResponse]) => {
        setPlans((plansResponse.data || []) as PlanSummary[]);
        setJobs(jobsResponse.data || []);
        const preferredJob = Number(searchParams.get('targetJobId')) || Number(profileResponse.data?.targetJobId) || 0;
        if (preferredJob) setTargetJobId(preferredJob);
        else if (jobsResponse.data?.length) setTargetJobId(jobsResponse.data[0].id);
        if (profileResponse.data?.dailyHours) setDailyHours(Number(profileResponse.data.dailyHours));
      })
      .catch(() => showMessage('部分基础数据加载失败，请刷新后重试', 'error'))
      .finally(() => setReady(true));
  }, [searchParams, showMessage]);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === targetJobId), [jobs, targetJobId]);
  const topicList = useMemo(() => Array.from(new Set(topics.split(/[,，、\n]/).map((topic) => topic.trim()).filter(Boolean))), [topics]);
  const canCreate = ready && !loading && (planType === 'main' ? targetJobId > 0 : planName.trim().length > 0 && topicList.length > 0);

  const handleCreate = async () => {
    if (!canCreate) return;
    setLoading(true);
    try {
      const response = await createPlan({
        planType,
        targetJobId: planType === 'main' ? targetJobId : undefined,
        planName: planType === 'side' ? planName.trim() : undefined,
        skills: planType === 'side' ? topicList : undefined,
        dailyHours,
        importFromPlanId: importFromExisting && plans.length ? plans[0].id : undefined,
      });
      showMessage(`${planType === 'main' ? '岗位主线' : '自选计划'}已创建，共 ${response.data.totalSkills} 个学习项`);
      setTimeout(() => navigate(`/user/learning/${response.data.id}`), 700);
    } catch (err: any) {
      showMessage(err?.response?.data?.message || '创建失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAICreate = () => {
    const goal = planType === 'main'
      ? `我想以“${selectedJob?.title || '目标岗位'}”为岗位主线，请基于岗位差距制定学习计划。`
      : `我想创建自选学习计划“${planName || '新的学习目标'}”，主要学习：${topicList.join('、') || topics}。`;
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
                  <div className="pc-plan-header"><span className="pc-plan-name">{plan.planName}</span><span className={`pc-plan-type pc-type-${plan.planType}`}>{plan.planType === 'main' ? '岗位主线' : '自选'}</span></div>
                  <div className="pc-plan-stats"><span>进度 {plan.doneSkills || 0}/{plan.totalSkills || 0}</span><span>每日 {plan.dailyHours || 0}h</span><span>{plan.planStatus === 'archived' ? '已归档' : '保留历史'}</span></div>
                </button>
              ))}
            </div>
            <div className="pc-divider"><span>创建新计划</span></div>
          </section>
        )}

        <main className="pc-card">
          <div className="pc-card-header">
            <h1 className="pc-card-title">创建学习计划</h1>
          </div>

          <div className="pc-section">
            <label className="pc-label">计划路径</label>
            <div className="pc-path-switch" role="tablist">
              <button className={planType === 'main' ? 'selected' : ''} onClick={() => setPlanType('main')}>
                <IconBriefcase size={19} /><span><strong>岗位主线</strong><small>绑定目标岗位</small></span>{planType === 'main' && <IconCheck size={15} />}
              </button>
              <button className={planType === 'side' ? 'selected' : ''} onClick={() => setPlanType('side')}>
                <IconBook size={19} /><span><strong>自选计划</strong><small>独立学习目标</small></span>{planType === 'side' && <IconCheck size={15} />}
              </button>
            </div>
          </div>

          <div className="pc-mode-switch">
            <button className={mode === 'quick' ? 'active' : ''} onClick={() => setMode('quick')}><IconTarget size={16} />直接创建</button>
            <button className={mode === 'ai' ? 'active' : ''} onClick={() => setMode('ai')}><IconRobot size={17} />AI 对话规划</button>
          </div>

          {planType === 'main' ? (
            <div className="pc-section">
              <label className="pc-label" htmlFor="target-job">目标岗位</label>
              <select id="target-job" className="hd-select pc-full-input" value={targetJobId} onChange={(event) => setTargetJobId(Number(event.target.value))}>
                <option value={0}>选择岗位</option>
                {jobs.map((job) => <option key={job.id} value={job.id}>{job.title} · {job.company}</option>)}
              </select>
              {selectedJob && <div className="pc-job-note"><IconBriefcase size={16} /><span><strong>{selectedJob.title}</strong><small>{selectedJob.company} · {selectedJob.location || '地点待确认'}</small></span></div>}
            </div>
          ) : (
            <>
              {suggested.sourceJobTitle && (
                <div className="pc-job-note" style={{ marginBottom: 14 }}>
                  <IconTarget size={16} />
                  <span>
                    <strong>来自 {suggested.sourceTrustLabel || '岗位参考'}：{suggested.sourceJobTitle}</strong>
                    <small>当前将它转为自选学习目标，不会直接进入投递流程。</small>
                  </span>
                </div>
              )}
              <div className="pc-section">
                <label className="pc-label" htmlFor="plan-name">计划名称</label>
                <input id="plan-name" className="hd-input pc-full-input" value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="例如：Python 数据分析" />
              </div>
              <div className="pc-section">
                <label className="pc-label" htmlFor="topics">学习主题</label>
                <textarea id="topics" className="hd-input pc-full-input pc-topics" value={topics} onChange={(event) => setTopics(event.target.value)} placeholder="Python、Pandas、数据可视化" />
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
              <button className={`pc-btn pc-btn-create${loading ? ' loading' : ''}`} onClick={handleCreate} disabled={!canCreate}>{loading ? '正在生成...' : `创建${planType === 'main' ? '岗位主线' : '自选计划'}`}</button>
            ) : (
              <button className="pc-btn pc-btn-create" onClick={handleAICreate} disabled={planType === 'side' && (!planName.trim() || topicList.length === 0)}>进入 AI 对话</button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

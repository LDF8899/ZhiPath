import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getJobDetail,
  calculateMatch,
  applyJob,
  importJobSkills,
  generateResume,
} from '../../api/user';
import {
  IconArrowLeft,
  IconBriefcase,
  IconBuilding,
  IconMapPin,
  IconWallet,
  IconStar,
  IconCheck,
  IconX,
  IconBook,
  IconDocument,
  IconSend,
  IconRefresh,
  IconTarget,
} from '../../components/icons';
import MatchBreakdown from '../../components/MatchBreakdown';
import type { Job } from '../../types';

/* ──────────────────────────────────────────
   Job Detail Page — hand-drawn design system
   岗位详情 + 匹配分析 + 技能差距 + 操作按钮
   ────────────────────────────────────────── */

/* Toast hook (hand-drawn pattern) */
function useHdMessage() {
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    clearTimeout(timer.current);
    setMsg({ text, type });
    timer.current = setTimeout(() => setMsg(null), 2500);
  }, []);
  return {
    el: msg ? <div className={`hd-message ${msg.type}`}>{msg.text}</div> : null,
    show,
  };
}

/** Match score color */
function scoreColor(score: number): string {
  if (score >= 80) return '#3a7d3a';
  if (score >= 60) return 'var(--data-blue)';
  return 'var(--accent)';
}

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { el: msgEl, show: showMsg } = useHdMessage();

  const [job, setJob] = useState<Job | null>(null);
  const [matchResult, setMatchResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [addingPlan, setAddingPlan] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const jobId = parseInt(id, 10);
      const [jobRes, matchRes] = await Promise.all([
        getJobDetail(jobId),
        calculateMatch(jobId).catch(() => null),
      ]);
      setJob(jobRes.data);
      if (matchRes?.data) {
        setMatchResult(matchRes.data);
      }
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  /* ── Action handlers ── */

  const handleApply = async () => {
    if (!id) return;
    setApplying(true);
    try {
      await applyJob(parseInt(id, 10));
      showMsg('简历已投递，等待审核');
    } catch (e: any) {
      showMsg(e?.message || '投递失败', 'error');
    } finally {
      setApplying(false);
    }
  };

  const handleAddToPlan = async () => {
    if (!missingSkills.length || !id) return;
    setAddingPlan(true);
    try {
      const res = await importJobSkills(parseInt(id, 10), 'side');
      if (res.code === 200 && res.data) {
        showMsg(res.data.message || `已添加 ${res.data.imported} 个技能到学习计划`);
      } else {
        showMsg('添加失败', 'error');
      }
    } catch (e: any) {
      showMsg(e?.message || '添加失败', 'error');
    } finally {
      setAddingPlan(false);
    }
  };

  const handleGenerateResume = async () => {
    if (!id) return;
    setGenerating(true);
    try {
      await generateResume(parseInt(id, 10));
      showMsg('简历已生成');
      navigate('/user/resume');
    } catch (e: any) {
      showMsg(e?.message || '生成失败', 'error');
    } finally {
      setGenerating(false);
    }
  };

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-loading">
            <IconBriefcase size={32} className="mb-3" style={{ opacity: 0.4 }} />
            <div>加载岗位详情...</div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (error || !job) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-empty">
            <div style={{ marginBottom: 12 }}>{error || '岗位不存在'}</div>
            <button className="hd-btn small" onClick={fetchData}>
              <IconRefresh size={14} style={{ marginRight: 6 }} />
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Match analysis data ── */
  const score = matchResult?.totalScore || job.matchScore || 0;
  const matchedSkills: string[] =
    matchResult?.breakdown?.requiredSkills?.matched || [];
  const missingSkills: string[] =
    matchResult?.breakdown?.requiredSkills?.missing || [];
  const preferredMatched: string[] =
    matchResult?.breakdown?.preferredSkills?.matched || [];
  const gapAnalysis: Array<{ skill: string; type: string; currentMastery: number }> =
    matchResult?.gapAnalysis || [];
  const canApply = matchResult?.canApply !== false;
  const deliveryThreshold = matchResult?.deliveryThreshold || 60;

  return (
    <div className="hd-page">
      {msgEl}
      <div className="hd-page-wrap">
        {/* ── Back nav ── */}
        <button
          onClick={() => navigate('/user/jobs')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            font: '15px/1 var(--hand)',
            color: 'var(--pencil)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          <IconArrowLeft size={16} />
          返回岗位列表
        </button>

        {/* ── Header ── */}
        <div className="hd-header">
          <h1>{job.title}</h1>
          <div className="hd-flex" style={{ gap: 12 }}>
            <span
              className="hd-flex"
              style={{ font: '15px/1 var(--hand)', color: 'var(--pencil)', gap: 6 }}
            >
              <IconBuilding size={16} />
              {job.company}
            </span>
            {job.location && (
              <span
                className="hd-flex"
                style={{ font: '15px/1 var(--hand)', color: 'var(--pencil)', gap: 6 }}
              >
                <IconMapPin size={16} />
                {job.location}
              </span>
            )}
          </div>
        </div>

        <div className="hd-grid-2" style={{ gap: 24, alignItems: 'start' }}>
          {/* ═══════════════════════════════════
              LEFT COLUMN — main content
              ═══════════════════════════════════ */}
          <div className="hd-flex-col" style={{ gap: 20 }}>
            {/* ── Salary + Score banner ── */}
            <div className="hd-canvas">
              <div className="hd-flex-between" style={{ marginBottom: 16 }}>
                <div>
                  {job.salaryRange && (
                    <div
                      className="hd-flex"
                      style={{
                        font: '700 28px/1 var(--serif)',
                        color: 'var(--accent)',
                        gap: 8,
                      }}
                    >
                      <IconWallet size={24} />
                      {job.salaryRange}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      font: '800 52px/1 var(--serif)',
                      color: scoreColor(score),
                    }}
                  >
                    {score}%
                  </div>
                  <div
                    style={{
                      font: '13px/1 var(--mono)',
                      color: 'var(--pencil)',
                      letterSpacing: '0.12em',
                      marginTop: 4,
                    }}
                  >
                    MATCH SCORE
                  </div>
                </div>
              </div>

              {/* Required skills */}
              <div className="hd-divider" />
              <div className="hd-section-label">
                <h3>岗位要求</h3>
              </div>
              <div style={{ marginBottom: 12 }}>
                <span
                  style={{
                    font: '12px/1 var(--mono)',
                    color: 'var(--pencil)',
                    letterSpacing: '0.1em',
                  }}
                >
                  必须技能
                </span>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginTop: 8,
                  }}
                >
                  {job.requiredSkills.map((s, i) => (
                    <span key={s.name || i} className="hd-tag hot">{s.name}</span>
                  ))}
                </div>
              </div>
              {job.preferredSkills && job.preferredSkills.length > 0 && (
                <div>
                  <span
                    style={{
                      font: '12px/1 var(--mono)',
                      color: 'var(--pencil)',
                      letterSpacing: '0.1em',
                    }}
                  >
                    加分技能
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                      marginTop: 8,
                    }}
                  >
                    {job.preferredSkills.map((s, i) => (
                      <span key={s.name || i} className="hd-tag">{s.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── JD text ── */}
            {job.jdText && (
              <div className="hd-canvas">
                <div className="hd-section-label">
                  <h3>岗位描述</h3>
                </div>
                <div
                  className="hd-divider"
                  style={{ marginBottom: 16 }}
                />
                <p
                  style={{
                    font: '15px/1.7 var(--hand)',
                    color: 'var(--ink)',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {job.jdText}
                </p>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════
              RIGHT COLUMN — sidebar
              ═══════════════════════════════════ */}
          <div className="hd-flex-col" style={{ gap: 20 }}>
            {/* ── Match score card ── */}
            <div className="hd-card-accent">
              <div className="hd-section-label">
                <IconTarget size={18} />
                <h3>匹配度分析</h3>
              </div>
              <div className="hd-divider" />

              {/* Large score display */}
              <div style={{ textAlign: 'center', margin: '16px 0 20px' }}>
                <div
                  style={{
                    font: '800 64px/1 var(--serif)',
                    color: scoreColor(score),
                  }}
                >
                  {score}
                </div>
                <div
                  style={{
                    font: '14px/1 var(--mono)',
                    color: 'var(--pencil)',
                    letterSpacing: '0.14em',
                    marginTop: 6,
                  }}
                >
                  匹配度
                </div>
                {/* Progress bar */}
                <div
                  className="hd-progress"
                  style={{ marginTop: 12, maxWidth: 180, marginLeft: 'auto', marginRight: 'auto' }}
                >
                  <div
                    className="hd-progress-bar"
                    style={{
                      width: `${Math.min(score, 100)}%`,
                      background: scoreColor(score),
                    }}
                  />
                </div>
              </div>

              {/* 5 因子分解图 */}
              {matchResult?.breakdown && (
                <div style={{ marginBottom: 16 }}>
                  <div className="hd-divider" style={{ marginBottom: 12 }} />
                  <div
                    style={{
                      font: '12px/1 var(--mono)',
                      color: 'var(--pencil)',
                      letterSpacing: '0.1em',
                      marginBottom: 10,
                    }}
                  >
                    因子分解
                  </div>
                  <MatchBreakdown
                    breakdown={matchResult.breakdown}
                    weights={matchResult.weights}
                    scenario={matchResult.scenario}
                    compact
                  />
                </div>
              )}

              {/* Matched skills (green) */}
              <div style={{ marginBottom: 14 }}>
                <div
                  className="hd-flex"
                  style={{
                    font: '12px/1 var(--mono)',
                    color: '#3a7d3a',
                    gap: 6,
                    marginBottom: 8,
                    letterSpacing: '0.1em',
                  }}
                >
                  <IconCheck size={14} />
                  已掌握
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {matchedSkills.length > 0 ? (
                    matchedSkills.map((s: string) => (
                      <span key={s} className="hd-badge green">{s}</span>
                    ))
                  ) : (
                    <span
                      style={{ font: '12px/1 var(--hand)', color: 'var(--pencil)', opacity: 0.6 }}
                    >
                      暂无
                    </span>
                  )}
                </div>
              </div>

              {/* Missing skills (red) */}
              <div style={{ marginBottom: 14 }}>
                <div
                  className="hd-flex"
                  style={{
                    font: '12px/1 var(--mono)',
                    color: 'var(--accent)',
                    gap: 6,
                    marginBottom: 8,
                    letterSpacing: '0.1em',
                  }}
                >
                  <IconX size={14} />
                  待学习
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {missingSkills.length > 0 ? (
                    missingSkills.map((s: string) => (
                      <span key={s} className="hd-badge red">{s}</span>
                    ))
                  ) : (
                    <span
                      style={{ font: '12px/1 var(--hand)', color: 'var(--pencil)', opacity: 0.6 }}
                    >
                      暂无
                    </span>
                  )}
                </div>
              </div>

              {/* Preferred matched */}
              {preferredMatched.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      font: '12px/1 var(--mono)',
                      color: 'var(--pencil)',
                      letterSpacing: '0.1em',
                      marginBottom: 8,
                    }}
                  >
                    加分项
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {preferredMatched.map((s: string) => (
                      <span key={s} className="hd-badge">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Gap analysis */}
              {gapAnalysis.length > 0 && (
                <div>
                  <div className="hd-divider" />
                  <div
                    style={{
                      font: '12px/1 var(--mono)',
                      color: 'var(--pencil)',
                      letterSpacing: '0.1em',
                      marginBottom: 10,
                    }}
                  >
                    差距分析
                  </div>
                  <div className="hd-flex-col" style={{ gap: 6 }}>
                    {gapAnalysis.slice(0, 5).map((g: any, i: number) => (
                      <div
                        key={i}
                        className="hd-flex-between"
                        style={{ font: '13px/1 var(--hand)' }}
                      >
                        <span
                          style={{
                            color: g.type === 'required' ? 'var(--accent)' : 'var(--pencil)',
                          }}
                        >
                          {g.skill}
                        </span>
                        <span
                          className="hd-pill"
                          style={{ fontSize: 11, padding: '3px 8px' }}
                        >
                          {g.currentMastery}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Action buttons ── */}
            <div className="hd-card-accent">
              <div className="hd-section-label">
                <h3>操作</h3>
              </div>
              <div className="hd-divider" style={{ marginBottom: 16 }} />

              {/* §7.4 分阶段达标门槛提示 */}
              {matchResult && !canApply && (
                <div
                  className="hd-dashed"
                  style={{
                    marginBottom: 14,
                    background: 'var(--note-pink)',
                    font: '13px/1.4 var(--hand)',
                    color: 'var(--accent)',
                    borderColor: 'var(--accent)',
                  }}
                >
                  {matchResult.requirement?.reason
                    || `必须技能覆盖未达 ${deliveryThreshold}%，建议先提升技能`}
                  {matchResult.requirement && (
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                      {matchResult.requirement.level === 'senior' ? '高级岗' : matchResult.requirement.level === 'mid' ? '中级岗' : '初级岗'}
                      ：需覆盖 {matchResult.requirement.coverageNeeded}%
                      （当前 {matchResult.requirement.coverageActual}%）
                      {matchResult.requirement.extraConditionLabel
                        && ` ＋ ${matchResult.requirement.extraConditionLabel}`}
                    </div>
                  )}
                </div>
              )}

              {/* 加入学习计划 */}
              <button
                className="hd-btn"
                style={{ width: '100%', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onClick={handleAddToPlan}
                disabled={addingPlan || missingSkills.length === 0}
              >
                <IconBook size={16} />
                {addingPlan ? '添加中...' : '加入学习计划'}
              </button>

              {/* 生成简历 */}
              <button
                className="hd-btn secondary"
                style={{ width: '100%', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onClick={handleGenerateResume}
                disabled={generating}
              >
                <IconDocument size={16} />
                {generating ? '生成中...' : '生成简历'}
              </button>

              {/* 投递简历 */}
              <button
                className="hd-btn highlight"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onClick={handleApply}
                disabled={applying || !canApply}
              >
                <IconSend size={16} />
                {applying ? '投递中...' : '投递简历'}
              </button>
            </div>

            {/* ── Enterprise info ── */}
            <div className="hd-card">
              <div className="hd-section-label">
                <IconBuilding size={16} />
                <h3 style={{ fontSize: 16 }}>企业信息</h3>
              </div>
              <div className="hd-divider" />
              <div className="hd-flex-col" style={{ gap: 8, marginTop: 8 }}>
                <div className="hd-flex-between">
                  <span style={{ font: '13px/1 var(--hand)', color: 'var(--pencil)' }}>
                    公司
                  </span>
                  <span style={{ font: '14px/1 var(--hand-bold)', color: 'var(--ink)' }}>
                    {job.enterpriseName || job.company}
                  </span>
                </div>
                {job.enterpriseIndustry && (
                  <div className="hd-flex-between">
                    <span style={{ font: '13px/1 var(--hand)', color: 'var(--pencil)' }}>
                      行业
                    </span>
                    <span style={{ font: '14px/1 var(--hand-bold)', color: 'var(--ink)' }}>
                      {job.enterpriseIndustry}
                    </span>
                  </div>
                )}
                {job.location && (
                  <div className="hd-flex-between">
                    <span style={{ font: '13px/1 var(--hand)', color: 'var(--pencil)' }}>
                      地点
                    </span>
                    <span
                      className="hd-flex"
                      style={{ font: '14px/1 var(--hand-bold)', color: 'var(--ink)', gap: 4 }}
                    >
                      <IconMapPin size={14} />
                      {job.location}
                    </span>
                  </div>
                )}
                {job.salaryRange && (
                  <div className="hd-flex-between">
                    <span style={{ font: '13px/1 var(--hand)', color: 'var(--pencil)' }}>
                      薪资
                    </span>
                    <span
                      style={{ font: '14px/1 var(--hand-bold)', color: 'var(--accent)' }}
                    >
                      {job.salaryRange}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

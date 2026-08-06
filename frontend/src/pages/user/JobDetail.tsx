import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import AMapLoader from '@amap/amap-jsapi-loader';
import {
  getJobDetail,
  getJobCompanyContext,
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
import InteractiveCompanyMap from '../../components/InteractiveCompanyMap';
import JobGapCard from '../../components/JobGapCard';
import EmptyState from '../../components/EmptyState';
import JobTrustBanner from '../../components/JobTrustBanner';
import type { Job } from '../../types';
import { readOnlineJob } from '../../utils/onlineJobCache';
import { getJobSkillNames, getJobTrustTier } from '../../utils/jobTrust';

interface OnlineCompanyContext {
  companyName: string;
  introduction: string;
  location: {
    query: string;
    formattedAddress: string;
    longitude: number | null;
    latitude: number | null;
    mapImage: string | null;
  };
}

async function resolveOnlineCompanyContext(job: Job): Promise<OnlineCompanyContext> {
  const query = [job.location, job.company].filter(Boolean).join(' ');
  const fallback: OnlineCompanyContext = {
    companyName: job.company || job.enterpriseName || '',
    introduction: job.snippet || job.jdText || '',
    location: {
      query,
      formattedAddress: job.location || '',
      longitude: null,
      latitude: null,
      mapImage: null,
    },
  };
  const key = import.meta.env.VITE_AMAP_WEB_KEY || '';
  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE || '';
  if (!key || !securityJsCode || !query) return fallback;

  try {
    (window as any)._AMapSecurityConfig = { securityJsCode };
    const AMap = await AMapLoader.load({
      key,
      version: '2.0',
      plugins: ['AMap.Geocoder'],
    });
    return await new Promise<OnlineCompanyContext>((resolve) => {
      const geocoder = new AMap.Geocoder({ city: job.location || undefined });
      geocoder.getLocation(query, (status: string, result: any) => {
        const geocode = status === 'complete' && result?.geocodes?.length
          ? result.geocodes[0]
          : null;
        const point = geocode?.location;
        const longitude = typeof point?.lng === 'number' ? point.lng : null;
        const latitude = typeof point?.lat === 'number' ? point.lat : null;
        resolve({
          ...fallback,
          location: {
            ...fallback.location,
            formattedAddress: geocode?.formattedAddress || geocode?.formatted_address || job.location || query,
            longitude,
            latitude,
          },
        });
      });
    });
  } catch {
    return fallback;
  }
}

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

function buildMatchReason({
  score,
  jobTitle,
  matchedSkills,
  missingSkills,
  preferredMatched,
  gapAnalysis,
  isOnlineJob,
  trustLabel,
}: {
  score: number;
  jobTitle: string;
  matchedSkills: string[];
  missingSkills: string[];
  preferredMatched: string[];
  gapAnalysis: Array<{ skill: string; type: string; currentMastery: number }>;
  isOnlineJob: boolean;
  trustLabel: string;
}) {
  if (isOnlineJob) {
    const skills = gapAnalysis.length
      ? gapAnalysis.slice(0, 3).map((item) => `${item.skill} ${item.currentMastery}%`).join('、')
      : '岗位技能标签';
    return `${trustLabel}的 ${jobTitle} 按 ${skills} 做快速估算，当前为 ${score}%。它适合用来判断学习方向，不作为平台可投递岗位。`;
  }

  const matched = matchedSkills.slice(0, 3).join('、') || '已掌握技能较少';
  const missing = missingSkills.slice(0, 3).join('、') || '暂无关键缺口';
  const bonus = preferredMatched.length ? `，加分项命中 ${preferredMatched.slice(0, 2).join('、')}` : '';
  return `已匹配 ${matched}${bonus}；主要缺口是 ${missing}，因此 ${jobTitle} 当前匹配度为 ${score}%。完成缺失技能和测评后，分数会重新计算。`;
}

function signed(value: number) {
  const rounded = Math.round(Number(value || 0) * 100) / 100;
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { el: msgEl, show: showMsg } = useHdMessage();

  const [job, setJob] = useState<Job | null>(null);
  const [matchResult, setMatchResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [addingPlan, setAddingPlan] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [companyContext, setCompanyContext] = useState<any>(null);
  const [companyContextLoading, setCompanyContextLoading] = useState(false);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const jobId = parseInt(id, 10);
      if (jobId < 0) {
        const routeJob = (location.state as { onlineJob?: Job } | null)?.onlineJob;
        const onlineJob = routeJob?.id === jobId ? routeJob : readOnlineJob(jobId);
        if (!onlineJob) {
          setError('联网岗位信息已过期，请返回岗位列表重新搜索');
          setJob(null);
          return;
        }
        setJob(onlineJob);
        setMatchResult(null);
        return;
      }
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

  useEffect(() => {
    if (!id || !job) {
      setCompanyContext(null);
      setCompanyContextLoading(false);
      return;
    }
    let cancelled = false;
    setCompanyContextLoading(true);
    const isOnline = Number(job.id) < 0 || job.source === 'online';
    const contextPromise = isOnline
      ? resolveOnlineCompanyContext(job)
      : getJobCompanyContext(parseInt(id, 10)).then((res) => res.data);
    contextPromise
      .then((res) => { if (!cancelled) setCompanyContext(res); })
      .catch(() => { if (!cancelled) setCompanyContext(null); })
      .finally(() => { if (!cancelled) setCompanyContextLoading(false); });
    return () => { cancelled = true; };
  }, [id, job?.id, job?.company, job?.location]);

  /* ── Action handlers ── */

  const handleApply = async () => {
    if (!id || !job) return;
    const currentTrust = getJobTrustTier(job);
    if (!currentTrust.canDirectApply) {
      showMsg(`${currentTrust.label}不能直接投递，可作为学习目标参考`, 'error');
      return;
    }
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
          <EmptyState
            icon="briefcase"
            tone="warning"
            title={error || '岗位不存在'}
            description="联网参考岗位可能已过期，本地岗位也可能已下架。"
            actionLabel="重新加载"
            onAction={fetchData}
          />
        </div>
      </div>
    );
  }

  /* ── Match analysis data ── */
  const score = matchResult?.totalScore || job.matchScore || 0;
  const trustTier = getJobTrustTier(job);
  const isOnlineJob = Number(job.id) < 0 || job.source === 'online' || job.searchMeta?.source === 'online';
  const isAiGenerated = trustTier.kind === 'ai';
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
  const learningTargetSkills = isOnlineJob ? getJobSkillNames(job).slice(0, 8) : missingSkills;
  const scoreChange = matchResult?.scoreChange || null;
  const matchReason = buildMatchReason({
    score,
    jobTitle: job.title,
    matchedSkills,
    missingSkills,
    preferredMatched,
    gapAnalysis,
    isOnlineJob,
    trustLabel: trustTier.label,
  });

  const handleUseAsLearningTarget = () => {
    const skills = learningTargetSkills.length > 0 ? learningTargetSkills : [job.title];
    navigate('/plan/create?type=side', {
      state: {
        suggestedPlanName: `${job.title}补齐计划`,
        suggestedTopics: skills.join('、'),
        sourceJobTitle: job.title,
        sourceTrustLabel: trustTier.label,
      },
    });
  };

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
          <div className="hd-flex" style={{ gap: 10, alignItems: 'center', minWidth: 0 }}>
            <h1>{job.title}</h1>
            <span className={trustTier.badgeClass} style={{ flexShrink: 0 }}>
              {trustTier.label}
            </span>
          </div>
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

        <JobTrustBanner tier={trustTier} host={job.host} />

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
                  {job.requiredSkills.length > 0 ? job.requiredSkills.map((s, i) => (
                    <span key={s.name || i} className="hd-tag hot">{s.name}</span>
                  )) : (
                    <span style={{ font: '13px/1.5 var(--hand)', color: 'var(--pencil)' }}>暂未提取技能要求</span>
                  )}
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

            {/* ── AI company introduction ── */}
            <div className="hd-canvas">
              <div className="hd-section-label">
                <IconBuilding size={18} />
                <h3>公司简介</h3>
                <span className="hd-badge accent" style={{ marginLeft: 'auto' }}>
                  {isOnlineJob ? (isAiGenerated ? '参考摘要' : '来源摘要') : 'AI 整理'}
                </span>
              </div>
              <div className="hd-divider" style={{ marginBottom: 16 }} />
              {companyContextLoading ? (
                <div className="hd-flex" style={{ gap: 9, color: 'var(--pencil)', font: '14px/1.6 var(--hand)' }}>
                  <span className="hd-spinner" /> 正在整理公司公开信息...
                </div>
              ) : (
                <p style={{ font: '15px/1.75 var(--hand)', color: 'var(--ink)', margin: 0 }}>
                  {companyContext?.introduction
                    || `${job.enterpriseName || job.company}正在招聘${job.title}。公开信息有限，建议结合岗位描述及企业官方渠道进一步了解业务方向与团队情况。`}
                </p>
              )}
              <div style={{ marginTop: 12, color: 'var(--pencil)', font: '12px/1.5 var(--hand)' }}>
                {isOnlineJob
                  ? '公司信息根据当前岗位卡片整理，请以企业官方信息为准。'
                  : '内容由 deepseek-v4-flash 基于岗位与企业公开常识整理，请以企业官方信息为准。'}
              </div>
            </div>

            {/* ── Company location ── */}
            <div className="hd-canvas" style={{ overflow: 'hidden' }}>
              <div className="hd-section-label">
                <IconMapPin size={18} />
                <h3>公司位置</h3>
              </div>
              <div className="hd-divider" style={{ marginBottom: 14 }} />
              <div className="hd-flex-between" style={{ gap: 16, marginBottom: 12, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ font: '700 16px/1.4 var(--hand-bold)', color: 'var(--ink)' }}>
                    {companyContext?.location?.formattedAddress || job.location || '暂未提供工作地点'}
                  </div>
                  {companyContext?.location?.longitude != null && (
                    <div style={{ marginTop: 4, font: '11px/1.4 var(--mono)', color: 'var(--pencil)' }}>
                      {companyContext.location.longitude.toFixed(5)}, {companyContext.location.latitude.toFixed(5)}
                    </div>
                  )}
                </div>
                {companyContext?.location?.longitude != null && (
                  <a
                    className="hd-btn small secondary"
                    href={`https://uri.amap.com/marker?position=${companyContext.location.longitude},${companyContext.location.latitude}&name=${encodeURIComponent(companyContext.companyName || job.company)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
                  >
                    <IconMapPin size={14} /> 查看地图
                  </a>
                )}
              </div>
              {companyContextLoading ? (
                <div style={{ height: 220, background: 'var(--paper-tint)', border: '1px solid var(--rule)', borderRadius: 6 }} />
              ) : companyContext?.location?.longitude != null ? (
                <InteractiveCompanyMap
                  longitude={companyContext.location.longitude}
                  latitude={companyContext.location.latitude}
                  companyName={companyContext.companyName || job.company}
                  staticImage={companyContext.location.mapImage}
                />
              ) : (
                <div
                  style={{
                    height: 180,
                    display: 'grid',
                    placeItems: 'center',
                    border: '1px solid var(--rule)',
                    borderRadius: 6,
                    background: 'var(--paper-tint)',
                    color: 'var(--pencil)',
                    font: '13px/1.5 var(--hand)',
                  }}
                >
                  <span className="hd-flex" style={{ gap: 6 }}><IconMapPin size={17} /> 暂无精确地图</span>
                </div>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════
              RIGHT COLUMN — sidebar
              ═══════════════════════════════════ */}
          <div className="hd-flex-col" style={{ gap: 20 }}>
            {/* ── 岗位差距卡（P0-1）：Top3 缺口 + 推荐动作 + 一键加入计划 ── */}
            {!isOnlineJob && (
              <JobGapCard jobId={job.id} showHeader={false} />
            )}

            {/* ── Match score card ── */}
            <div className="hd-card-accent">
              <div className="hd-section-label">
                <IconTarget size={18} />
                <h3>{isOnlineJob ? '推荐匹配度' : '匹配度分析'}</h3>
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

              {isOnlineJob && !matchResult && (
                <div className="hd-dashed" style={{ marginBottom: 16, font: '13px/1.5 var(--hand)', color: 'var(--pencil)' }}>
                  当前分数按技能标签快速估算；完整匹配分析仅适用于本地岗位库。
                </div>
              )}

              <div className="hd-dashed" style={{ marginBottom: 16, font: '13px/1.55 var(--hand)', color: 'var(--ink)' }}>
                <strong>为什么是这个分数：</strong>{matchReason}
              </div>

              {scoreChange && (
                <div
                  className="hd-dashed"
                  style={{
                    marginBottom: 16,
                    background: scoreChange.delta >= 0 ? 'rgba(58, 125, 58, 0.08)' : 'var(--note-pink)',
                    borderColor: scoreChange.delta >= 0 ? '#3a7d3a' : 'var(--accent)',
                    font: '13px/1.55 var(--hand)',
                    color: 'var(--ink)',
                  }}
                >
                  <div className="hd-flex-between" style={{ gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                    <strong>为什么匹配度变化：</strong>
                    <span className={`hd-badge ${scoreChange.delta >= 0 ? 'green' : 'red'}`}>
                      {scoreChange.beforeScore}% → {scoreChange.afterScore}%（{signed(scoreChange.delta)}）
                    </span>
                  </div>
                  <div>{scoreChange.explanation}</div>
                  {(scoreChange.skillChanges?.length > 0 || scoreChange.radarChanges?.length > 0) && (
                    <div className="hd-flex" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {scoreChange.skillChanges?.slice(0, 3).map((item: any) => (
                        <span key={`skill-${item.name}`} className={`hd-badge ${item.delta >= 0 ? 'green' : 'red'}`}>
                          {item.name} {signed(item.delta)}
                        </span>
                      ))}
                      {scoreChange.radarChanges?.slice(0, 2).map((item: any) => (
                        <span key={`radar-${item.name}`} className={`hd-badge ${item.delta >= 0 ? 'green' : 'red'}`}>
                          {item.name} {signed(item.delta)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
              {!isOnlineJob && <div style={{ marginBottom: 14 }}>
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
              </div>}

              {/* Missing skills (red) */}
              {!isOnlineJob && <div style={{ marginBottom: 14 }}>
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
              </div>}

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
            {!trustTier.canDirectApply ? (
              <div className="hd-card-accent">
                <div className="hd-section-label">
                  <h3>可执行动作</h3>
                </div>
                <div className="hd-divider" style={{ marginBottom: 16 }} />
                <JobTrustBanner tier={trustTier} host={job.host} compact />
                {job.url && (
                  <a
                    className="hd-btn highlight"
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ width: '100%', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}
                  >
                    <IconSend size={16} />查看原岗位
                  </a>
                )}
                <button
                  className="hd-btn"
                  style={{ width: '100%', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onClick={handleUseAsLearningTarget}
                  disabled={learningTargetSkills.length === 0}
                >
                  <IconBook size={16} />作为学习目标
                </button>
                <button
                  className="hd-btn secondary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onClick={() => navigate('/user/jobs')}
                >
                  <IconArrowLeft size={16} />返回岗位列表
                </button>
              </div>
            ) : <div className="hd-card-accent">
              <div className="hd-section-label">
                <h3>可执行动作</h3>
              </div>
              <div className="hd-divider" style={{ marginBottom: 16 }} />
              <div className="hd-dashed" style={{ marginBottom: 14, font: '13px/1.5 var(--hand)', color: 'var(--pencil)' }}>
                <strong>{trustTier.label}：</strong>建议先补齐缺口并生成岗位版简历；达到投递门槛后再投递，后续变化会进入成长报告。
              </div>

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
            </div>}

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

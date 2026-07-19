import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getJobs } from '../../api/user';
import {
  IconSearch,
  IconBriefcase,
  IconBuilding,
  IconMapPin,
  IconWallet,
  IconRefresh,
  IconStar,
  IconLink,
} from '../../components/icons';
import type { Job } from '../../types';
import { storeOnlineJob } from '../../utils/onlineJobCache';

/* ──────────────────────────────────────────
   Jobs Page — hand-drawn design system
   岗位匹配 listing with search / sort / grid
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

/** SVG match score circle */
function ScoreCircle({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="var(--rule)"
        strokeWidth="4"
      />
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={scoreColor(score)}
        strokeWidth="4"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${c} ${c})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text
        x={c}
        y={c}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          font: `700 ${size * 0.28}px/1 var(--serif)`,
          fill: scoreColor(score),
        }}
      >
        {score}
      </text>
    </svg>
  );
}

/** 解析薪资范围字符串，返回上限数字（如 "15-25K" → 25） */
function parseSalaryMax(s: string): number {
  if (!s) return 0;
  const match = s.match(/(\d+)\s*K/i);
  if (match) return parseInt(match[1], 10);
  const nums = s.match(/\d+/g);
  return nums ? Math.max(...nums.map(Number)) : 0;
}

export default function Jobs() {
  const navigate = useNavigate();
  const { el: msgEl } = useHdMessage();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState<'match' | 'salary'>('match');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [searchMode, setSearchMode] = useState<'hybrid' | 'local' | 'online'>('hybrid');
  const [searchMeta, setSearchMeta] = useState<Record<string, any> | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingText, setLoadingText] = useState('正在匹配岗位...');
  const requestSeq = useRef(0);
  const pageSize = 20;

  const fetchJobs = async (p = 1, kw?: string, lv?: string, mode = searchMode) => {
    const requestId = ++requestSeq.current;
    const effectiveKw = kw?.trim() || '';
    setLoading(true);
    setError(null);
    setLoadingText(
      mode === 'online'
        ? `正在联网搜索${effectiveKw ? `“${effectiveKw}”` : '热门 IT 岗位'}...`
        : mode === 'local'
          ? '正在查询本地岗位...'
          : effectiveKw
            ? `正在混合搜索“${effectiveKw}”...`
            : '正在匹配岗位...',
    );
    if (p === 1) {
      setJobs([]);
      setTotal(0);
      setSearchMeta(null);
    }
    try {
      const shouldIncludeOnline = mode === 'online' || (mode === 'hybrid' && effectiveKw.length > 0);
      const res = await getJobs({
        page: p,
        pageSize,
        keyword: effectiveKw || undefined,
        level: lv || undefined,
        searchMode: mode,
        includeOnline: shouldIncludeOnline,
      });
      if (requestId !== requestSeq.current) return;
      const items = res.data || [];
      setTotal(res.total || 0);
      setSearchMeta(res.meta || null);
      if (p === 1) {
        setJobs(items);
      } else {
        setJobs((prev) => [...prev, ...items]);
      }
      setPage(p);
    } catch (err: any) {
      if (requestId !== requestSeq.current) return;
      setError(err?.message || '加载失败');
    } finally {
      if (requestId === requestSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs(1);
  }, []);

  const handleSearch = () => {
    fetchJobs(1, keyword, levelFilter, searchMode);
  };

  const handleLevelChange = (lv: string) => {
    setLevelFilter(lv);
    fetchJobs(1, keyword, lv, searchMode);
  };

  const handleLoadMore = () => {
    fetchJobs(page + 1, keyword, levelFilter, searchMode);
  };

  const handleSearchModeChange = (mode: 'hybrid' | 'local' | 'online') => {
    setSearchMode(mode);
    fetchJobs(1, keyword, levelFilter, mode);
  };

  const handleJobClick = (job: Job) => {
    const isOnline = (typeof job.id === 'number' && job.id < 0) || job.source === 'online';
    if (isOnline) {
      storeOnlineJob(job);
      navigate(`/user/jobs/${job.id}`, { state: { onlineJob: job } });
      return;
    }
    navigate(`/user/jobs/${job.id}`);
  };

  /* Sort */
  const filtered = [...jobs].sort((a, b) => {
    if (sortBy === 'match') return (b.matchScore || 0) - (a.matchScore || 0);
    if (sortBy === 'salary') return parseSalaryMax(b.salaryRange) - parseSalaryMax(a.salaryRange);
    return 0;
  });

  const hasMore = jobs.length < total;
  const totalPages = Math.ceil(total / pageSize);
  const localCount = Number(searchMeta?.localCount || 0);
  const onlineCount = Number(searchMeta?.onlineCount || 0);
  const webOnlineCount = Number(searchMeta?.webOnlineCount ?? onlineCount);
  const aiRecommendationCount = Number(searchMeta?.aiRecommendationCount || 0);
  const hasSearchMeta = Boolean(searchMeta);
  const onlineQuery = String(searchMeta?.onlineQuery || keyword || '').trim();

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-loading">
            <IconBriefcase size={32} className="mb-3" style={{ opacity: 0.4 }} />
            <div>{loadingText}</div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (error && jobs.length === 0) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-empty">
            <div style={{ marginBottom: 12 }}>{error}</div>
            <button className="hd-btn small" onClick={() => fetchJobs(1)}>
              <IconRefresh size={14} style={{ marginRight: 6 }} />
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hd-page">
      {msgEl}
      <div className="hd-page-wrap">
        {/* ── Header ── */}
        <div className="hd-header">
          <h1>岗位匹配</h1>
          <div className="hd-flex" style={{ gap: 8, alignItems: 'center' }}>
            <span className="hd-pill">{filtered.length} / {total} 个岗位</span>
            <button className="hd-btn small secondary" onClick={() => fetchJobs(1, keyword || undefined, levelFilter, searchMode)} disabled={loading} title="刷新">
              <IconRefresh size={14} />
            </button>
          </div>
        </div>

        {/* ── Search bar ── */}
        <div style={{ marginBottom: 20 }}>
          <div className="hd-flex" style={{ maxWidth: 520, gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <IconSearch
                size={18}
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--pencil)',
                  opacity: 0.6,
                }}
              />
              <input
                className="hd-input"
                style={{ paddingLeft: 40 }}
                placeholder="搜索岗位、公司或技能..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button className="hd-btn small" onClick={handleSearch} disabled={loading}>
              <IconSearch size={14} style={{ marginRight: 4 }} />
              搜索
            </button>
            <button className="hd-btn small secondary" onClick={() => fetchJobs(1, keyword || undefined, levelFilter, searchMode)} disabled={loading} title="刷新搜索结果">
              <IconRefresh size={14} />
            </button>
          </div>
        </div>

        {/* ── Sort toggles + level filter ── */}
        <div className="hd-flex-between" style={{ marginTop: -10, marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div className="hd-toggle" title="选择岗位搜索范围">
            {([
              ['hybrid', '混合搜索'],
              ['local', '本地岗位'],
              ['online', '联网搜索'],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                className={`hd-toggle-tag ${searchMode === mode ? 'active' : ''}`}
                onClick={() => handleSearchModeChange(mode)}
                disabled={loading}
              >
                {label}
              </button>
            ))}
          </div>
          {hasSearchMeta && (
            <span className="hd-pill">
              {searchMode === 'online'
                ? aiRecommendationCount > 0
                  ? webOnlineCount > 0
                    ? `联网 ${webOnlineCount} · AI 补充 ${aiRecommendationCount}`
                    : `联网未命中 · AI 补充 ${aiRecommendationCount}`
                  : `联网搜索 · ${webOnlineCount} 个结果`
                : searchMode === 'local'
                  ? `本地岗位 · ${localCount} 个结果`
                  : `本地 ${localCount} · 联网 ${onlineCount}`}
            </span>
          )}
        </div>

        <div className="hd-flex-between" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div className="hd-toggle">
            <button
              className={`hd-toggle-tag ${sortBy === 'match' ? 'active' : ''}`}
              onClick={() => setSortBy('match')}
            >
              <IconStar size={13} style={{ marginRight: 4 }} />
              按匹配度
            </button>
            <button
              className={`hd-toggle-tag ${sortBy === 'salary' ? 'active' : ''}`}
              onClick={() => setSortBy('salary')}
            >
              <IconWallet size={13} style={{ marginRight: 4 }} />
              按薪资
            </button>
          </div>
          <div className="hd-toggle">
            <button
              className={`hd-toggle-tag ${levelFilter === '' ? 'active' : ''}`}
              onClick={() => handleLevelChange('')}
            >
              全部
            </button>
            <button
              className={`hd-toggle-tag ${levelFilter === 'junior' ? 'active' : ''}`}
              onClick={() => handleLevelChange('junior')}
            >
              初级
            </button>
            <button
              className={`hd-toggle-tag ${levelFilter === 'mid' ? 'active' : ''}`}
              onClick={() => handleLevelChange('mid')}
            >
              中级
            </button>
            <button
              className={`hd-toggle-tag ${levelFilter === 'senior' ? 'active' : ''}`}
              onClick={() => handleLevelChange('senior')}
            >
              高级
            </button>
          </div>
        </div>

        {/* ── Job cards grid ── */}
        {filtered.length > 0 ? (
          <>
            <div className="hd-grid-auto">
              {filtered.map((job, idx) => (
                <JobCardItem
                  key={job.id}
                  job={job}
                  tilt={`hd-tilt-${(idx % 4) + 1}`}
                  onClick={() => handleJobClick(job)}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 28 }}>
                <button
                  className="hd-btn small secondary"
                  onClick={() => fetchJobs(page - 1, keyword, levelFilter, searchMode)}
                  disabled={page <= 1 || loading}
                >
                  ← 上一页
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const start = totalPages <= 7 ? 1 : Math.max(1, page - 3);
                  const end = totalPages <= 7 ? totalPages : Math.min(totalPages, page + 3);
                  const pn = start + i;
                  if (pn > end) return null;
                  return (
                    <button
                      key={pn}
                      className={`hd-btn small ${pn === page ? '' : 'secondary'}`}
                      onClick={() => fetchJobs(pn, keyword, levelFilter, searchMode)}
                      disabled={loading}
                    >
                      {pn}
                    </button>
                  );
                })}
                <button
                  className="hd-btn small secondary"
                  onClick={() => fetchJobs(page + 1, keyword, levelFilter, searchMode)}
                  disabled={page * pageSize >= total || loading}
                >
                  下一页 →
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="hd-empty">
            <IconBriefcase size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div>
              {searchMode === 'online'
                ? `联网搜索未找到${onlineQuery && onlineQuery !== 'IT' ? `“${onlineQuery}”` : '热门 IT'}岗位`
                : '没有找到匹配的岗位'}
            </div>
            <button
              className="hd-btn small secondary"
              style={{ marginTop: 12 }}
              onClick={() => {
                if (searchMode === 'online') {
                  fetchJobs(1, keyword, levelFilter, 'online');
                } else {
                  setKeyword('');
                  fetchJobs(1, '', levelFilter, searchMode);
                }
              }}
            >
              {searchMode === 'online' ? (
                <><IconRefresh size={14} style={{ marginRight: 6 }} />重新联网搜索</>
              ) : '清除搜索'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 岗位级别中文映射 ── */
const LEVEL_LABEL: Record<string, string> = {
  junior: '初级',
  mid: '中级',
  senior: '高级',
};

/* ──────────────────────────────────────────
   JobCardItem — single job card
   ────────────────────────────────────────── */
function JobCardItem({
  job,
  tilt,
  onClick,
}: {
  job: Job;
  tilt: string;
  onClick: () => void;
}) {
  const score = job.matchScore || 0;
  const isOnline = (typeof job.id === 'number' && job.id < 0) || job.source === 'online';
  const isAiGenerated = isOnline && (job.searchMeta?.origin === 'ai_generated' || !job.url);
  const matchedFields = job.searchMeta?.matchedFields || [];

  /* Match level badge */
  const matchBadge =
    score >= 80
      ? { label: '高匹配', cls: 'hd-badge green' }
      : score >= 60
      ? { label: '中匹配', cls: 'hd-badge accent' }
      : { label: '待提升', cls: 'hd-badge red' };

  /* Job level badge */
  const levelLabel = LEVEL_LABEL[job.level] || job.level;

  return (
    <div
      className={`hd-card ${tilt}`}
      style={{ cursor: 'pointer', transition: 'box-shadow 0.2s' }}
      onClick={onClick}
    >
      {/* Top row: title + score circle */}
      <div className="hd-flex-between" style={{ marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: '700 18px/1.2 var(--serif)',
              color: 'var(--ink)',
              marginBottom: 6,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {job.title}
            {isOnline && (
              <span className="hd-badge accent" style={{ marginLeft: 8, fontSize: 10, verticalAlign: 'middle' }}>
                {isAiGenerated ? 'AI 推荐' : '联网'}
              </span>
            )}
          </div>
          <div className="hd-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span
              className="hd-flex"
              style={{ font: '13px/1 var(--hand)', color: 'var(--pencil)', gap: 4 }}
            >
              <IconBuilding size={14} />
              {job.enterpriseName || job.company}
            </span>
            {job.location && (
              <span
                className="hd-flex"
                style={{ font: '13px/1 var(--hand)', color: 'var(--pencil)', gap: 4 }}
              >
                <IconMapPin size={14} />
                {job.location}
              </span>
            )}
            {isOnline && !isAiGenerated && job.host && (
              <span
                className="hd-flex"
                style={{ font: '13px/1 var(--hand)', color: 'var(--pencil)', gap: 4 }}
              >
                <IconLink size={14} />
                {job.host}
              </span>
            )}
          </div>
        </div>
        <ScoreCircle score={score} size={56} />
      </div>

      {/* Match badge + level badge + salary */}
      <div className="hd-flex" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span className={matchBadge.cls}>{matchBadge.label}</span>
        <span className="hd-badge">{levelLabel}</span>
        {job.salaryRange && (
          <span
            className="hd-flex"
            style={{ font: '13px/1 var(--hand-bold)', color: 'var(--accent)', gap: 4 }}
          >
            <IconWallet size={14} />
            {job.salaryRange}
          </span>
        )}
        {!isOnline && matchedFields.length > 0 && (
          <span className="hd-badge">
            命中 {matchedFields.length}
          </span>
        )}
      </div>

      {isOnline && job.snippet && (
        <div
          style={{
            font: '13px/1.5 var(--hand)',
            color: 'var(--pencil)',
            marginBottom: 10,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {job.snippet}
        </div>
      )}

      {/* Skills tags */}
      {job.requiredSkills && job.requiredSkills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {job.requiredSkills.slice(0, 5).map((skill, i) => (
            <span key={skill.name || i} className="hd-tag">{skill.name}</span>
          ))}
          {job.requiredSkills.length > 5 && (
            <span className="hd-tag" style={{ opacity: 0.6 }}>
              +{job.requiredSkills.length - 5}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

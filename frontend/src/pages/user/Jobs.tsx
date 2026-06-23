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
} from '../../components/icons';
import type { Job } from '../../types';

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
  const { el: msgEl, show: showMsg } = useHdMessage();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState<'match' | 'salary'>('match');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const fetchJobs = async (p = 1, kw?: string, lv?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getJobs({ page: p, pageSize, keyword: kw || undefined, level: lv || undefined });
      const items = res.data || [];
      setTotal(res.total || 0);
      if (p === 1) {
        setJobs(items);
      } else {
        setJobs((prev) => [...prev, ...items]);
      }
      setPage(p);
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs(1);
  }, []);

  const handleSearch = () => {
    fetchJobs(1, keyword, levelFilter);
  };

  const handleLevelChange = (lv: string) => {
    setLevelFilter(lv);
    fetchJobs(1, keyword, lv);
  };

  const handleLoadMore = () => {
    fetchJobs(page + 1, keyword, levelFilter);
  };

  /* Sort */
  const filtered = [...jobs].sort((a, b) => {
    if (sortBy === 'match') return (b.matchScore || 0) - (a.matchScore || 0);
    if (sortBy === 'salary') return parseSalaryMax(b.salaryRange) - parseSalaryMax(a.salaryRange);
    return 0;
  });

  const hasMore = jobs.length < total;

  /* ── Loading state ── */
  if (loading && jobs.length === 0) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-loading">
            <IconBriefcase size={32} className="mb-3" style={{ opacity: 0.4 }} />
            <div>正在匹配岗位...</div>
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
          <span className="hd-pill">{filtered.length} / {total} 个岗位</span>
        </div>

        {/* ── Search bar ── */}
        <div style={{ marginBottom: 20 }}>
          <div className="hd-flex" style={{ maxWidth: 520 }}>
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
            <button className="hd-btn small" onClick={handleSearch}>
              搜索
            </button>
          </div>
        </div>

        {/* ── Sort toggles + level filter ── */}
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
                  onClick={() => navigate(`/user/jobs/${job.id}`)}
                />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: 28 }}>
                <button
                  className="hd-btn secondary"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? '加载中...' : '加载更多'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="hd-empty">
            <IconBriefcase size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div>没有找到匹配的岗位</div>
            <button
              className="hd-btn small secondary"
              style={{ marginTop: 12 }}
              onClick={() => { setKeyword(''); fetchJobs(1); }}
            >
              清除搜索
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
      </div>

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

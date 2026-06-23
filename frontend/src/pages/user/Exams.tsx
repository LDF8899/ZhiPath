import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExams } from '../../api/user';
import type { ExamRecord } from '../../types';
import '../../styles/hand-draw.css';

/* ── SVG icons ─────────────────────────────────────────── */
const IconDoc = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const IconCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const IconX = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const IconRefresh = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const IconPlay = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const IconExam = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <line x1="8" y1="7" x2="16" y2="7" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

/* ── Status helpers ────────────────────────────────────── */
type StatusFilter = 'all' | 'pending' | 'passed' | 'failed';

function getExamStatus(exam: ExamRecord): 'pending' | 'passed' | 'failed' {
  if (exam.passed) return 'passed';
  if (exam.score > 0) return 'failed';
  return 'pending';
}

function statusLabel(s: string) {
  if (s === 'passed') return '通过';
  if (s === 'failed') return '未通过';
  return '待考试';
}

function typeLabel(exam: ExamRecord): string {
  // examType: 1=skill, 2=job, 3=quick
  if (exam.examType === 2) return '岗位';
  if (exam.examType === 3) return '速测';
  return '技能';
}

/* ── Component ─────────────────────────────────────────── */
export default function Exams() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');

  const fetchExams = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getExams();
      setExams(res.data || []);
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchExams(); }, []);

  /* ── Loading state ─────────────────────────────────── */
  if (loading) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-loading">
            <div className="hd-skeleton w60" style={{ margin: '0 auto 8px' }} />
            <div className="hd-skeleton w40" style={{ margin: '0 auto' }} />
            <p style={{ marginTop: 16, color: 'var(--pencil)' }}>正在加载考试...</p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error state ───────────────────────────────────── */
  if (error) {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div className="hd-empty">
            <p style={{ marginBottom: 12 }}>{error}</p>
            <button className="hd-btn small" onClick={fetchExams}>
              <span className="hd-flex" style={{ gap: 6 }}><IconRefresh /> 重试</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Filter exams ──────────────────────────────────── */
  const filtered = exams.filter((e) => {
    if (filter === 'all') return true;
    return getExamStatus(e) === filter;
  });

  const pendingCount = exams.filter((e) => getExamStatus(e) === 'pending').length;
  const passedCount = exams.filter((e) => getExamStatus(e) === 'passed').length;
  const failedCount = exams.filter((e) => getExamStatus(e) === 'failed').length;

  return (
    <div className="hd-page">
      <div className="hd-page-wrap">
        {/* ── Header ─────────────────────────────────── */}
        <div className="hd-header">
          <div className="hd-flex" style={{ gap: 14 }}>
            <span style={{ color: 'var(--accent)' }}><IconExam /></span>
            <h1>考试中心</h1>
          </div>
          <div className="hd-flex" style={{ gap: 10 }}>
            <button
              className="hd-btn secondary small"
              onClick={() => navigate('/user/wrong-answers')}
            >
              错题本
            </button>
            <span className="hd-pill">{exams.length} 场考试</span>
          </div>
        </div>

        {/* ── KPIs ───────────────────────────────────── */}
        <div className="hd-kpis">
          <div className="hd-kpi hd-tilt-1">
            <div className="hd-kpi-label">全部</div>
            <div className="hd-kpi-value ink">{exams.length}</div>
          </div>
          <div className="hd-kpi hd-tilt-2">
            <div className="hd-kpi-label">待考试</div>
            <div className="hd-kpi-value">{pendingCount}</div>
          </div>
          <div className="hd-kpi hd-tilt-3">
            <div className="hd-kpi-label">已通过</div>
            <div className="hd-kpi-value blue">{passedCount}</div>
          </div>
          <div className="hd-kpi hd-tilt-4">
            <div className="hd-kpi-label">未通过</div>
            <div className="hd-kpi-value ink">{failedCount}</div>
          </div>
        </div>

        {/* ── Filter toggles ─────────────────────────── */}
        <div style={{ margin: '20px 0 16px' }}>
          <div className="hd-toggle">
            {(['all', 'pending', 'passed', 'failed'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                className={`hd-toggle-tag${filter === f ? ' active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? '全部' : statusLabel(f)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Exam list ──────────────────────────────── */}
        {filtered.length > 0 ? (
          <div className="hd-flex-col" style={{ gap: 12 }}>
            {filtered.map((exam) => {
              const status = getExamStatus(exam);
              return (
                <div key={exam.id} className="hd-card">
                  <div className="hd-flex-between">
                    {/* Left: icon + info */}
                    <div className="hd-flex" style={{ gap: 14 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background:
                            status === 'passed'
                              ? 'var(--note-green)'
                              : status === 'failed'
                              ? 'var(--note-pink)'
                              : 'var(--note-yellow)',
                          color:
                            status === 'passed'
                              ? '#3a7d3a'
                              : status === 'failed'
                              ? 'var(--accent)'
                              : 'var(--ink)',
                        }}
                      >
                        {status === 'passed' ? <IconCheck /> : status === 'failed' ? <IconX /> : <IconDoc />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{exam.skillName}</div>
                        <div className="hd-flex" style={{ gap: 6, flexWrap: 'wrap' }}>
                          <span className="hd-badge accent">{typeLabel(exam)}</span>
                          <span
                            className={`hd-badge ${
                              status === 'passed' ? 'green' : status === 'failed' ? 'red' : ''
                            }`}
                          >
                            {statusLabel(status)}
                          </span>
                          {exam.retryCount > 0 && (
                            <span className="hd-tag">重考 {exam.retryCount} 次</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: score + action */}
                    <div style={{ textAlign: 'right' }}>
                      {exam.score > 0 && (
                        <div
                          style={{
                            font: "800 28px/1 var(--serif)",
                            color: status === 'passed' ? '#3a7d3a' : 'var(--accent)',
                            marginBottom: 6,
                          }}
                        >
                          {exam.score}
                          <span style={{ fontSize: 14, fontWeight: 400 }}>分</span>
                        </div>
                      )}
                      <button
                        className="hd-btn small"
                        onClick={() => navigate(`/user/exams/${exam.id}/take`)}
                      >
                        <span className="hd-flex" style={{ gap: 4 }}>
                          <IconPlay />
                          {status === 'failed' ? '重新考试' : '开始考试'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="hd-empty">
            <p>暂无考试记录</p>
            <p style={{ fontSize: 14, marginTop: 4 }}>完成学习路径中的技能点后可参加考试</p>
          </div>
        )}
      </div>
    </div>
  );
}

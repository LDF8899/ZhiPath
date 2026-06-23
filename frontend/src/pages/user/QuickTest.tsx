import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getQuickTestQuestions, submitQuickTest } from '../../api/user';
import '../../styles/hand-draw.css';

/* ── SVG icons ─────────────────────────────────────────── */
const IconBolt = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);
const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);
const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);
const IconHome = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const IconRefresh = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);
const IconPlay = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);
const IconArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);
const IconArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);

/* ── Component ─────────────────────────────────────────── */
export default function QuickTest() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'result'>('intro');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [skillName, setSkillName] = useState('');
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const startTest = async () => {
    setLoading(true);
    try {
      const res = await getQuickTestQuestions();
      setQuestions(res.data?.questions || []);
      setSkillName(res.data?.skillName || 'JavaScript');
      setPhase('quiz');
    } catch (e: any) {
      console.error('Failed to fetch questions:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const question = questions[current];
  const isLast = current === questions.length - 1;

  const handleSelect = (value: any) => {
    const questionId = question?.id || current.toString();
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    if (isLast) {
      handleSubmit();
    } else {
      setCurrent(c => c + 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await submitQuickTest({ skillName, answers, questions });
      setResult(res.data);
      setPhase('result');
    } catch (e: any) {
      console.error('Submit failed:', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setCurrent(0);
    setResult(null);
    setPhase('intro');
  };

  /* ── Intro screen ─────────────────────────────────── */
  if (phase === 'intro') {
    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <div className="hd-header">
              <div className="hd-flex" style={{ gap: 14 }}>
                <span style={{ color: 'var(--highlight)' }}><IconBolt /></span>
                <h1>5分钟速测</h1>
              </div>
            </div>

            <div className="hd-card-accent" style={{ marginTop: 24 }}>
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div
                  style={{
                    width: 80, height: 80, borderRadius: '50%',
                    border: '3px solid var(--highlight)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px',
                    background: 'var(--note-yellow)',
                    color: 'var(--ink)',
                  }}
                >
                  <IconBolt />
                </div>
                <h2 style={{ font: "800 28px/1.2 var(--serif)", marginBottom: 12 }}>
                  快速检验你的技能
                </h2>
                <p style={{ color: 'var(--pencil)', marginBottom: 24, maxWidth: 380, margin: '0 auto 24px' }}>
                  5 道精选题目，快速了解你对当前技能的掌握程度。
                  测试结果将更新你的技能画像。
                </p>

                <div className="hd-divider" />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, margin: '20px 0' }}>
                  <div className="hd-kpi">
                    <div className="hd-kpi-value" style={{ fontSize: 32 }}>5</div>
                    <div className="hd-kpi-label">题目</div>
                  </div>
                  <div className="hd-kpi">
                    <div className="hd-kpi-value blue" style={{ fontSize: 32 }}>~5</div>
                    <div className="hd-kpi-label">分钟</div>
                  </div>
                  <div className="hd-kpi">
                    <div className="hd-kpi-value ink" style={{ fontSize: 32 }}>AI</div>
                    <div className="hd-kpi-label">出题</div>
                  </div>
                </div>

                <button
                  className="hd-btn"
                  onClick={startTest}
                  disabled={loading}
                  style={{ marginTop: 16 }}
                >
                  <span className="hd-flex" style={{ gap: 8 }}>
                    <IconPlay />
                    {loading ? '正在生成题目...' : '开始速测'}
                  </span>
                </button>
              </div>
            </div>

            <div className="hd-note yellow" style={{ margin: '24px auto 0', maxWidth: 260 }}>
              <div className="hd-note-tape" />
              <b>小贴士：</b>速测题目会根据你的学习方向自动生成，答完即可看到解析。
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Quiz screen ──────────────────────────────────── */
  if (phase === 'quiz') {
    if (!question || questions.length === 0) {
      return (
        <div className="hd-page">
          <div className="hd-page-wrap">
            <div className="hd-empty">暂无题目，请稍后再试</div>
          </div>
        </div>
      );
    }

    const questionId = question.id || current.toString();
    const progressPct = Math.round(((current + 1) / questions.length) * 100);

    return (
      <div className="hd-page">
        <div className="hd-page-wrap">
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            {/* Top bar */}
            <div className="hd-flex-between" style={{ marginBottom: 20 }}>
              <button
                className="hd-btn secondary small"
                onClick={() => navigate(-1)}
              >
                <span className="hd-flex" style={{ gap: 4 }}><IconBack /> 退出速测</span>
              </button>
              <div className="hd-flex" style={{ gap: 8 }}>
                <span style={{ color: 'var(--highlight)' }}><IconBolt /></span>
                <span style={{ fontSize: 14, color: 'var(--pencil)' }}>
                  5分钟速测 · {skillName}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="hd-progress" style={{ marginBottom: 20 }}>
              <div
                className="hd-progress-bar"
                style={{ width: `${progressPct}%`, background: 'var(--highlight)' }}
              />
            </div>

            {/* Question card */}
            <div className="hd-card-accent">
              <div className="hd-flex" style={{ gap: 8, marginBottom: 14 }}>
                <span className="hd-pin">
                  第 {current + 1}/{questions.length} 题
                </span>
              </div>

              <h2 style={{ font: "700 20px/1.4 var(--hand-bold)", marginBottom: 20 }}>
                {question.title}
              </h2>

              {question.options && (
                <div className="hd-flex-col" style={{ gap: 10 }}>
                  {question.options.map((opt: string, i: number) => {
                    const selected = answers[questionId] === i;
                    return (
                      <button
                        key={i}
                        className="hd-card"
                        onClick={() => handleSelect(i)}
                        style={{
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          background: selected ? 'var(--note-yellow)' : 'var(--paper)',
                          borderColor: selected ? 'var(--ink)' : 'var(--pencil)',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span
                          style={{
                            width: 24, height: 24, borderRadius: '50%',
                            border: `2px solid ${selected ? 'var(--ink)' : 'var(--pencil)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            font: "12px/1 var(--mono)",
                            background: selected ? 'var(--ink)' : 'transparent',
                            color: selected ? 'var(--paper)' : 'var(--pencil)',
                            flexShrink: 0,
                          }}
                        >
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span style={{ fontSize: 15 }}>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="hd-flex-between" style={{ marginTop: 20 }}>
              <button
                className="hd-btn secondary small"
                onClick={() => setCurrent(c => c - 1)}
                disabled={current === 0}
              >
                <span className="hd-flex" style={{ gap: 4 }}><IconArrowLeft /> 上一题</span>
              </button>
              <button
                className="hd-btn small"
                onClick={handleNext}
                disabled={answers[questionId] === undefined || submitting}
                style={{ background: 'var(--highlight)', color: 'var(--ink)' }}
              >
                <span className="hd-flex" style={{ gap: 4 }}>
                  {submitting ? '提交中...' : isLast ? '提交' : '下一题'}
                  {!isLast && !submitting && <IconArrowRight />}
                </span>
              </button>
            </div>

            {/* Question dots */}
            <div className="hd-flex" style={{ justifyContent: 'center', gap: 8, marginTop: 20 }}>
              {questions.map((_: any, i: number) => {
                const qId = questions[i]?.id || i.toString();
                const answered = answers[qId] !== undefined;
                return (
                  <span
                    key={i}
                    style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: i === current
                        ? 'var(--ink)'
                        : answered
                        ? 'var(--highlight)'
                        : 'var(--rule)',
                      border: `1.5px solid ${i === current ? 'var(--ink)' : 'var(--pencil)'}`,
                      transition: 'all 0.15s',
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Result screen ────────────────────────────────── */
  const passed = result?.passed;

  return (
    <div className="hd-page">
      <div className="hd-page-wrap">
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div className="hd-header">
            <div className="hd-flex" style={{ gap: 14 }}>
              <span style={{ color: 'var(--highlight)' }}><IconBolt /></span>
              <h1>速测结果</h1>
            </div>
          </div>

          {/* Score card */}
          <div className="hd-card-accent" style={{ textAlign: 'center', marginTop: 20 }}>
            <div
              style={{
                width: 100, height: 100, borderRadius: '50%',
                border: `4px solid ${passed ? '#3a7d3a' : 'var(--accent)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
                background: passed ? 'var(--note-green)' : 'var(--note-pink)',
              }}
            >
              <span style={{ font: "800 36px/1 var(--serif)", color: passed ? '#3a7d3a' : 'var(--accent)' }}>
                {result?.score ?? 0}
              </span>
            </div>

            <h2 style={{ font: "800 24px/1.2 var(--serif)", marginBottom: 8 }}>
              {passed ? '速测通过！' : '继续加油！'}
            </h2>
            <p style={{ color: 'var(--pencil)', marginBottom: 20 }}>
              得分 {result?.score} 分 · 答对 {result?.correctCount}/{result?.totalCount} 题
            </p>

            {passed && (
              <div className="hd-badge green" style={{ marginBottom: 20 }}>
                技能确认：{skillName}
              </div>
            )}

            <div className="hd-divider" />

            <div className="hd-flex" style={{ justifyContent: 'center', gap: 10, marginTop: 16 }}>
              <button className="hd-btn secondary small" onClick={() => navigate('/user/home')}>
                <span className="hd-flex" style={{ gap: 4 }}><IconHome /> 返回主页</span>
              </button>
              <button className="hd-btn small" onClick={handleRetry}>
                <span className="hd-flex" style={{ gap: 4 }}><IconRefresh /> 再测一次</span>
              </button>
            </div>
          </div>

          {/* Answer details */}
          {result?.results && result.results.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div className="hd-section-label">
                <h3>答题详情</h3>
              </div>
              <div className="hd-flex-col" style={{ gap: 10 }}>
                {result.results.map((r: any, i: number) => (
                  <div key={i} className="hd-card">
                    <div className="hd-flex" style={{ gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ color: r.correct ? '#3a7d3a' : 'var(--accent)', flexShrink: 0, marginTop: 2 }}>
                        {r.correct ? <IconCheck /> : <IconX />}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ marginBottom: 4 }}>
                          {questions[i]?.title || `第 ${i + 1} 题`}
                        </div>
                        {r.explanation && (
                          <div style={{ fontSize: 13, color: 'var(--pencil)' }}>
                            {r.explanation}
                          </div>
                        )}
                      </div>
                      <span className={`hd-badge ${r.correct ? 'green' : 'red'}`}>
                        {r.correct ? '正确' : '错误'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sticky note encouragement */}
          {!passed && (
            <div className="hd-note pink" style={{ margin: '24px auto 0', maxWidth: 240 }}>
              <div className="hd-note-tape" />
              <b>别灰心！</b>回去复习一下薄弱环节，再来挑战吧。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

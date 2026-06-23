import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { startExam, submitExam } from '../../api/user';
import '../../styles/hand-draw.css';
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconX,
  IconClock,
  IconLightbulb,
  IconRefresh,
  IconTrophy,
  IconDocument,
  IconWarning,
} from '../../components/icons';

/** 状态中文映射 */
const QTYPE_LABEL: Record<string, string> = {
  choice: '选择题',
  fill: '填空题',
  coding: '编程题',
  essay: '简答题',
};

export default function ExamTake() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 答题状态
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Timer
  const [seconds, setSeconds] = useState(0);
  // §24.1 总时限（秒）；0 表示无限制
  const [timeLimitSec, setTimeLimitSec] = useState(0);
  // 每题用时累计（防作弊行为记录）
  const timingsRef = useRef<Record<string, number>>({});
  const questionEnterRef = useRef<number>(Date.now());

  useEffect(() => {
    const fetchExam = async () => {
      if (!id) return;
      setLoading(true);
      try {
        // §24.1 通过 startExam 随机抽题+选项乱序
        const res = await startExam(parseInt(id, 10));
        const data = res.data;
        setExam(data);
        if (data?.questions) {
          setQuestions(data.questions);
          setTimeLimitSec(data.timeLimitSec || 0);
        }
      } catch (err: any) {
        setError(err?.message || '加载失败');
      } finally {
        setLoading(false);
        questionEnterRef.current = Date.now();
      }
    };
    fetchExam();
  }, [id]);

  // 记录离开当前题的用时
  const recordTiming = () => {
    if (!questions[current]) return;
    const qid = questions[current].id ?? current.toString();
    const elapsed = (Date.now() - questionEnterRef.current) / 1000;
    timingsRef.current[qid] = (timingsRef.current[qid] || 0) + elapsed;
    questionEnterRef.current = Date.now();
  };

  // Timer tick — 倒计时（有时限）或正计时（无时限）
  useEffect(() => {
    if (submitted || loading) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [submitted, loading]);

  // §24.1 时间到自动交卷
  useEffect(() => {
    if (timeLimitSec > 0 && seconds >= timeLimitSec && !submitted && !loading) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, timeLimitSec, submitted, loading]);

  const question = questions[current];
  const isLast = current === questions.length - 1;

  const handleSelect = (value: any) => {
    const questionId = question.id || current.toString();
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    recordTiming();
    if (isLast) {
      handleSubmit();
    } else {
      setCurrent((c) => c + 1);
    }
  };

  const handleSubmit = async () => {
    if (!id || submitting) return;
    recordTiming();
    setSubmitting(true);
    try {
      const res = await submitExam({
        examId: exam?.examId || parseInt(id, 10),
        exam_type: exam?.examType || 1,
        skill_name: exam?.skillName,
        answers,
        questionTimings: timingsRef.current,
      });
      setResult(res.data);
      setSubmitted(true);
    } catch (e: any) {
      console.error('Submit failed:', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="hd-page">
        <div className="hd-loading">正在加载考试...</div>
      </div>
    );
  }

  /* ─── Error ─── */
  if (error) {
    return (
      <div className="hd-page">
        <div className="hd-empty">
          <IconWarning size={40} style={{ margin: '0 auto 12px', color: 'var(--accent)' }} />
          <p style={{ fontWeight: 700 }}>{error}</p>
          <button className="hd-btn small" style={{ marginTop: 16 }} onClick={() => navigate('/user/exams')}>
            返回考试列表
          </button>
        </div>
      </div>
    );
  }

  /* ─── Results page ─── */
  if (submitted && result) {
    const score = result.score || 0;
    const passed = result.passed === 1 || result.passed === true || score >= 60;
    const wrongAnalysis = result.wrongAnalysis || {};
    const weakPoints = wrongAnalysis.weakPoints || wrongAnalysis.wrongQuestions || [];
    const reinforcementPlan = wrongAnalysis.reinforcementPlan || {};

    return (
      <div className="hd-page">
        <div className="hd-page-wrap" style={{ maxWidth: 720 }}>
          {/* Back button */}
          <button className="hd-btn secondary small" onClick={() => navigate('/user/exams')} style={{ marginBottom: 20 }}>
            <IconArrowLeft size={16} /> 返回考试列表
          </button>

          {/* Score card */}
          <div
            className="hd-canvas"
            style={{
              textAlign: 'center',
              background: passed ? 'var(--note-green)' : 'var(--note-pink)',
            }}
          >
            <IconTrophy size={48} style={{ color: passed ? '#3a7d3a' : 'var(--accent)', margin: '0 auto 12px' }} />
            <div
              style={{
                fontFamily: 'var(--serif)',
                fontSize: 56,
                fontWeight: 800,
                color: passed ? '#3a7d3a' : 'var(--accent)',
              }}
            >
              {score}分
            </div>
            <div style={{ fontFamily: 'var(--hand-bold)', fontSize: 22, color: 'var(--ink)', marginTop: 6 }}>
              {passed ? '考试通过！' : '未通过'}
            </div>
            <div style={{ fontFamily: 'var(--hand)', fontSize: 15, color: 'var(--pencil)', marginTop: 6 }}>
              答对 {result.summary?.correctCount || '?'}/{result.summary?.totalQuestions || questions.length} 题
              {' '}&middot;{' '}用时 {formatTime(seconds)}
            </div>

            {!passed && (
              <button
                className="hd-btn highlight"
                style={{ marginTop: 18 }}
                onClick={() => {
                  setAnswers({});
                  setCurrent(0);
                  setSubmitted(false);
                  setResult(null);
                  setSeconds(0);
                }}
              >
                <IconRefresh size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
                重新考试
              </button>
            )}
          </div>

          {/* Weak points analysis */}
          {weakPoints.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div className="hd-section-label">
                <h3>薄弱知识点</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {weakPoints.map((w: any, i: number) => (
                  <div key={i} className="hd-card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <IconX size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--hand-bold)', fontSize: 15, color: 'var(--ink)' }}>{w.skill}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                        {w.errorCount > 0 && <span className="hd-badge red">错 {w.errorCount} 题</span>}
                        {w.errorRate > 0 && <span className="hd-tag">错误率 {Math.round(w.errorRate * 100)}%</span>}
                      </div>
                      {w.description && (
                        <div style={{ fontFamily: 'var(--hand)', fontSize: 13, color: 'var(--pencil)', marginTop: 8 }}>
                          {w.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reinforcement plan */}
          {(reinforcementPlan.tasks?.length > 0 || reinforcementPlan.skills?.length > 0) && (
            <div
              className="hd-card-accent"
              style={{ marginTop: 24, background: 'var(--note-yellow)' }}
            >
              <div className="hd-flex" style={{ marginBottom: 10 }}>
                <IconLightbulb size={18} style={{ color: 'var(--accent)' }} />
                <span style={{ fontFamily: 'var(--hand-bold)', fontSize: 17, color: 'var(--ink)' }}>补强计划</span>
              </div>
              {reinforcementPlan.estimatedDays && (
                <p style={{ fontFamily: 'var(--hand)', fontSize: 14, color: 'var(--pencil)', marginBottom: 14 }}>
                  预计 {reinforcementPlan.estimatedDays} 天完成补强
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* New format: tasks */}
                {reinforcementPlan.tasks?.map((t: any, i: number) => (
                  <div
                    key={i}
                    className="hd-card"
                    style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                  >
                    <span className="hd-badge accent">
                      {t.taskType === 'review' ? '复习' : t.taskType === 'practice' ? '练习' : '编码'}
                    </span>
                    <span style={{ fontFamily: 'var(--hand)', fontSize: 15, color: 'var(--ink)', flex: 1 }}>
                      {t.description}
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--pencil)' }}>
                      {t.estimatedMinutes}min
                    </span>
                  </div>
                ))}
                {/* Legacy format: skills */}
                {!reinforcementPlan.tasks?.length && reinforcementPlan.skills?.map((s: any, i: number) => (
                  <div
                    key={i}
                    className="hd-card"
                    style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                  >
                    <span className="hd-badge accent">P{s.priority}</span>
                    <span style={{ fontFamily: 'var(--hand)', fontSize: 15, color: 'var(--ink)', flex: 1 }}>
                      {s.name}
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--pencil)' }}>
                      {s.estimatedMinutes}min
                    </span>
                  </div>
                ))}
              </div>
              {reinforcementPlan.resources?.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {reinforcementPlan.resources.map((r: string, i: number) => (
                    <span key={i} className="hd-tag">{r}</span>
                  ))}
                </div>
              )}
              <button
                className="hd-btn small"
                style={{ marginTop: 14 }}
                onClick={() => navigate('/user/learning')}
              >
                开始补强学习
              </button>
            </div>
          )}

          {/* Answer details */}
          <div style={{ marginTop: 24 }}>
            <div className="hd-section-label">
              <h3>答题详情</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {questions.map((q, i) => {
                const questionId = q.id || i.toString();
                const userAnswer = answers[questionId];
                const isCorrect = userAnswer === q.answer;

                return (
                  <div key={i} className="hd-card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    {isCorrect ? (
                      <IconCheck size={18} style={{ color: '#3a7d3a', flexShrink: 0, marginTop: 2 }} />
                    ) : (
                      <IconX size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                    )}
                    <div>
                      <div style={{ fontFamily: 'var(--hand)', fontSize: 15, color: 'var(--ink)' }}>
                        {i + 1}. {q.question || q.title}
                      </div>
                      {q.options && (
                        <div style={{ fontFamily: 'var(--hand)', fontSize: 13, color: 'var(--pencil)', marginTop: 4 }}>
                          你的答案：{q.options[userAnswer] ?? '未作答'} &middot; 正确答案：{q.options[q.answer]}
                        </div>
                      )}
                      {q.explanation && (
                        <div style={{ fontFamily: 'var(--hand)', fontSize: 12, color: 'var(--rule)', marginTop: 4 }}>
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── No question ─── */
  if (!question) {
    return (
      <div className="hd-page">
        <div className="hd-empty">
          <IconDocument size={40} style={{ margin: '0 auto 12px', color: 'var(--pencil)' }} />
          <p style={{ fontWeight: 700 }}>没有题目</p>
          <button className="hd-btn small" style={{ marginTop: 16 }} onClick={() => navigate('/user/exams')}>
            返回
          </button>
        </div>
      </div>
    );
  }

  const questionId = question.id || current.toString();
  const progressPct = Math.round(((current + 1) / questions.length) * 100);

  /* ─── Answering ─── */
  return (
    <div className="hd-page">
      <div className="hd-page-wrap" style={{ maxWidth: 720 }}>
        {/* Header */}
        <div className="hd-header">
          <button className="hd-btn secondary small" onClick={() => navigate('/user/exams')}>
            <IconArrowLeft size={16} /> 退出考试
          </button>
          <div className="hd-flex">
            <IconClock size={16} style={{ color: 'var(--pencil)' }} />
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 14,
              color: timeLimitSec > 0 && timeLimitSec - seconds <= 60 ? 'var(--accent)' : 'var(--pencil)',
            }}>
              {timeLimitSec > 0 ? formatTime(Math.max(0, timeLimitSec - seconds)) : formatTime(seconds)}
            </span>
            <span className="hd-pill">
              {current + 1} / {questions.length}
            </span>
            {question.type && (
              <span className="hd-tag">{QTYPE_LABEL[question.type] || question.type}</span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="hd-progress" style={{ marginBottom: 20 }}>
          <div className="hd-progress-bar blue" style={{ width: `${progressPct}%` }} />
        </div>

        {/* Question number navigation */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          {questions.map((_, i) => {
            const qid = questions[i].id || i.toString();
            const answered = answers[qid] !== undefined;
            const isCurrentNav = i === current;

            return (
              <button
                key={i}
                onClick={() => { recordTiming(); setCurrent(i); }}
                style={{
                  width: 34,
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--mono)',
                  fontSize: 13,
                  border: `2px solid ${isCurrentNav ? 'var(--accent)' : 'var(--pencil)'}`,
                  borderRadius: 6,
                  background: isCurrentNav
                    ? 'var(--accent)'
                    : answered
                    ? 'var(--highlight)'
                    : 'var(--paper)',
                  color: isCurrentNav ? 'var(--paper)' : 'var(--ink)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {/* Question card */}
        <div className="hd-canvas">
          <h2 style={{ fontFamily: 'var(--hand-bold)', fontSize: 18, color: 'var(--ink)', marginBottom: 20 }}>
            {question.question || question.title}
          </h2>

          {/* Choice */}
          {question.type === 'choice' && question.options && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {question.options.map((opt: string, i: number) => {
                const selected = answers[questionId] === i;
                return (
                  <label
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '12px 14px',
                      border: `2px solid ${selected ? 'var(--accent)' : 'var(--pencil)'}`,
                      borderRadius: 8,
                      background: selected ? 'var(--note-yellow)' : 'var(--paper-tint)',
                      cursor: 'pointer',
                      fontFamily: 'var(--hand)',
                      fontSize: 15,
                      transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="radio"
                      name={`exam-q-${questionId}`}
                      checked={selected}
                      onChange={() => handleSelect(i)}
                      style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                    />
                    <span style={{ color: 'var(--ink)' }}>{opt}</span>
                  </label>
                );
              })}
            </div>
          )}

          {/* Fill */}
          {question.type === 'fill' && (
            <input
              className="hd-input"
              type="text"
              placeholder="输入答案"
              value={answers[questionId] || ''}
              onChange={(e) => handleSelect(e.target.value)}
            />
          )}

          {/* Coding / Essay */}
          {(question.type === 'coding' || question.type === 'essay') && (
            <textarea
              className="hd-textarea"
              rows={10}
              placeholder={question.template || '输入你的答案'}
              value={answers[questionId] || ''}
              onChange={(e) => handleSelect(e.target.value)}
              style={{ fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.6 }}
            />
          )}

          {/* Hint */}
          {question.hint && (
            <div className="hd-dashed" style={{ marginTop: 16, fontSize: 13, color: 'var(--pencil)' }}>
              <IconLightbulb size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              提示：{question.hint}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="hd-flex-between" style={{ marginTop: 20 }}>
          <button
            className="hd-btn secondary small"
            onClick={() => setCurrent((c) => c - 1)}
            disabled={current === 0}
          >
            <IconArrowLeft size={16} /> 上一题
          </button>
          <button
            className="hd-btn"
            onClick={handleNext}
            disabled={answers[questionId] === undefined || submitting}
            style={{ minWidth: 110 }}
          >
            {submitting ? '提交中...' : isLast ? '提交' : '下一题'}
            {!isLast && !submitting && <IconArrowRight size={16} style={{ marginLeft: 6, verticalAlign: -3 }} />}
          </button>
        </div>
      </div>
    </div>
  );
}

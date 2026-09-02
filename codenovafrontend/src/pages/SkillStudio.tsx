import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock3,
  Code2,
  Gauge,
  Library,
  Loader2,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Terminal,
  Trophy,
} from 'lucide-react';
import {
  agentApi,
  skillApi,
  type MasteryBreakdown,
  type SkillContent,
} from '../lib/api';
import { setPendingQuestionConfig } from '../lib/questionGeneratorConfig';
import { EVENT_TYPES, useStreamEvents } from '../lib/sse';
import { toast } from '../store/toast';
import { Markdown } from '../components/Markdown';
import {
  Banner,
  Bar,
  Button,
  Card,
  CardBody,
  CardHead,
  Empty,
  LoadingBlock,
  Tag,
  WeightBar,
} from '../components/ui';

type StepKey = 'lecture' | 'quiz' | 'code' | 'assess';

const STEPS: Array<{ key: StepKey; label: string; weight: number; icon: ReactNode }> = [
  { key: 'lecture', label: '讲义', weight: 30, icon: <BookOpen size={14} /> },
  { key: 'quiz', label: '测验', weight: 25, icon: <CheckCircle2 size={14} /> },
  { key: 'code', label: '实操', weight: 25, icon: <Code2 size={14} /> },
  { key: 'assess', label: '评估', weight: 20, icon: <Gauge size={14} /> },
];

const POLL_INTERVAL = 3000;
const MAX_POLLS = 30; // 最多等 90 秒，超时后交回用户手动重试

/**
 * 把题目里的 answer 解析成 options 下标。
 * 后端历史数据里存在两种脏值：模型照抄模板留下的常量 0，以及直接给字母 "B"。
 * 直接 Number("B") 会得到 NaN，导致选对也被判错，所以这里做与后端一致的归一化。
 */
function resolveAnswerIndex(question: any): number | null {
  const options = question?.options;
  if (!Array.isArray(options) || options.length < 2) return null;
  const raw = question?.answer;

  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < options.length) {
    return raw;
  }
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (/^\d+$/.test(text)) {
      const n = Number(text);
      return n >= 0 && n < options.length ? n : null;
    }
    const letter = text.match(/^([A-Za-z])/);
    if (letter) {
      const n = letter[1].toUpperCase().charCodeAt(0) - 65;
      return n >= 0 && n < options.length ? n : null;
    }
    const exact = options.findIndex((o) => String(o).trim() === text);
    if (exact >= 0) return exact;
    const prefixed = options.findIndex((o) => String(o).trim().startsWith(text));
    if (prefixed >= 0) return prefixed;
  }
  return null;
}

export default function SkillStudio() {
  const { skill = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const skillName = decodeURIComponent(skill);
  const planId = searchParams.get('plan') ? Number(searchParams.get('plan')) : 0;

  const [step, setStep] = useState<StepKey>('lecture');
  const [content, setContent] = useState<SkillContent | null>(null);
  const [mastery, setMastery] = useState<MasteryBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [waitedSec, setWaitedSec] = useState(0);
  const [acting, setActing] = useState(false);

  // 测验
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean } | null>(null);

  // 实操
  const [codeMap, setCodeMap] = useState<Record<number, string>>({});
  const [consoleOut, setConsoleOut] = useState<Record<number, string>>({});

  // 评估
  const [assessment, setAssessment] = useState<any>(null);
  const [assessing, setAssessing] = useState(false);

  const pollCount = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadContent = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const result = await skillApi.content(skillName);
        setContent(result);
        setError(null);
        return result;
      } catch (err: any) {
        if (!silent) setError(err?.message || '加载失败');
        return null;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [skillName],
  );

  const loadMastery = useCallback(async () => {
    try {
      const result = await skillApi.mastery(skillName);
      setMastery(result);
    } catch {
      // 掌握度读不到不阻塞学习流程
    }
  }, [skillName]);

  // 首次加载 + 内容生成轮询
  useEffect(() => {
    let alive = true;
    setWaitedSec(0);
    pollCount.current = 0;

    const run = async () => {
      const result = await loadContent();
      if (!alive) return;

      if (result && !result.has_content) {
        setGenerating(true);
        const poll = async () => {
          if (!alive) return;
          pollCount.current += 1;
          setWaitedSec(pollCount.current * (POLL_INTERVAL / 1000));

          const next = await loadContent(true);
          if (!alive) return;

          if (next?.has_content) {
            setGenerating(false);
            setContent(next);
            toast.success('内容已生成', `${skillName} 的讲义、测验和实操已就绪`);
            return;
          }
          if (pollCount.current < MAX_POLLS) {
            pollTimer.current = setTimeout(poll, POLL_INTERVAL);
          } else {
            setGenerating(false);
            setError('生成超时了。后端可能繁忙或模型未配置，可以稍后重试。');
          }
        };
        pollTimer.current = setTimeout(poll, POLL_INTERVAL);
      }
    };

    run();
    loadMastery();

    return () => {
      alive = false;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [skillName, loadContent, loadMastery]);

  // 后端通知资源就绪时，主动拉一次，避免干等轮询
  useStreamEvents(EVENT_TYPES.RESOURCE_READY, (event) => {
    if (event.data?.skill_name === skillName) {
      loadContent(true).then((next) => {
        if (next?.has_content) {
          setContent(next);
          setGenerating(false);
        }
      });
    }
  });

  /** 统一处理进度回包：把 +delta% / 匹配度变化 / commit 讲给用户听 */
  const reportProgress = useCallback((result: any, fallback: string) => {
    const delta = Number(result?.delta || 0);
    const masteryPct = Number(result?.masteryPct || 0);
    const matchDelta = result?.matchSummary?.best?.matchScore ?? result?.gitDelta?.metricsChange?.matchScore;

    const parts: string[] = [];
    if (delta > 0) parts.push(`掌握度 +${delta}% → ${Math.round(masteryPct)}%`);
    if (typeof matchDelta === 'number' && matchDelta !== 0) parts.push(`匹配度 ${matchDelta > 0 ? '+' : ''}${matchDelta}%`);
    if (result?.commit?.id) parts.push(`已记录 #${result.commit.id}`);

    toast.success(fallback, parts.join(' · ') || result?.message || undefined);
    loadMastery();
  }, [loadMastery]);

  const markRead = async () => {
    setActing(true);
    try {
      const result = await skillApi.markRead(skillName, planId);
      reportProgress(result, '讲义已读完');
      setStep('quiz');
    } catch (err: any) {
      toast.error('提交失败', err?.message || '');
    } finally {
      setActing(false);
    }
  };

  const submitQuiz = async () => {
    const questions = content?.quiz || [];
    if (questions.length === 0) return;
    let correct = 0;
    questions.forEach((question, index) => {
      const picked = answers[index];
      const right = resolveAnswerIndex(question);
      if (right !== null && picked === right) correct += 1;
    });
    setActing(true);
    try {
      const result = await skillApi.submitQuiz(skillName, questions.length, correct, planId);
      setQuizResult({ score: result.score ?? 0, passed: Boolean(result.passed) });
      reportProgress(result, result.passed ? '测验通过' : '测验未通过');
      if (result.passed) setTimeout(() => setStep('code'), 900);
    } catch (err: any) {
      toast.error('提交失败', err?.message || '');
    } finally {
      setActing(false);
    }
  };

  const finishCode = async () => {
    setActing(true);
    try {
      const result = await skillApi.markCode(skillName, planId);
      reportProgress(result, '实操已完成');
      setStep('assess');
    } catch (err: any) {
      toast.error('提交失败', err?.message || '');
    } finally {
      setActing(false);
    }
  };

  const completeSkill = async () => {
    setActing(true);
    try {
      const result = await skillApi.complete(skillName, planId);
      reportProgress(result, result.phase_completed ? '阶段完成' : '能力项已掌握');
      if (result.phase_completed) {
        toast.info('可以进入下一阶段了', '去路径页看看下一阶段的安排');
      }
    } catch (err: any) {
      toast.error('提交失败', err?.message || '');
    } finally {
      setActing(false);
    }
  };

  const runAssessment = async () => {
    setAssessing(true);
    try {
      const learningData = [
        `技能：${skillName}`,
        `讲义：${mastery?.breakdown?.lecture?.done ? '已读完' : '未读完'}`,
        `测验：${mastery?.breakdown?.quiz?.done ? '已通过' : '未通过'}`,
        `实操：${mastery?.breakdown?.code?.done ? '已完成' : '未完成'}`,
        `当前掌握度：${Math.round(mastery?.masteryPct || 0)}%`,
      ].join('\n');
      const result = await agentApi.assess({
        learningData,
        skillName,
        goal: 'AI 原生软件开发',
        currentProgress: `掌握度 ${Math.round(mastery?.masteryPct || 0)}%`,
      });
      setAssessment(result);
      toast.success('评估完成', `综合得分 ${Math.round(result.overallScore || 0)}`);
      loadMastery();
    } catch (err: any) {
      toast.error('评估失败', err?.message || '');
    } finally {
      setAssessing(false);
    }
  };

  const runCode = (index: number, code: string) => {
    const logs: string[] = [];
    const fakeConsole = {
      log: (...args: any[]) => logs.push(args.map((item) => formatValue(item)).join(' ')),
      error: (...args: any[]) => logs.push(`[error] ${args.map((item) => formatValue(item)).join(' ')}`),
      warn: (...args: any[]) => logs.push(`[warn] ${args.map((item) => formatValue(item)).join(' ')}`),
      info: (...args: any[]) => logs.push(args.map((item) => formatValue(item)).join(' ')),
    };

    try {
      // 本地沙箱：只用于演示执行结果，不做判题
      const fn = new Function('console', `"use strict";\n${code}`);
      fn(fakeConsole);
      if (logs.length === 0) logs.push('（代码已执行，没有 console 输出）');
    } catch (err: any) {
      logs.push(`[错误] ${err?.message || String(err)}`);
    }
    setConsoleOut((prev) => ({ ...prev, [index]: logs.join('\n') }));
  };

  const weightSegments = useMemo(() => {
    const breakdown = mastery?.breakdown || {};
    return STEPS.map((item) => ({
      label: item.label,
      weight: item.weight,
      done: Boolean(breakdown[item.key === 'assess' ? 'exam' : item.key]?.done),
    }));
  }, [mastery]);

  const stepDone = (key: StepKey) => {
    const breakdown = mastery?.breakdown || {};
    return Boolean(breakdown[key === 'assess' ? 'exam' : key]?.done);
  };

  const questions = content?.quiz || [];
  const problems = content?.coding || [];
  const readings = content?.reading || [];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="page page--narrow" style={{ margin: '0 auto' }}>
      {/* 头部 */}
      <div className="col" style={{ gap: 12 }}>
        <button
          type="button"
          className="btn btn--quiet btn--sm"
          onClick={() => navigate('/path')}
          style={{ alignSelf: 'flex-start' }}
        >
          <ArrowLeft size={14} />
          返回路径
        </button>

        <div className="row-between wrap">
          <h1 style={{ fontSize: 23 }}>{skillName}</h1>
          <div className="row" style={{ gap: 10 }}>
            <Tag tone="brand" icon={<Gauge size={11} />}>
              掌握度 {Math.round(mastery?.masteryPct || 0)}%
            </Tag>
            {mastery?.trustWeight !== undefined && (
              <Tag tone="outline">可信权重 {Math.round((mastery.trustWeight || 0) * 100)}%</Tag>
            )}
          </div>
        </div>

        <div className="col" style={{ gap: 5 }}>
          <Bar
            value={mastery?.masteryPct || 0}
            tone={(mastery?.masteryPct || 0) >= 100 ? 'green' : undefined}
          />
          <WeightBar segments={weightSegments} />
        </div>
      </div>

      {/* 闭环导航 */}
      <div className="loop-nav">
        {STEPS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`loop-step ${stepDone(item.key) ? 'is-done' : ''}`}
            aria-current={step === item.key ? 'step' : undefined}
            onClick={() => setStep(item.key)}
          >
            <span className="loop-step__mark">
              {stepDone(item.key) ? <CheckCircle2 size={14} strokeWidth={3} /> : item.icon}
            </span>
            <span className="grow" style={{ textAlign: 'left' }}>
              <span className="loop-step__label" style={{ display: 'block' }}>
                {item.label}
              </span>
              <span className="loop-step__weight">完成后 +{item.weight}%</span>
            </span>
          </button>
        ))}
      </div>

      {error && (
        <Banner tone="error">
          {error}
          <div style={{ marginTop: 8 }}>
            <Button size="sm" variant="ghost" onClick={() => loadContent()}>
              重试
            </Button>
          </div>
        </Banner>
      )}

      {/* 生成中：说清在等什么、等了多久 */}
      {generating && (
        <Card>
          <CardHead
            icon={<Loader2 size={15} className="btn__spinner" />}
            title="正在为你生成学习内容"
            extra={<Tag tone="amber">已等待 {waitedSec}s</Tag>}
          />
          <CardBody className="col" style={{ gap: 12 }}>
            <p style={{ fontSize: 13.5, lineHeight: 1.7 }}>
              这个能力项在知识库里还没有现成内容，后端已经派出 Agent 现场生成：
              <strong>定制讲义</strong>、<strong>分阶测验</strong>、<strong>实操任务</strong> 三条线并行跑，
              通常 15-60 秒。生成结果会存进知识库，下次进来直接可用。
            </p>
            <Bar value={Math.min(95, (waitedSec / 60) * 100)} flowing />
            <span className="tiny faint">
              页面会自动刷新，不用手动刷新。生成完成后会直接开始学习。
            </span>
          </CardBody>
        </Card>
      )}

      {loading && !generating && <LoadingBlock text="正在读取学习内容" />}

      {!loading && !generating && content?.has_content && (
        <>
          {/* 讲义 */}
          {step === 'lecture' && (
            <Card>
              <CardHead
                icon={<BookOpen size={15} />}
                title="定制讲义"
                extra={stepDone('lecture') ? <Tag tone="green">已读完</Tag> : <Tag tone="outline">+30%</Tag>}
              />
              <CardBody>
                {content.lecture ? (
                  <Markdown source={content.lecture} />
                ) : (
                  <Empty
                    icon={<BookOpen size={20} />}
                    title="这个能力项还没有讲义"
                    desc="可以让资源生成 Agent 现在写一份。"
                    action={
                      <Button
                        variant="soft"
                        loading={acting}
                        onClick={async () => {
                          setActing(true);
                          try {
                            const result = await agentApi.lecture(skillName, 'beginner');
                            setContent((prev) =>
                              prev ? { ...prev, lecture: result?.content || result?.markdown || null } : prev,
                            );
                            toast.success('讲义已生成');
                          } catch (err: any) {
                            toast.error('生成失败', err?.message || '');
                          } finally {
                            setActing(false);
                          }
                        }}
                      >
                        <Sparkles size={14} />
                        生成讲义
                      </Button>
                    }
                  />
                )}
              </CardBody>
              {content.lecture && !stepDone('lecture') && (
                <div className="card__foot row" style={{ justifyContent: 'space-between' }}>
                  <span className="tiny faint">读完点这里，掌握度 +30%，然后进入测验</span>
                  <Button variant="primary" onClick={markRead} loading={acting}>
                    <CheckCircle2 size={15} />
                    读完了，去测验
                  </Button>
                </div>
              )}
              {content.lecture && stepDone('lecture') && (
                <div className="card__foot row" style={{ justifyContent: 'flex-end' }}>
                  <Button variant="soft" onClick={() => setStep('quiz')}>
                    进入测验
                    <ArrowLeft size={14} style={{ transform: 'rotate(180deg)' }} />
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* 测验 */}
          {step === 'quiz' && (
            <Card>
              <CardHead
                icon={<CheckCircle2 size={15} />}
                title="分阶测验"
                extra={stepDone('quiz') ? <Tag tone="green">已通过</Tag> : <Tag tone="outline">+25%</Tag>}
              />
              <CardBody className="col" style={{ gap: 18 }}>
                {quizResult && (
                  <div className={`score-hero score-hero--${quizResult.passed ? 'pass' : 'fail'}`}>
                    <span className="score-hero__value">{quizResult.score}</span>
                    <span className="score-hero__label">
                      {quizResult.passed ? '通过，可以进入实操了' : '未达到通过线，建议回看讲义再试一次'}
                    </span>
                  </div>
                )}

                {/* 路径决策卡：测验正确率直接触发"补弱巩固 / 进阶挑战"决策 */}
                {quizResult && !quizResult.passed && (
                  <Banner tone="warning">
                    <div className="col" style={{ gap: 8 }}>
                      <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <ShieldCheck size={14} />
                        路径决策 Agent：补弱巩固
                      </strong>
                      <span>
                        本轮正确率 {quizResult.score}% 未达通过线。建议生成一组针对「{skillName}」的由浅入深补弱练习，练完再回来重测。
                      </span>
                      <div>
                        <Button size="sm" variant="primary" onClick={() => navigate(`/remediation?skill=${encodeURIComponent(skillName)}`)}>
                          <Target size={13} />
                          生成补弱练习
                        </Button>
                      </div>
                    </div>
                  </Banner>
                )}
                {quizResult && quizResult.passed && quizResult.score >= 90 && (
                  <Banner tone="success">
                    <div className="col" style={{ gap: 8 }}>
                      <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Trophy size={14} />
                        路径决策 Agent：进阶挑战
                      </strong>
                      <span>
                        本轮得分 {quizResult.score}，掌握度已领先。可以生成一组更高难度的综合应用题挑战自己，也可以先继续实操。
                      </span>
                      <div>
                        <Button
                          size="sm"
                          variant="soft"
                          onClick={() => {
                            setPendingQuestionConfig({
                              subject: skillName,
                              count: 5,
                              difficulty: 8,
                              questionTypes: ['choice', 'fill'],
                              topics: [{ label: skillName }],
                              instructions: '进阶挑战：学习者已通过基础测验，请生成更高难度的综合应用题，注重多步推理与工程场景。',
                            });
                            navigate('/questions');
                          }}
                        >
                          <Sparkles size={13} />
                          生成进阶挑战题
                        </Button>
                      </div>
                    </div>
                  </Banner>
                )}

                {questions.length === 0 ? (
                  <Empty
                    icon={<CheckCircle2 size={20} />}
                    title="还没有测验题"
                    desc="题目是在生成讲义时一起产出的。可以让资源生成 Agent 单独生成一组。"
                    action={
                      <Button variant="soft" onClick={() => loadContent()}>
                        刷新看看
                      </Button>
                    }
                  />
                ) : (
                  <>
                    {questions.map((question, qIndex) => {
                      const picked = answers[qIndex];
                      const right = resolveAnswerIndex(question);
                      const revealed = Boolean(quizResult);

                      return (
                        <div key={qIndex} className="quiz">
                          <div className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
                            <span className="tag tag--outline">{qIndex + 1}</span>
                            <span className="quiz__q">{question.question}</span>
                          </div>

                          <div className="quiz__options">
                            {(question.options || []).map((option, oIndex) => {
                              const isPicked = picked === oIndex;
                              const isRight = revealed && oIndex === right;
                              const isWrong = revealed && isPicked && oIndex !== right;
                              return (
                                <button
                                  key={oIndex}
                                  type="button"
                                  disabled={revealed}
                                  className={`quiz__option ${isPicked ? 'is-picked' : ''} ${
                                    isRight ? 'is-right' : ''
                                  } ${isWrong ? 'is-wrong' : ''}`}
                                  onClick={() =>
                                    setAnswers((prev) => ({ ...prev, [qIndex]: oIndex }))
                                  }
                                >
                                  <span className="quiz__key">
                                    {isRight ? '✓' : isWrong ? '✕' : String.fromCharCode(65 + oIndex)}
                                  </span>
                                  <span className="grow">{option}</span>
                                </button>
                              );
                            })}
                          </div>

                          {revealed && question.explanation && (
                            <div className="quiz__explain">
                              <strong>解析：</strong>
                              {question.explanation}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div className="row-between" style={{ paddingTop: 6, borderTop: '1px solid var(--border-soft)' }}>
                      <span className="tiny faint">
                        已作答 {answeredCount} / {questions.length} · 通过后掌握度 +25%
                      </span>
                      <div className="row" style={{ gap: 9 }}>
                        {quizResult && (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setQuizResult(null);
                              setAnswers({});
                            }}
                          >
                            <RotateCcw size={14} />
                            重做
                          </Button>
                        )}
                        <Button
                          variant="primary"
                          onClick={submitQuiz}
                          disabled={answeredCount < questions.length || Boolean(quizResult)}
                          loading={acting}
                        >
                          提交答案
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardBody>
            </Card>
          )}

          {/* 实操 */}
          {step === 'code' && (
            <Card>
              <CardHead
                icon={<Code2 size={15} />}
                title="编程实操"
                extra={stepDone('code') ? <Tag tone="green">已完成</Tag> : <Tag tone="outline">+25%</Tag>}
              />
              <CardBody className="col" style={{ gap: 18 }}>
                {problems.length === 0 ? (
                  <Empty
                    icon={<Code2 size={20} />}
                    title="还没有实操任务"
                    desc="可以让代码案例 Agent 现在生成一组，围绕这个能力项给出可运行的起点代码和验收点。"
                    action={
                      <Button
                        variant="soft"
                        loading={acting}
                        onClick={async () => {
                          setActing(true);
                          try {
                            const result = await agentApi.code(skillName);
                            const list = result?.problems || result?.coding || result?.cases || [];
                            if (list.length) {
                              setContent((prev) => (prev ? { ...prev, coding: list } : prev));
                              toast.success('实操任务已生成', `共 ${list.length} 题`);
                            } else {
                              toast.warn('生成完成但没有返回题目', '可以稍后刷新重试');
                            }
                          } catch (err: any) {
                            toast.error('生成失败', err?.message || '');
                          } finally {
                            setActing(false);
                          }
                        }}
                      >
                        <Sparkles size={14} />
                        生成实操任务
                      </Button>
                    }
                  />
                ) : (
                  <>
                    {problems.map((problem, pIndex) => {
                      const starter =
                        codeMap[pIndex] ?? problem.setup ?? problem.code ?? '// 在这里写下你的实现\n';
                      return (
                        <div key={pIndex} className="code-lab">
                          <div>
                            <h3 style={{ fontSize: 15 }}>{problem.title || `实操 ${pIndex + 1}`}</h3>
                            {problem.description && (
                              <p style={{ fontSize: 13.2, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.7 }}>
                                {problem.description}
                              </p>
                            )}
                          </div>

                          {problem.keyPoints?.length ? (
                            <div className="row wrap" style={{ gap: 6 }}>
                              {problem.keyPoints.map((point) => (
                                <Tag key={point} tone="brand">
                                  {point}
                                </Tag>
                              ))}
                            </div>
                          ) : null}

                          <textarea
                            className="code-lab__editor"
                            spellCheck={false}
                            value={starter}
                            onChange={(event) =>
                              setCodeMap((prev) => ({ ...prev, [pIndex]: event.target.value }))
                            }
                          />

                          <div className="row" style={{ gap: 8 }}>
                            <Button size="sm" variant="soft" onClick={() => runCode(pIndex, starter)}>
                              <Play size={13} />
                              运行
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setCodeMap((prev) => ({
                                  ...prev,
                                  [pIndex]: problem.setup ?? problem.code ?? '',
                                }))
                              }
                            >
                              <RotateCcw size={13} />
                              重置
                            </Button>
                            {(problem.hints?.length || 0) > 0 && (
                              <span className="tiny faint">提示：{problem.hints?.[0]}</span>
                            )}
                          </div>

                          <div className="code-lab__console">{consoleOut[pIndex] || ''}</div>
                        </div>
                      );
                    })}

                    <div className="row-between" style={{ paddingTop: 6, borderTop: '1px solid var(--border-soft)' }}>
                      <span className="tiny faint">
                        代码在你的浏览器本地运行，只用于验证思路，不会提交到服务器
                      </span>
                      <Button variant="primary" onClick={finishCode} loading={acting}>
                        <Trophy size={15} />
                        完成实操
                      </Button>
                    </div>
                  </>
                )}
              </CardBody>
            </Card>
          )}

          {/* 评估 */}
          {step === 'assess' && (
            <Card>
              <CardHead icon={<Gauge size={15} />} title="能力评估" extra={<Tag tone="outline">+20%</Tag>} />
              <CardBody className="col" style={{ gap: 16 }}>
                {!assessment ? (
                  <>
                    <p style={{ fontSize: 13.5, lineHeight: 1.75 }}>
                      评估 Agent 会综合你的讲义阅读、测验正确率、实操完成情况，
                      给出分维度评分和下一步建议。它同时会把这次结果写进能力档案。
                    </p>

                    <div className="grid grid--3">
                      {(mastery?.breakdown
                        ? Object.entries(mastery.breakdown)
                        : []
                      ).map(([key, value]: [string, any]) => (
                        <div className="metric" key={key}>
                          <span className="metric__label">{value.label}</span>
                          <span className="metric__value" style={{ fontSize: 18 }}>
                            {value.done ? '已完成' : '未完成'}
                          </span>
                          <span className="metric__foot">权重 +{value.weight}%</span>
                        </div>
                      ))}
                    </div>

                    <Button variant="primary" onClick={runAssessment} loading={assessing} block>
                      <Sparkles size={15} />
                      开始评估
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="row" style={{ gap: 16, alignItems: 'center' }}>
                      <div className="score-hero score-hero--pass" style={{ minWidth: 150, padding: '18px 24px' }}>
                        <span className="score-hero__value">{Math.round(assessment.overallScore || 0)}</span>
                        <span className="score-hero__label">{assessment.level || '综合得分'}</span>
                      </div>
                      <div className="grow">
                        <p style={{ fontSize: 13.5, lineHeight: 1.75 }}>
                          {assessment.summary || '评估已完成。'}
                        </p>
                        {assessment.encouragement && (
                          <p className="small muted" style={{ marginTop: 6 }}>
                            {assessment.encouragement}
                          </p>
                        )}
                      </div>
                    </div>

                    {(assessment.dimensions || []).length > 0 && (
                      <div className="col" style={{ gap: 10 }}>
                        <span className="small strong">分维度表现</span>
                        {(assessment.dimensions || []).map((dimension: any, index: number) => (
                          <div key={index} className="col" style={{ gap: 5 }}>
                            <div className="row-between">
                              <span className="small">{dimension.dimension || dimension.name}</span>
                              <span className="small strong">
                                {dimension.score}/{dimension.maxScore || 100}
                              </span>
                            </div>
                            <Bar
                              value={((dimension.score || 0) / (dimension.maxScore || 100)) * 100}
                              tone={(dimension.score || 0) >= 70 ? 'green' : 'amber'}
                            />
                            {dimension.detail && <span className="tiny faint">{dimension.detail}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {(assessment.weakPoints || []).length > 0 && (
                      <div className="col" style={{ gap: 8 }}>
                        <span className="small strong">还差的地方</span>
                        <div className="row wrap" style={{ gap: 7 }}>
                          {(assessment.weakPoints || []).map((point: any, index: number) => (
                            <Tag key={index} tone="rose">
                              {typeof point === 'string' ? point : point.point || point.name}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}

                    {(assessment.improvements || []).length > 0 && (
                      <div className="col" style={{ gap: 8 }}>
                        <span className="small strong">下一步建议</span>
                        {(assessment.improvements || []).map((item: any, index: number) => (
                          <div key={index} className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
                            <CheckCircle2 size={14} style={{ color: 'var(--brand-600)', marginTop: 3 }} />
                            <span className="small" style={{ lineHeight: 1.7 }}>
                              {typeof item === 'string' ? item : item.action || item.suggestion}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="row" style={{ gap: 9 }}>
                      <Button variant="ghost" onClick={() => setAssessment(null)}>
                        <RotateCcw size={14} />
                        重新评估
                      </Button>
                      <Button variant="primary" onClick={completeSkill} loading={acting}>
                        <Trophy size={15} />
                        确认掌握这个能力项
                      </Button>
                    </div>
                  </>
                )}
              </CardBody>
            </Card>
          )}

          {/* 拓展阅读 */}
          {readings.length > 0 && (
            <Card>
              <CardHead icon={<Library size={15} />} title="拓展阅读" extra={<Tag tone="outline">{readings.length} 篇</Tag>} />
              <CardBody>
                <div className="col" style={{ gap: 10 }}>
                  {readings.slice(0, 6).map((item, index) => (
                    <div key={index} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                      <BookOpen size={14} style={{ color: 'var(--text-faint)', marginTop: 3, flexShrink: 0 }} />
                      <div className="grow">
                        <span className="small strong">{item.title || '推荐阅读'}</span>
                        <p className="tiny muted" style={{ lineHeight: 1.65 }}>
                          {item.summary || item.why || ''}
                        </p>
                      </div>
                      {item.url && /^https?:/i.test(item.url) && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="btn btn--quiet btn--sm"
                        >
                          打开
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </>
      )}

      {!loading && !generating && content && !content.has_content && !error && (
        <Card>
          <Empty
            icon={<BookOpen size={22} />}
            title="这个能力项还没有学习内容"
            desc="后端没有返回内容，也没有触发生成。可以手动重试一次。"
            action={
              <Button variant="primary" onClick={() => loadContent()}>
                <RotateCcw size={14} />
                重新获取
              </Button>
            }
          />
        </Card>
      )}
    </div>
  );
}

function formatValue(value: any): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

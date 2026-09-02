import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  ListChecks,
  RefreshCw,
  Route as RouteIcon,
  Target,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { questionGenerationApi, remediationApi, type GeneratedQuestion, type QuestionGenerationSnapshot } from '../lib/api';
import { useAsync } from '../components/ui';
import { toast } from '../store/toast';
import {
  QuestionCard,
  answerLabel,
  gradeQuestion,
  questionKind,
  questionStem,
  type AnswerValue,
  type PracticeQuestion,
} from '../components/QuestionCard';
import {
  Banner,
  Button,
  Card,
  CardBody,
  CardHead,
  Choice,
  Empty,
  LoadingBlock,
  Metric,
  Range,
  SectionTitle,
  Segmented,
  Tag,
} from '../components/ui';

/**
 * 补弱决策页 —— 动态决策闭环的用户入口。
 *
 * 链路：弱项列表（掌握度<60） -> 生成补弱练习（严格出题管线） -> 作答自检
 *       -> 补强前后掌握度对比 -> 回技能页重测回写。
 * 由 SkillStudio 测验未通过时的"路径决策 Agent"卡片带 ?skill= 进入。
 */

type Phase = 'select' | 'generating' | 'practice';

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: '基础巩固', difficulty: 4 },
  { value: 'standard', label: '标准补弱', difficulty: 6 },
  { value: 'hard', label: '强化突破', difficulty: 8 },
] as const;

type DifficultyKey = (typeof DIFFICULTY_OPTIONS)[number]['value'];

export default function Remediation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusSkill = searchParams.get('skill') || '';

  const weak = useAsync(() => remediationApi.weakPoints(), []);
  const history = useAsync(() => remediationApi.history(8), []);

  const [phase, setPhase] = useState<Phase>('select');
  const [selected, setSelected] = useState<string[]>([]);
  const [count, setCount] = useState(5);
  const [difficultyKey, setDifficultyKey] = useState<DifficultyKey>('standard');
  const [generateMessage, setGenerateMessage] = useState('');

  const [taskId, setTaskId] = useState<number | null>(null);
  const [runId, setRunId] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<QuestionGenerationSnapshot | null>(null);

  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [checked, setChecked] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const weakPoints = weak.data || [];

  // 从 SkillStudio 带进来的技能名：不管当前是否真的低于阈值，都作为可选项给出
  const selectableTopics = useMemo(() => {
    const labels = weakPoints.map((item: any) => String(item.label || item.name || ''));
    if (focusSkill && !labels.includes(focusSkill)) labels.unshift(focusSkill);
    return labels.filter(Boolean);
  }, [weakPoints, focusSkill]);

  useEffect(() => {
    if (selected.length === 0 && selectableTopics.length > 0) {
      setSelected(focusSkill ? [focusSkill] : [selectableTopics[0]]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectableTopics.join('|')]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const difficulty = DIFFICULTY_OPTIONS.find((item) => item.value === difficultyKey)?.difficulty ?? 6;

  const questions: PracticeQuestion[] = useMemo(
    () => (Array.isArray(snapshot?.questions) ? (snapshot!.questions as GeneratedQuestion[]) : []),
    [snapshot],
  );

  const startGenerate = async () => {
    if (selected.length === 0) {
      toast.warn('先选择要补弱的能力项');
      return;
    }
    setPhase('generating');
    setGenerateMessage('正在按"由浅入深"策略创建补弱出题任务…');
    try {
      const result = await remediationApi.generate({
        topics: selected.map((label) => ({ label })),
        count,
        difficulty,
      });
      setTaskId(result.taskId);
      setRunId(result.runId ?? null);
      setGenerateMessage(`出题任务 #${result.taskId} 已启动，多智能体正在检索知识库并生成题目…`);
      pollSnapshot(result.taskId);
    } catch (err: any) {
      toast.error('补弱任务创建失败', err?.message || '');
      setPhase('select');
    }
  };

  const pollSnapshot = (id: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      if (attempts > 120) {
        clearInterval(pollRef.current!);
        toast.error('生成超时', '任务仍在后台执行，稍后可从出题器查看进度');
        setPhase('select');
        return;
      }
      try {
        const snap = await questionGenerationApi.snapshot(id);
        setSnapshot(snap);
        if (snap.taskStatus === 'completed') {
          clearInterval(pollRef.current!);
          if ((snap.questions?.length || 0) > 0) {
            setPhase('practice');
            setChecked(false);
            setAnswers({});
          } else {
            toast.error('没有生成可用题目', snap.errorMessage || '请调整配置重试');
            setPhase('select');
          }
        } else if (snap.taskStatus === 'failed' || snap.taskStatus === 'cancelled') {
          clearInterval(pollRef.current!);
          toast.error('生成失败', snap.errorMessage || '请稍后重试');
          setPhase('select');
        } else if (snap.progress?.message) {
          setGenerateMessage(snap.progress.message);
        }
      } catch {
        // 单次轮询失败不中断，下一轮继续
      }
    }, 3000);
  };

  const resultStats = useMemo(() => {
    if (!checked) return null;
    let total = 0;
    let correct = 0;
    for (const question of questions) {
      const kind = questionKind(question);
      if (kind === 'code') continue; // 编程题不自判
      total += 1;
      if (gradeQuestion(question, answers[answerKey(question)]) === true) correct += 1;
    }
    return { total, correct };
  }, [checked, questions, answers]);

  const backToSelect = () => {
    setPhase('select');
    setSnapshot(null);
    setTaskId(null);
    setRunId(null);
    setAnswers({});
    setChecked(false);
    weak.reload();
    history.reload();
  };

  return (
    <div className="col" style={{ gap: 18 }}>
      <header>
        <h2 style={{ fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={18} style={{ color: 'var(--brand-600)' }} />
          补弱决策
        </h2>
        <p className="small muted" style={{ marginTop: 4 }}>
          掌握度低于 60% 的能力项会出现在这里。路径决策 Agent 会把它们包装成一份"由浅入深"的补弱练习，练完回技能页重测即可回写掌握度。
        </p>
      </header>

      {phase === 'select' && (
        <>
          <Card>
            <CardHead icon={<ListChecks size={15} />} title="1 · 选择要补弱的能力项" extra={<Tag tone={selected.length ? 'brand' : 'neutral'}>已选 {selected.length}</Tag>} />
            <CardBody>
              {weak.loading && !weak.data ? (
                <LoadingBlock text="正在读取弱项" />
              ) : selectableTopics.length === 0 ? (
                <Empty
                  icon={<CheckCircle2 size={22} />}
                  title="当前没有低于阈值的弱项"
                  desc="所有已学习技能的掌握度都达标。可以先做一次考试演练，系统会根据答题结果更新掌握度。"
                  action={<Button variant="primary" onClick={() => navigate('/exams')}>去考试演练</Button>}
                />
              ) : (
                <div className="col" style={{ gap: 8 }}>
                  {selectableTopics.map((label) => {
                    const point = weakPoints.find((item: any) => String(item.label || item.name || '') === label);
                    const mastery = point ? Math.round(Number(point.masteryPct || 0)) : null;
                    return (
                      <Choice
                        key={label}
                        title={
                          <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                            {label}
                            {focusSkill === label && <Tag tone="amber">来自测验诊断</Tag>}
                          </span>
                        }
                        desc={mastery !== null ? `当前掌握度 ${mastery}%` : '本次测验未通过，建议生成针对性练习'}
                        selected={selected.includes(label)}
                        onClick={() =>
                          setSelected((prev) =>
                            prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label],
                          )
                        }
                      />
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHead icon={<RouteIcon size={15} />} title="2 · 配置练习强度" />
            <CardBody>
              <div className="col" style={{ gap: 14 }}>
                <label className="col" style={{ gap: 6 }}>
                  <span className="small" style={{ fontWeight: 600 }}>题目数量：{count} 题</span>
                  <Range value={count} min={3} max={10} onChange={setCount} />
                </label>
                <div className="col" style={{ gap: 6 }}>
                  <span className="small" style={{ fontWeight: 600 }}>难度定位</span>
                  <Segmented
                    value={difficultyKey}
                    options={DIFFICULTY_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
                    onChange={setDifficultyKey}
                  />
                </div>
                <Banner tone="info">
                  补弱练习会走统一出题管线：领域知识库约束 + 审核校验，和严格出题器同一条可信链路。
                </Banner>
                <div>
                  <Button variant="primary" onClick={startGenerate} disabled={selected.length === 0}>
                    <RefreshCw size={15} />
                    生成补弱练习
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </>
      )}

      {phase === 'generating' && (
        <Card>
          <CardBody>
            <LoadingBlock text="多智能体正在生成补弱练习" sub={generateMessage} />
            {taskId && (
              <p className="tiny faint" style={{ textAlign: 'center' }}>
                任务 #{taskId}{runId ? ` · 补弱记录 #${runId}` : ''} · 页面会自动轮询进度，无需刷新
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {phase === 'practice' && (
        <>
          <Card>
            <CardHead
              icon={<ListChecks size={15} />}
              title="3 · 完成补弱练习"
              extra={<Tag tone="brand">{questions.length} 题</Tag>}
            />
            <CardBody>
              <div className="col" style={{ gap: 12 }}>
                {questions.map((question, index) => {
                  const key = answerKey(question);
                  const grade = checked ? gradeQuestion(question, answers[key]) : null;
                  return (
                    <QuestionCard
                      key={key}
                      index={index}
                      question={question}
                      value={answers[key] ?? null}
                      disabled={checked}
                      onChange={(next) => setAnswers((prev) => ({ ...prev, [key]: next }))}
                      footer={
                        checked && (
                          <div className="col" style={{ gap: 6, paddingLeft: 2, borderLeft: `3px solid ${grade === true ? 'var(--green-500, #22c55e)' : 'var(--rose-400, #fb7185)'}` }}>
                            <div className="row" style={{ gap: 6 }}>
                              {grade === true ? (
                                <Tag tone="green" icon={<CheckCircle2 size={11} />}>答对了</Tag>
                              ) : grade === false ? (
                                <Tag tone="rose" icon={<XCircle size={11} />}>答错了</Tag>
                              ) : (
                                <Tag tone="amber">请对照解析自查</Tag>
                              )}
                              {grade !== true && (
                                <span className="tiny" style={{ fontWeight: 600 }}>
                                  正确答案：{answerLabel(question)}
                                </span>
                              )}
                            </div>
                            {question.solution && (
                              <p className="small muted" style={{ whiteSpace: 'pre-wrap' }}>
                                解析：{question.solution}
                              </p>
                            )}
                          </div>
                        )
                      }
                    />
                  );
                })}

                {!checked ? (
                  <div className="row" style={{ gap: 10 }}>
                    <Button variant="primary" onClick={() => setChecked(true)}>
                      提交练习
                    </Button>
                    <Button variant="ghost" onClick={backToSelect}>
                      放弃本轮
                    </Button>
                  </div>
                ) : (
                  <div className="col" style={{ gap: 12 }}>
                    {resultStats && resultStats.total > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                        <Metric label="客观题正确" value={resultStats.correct} unit={`/${resultStats.total}`} accent={resultStats.correct / resultStats.total >= 0.7} />
                        <Metric
                          label="正确率"
                          value={Math.round((resultStats.correct / resultStats.total) * 100)}
                          unit="%"
                          foot={resultStats.correct / resultStats.total >= 0.7 ? '达到重测标准' : '建议再练一轮'}
                        />
                      </div>
                    )}
                    <Banner tone="info">
                      补弱练习的成绩不会直接改写掌握度——回到技能页重新通过测验，才是被系统采信的学习证据。
                    </Banner>
                    <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                      {selected.map((label) => (
                        <Button key={label} variant="primary" onClick={() => navigate(`/skill/${encodeURIComponent(label)}`)}>
                          回「{label}」重测
                        </Button>
                      ))}
                      <Button variant="ghost" onClick={backToSelect}>
                        <RefreshCw size={14} />
                        再来一轮
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {runId != null && (
            <p className="tiny faint">补弱记录 #{runId} · 完成重测后可在下方历史里看到掌握度前后对比</p>
          )}
        </>
      )}

      <section>
        <SectionTitle icon={<TrendingUp size={15} />} title="补强历史" extra={<span className="tiny faint">补强前 → 当前掌握度</span>} />
        {history.loading && !history.data ? (
          <LoadingBlock text="正在读取补强历史" />
        ) : (history.data || []).length === 0 ? (
          <Empty
            icon={<TrendingUp size={20} />}
            title="还没有补强记录"
            desc="生成一次补弱练习并完成重测后，这里会展示每个知识点的掌握度变化。"
          />
        ) : (
          <div className="col" style={{ gap: 10 }}>
            {(history.data || []).map((run: any) => (
              <Card key={run.id} >
                <CardBody>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <span className="small" style={{ fontWeight: 600 }}>补弱 #{run.id}</span>
                    <span className="tiny faint">任务 #{run.taskId}</span>
                    {run.createTime ? (
                      <span className="tiny faint">{new Date(run.createTime).toLocaleString('zh-CN')}</span>
                    ) : null}
                  </div>
                  <div className="col" style={{ gap: 6, marginTop: 8 }}>
                    {(run.topics || []).map((topic: any) => (
                      <div className="row" key={topic.label} style={{ gap: 8 }}>
                        <span className="small" style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {topic.label}
                        </span>
                        <span className="tiny muted">{Math.round(topic.beforeMastery)}% → {Math.round(topic.currentMastery)}%</span>
                        <Tag tone={topic.delta > 0 ? 'green' : topic.delta < 0 ? 'rose' : 'neutral'}>
                          {topic.delta > 0 ? `+${Math.round(topic.delta)}` : Math.round(topic.delta)}%
                        </Tag>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      {focusSkill && phase === 'select' && (
        <p className="tiny faint">
          已带入选修技能「{focusSkill}」，可勾选其他弱项一起补强。
        </p>
      )}
    </div>
  );
}

function answerKey(question: PracticeQuestion): string {
  return String(question.id ?? question.clientId ?? (questionStem(question).slice(0, 40) || 'q'));
}

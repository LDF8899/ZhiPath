import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpenCheck,
  CheckCircle2,
  AlertCircle,
  FileStack,
  Layers,
  ListChecks,
  Play,
  RotateCcw,
  ShieldCheck,
  Timer,
  XCircle,
} from 'lucide-react';
import {
  examsApi,
  questionBankApi,
  type ExamTakeData,
} from '../lib/api';
import { setPendingQuestionConfig } from '../lib/questionGeneratorConfig';
import { useAsync } from '../components/ui';
import { toast } from '../store/toast';
import {
  QuestionCard,
  type AnswerValue,
  type PracticeQuestion,
} from '../components/QuestionCard';
import {
  Banner,
  Button,
  Card,
  CardBody,
  CardHead,
  Empty,
  Input,
  LoadingBlock,
  Metric,
  Segmented,
  Tag,
} from '../components/ui';

/**
 * 考试演练页 —— 把"题库"到"答题正确率"这一环接上。
 *
 * 题库组卷 -> 抽题作答（答案保存在服务端、限时） -> 交卷批改
 * -> 未通过触发错题分析 + 路径决策（补弱巩固 / 进阶挑战）-> 错题本复盘。
 */

type Tab = 'bank' | 'records' | 'wrong';
type View = 'list' | 'take' | 'result';

const TYPE_FILTERS = [
  { value: '', label: '全部题型' },
  { value: 'choice', label: '单选' },
  { value: 'fill', label: '填空' },
  { value: 'code', label: '编程' },
] as const;

function timeLabel(raw?: number | string) {
  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value <= 0) return '—';
  const ms = value > 1e12 ? value : value * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function safeStringify(value: any): string {
  if (value === null || value === undefined) return '（无参考答案）';
  if (typeof value === 'string') return value;
  try {
    const text = JSON.stringify(value);
    // 形如 {"solution":"..."} 的参考答案对象，只取有意义的文本字段
    const parsed = typeof text === 'string' ? JSON.parse(text) : value;
    if (parsed && typeof parsed === 'object') {
      return String(parsed.solution || parsed.content || parsed.answer || text);
    }
    return String(text);
  } catch {
    return String(value);
  }
}

export default function Exams() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('bank');
  const [view, setView] = useState<View>('list');
  const [takeData, setTakeData] = useState<ExamTakeData | null>(null);
  const [result, setResult] = useState<any>(null);

  const enterTake = async (examId: number, count = 10) => {
    try {
      toast.info('正在抽题', '服务端随机抽题并剔除答案');
      const data = await examsApi.take(examId, count);
      if (!data?.questions?.length) {
        toast.error('这场考试没有可用题目', '先去题库确认题目已入库');
        return;
      }
      setTakeData(data);
      setView('take');
    } catch (err: any) {
      toast.error('进入考试失败', err?.message || '');
    }
  };

  return (
    <div className="col" style={{ gap: 18 }}>
      <header>
        <h2 style={{ fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpenCheck size={18} style={{ color: 'var(--brand-600)' }} />
          考试演练
        </h2>
        <p className="small muted" style={{ marginTop: 4 }}>
          从题库挑题组卷作答，或直接进入历史试卷。成绩会回写掌握度与成长记录，未通过的技能会被路径决策 Agent 安排补弱。
        </p>
      </header>

      {view === 'list' && (
        <>
          <Segmented
            value={tab}
            options={[
              { value: 'bank', label: '题库组卷' },
              { value: 'records', label: '考试记录' },
              { value: 'wrong', label: '错题本' },
            ]}
            onChange={setTab}
          />

          {tab === 'bank' && (
            <BankTab
              onAssembled={async (examId, questionCount) => {
                await enterTake(examId, Math.min(questionCount, 20));
              }}
            />
          )}

          {tab === 'records' && <RecordsTab onEnter={enterTake} />}

          {tab === 'wrong' && (
            <WrongTab
              onRemediate={(skillName) => navigate(`/remediation?skill=${encodeURIComponent(skillName)}`)}
            />
          )}
        </>
      )}

      {view === 'take' && takeData && (
        <TakeView
          data={takeData}
          onExit={() => setView('list')}
          onSubmitted={(submitted) => {
            setResult(submitted);
            setView('result');
          }}
        />
      )}

      {view === 'result' && result && (
        <ResultView
          result={result}
          onBack={() => setView('list')}
          onRemediate={(skillName) => navigate(`/remediation?skill=${encodeURIComponent(skillName)}`)}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Tab 1：题库组卷
// ────────────────────────────────────────────────────────────

function BankTab({
  onAssembled,
}: {
  onAssembled: (examId: number, questionCount: number) => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const [skillName, setSkillName] = useState('');
  const [questionType, setQuestionType] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [assembling, setAssembling] = useState(false);
  // 后端 pageSuccess 的 data 就是数组（total 在信封顶层会被 api 客户端剥掉），一次取 50 条即可
  const pageSize = 50;

  const bank = useAsync(
    () => questionBankApi.questions({ skillName: skillName || undefined, questionType: questionType || undefined, page: 1, pageSize }),
    [skillName, questionType],
  );

  const rows: any[] = Array.isArray(bank.data) ? bank.data : bank.data?.list || [];
  const total = Number(bank.data?.total ?? rows.length);

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));

  const assemble = async () => {
    if (selected.length === 0) return;
    setAssembling(true);
    try {
      const created = await questionBankApi.assemble(selected);
      toast.success('组卷完成', `已创建考试 #${created.examId}，共 ${created.questionCount} 题`);
      setSelected([]);
      await onAssembled(created.examId, created.questionCount);
    } catch (err: any) {
      toast.error('组卷失败', err?.message || '');
    } finally {
      setAssembling(false);
    }
  };

  return (
    <Card>
      <CardHead
        icon={<FileStack size={15} />}
        title="题库"
        extra={<span className="tiny faint">共 {total} 题 · 勾选后组卷</span>}
      />
      <CardBody>
        <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <Input
            placeholder="按技能名筛选"
            value={skillName}
            onChange={(event: any) => setSkillName(event.target.value)}
            style={{ maxWidth: 220 }}
          />
          <Segmented
            value={questionType}
            options={TYPE_FILTERS.map((item) => ({ value: item.value, label: item.label }))}
            onChange={setQuestionType}
          />
          {selected.length > 0 && (
            <Button variant="primary" onClick={assemble} disabled={assembling}>
              <Layers size={14} />
              组卷并开始（{selected.length} 题）
            </Button>
          )}
        </div>

        {bank.loading && !bank.data ? (
          <LoadingBlock text="正在读取题库" />
        ) : rows.length === 0 ? (
          <Empty
            icon={<FileStack size={22} />}
            title="题库里还没有符合条件的题目"
            desc="去严格出题器生成并批准入库一批题目，或检查筛选条件。"
            action={<Button variant="primary" onClick={() => navigate('/questions')}>去严格出题</Button>}
          />
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {rows.map((row: any) => {
              const id = Number(row.id);
              return (
                <div
                  key={id}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(id)}
                  onKeyDown={(event) => event.key === 'Enter' && toggle(id)}
                  className="row"
                  style={{
                    gap: 10,
                    padding: '9px 12px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    border: `1px solid ${selected.includes(id) ? 'var(--brand-300, #a5b4fc)' : 'var(--border)'}`,
                    background: selected.includes(id) ? 'var(--brand-50, #eef2ff)' : 'transparent',
                    alignItems: 'flex-start',
                  }}
                >
                  <input type="checkbox" checked={selected.includes(id)} readOnly style={{ marginTop: 3 }} />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="small" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.title}
                    </span>
                    <span className="row tiny faint" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <span>#{id}</span>
                      <span>·</span>
                      <span>{row.skillName || '通用'}</span>
                      <span>·</span>
                      <span>难度 {row.difficulty ?? '—'}</span>
                      {row.confidence ? <span>· 可信度 {Math.round(row.confidence * 100)}%</span> : null}
                      {row.source ? <span>· {row.source === 'generated' ? 'AI 生成' : row.source === 'imported' ? '导入' : '手动'}</span> : null}
                    </span>
                  </span>
                  <Tag tone="neutral">{row.type}</Tag>
                </div>
              );
            })}

            {rows.length >= pageSize && (
              <p className="tiny faint" style={{ textAlign: 'center' }}>
                已显示前 {pageSize} 题，可按技能名或题型缩小范围查看更多
              </p>
            )}
          </div>
        )}

        {rows.length > 0 && (
          <Banner tone="info">
            组卷后由服务端随机抽题、选项乱序并保留答案，前端拿到的快照不含正确答案。
            题目多于所选题数时每次抽取都会不同。
          </Banner>
        )}
      </CardBody>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
//  Tab 2：考试记录
// ────────────────────────────────────────────────────────────

function RecordsTab({ onEnter }: { onEnter: (examId: number, count?: number) => void }) {
  const records = useAsync(() => examsApi.list(1, 50), []);
  // 后端 pageSuccess 信封的 data 就是数组，total/page 在信封顶层
  const rows: any[] = Array.isArray(records.data) ? records.data : records.data?.list || [];

  return (
    <Card>
      <CardHead icon={<ListChecks size={15} />} title="考试记录" extra={<span className="tiny faint">最近 {rows.length} 场</span>} />
      <CardBody>
        {records.loading && !records.data ? (
          <LoadingBlock text="正在读取考试记录" />
        ) : rows.length === 0 ? (
          <Empty
            icon={<ListChecks size={22} />}
            title="还没有考过试"
            desc="从题库组一份卷子开始第一次演练吧。"
          />
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {rows.map((exam: any) => {
              const scored = exam.score !== null && exam.score !== undefined;
              const passed = Number(exam.passed) === 1;
              return (
                <div className="row" key={exam.id} style={{ gap: 10, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="small" style={{ display: 'block', fontWeight: 600 }}>
                      考试 #{exam.id} · {exam.skillName || '综合'}
                    </span>
                    <span className="row tiny faint" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <span>{timeLabel(exam.createTime)}</span>
                      {exam.retryCount ? <span>· 已重考 {exam.retryCount} 次</span> : null}
                    </span>
                  </span>
                  {scored ? (
                    <Tag tone={passed ? 'green' : 'rose'} icon={passed ? <CheckCircle2 size={11} /> : <XCircle size={11} />}>
                      {exam.score} 分 · {passed ? '通过' : '未通过'}
                    </Tag>
                  ) : (
                    <Tag tone="amber">未完成</Tag>
                  )}
                  <Button size="sm" variant="quiet" onClick={() => onEnter(exam.id, 10)}>
                    {scored ? <RotateCcw size={13} /> : <Play size={13} />}
                    {scored ? '重考' : '进入'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
//  Tab 3：错题本
// ────────────────────────────────────────────────────────────

function WrongTab({ onRemediate }: { onRemediate: (skillName: string) => void }) {
  const wrong = useAsync(() => examsApi.wrongAnswers(), []);
  // 后端返回按技能分组：{ total, skills: [{ skill, count, items: [...] }] }；
  // 兼容老版平铺数组格式
  const raw: any = wrong.data;
  const groups: Array<{ skill: string; count?: number; items: any[] }> = Array.isArray(raw)
    ? [{ skill: '', items: raw }]
    : (raw?.skills || []).map((g: any) => ({ skill: g?.skill || '', count: g?.count, items: g?.items || [] }));
  const total = Number(raw?.total ?? groups.reduce((sum, g) => sum + (g.items?.length || 0), 0));

  return (
    <Card>
      <CardHead icon={<XCircle size={15} />} title="错题本" extra={<span className="tiny faint">{total} 条错题</span>} />
      <CardBody>
        {wrong.loading && !wrong.data ? (
          <LoadingBlock text="正在读取错题本" />
        ) : total === 0 || groups.every((g) => g.items.length === 0) ? (
          <Empty
            icon={<CheckCircle2 size={22} />}
            title="错题本是空的"
            desc="考试未通过时，答错的题目会自动进入错题本，并附上正确答案与薄弱点分析。"
          />
        ) : (
          <div className="col" style={{ gap: 14 }}>
            {groups
              .filter((g) => g.skill && !g.skill.startsWith('未知'))
              .length > 0 && (
              <Banner tone="warning">
                错题集中在：
                {groups
                  .filter((g) => g.skill && !g.skill.startsWith('未知'))
                  .map((g) => g.skill)
                  .join('、')}
                。可以针对这些技能生成补弱练习。
              </Banner>
            )}
            {groups.map((group, groupIndex) => (
              <div className="col" key={group.skill || groupIndex} style={{ gap: 8 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="small" style={{ fontWeight: 600 }}>{group.skill || '未归类'}</span>
                  <Tag tone="neutral">{group.items.length} 题</Tag>
                  {group.skill && !group.skill.startsWith('未知') && (
                    <Button size="sm" variant="quiet" onClick={() => onRemediate(group.skill)}>
                      <ShieldCheck size={13} />
                      补弱「{group.skill}」
                    </Button>
                  )}
                </div>
                {group.items.map((row: any, index: number) => (
                  <div key={`${row.examId}-${index}`} className="col" style={{ gap: 6, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <Tag tone="rose">错题</Tag>
                      <span className="tiny faint">考试 #{row.examId} · {timeLabel(row.createTime)}</span>
                    </div>
                    <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{row.question}</p>
                    <div className="row tiny" style={{ gap: 14, flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--rose-600)' }}>你的答案：{row.userAnswer || '（未作答）'}</span>
                      <span style={{ color: 'var(--green-600)' }}>
                        参考答案：{typeof row.correctAnswer === 'string' ? row.correctAnswer : safeStringify(row.correctAnswer)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
//  作答视图
// ────────────────────────────────────────────────────────────

/**
 * 服务端快照归一：
 *   - 题库选项是字符串数组，选项 key 取其在乱序数组中的位置（字符串数字），
 *     交卷时还原成数字 —— 服务端 checkAnswer 对 choice 用严格相等比较数字索引。
 *   - 题干字段统一成 stem。
 */
function normalizeServedQuestion(raw: any): PracticeQuestion {
  const opts = raw?.options ?? raw?.content?.options ?? [];
  const options = (Array.isArray(opts) ? opts : []).map((opt: any, index: number) =>
    typeof opt === 'string' ? { key: String(index), text: opt } : { key: String(opt?.key ?? index), text: String(opt?.text ?? opt ?? '') },
  );
  return { ...raw, stem: raw?.stem || raw?.title || '', options };
}

/** choice 的数字索引 key 交卷前转回 number；填空/简答保持文本 */
function toSubmitValue(value: AnswerValue): any {
  const toNum = (v: string) => (/^\d+$/.test(v) ? Number(v) : v);
  if (Array.isArray(value)) return value.map((item) => toNum(String(item)));
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return value;
}

function TakeView({
  data,
  onExit,
  onSubmitted,
}: {
  data: ExamTakeData;
  onExit: () => void;
  onSubmitted: (result: any) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState(() => Math.max(0, data.timeLimitSec - Math.floor((Date.now() - data.startedAt) / 1000)));
  const touchRef = useRef<Record<string, number>>({});
  const submittedRef = useRef(false);

  const questions = useMemo(() => data.questions.map(normalizeServedQuestion), [data]);

  const submit = async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const questionTimings: Record<string, number> = {};
      const now = Date.now();
      for (const [key, firstTouch] of Object.entries(touchRef.current)) {
        questionTimings[key] = Math.max(1, Math.round((now - firstTouch) / 1000));
      }
      const submittedAnswers: Record<string, any> = {};
      for (const [key, value] of Object.entries(answers)) {
        submittedAnswers[key] = toSubmitValue(value ?? null);
      }
      const submitted = await examsApi.submit({
        examId: data.examId,
        examType: data.examType,
        skillName: data.skillName || undefined,
        answers: submittedAnswers,
        questionTimings,
      });
      toast.success('交卷成功', `得分 ${submitted.score}`);
      onSubmitted(submitted);
    } catch (err: any) {
      submittedRef.current = false;
      toast.error('交卷失败', err?.message || '');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const next = Math.max(0, data.timeLimitSec - Math.floor((Date.now() - data.startedAt) / 1000));
      setRemaining(next);
      if (next <= 0 && !submittedRef.current) {
        toast.warn('时间到', '正在自动交卷');
        submit();
      }
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const answeredCount = Object.values(answers).filter((value) =>
    Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== '',
  ).length;

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <Card>
      <CardHead
        icon={<Timer size={15} />}
        title={`考试 #${data.examId}${data.skillName ? ` · ${data.skillName}` : ''}`}
        extra={
          <span className="row" style={{ gap: 8 }}>
            <Tag tone={remaining < 60 ? 'rose' : 'brand'}>{mm}:{ss}</Tag>
            <Tag tone="neutral">已答 {answeredCount}/{questions.length}</Tag>
          </span>
        }
      />
      <CardBody>
        <div className="col" style={{ gap: 12 }}>
          {questions.map((question, index) => {
            const key = String(question.id ?? index);
            return (
              <QuestionCard
                key={key}
                index={index}
                question={question}
                value={answers[key] ?? null}
                disabled={submitting}
                onChange={(next) => {
                  if (!touchRef.current[key]) touchRef.current[key] = Date.now();
                  setAnswers((prev) => ({ ...prev, [key]: next }));
                }}
              />
            );
          })}

          <div className="row" style={{ gap: 10 }}>
            <Button variant="primary" onClick={submit} disabled={submitting}>
              交卷（{answeredCount}/{questions.length}）
            </Button>
            <Button variant="ghost" onClick={onExit} disabled={submitting}>
              暂时离开
            </Button>
          </div>
          <p className="tiny faint">
            离开后重新进入会继续本次作答快照，不会重新抽题；倒计时以服务端开始时间为准。
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
//  结果视图（含路径决策卡）
// ────────────────────────────────────────────────────────────

function ResultView({
  result,
  onBack,
  onRemediate,
}: {
  result: any;
  onBack: () => void;
  onRemediate: (skillName: string) => void;
}) {
  const navigate = useNavigate();
  const score = Math.round(Number(result.score ?? 0));
  const passed = Number(result.passed) === 1;
  const summary = result.summary || {};
  const skillName = String(result.skillName || '');
  const weakPoints: string[] = result.wrongAnalysis?.weakPoints
    ?.map((item: any) => (typeof item === 'string' ? item : item?.point || item?.skill || item?.title || ''))
    .filter(Boolean) || [];
  const plan = result.wrongAnalysis?.reinforcementPlan;
  const planTasks: Array<{ skill?: string; taskType?: string; description?: string; estimatedMinutes?: number }> =
    Array.isArray(plan?.tasks) ? plan.tasks : [];
  const advanced = passed && score >= 90;

  const goAdvanced = () => {
    setPendingQuestionConfig({
      subject: skillName || '综合能力',
      count: 5,
      difficulty: 8,
      questionTypes: ['choice', 'fill'],
      topics: [{ label: skillName || '综合能力' }],
      instructions: '进阶挑战：学习者已通过基础测验，请生成更高难度的综合应用题，注重多步推理与工程场景。',
    });
    navigate('/questions');
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <Card>
        <CardBody>
          <div className="col" style={{ gap: 14, alignItems: 'flex-start' }}>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <Tag tone={passed ? 'green' : 'rose'} icon={passed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}>
                {passed ? '通过' : '未通过'}
              </Tag>
              {result.anomalyFlagged && <Tag tone="amber" icon={<AlertCircle size={11} />}>作答行为已标记复核</Tag>}
              {skillName && <span className="small muted">技能：{skillName}</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, width: '100%' }}>
              <Metric label="得分" value={score} unit="/100" accent={passed} />
              <Metric label="答对" value={summary.correctCount ?? '—'} unit={`/${summary.totalQuestions ?? '—'}`} />
              <Metric label="答错" value={summary.wrongCount ?? '—'} />
            </div>

            {passed ? (
              <Banner tone="success">
                成绩已回写掌握度与成长记录。{advanced ? '表现优秀，可以直接安排进阶挑战。' : '继续保持，或进入下一步实操。'}
              </Banner>
            ) : (
              <Banner tone="warning">
                未达通过线。审核 Agent 已对错题做了薄弱点分析，路径决策 Agent 建议先补弱再重考。
              </Banner>
            )}
          </div>
        </CardBody>
      </Card>

      {weakPoints.length > 0 && (
        <Card>
          <CardHead icon={<ShieldCheck size={15} />} title="薄弱点分析（审核 Agent）" />
          <CardBody>
            <div className="row wrap" style={{ gap: 8 }}>
              {weakPoints.map((point) => (
                <Tag key={point} tone="amber">{point}</Tag>
              ))}
            </div>
            {weakPoints.length > 0 && (
              <div className="row wrap" style={{ gap: 8 }}>
                {weakPoints.map((point) => (
                  <Tag key={point} tone="amber">{point}</Tag>
                ))}
              </div>
            )}
            {planTasks.length > 0 && (
              <div className="col" style={{ gap: 8 }}>
                <span className="tiny" style={{ fontWeight: 600 }}>补强计划（预计 {plan.estimatedDays ?? '—'} 天）</span>
                {planTasks.map((task, index) => (
                  <div key={index} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                    <Tag tone={task.taskType === 'review' ? 'violet' : 'teal'}>{task.taskType === 'review' ? '复盘' : '练习'}</Tag>
                    <span className="small grow" style={{ minWidth: 0 }}>
                      {task.skill ? <strong>{task.skill}：</strong> : null}
                      {task.description}
                    </span>
                    {task.estimatedMinutes ? <span className="tiny faint">{task.estimatedMinutes}′</span> : null}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHead icon={<ShieldCheck size={15} />} title="路径决策 Agent 建议" />
        <CardBody>
          <div className="col" style={{ gap: 12 }}>
            {passed ? (
              advanced ? (
                <>
                  <p className="small">
                    本轮得分 <strong>{score}</strong>，已达进阶阈值（90）。可以生成一组更高难度的综合应用题，继续向上挑战。
                  </p>
                  <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                    <Button variant="primary" onClick={goAdvanced}>
                      生成进阶挑战题
                    </Button>
                    <Button variant="ghost" onClick={onBack}>返回考试列表</Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="small">本轮已通过。可以继续后续实操，或再组一卷巩固。</p>
                  <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                    <Button variant="primary" onClick={onBack}>返回考试列表</Button>
                    {skillName && (
                      <Button variant="quiet" onClick={() => navigate(`/skill/${encodeURIComponent(skillName)}`)}>
                        回到技能学习
                      </Button>
                    )}
                  </div>
                </>
              )
            ) : (
              <>
                <p className="small">
                  本轮得分 <strong>{score}</strong>，低于通过线。建议针对这次答错的技能生成由浅入深的补弱练习，练完再回来重考。
                </p>
                <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  <Button variant="primary" onClick={() => onRemediate(skillName || weakPoints[0] || '综合能力')}>
                    生成补弱练习
                  </Button>
                  <Button variant="quiet" onClick={onBack}>返回考试列表</Button>
                </div>
              </>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

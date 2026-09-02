import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileQuestion,
  History,
  Loader2,
  Play,
  Plus,
  Save,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import { questionGenerationApi, remediationApi, type GeneratedQuestion, type GenerationConfig } from '../lib/api';
import { takePendingQuestionConfig } from '../lib/questionGeneratorConfig';
import { useQuestionGenerator } from '../hooks/useQuestionGenerator';
import { toast } from '../store/toast';
import { Banner, Bar, Button, Card, CardBody, CardHead, Empty, Field, Input, Range, Tag, Textarea } from '../components/ui';

type SourceMode = 'manual' | 'matched' | 'agent';

const TYPE_LABELS: Record<string, string> = {
  choice: '单选',
  fill: '填空',
  coding: '编程',
  essay: '简答',
};

const TYPE_HINTS: Record<string, string> = {
  choice: '概念辨析、唯一答案',
  fill: '关键术语、推导结果',
  coding: '实践任务、可验收',
  essay: '解释能力、方案表达',
};

const TYPE_ORDER = ['choice', 'fill', 'coding', 'essay'];

const DIFFICULTY_PRESETS = [
  { key: 'basic', label: '基础', value: 3, desc: '回忆、单步应用' },
  { key: 'standard', label: '标准', value: 6, desc: '多步推理、常见场景' },
  { key: 'advanced', label: '进阶', value: 8, desc: '综合迁移、约束较多' },
  { key: 'challenge', label: '挑战', value: 10, desc: '压轴、开放边界' },
];

function normalizeConfig(input: Partial<GenerationConfig> = {}): GenerationConfig {
  return {
    subject: String(input.subject || (input as any).skillName || ''),
    count: Math.min(100, Math.max(1, Number(input.count || (input as any).question_count || 5))),
    difficulty: Math.min(10, Math.max(1, Number(input.difficulty || 5))),
    questionTypes: Array.isArray(input.questionTypes) && input.questionTypes.length
      ? input.questionTypes
      : (input as any).question_type === 'mixed'
        ? ['choice', 'fill', 'coding']
        : [String((input as any).question_type || 'choice')],
    curriculum: input.curriculum || '',
    grade: input.grade || '',
    locale: input.locale || 'zh-CN',
    topics: Array.isArray(input.topics) ? input.topics : [],
    instructions: input.instructions || '',
    metadata: input.metadata || {},
    referenceLibrary: input.referenceLibrary ?? true,
  };
}

function activeDifficulty(value: number) {
  if (value <= 3) return 'basic';
  if (value <= 6) return 'standard';
  if (value <= 8) return 'advanced';
  return 'challenge';
}

function answerText(question: GeneratedQuestion) {
  const answer = question.answer;
  if (answer === undefined || answer === null || answer === '') return '未给出';
  if (typeof answer !== 'object') return String(answer);

  // 选项题：把索引/键还原成选项文本，而不是把对象 JSON 直接亮给用户
  const options: Array<{ key?: string; text?: string }> = Array.isArray(question.options) ? question.options : [];
  const optionText = (value: any): string => {
    if (typeof value === 'number' && options[value]) return options[value]?.text || options[value]?.key || String(value);
    if (typeof value === 'string' && /^\d+$/.test(value) && options[Number(value)]) {
      return options[Number(value)]?.text || value;
    }
    if (typeof value === 'string') {
      const byKey = options.find((opt) => opt.key === value);
      if (byKey?.text) return byKey.text;
      return value;
    }
    if (value && typeof value === 'object') return String(value.text || value.label || '');
    return '';
  };

  if (Array.isArray(answer)) {
    return answer.map(optionText).filter(Boolean).join('、') || '见解析';
  }
  const single = optionText(answer);
  if (single) return single;
  if (typeof answer.correct === 'number' && options[answer.correct]) return options[answer.correct]?.text;
  if (question.solution) return `见解析：${String(question.solution).slice(0, 120)}`;
  return '见解析';
}

export default function QuestionGenerator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pendingConfig = useMemo(() => takePendingQuestionConfig(), []);
  const generator = useQuestionGenerator(normalizeConfig(pendingConfig || {}));
  const [mode, setMode] = useState<SourceMode>(pendingConfig ? 'agent' : 'manual');
  const [topicInput, setTopicInput] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [weakPoints, setWeakPoints] = useState<Array<{ label: string; masteryPct?: number }>>([]);
  const [matching, setMatching] = useState(false);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const progressPct = generator.progress.total
    ? Math.min(100, Math.round((generator.progress.current / generator.progress.total) * 100))
    : 0;
  const selectedQuestions = generator.questions.filter((_, index) => selected.includes(index));
  const persistedCount = generator.questions.filter((question) => Number(question.id)).length;
  const approvedCount = Array.isArray(generator.task?.approvedQuestionIds) ? generator.task!.approvedQuestionIds.length : 0;

  const updateConfig = (patch: Partial<GenerationConfig>) => {
    generator.setConfig((current) => ({ ...current, ...patch }));
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      setRecentTasks(await questionGenerationApi.list(12));
    } catch (err: any) {
      toast.error('出题任务历史读取失败', err?.message || '');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
    const taskId = searchParams.get('taskId');
    if (taskId) {
      generator.refresh(Number(taskId)).catch((err) => toast.error('出题任务读取失败', err?.message || ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSelected(generator.questions.map((_, index) => index));
  }, [generator.questions.length]);

  const toggleType = (type: string) => {
    const current = generator.config.questionTypes || [];
    const next = current.includes(type) ? current.filter((item) => item !== type) : [...current, type];
    updateConfig({ questionTypes: next });
  };

  const addTopic = () => {
    const label = topicInput.trim();
    if (!label) return;
    const topics = generator.config.topics || [];
    if (topics.some((topic) => String(topic.label || topic.id) === label)) {
      setTopicInput('');
      return;
    }
    updateConfig({ topics: [...topics, { label }] });
    setTopicInput('');
  };

  const matchCurrentLevel = async (autoStart = false) => {
    setMode('matched');
    setMatching(true);
    try {
      const result = await remediationApi.prepare({
        count: generator.config.count,
        difficulty: generator.config.difficulty,
        questionTypes: generator.config.questionTypes,
        topics: generator.config.topics,
      });
      const nextConfig = normalizeConfig({
        ...result.config,
        count: result.config?.count || generator.config.count,
        referenceLibrary: true,
      });
      setWeakPoints(result.weakPoints || []);
      generator.setConfig(nextConfig);
      toast.success('已按当前学习程度匹配出题参数');
      if (autoStart) {
        await generator.start(nextConfig);
        loadHistory();
      }
    } catch (err: any) {
      toast.error('学习程度匹配失败', err?.message || '');
    } finally {
      setMatching(false);
    }
  };

  const startStrictGeneration = async () => {
    const created = await generator.start(generator.config);
    if (created) loadHistory();
  };

  const saveDrafts = async () => {
    const result = await generator.saveDrafts();
    if (result) {
      toast.success(`草稿已保存 ${result.persisted || result.questionIds?.length || 0} 题`);
      loadHistory();
    }
  };

  const approveSelected = async () => {
    if (!selectedQuestions.length) return;
    let idByIndex = generator.questions.map((question) => Number(question.id) || 0);
    if (selectedQuestions.some((question) => !Number(question.id))) {
      const saved = await generator.saveDrafts();
      if (!saved) return;
      idByIndex = generator.questions.map((question, index) => Number(question.id) || Number(saved.questionIds?.[index]) || 0);
    }
    const ids = selected.map((index) => idByIndex[index]).filter(Boolean);
    if (!ids.length) {
      toast.warn('请先保存草稿后再批准入库');
      return;
    }
    const questionsMap = Object.fromEntries(
      selected.map((index) => [String(idByIndex[index]), generator.questions[index]]).filter(([id]) => Number(id)),
    ) as Record<string, GeneratedQuestion>;
    const result = await generator.approve(ids, questionsMap);
    if (result) {
      toast.success(`已批准入库 ${result.approved} 题`);
      loadHistory();
    }
  };

  const removeTask = async (taskId: number) => {
    try {
      await questionGenerationApi.remove(taskId);
      toast.success('出题任务已删除');
      loadHistory();
    } catch (err: any) {
      toast.error('删除失败', err?.message || '');
    }
  };

  return (
    <div className="page page--wide qg">
      <div className="page-head">
        <div className="row-between wrap">
          <div>
            <h1>严格出题器</h1>
            <p>参数来源可以来自智能体问诊、学习画像匹配或手动配置；所有题目都会进入生成任务、草稿审核、批准入库这条固定管线。</p>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <Tag tone={generator.status === 'error' ? 'rose' : generator.busy ? 'brand' : 'green'} dot>
              {generator.status}
            </Tag>
            <Button variant="ghost" size="sm" onClick={loadHistory}>
              <History size={14} />
              刷新历史
            </Button>
          </div>
        </div>
      </div>

      {generator.error && <Banner tone="error">{generator.error}</Banner>}

      <div className="qg-source">
        <button type="button" className="qg-source__item" aria-pressed={mode === 'manual'} onClick={() => setMode('manual')}>
          <SlidersHorizontal size={16} />
          <span>自选出题</span>
          <small>精确指定题型、难度、知识点</small>
        </button>
        <button type="button" className="qg-source__item" aria-pressed={mode === 'matched'} onClick={() => matchCurrentLevel(false)} disabled={matching}>
          {matching ? <Loader2 size={16} className="btn__spinner" /> : <Target size={16} />}
          <span>按学习程度匹配</span>
          <small>读取弱项和掌握度，自动填参</small>
        </button>
        <button type="button" className="qg-source__item" aria-pressed={mode === 'agent'} onClick={() => setMode('agent')}>
          <Bot size={16} />
          <span>智能体问诊配置</span>
          <small>先对话澄清，再带配置进入</small>
        </button>
      </div>

      {mode === 'agent' && (
        <Banner tone={pendingConfig ? 'success' : 'info'}>
          {pendingConfig ? '已接收智能体解析出的出题配置，可继续微调后启动严格生成。' : '在 AI 教练里说“帮我配置一套严格出题”，智能体会先追问范围、难度和题型，再把配置带回这里。'}
          <Button variant="soft" size="sm" style={{ marginLeft: 10 }} onClick={() => navigate('/coach')}>
            <Bot size={13} />
            去问智能体
          </Button>
        </Banner>
      )}

      <div className="grid grid--sidebar">
        <Card>
          <CardHead icon={<FileQuestion size={15} />} title="出题参数" extra={<Tag tone="outline">严格管线</Tag>} />
          <CardBody className="col" style={{ gap: 16 }}>
            <div className="grid grid--2">
              <Field label="主题 / 能力项" required>
                <Input
                  value={generator.config.subject}
                  onChange={(event) => updateConfig({ subject: event.target.value })}
                  placeholder="例如 RAG 检索链路、React Hooks"
                />
              </Field>
              <Field label="题目数量" required>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={generator.config.count}
                  onChange={(event) => updateConfig({ count: Math.min(100, Math.max(1, Number(event.target.value) || 1)) })}
                />
              </Field>
            </div>

            <Field label={`难度 ${generator.config.difficulty}/10`} hint={DIFFICULTY_PRESETS.find((item) => item.key === activeDifficulty(generator.config.difficulty))?.desc}>
              <div className="qg-presets">
                {DIFFICULTY_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className="qg-chip"
                    aria-pressed={activeDifficulty(generator.config.difficulty) === preset.key}
                    onClick={() => updateConfig({ difficulty: preset.value })}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <Range value={generator.config.difficulty} min={1} max={10} onChange={(difficulty) => updateConfig({ difficulty })} />
            </Field>

            <Field label="题型组合" required hint="可多选；后端会按题型、难度阶梯、唯一答案和详细解析生成。">
              <div className="qg-type-grid">
                {TYPE_ORDER.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className="choice"
                    aria-pressed={generator.config.questionTypes.includes(type)}
                    onClick={() => toggleType(type)}
                  >
                    {generator.config.questionTypes.includes(type) && (
                      <span className="choice__check">
                        <CheckCircle2 size={12} strokeWidth={3} />
                      </span>
                    )}
                    <span className="choice__title">{TYPE_LABELS[type]}</span>
                    <span className="choice__desc">{TYPE_HINTS[type]}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="知识点">
              <div className="qg-topic-input">
                <Input
                  value={topicInput}
                  onChange={(event) => setTopicInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addTopic();
                    }
                  }}
                  placeholder="例如 useEffect 依赖、向量召回、重排"
                />
                <Button variant="ghost" size="sm" onClick={addTopic}>
                  <Plus size={13} />
                  添加
                </Button>
              </div>
              {(generator.config.topics?.length || 0) > 0 && (
                <div className="row wrap" style={{ gap: 6 }}>
                  {(generator.config.topics || []).map((topic, index) => (
                    <button
                      key={`${topic.label || topic.id}-${index}`}
                      type="button"
                      className="qg-topic"
                      onClick={() => updateConfig({ topics: (generator.config.topics || []).filter((_, itemIndex) => itemIndex !== index) })}
                    >
                      {topic.label || topic.id}
                    </button>
                  ))}
                </div>
              )}
            </Field>

            <Field label="定制要求">
              <Textarea
                rows={3}
                value={generator.config.instructions || ''}
                onChange={(event) => updateConfig({ instructions: event.target.value })}
                placeholder="例如结合真实工程场景、避免重复、必须包含反例辨析。"
              />
            </Field>

            <label className="qg-toggle">
              <input
                type="checkbox"
                checked={Boolean(generator.config.referenceLibrary)}
                onChange={(event) => updateConfig({ referenceLibrary: event.target.checked })}
              />
              <span>
                <strong>结合题库防重复</strong>
                <small>检索已入库题目作为参考，降低近似重复。</small>
              </span>
            </label>

            <div className="row-between wrap">
              <Button variant="ghost" onClick={() => matchCurrentLevel(false)} loading={matching}>
                <Target size={14} />
                匹配当前程度
              </Button>
              <Button variant="primary" onClick={startStrictGeneration} loading={generator.busy}>
                <Play size={14} />
                启动严格生成
              </Button>
            </div>
          </CardBody>
        </Card>

        <div className="col" style={{ gap: 16 }}>
          <Card>
            <CardHead icon={<ClipboardCheck size={15} />} title="任务状态" extra={generator.taskId ? <Tag tone="brand">#{generator.taskId}</Tag> : null} />
            <CardBody className="col" style={{ gap: 13 }}>
              <div className="qg-state">
                <span>{generator.progress.message || (generator.taskId ? '等待快照更新' : '尚未启动')}</span>
                <strong>{generator.progress.current}/{generator.progress.total || generator.config.count}</strong>
              </div>
              <Bar value={progressPct} flowing={generator.status === 'running'} />
              <div className="qg-stat-grid">
                <span><strong>{generator.questions.length}</strong><small>已生成</small></span>
                <span><strong>{persistedCount}</strong><small>草稿</small></span>
                <span><strong>{approvedCount}</strong><small>已入库</small></span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHead icon={<Target size={15} />} title="匹配依据" />
            <CardBody>
              {weakPoints.length ? (
                <div className="col" style={{ gap: 8 }}>
                  {weakPoints.slice(0, 8).map((point) => (
                    <div className="qg-weak" key={point.label}>
                      <span>{point.label}</span>
                      <small>{typeof point.masteryPct === 'number' ? `掌握度 ${Math.round(point.masteryPct)}%` : '待补强'}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty icon={<Target size={20} />} title="尚未匹配学习程度" desc="点击匹配后会按当前弱项生成参数，仍可再手动微调。" />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHead icon={<History size={15} />} title="最近任务" extra={<span className="tiny faint">{loadingHistory ? '读取中' : `${recentTasks.length} 条`}</span>} />
            <CardBody className="col" style={{ gap: 8 }}>
              {recentTasks.length === 0 ? (
                <Empty icon={<History size={20} />} title="还没有出题任务" />
              ) : recentTasks.map((task) => (
                <div className="qg-history" key={task.taskId || task.id}>
                  <button type="button" onClick={() => generator.refresh(Number(task.taskId || task.id))}>
                    <span className="truncate">{task.subject || '未命名主题'}</span>
                    <small>{task.taskStatus} · {task.resultCount || 0}/{task.questionCount || task.count || 0}</small>
                  </button>
                  <button type="button" className="icon-btn" title="删除任务" onClick={() => removeTask(Number(task.taskId || task.id))}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHead
          icon={<Save size={15} />}
          title="审核题目"
          extra={
            <div className="row wrap" style={{ gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={() => setSelected(generator.questions.map((_, index) => index))} disabled={!generator.questions.length}>
                全选
              </Button>
              <Button variant="ghost" size="sm" onClick={saveDrafts} disabled={!generator.questions.length || generator.busy}>
                <Save size={13} />
                保存草稿
              </Button>
              <Button variant="primary" size="sm" onClick={approveSelected} disabled={!selected.length || generator.busy}>
                <ClipboardCheck size={13} />
                批准选中
              </Button>
            </div>
          }
        />
        <CardBody>
          {generator.questions.length === 0 ? (
            <Empty icon={<FileQuestion size={22} />} title="生成后在这里审核" desc="题目不会直接入库，必须先保存草稿并批准。" />
          ) : (
            <div className="qg-question-list">
              {generator.questions.map((question, index) => (
                <article className="qg-question" key={question.clientId || question.id || index}>
                  <label className="qg-question__check">
                    <input
                      type="checkbox"
                      checked={selected.includes(index)}
                      onChange={() => setSelected((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])}
                    />
                    <span>第 {index + 1} 题</span>
                  </label>
                  <div className="qg-question__body">
                    <div className="row wrap" style={{ gap: 7 }}>
                      <Tag tone="brand">{TYPE_LABELS[question.type] || question.type}</Tag>
                      {question.id && <Tag tone="green">草稿 #{question.id}</Tag>}
                      {generator.task?.approvedQuestionIds?.includes(Number(question.id)) && <Tag tone="violet">已入库</Tag>}
                    </div>
                    <h3>{question.stem}</h3>
                    {Array.isArray(question.options) && question.options.length > 0 && (
                      <ol className="qg-options">
                        {question.options.map((option, optionIndex) => (
                          <li key={option.key || optionIndex}>
                            <strong>{option.key || String.fromCharCode(65 + optionIndex)}.</strong>
                            <span>{option.text}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    <div className="qg-answer">
                      <strong>答案</strong>
                      <span>{answerText(question)}</span>
                    </div>
                    {question.solution && (
                      <div className="qg-solution">
                        <strong>解析</strong>
                        <p>{question.solution}</p>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

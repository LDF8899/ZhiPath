import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowUp,
  BookMarked,
  Bot,
  CalendarCheck,
  Clock3,
  Database,
  FileQuestion,
  FolderOpen,
  Gauge,
  Image as ImageIcon,
  ListChecks,
  MessageSquarePlus,
  Play,
  Route as RouteIcon,
  Sparkles,
  Trash2,
  User,
  Video,
} from 'lucide-react';
import { chatApi, type ChatAction, type ChatReply, type ChatSession } from '../lib/api';
import { setPendingQuestionConfig } from '../lib/questionGeneratorConfig';
import { toast } from '../store/toast';
import { Markdown } from '../components/Markdown';
import { EvidencePanel } from '../components/Evidence';
import { AnimationCard, DiagramCard, VideoCard } from '../components/ChatMediaCards';
import { Button, LoadingBlock, Tag } from '../components/ui';
import { TrustBadges } from '../components/AgentTrace';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: ChatAction[];
  evidence?: any[];
  citationMiss?: boolean;
  agentName?: string;
  pending?: boolean;
};

const HINTS = [
  '我现在最该补哪个能力项？',
  '帮我生成一个 RAG 检索链路的讲义',
  '我刚才的测验为什么没通过？',
  '按我的情况重新安排本周任务',
  '帮我配置一套严格出题',
  '查知识库里有没有 Transformer 微调资料',
  '抓取最新 AI 资讯入库',
];

const ACTIVE_CHAT_SESSION_KEY = 'codenova_active_chat_session';

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    '我是你的 AI 教练。我背后是五个协作的 Agent：先诊断你的学情，再从知识库取可信内容，生成资源，审核纠偏，最后调整你的学习路径。\n\n你可以直接问我问题，也可以让我生成讲义、出题、重新排任务。我说的每句话都会附上依据，没找到依据的地方我会明确标出来。',
};

/** actions → 业务卡片 */
const ACTION_META: Record<
  string,
  {
    label: string;
    icon: ReactNode;
    tone: 'brand' | 'teal' | 'violet' | 'amber' | 'rose';
    /** 卡片上主按钮的文案与跳转 */
    cta?: { text: string; to?: string; internal?: boolean };
  }
> = {
  generate_path: {
    label: '学习路径建议',
    icon: <RouteIcon size={14} />,
    tone: 'brand',
    cta: { text: '去路径看看', to: '/path' },
  },
  recommend_jobs: {
    label: '岗位匹配分析',
    icon: <Gauge size={14} />,
    tone: 'teal',
    cta: { text: '看成长报告', to: '/report' },
  },
  set_target_job: {
    label: '目标岗位已更新',
    icon: <Gauge size={14} />,
    tone: 'teal',
  },
  generate_exam: {
    label: '严格出题配置',
    icon: <FileQuestion size={14} />,
    tone: 'violet',
    cta: { text: '进入严格出题器', to: '/questions' },
  },
  question_config: {
    label: '出题需求配置',
    icon: <FileQuestion size={14} />,
    tone: 'violet',
    cta: { text: '进入严格出题器', to: '/questions' },
  },
  exam: {
    label: '严格出题配置',
    icon: <FileQuestion size={14} />,
    tone: 'violet',
    cta: { text: '进入严格出题器', to: '/questions' },
  },
  show_progress: {
    label: '当前进度',
    icon: <ListChecks size={14} />,
    tone: 'brand',
    cta: { text: '查看路径', to: '/path' },
  },
  show_today_tasks: {
    label: '今日任务',
    icon: <CalendarCheck size={14} />,
    tone: 'brand',
    cta: { text: '回到今日', to: '/today' },
  },
  recommend_resources: {
    label: '推荐资源',
    icon: <BookMarked size={14} />,
    tone: 'violet',
    cta: { text: '打开资源库', to: '/resources' },
  },
  query_knowledge: {
    label: '知识库检索',
    icon: <Database size={14} />,
    tone: 'teal',
    cta: { text: '打开知识库', to: '/knowledge' },
  },
  knowledge_results: {
    label: '知识库检索',
    icon: <Database size={14} />,
    tone: 'teal',
    cta: { text: '打开知识库', to: '/knowledge' },
  },
  knowledge_ingest: {
    label: '知识库智能体',
    icon: <Database size={14} />,
    tone: 'brand',
    cta: { text: '查看入库任务', to: '/knowledge' },
  },
  knowledge_ingestion_task: {
    label: '知识库智能体',
    icon: <Database size={14} />,
    tone: 'brand',
    cta: { text: '查看入库任务', to: '/knowledge' },
  },
  knowledge_news_refresh: {
    label: '资讯入库',
    icon: <Database size={14} />,
    tone: 'teal',
    cta: { text: '查看知识库', to: '/knowledge' },
  },
  generate_animation: {
    label: '动画演示',
    icon: <Play size={14} />,
    tone: 'amber',
  },
  generate_diagram: {
    label: '图表生成',
    icon: <ImageIcon size={14} />,
    tone: 'amber',
  },
  generate_video: {
    label: '教学视频',
    icon: <Video size={14} />,
    tone: 'amber',
  },
  generate_avatar: {
    label: '数字人讲解',
    icon: <Video size={14} />,
    tone: 'amber',
  },
  // ── 资源结果卡片（执行后由后端返回，内联展示产物）──
  video_pending: {
    label: '教学视频生成中',
    icon: <Video size={14} />,
    tone: 'amber',
  },
  video: {
    label: '教学视频',
    icon: <Video size={14} />,
    tone: 'amber',
  },
  diagram: {
    label: '知识图表',
    icon: <ImageIcon size={14} />,
    tone: 'amber',
  },
  animation: {
    label: '动画演示',
    icon: <Play size={14} />,
    tone: 'amber',
  },
};

export default function Coach() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    loadSessions(true);
  }, []);

  const loadSessions = async (restoreActive = false) => {
    setLoadingSessions(true);
    try {
      const list = await chatApi.sessions(1, 30);
      setSessions(list || []);
      if (restoreActive) {
        const fromUrl = searchParams.get('sessionId') || '';
        const saved = fromUrl || sessionStorage.getItem(ACTIVE_CHAT_SESSION_KEY);
        if (saved && list?.some((item) => item.session_id === saved)) {
          await openSession(saved, false);
        }
      }
    } catch (err: any) {
      toast.error('会话列表读取失败', err?.message || '');
    } finally {
      setLoadingSessions(false);
    }
  };

  const hydrateMessages = (session: ChatSession | null | undefined) => {
    const stored = session?.messages || [];
    const next = stored
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .map((item, index): Message => ({
        id: item.id || item.message_id || `${item.role}-${item.timestamp || index}`,
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: item.content || '',
        actions: item.actions || [],
        agentName: item.agent || undefined,
      }));
    setMessages(next.length ? next : [WELCOME_MESSAGE]);
  };

  const openSession = async (nextSessionId: string, focusComposer = true) => {
    setLoadingSessionId(nextSessionId);
    try {
      const detail = await chatApi.session(nextSessionId);
      if (!detail) {
        toast.error('会话不存在', '这条历史记录可能已被删除');
        return;
      }
      setSessionId(nextSessionId);
      sessionStorage.setItem(ACTIVE_CHAT_SESSION_KEY, nextSessionId);
      hydrateMessages(detail);
      if (focusComposer) textareaRef.current?.focus();
    } catch (err: any) {
      toast.error('会话读取失败', err?.message || '');
    } finally {
      setLoadingSessionId(null);
    }
  };

  const newSession = () => {
    setSessionId(undefined);
    sessionStorage.removeItem(ACTIVE_CHAT_SESSION_KEY);
    setMessages([WELCOME_MESSAGE]);
    setInput('');
    textareaRef.current?.focus();
  };

  const deleteSession = async (targetSessionId: string) => {
    try {
      await chatApi.deleteSession(targetSessionId);
      if (targetSessionId === sessionId) newSession();
      await loadSessions(false);
      toast.success('会话已删除');
    } catch (err: any) {
      toast.error('删除失败', err?.message || '');
    }
  };

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || sending) return;

    const userMessage: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    const placeholder: Message = { id: `p-${Date.now()}`, role: 'assistant', content: '', pending: true };
    setMessages((prev) => [...prev, userMessage, placeholder]);
    setInput('');
    setSending(true);

    try {
      const reply: ChatReply = await chatApi.send(text, sessionId, 'coach');
      setSessionId(reply.session_id);
      sessionStorage.setItem(ACTIVE_CHAT_SESSION_KEY, reply.session_id);
      setMessages((prev) =>
        prev.map((item) =>
          item.id === placeholder.id
            ? {
                ...item,
                content: reply.reply || '（这次没有生成文字回复）',
                actions: reply.actions || [],
                evidence: reply.evidence || [],
                citationMiss: Boolean(reply.citationMiss),
                agentName: reply.agentInfo?.name || reply.agent,
                pending: false,
              }
            : item,
        ),
      );
      loadSessions(false);
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((item) =>
          item.id === placeholder.id
            ? { ...item, content: `抱歉，这次请求失败了：${err?.message || '未知错误'}`, pending: false }
            : item,
        ),
      );
      toast.error('发送失败', err?.message || '');
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const openActionTarget = (action: ChatAction, to?: string) => {
    if (['question_config', 'generate_exam', 'exam'].includes(action.type)) {
      setPendingQuestionConfig(questionConfigFromAction(action));
      navigate('/questions');
      return;
    }
    if (to === '/knowledge') {
      const q = action.data?.query || action.query || '';
      navigate(q ? `/knowledge?q=${encodeURIComponent(q)}` : '/knowledge');
      return;
    }
    if (to) navigate(to);
  };

  return (
    <div className="chat chat--with-sessions">
      <aside className="chat-sessions">
        <div className="chat-sessions__head">
          <span>
            <strong>会话</strong>
            <small>{loadingSessions ? '同步中' : `${sessions.length} 条`}</small>
          </span>
          <button type="button" className="icon-btn" onClick={newSession} aria-label="新对话" title="新对话">
            <MessageSquarePlus size={15} />
          </button>
        </div>

        <div className="chat-sessions__list">
          <button
            type="button"
            className={`chat-session ${!sessionId ? 'is-active' : ''}`}
            onClick={newSession}
          >
            <span className="chat-session__title">新的对话</span>
            <span className="chat-session__meta">从空白上下文开始</span>
          </button>

          {sessions.map((session) => (
            <button
              type="button"
              className={`chat-session ${session.session_id === sessionId ? 'is-active' : ''}`}
              key={session.session_id}
              onClick={() => openSession(session.session_id)}
              disabled={loadingSessionId === session.session_id}
            >
              <span className="chat-session__title">{session.title || session.last_message || '未命名对话'}</span>
              <span className="chat-session__meta">
                <Clock3 size={11} />
                {formatSessionTime(session.updated_at || session.created_at)}
                {typeof session.message_count === 'number' && <span>{session.message_count} 条</span>}
                {Boolean(session.resources_count) && <span>{session.resources_count} 份资源</span>}
              </span>
              <span
                className="chat-session__delete"
                role="button"
                tabIndex={0}
                title="删除会话"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteSession(session.session_id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    deleteSession(session.session_id);
                  }
                }}
              >
                <Trash2 size={12} />
              </span>
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(sessionId ? `/resources?sessionId=${encodeURIComponent(sessionId)}` : '/resources')}
        >
          <FolderOpen size={14} />
          {sessionId ? '本会话资源' : '全部资源'}
        </Button>
      </aside>

      <section className="chat-main">
      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-inner">
          {messages.map((message) =>
            message.role === 'user' ? (
              <div className="msg msg--user" key={message.id}>
                <span className="msg__avatar">
                  <User size={14} />
                </span>
                <div className="msg__col">
                  <div className="msg__bubble">{message.content}</div>
                </div>
              </div>
            ) : (
              <div className="msg msg--ai" key={message.id}>
                <span className="msg__avatar">
                  {message.pending ? (
                    <Sparkles size={14} className="btn__spinner" style={{ border: 'none' }} />
                  ) : (
                    <Bot size={14} />
                  )}
                </span>
                <div className="msg__col">
                  {message.agentName && !message.pending && (
                    <span className="tag tag--brand" style={{ alignSelf: 'flex-start' }}>
                      <Bot size={10} />
                      {message.agentName}
                    </span>
                  )}

                  {message.pending ? (
                    <div className="msg__bubble">
                      <span className="thinking" style={{ color: 'var(--brand-600)' }}>
                        <span />
                        <span />
                        <span />
                      </span>
                      <span className="small muted" style={{ marginLeft: 8 }}>
                        正在路由意图、检索知识库
                      </span>
                    </div>
                  ) : (
                    <>
                      {message.content && <div className="msg__bubble"><Markdown source={message.content} /></div>}

                      {/* 可信生成指标：只展示后端真实回传的数据（引用条数 + 引用校验结果） */}
                      {(message.evidence?.length || message.citationMiss) && (
                        <div style={{ maxWidth: '100%' }}>
                          <TrustBadges
                            evidenceCount={message.evidence?.length || 0}
                            citationMiss={message.citationMiss}
                          />
                        </div>
                      )}

                      {/* 业务卡片 */}
                      {(message.actions || []).map((action, index) => {
                        const meta = ACTION_META[action.type] || {
                          label: action.type,
                          icon: <Sparkles size={14} />,
                          tone: 'brand' as const,
                        };
                        return (
                          <div className="action-card" key={`${action.type}-${index}`}>
                            <header className="action-card__head">
                              <span
                                className="action-card__icon"
                                style={{
                                  background: `var(--${meta.tone}-100, var(--brand-100))`,
                                  color: `var(--${meta.tone}-600, var(--brand-600))`,
                                }}
                              >
                                {meta.icon}
                              </span>
                              <span className="action-card__title">{meta.label}</span>
                            </header>

                            <div className="action-card__body">
                              <ActionBody action={action} />
                            </div>

                            {meta.cta && (
                              <div className="action-card__foot">
                                <Button
                                  size="sm"
                                  variant="soft"
                                  onClick={() => openActionTarget(action, meta.cta?.to)}
                                >
                                  {meta.cta.text}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* 证据链 */}
                      <EvidencePanel items={message.evidence || []} citationMiss={message.citationMiss} />
                    </>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="composer">
        <div className="composer__inner">
          <div className="composer__box">
            <textarea
              ref={textareaRef}
              className="composer__input"
              rows={1}
              value={input}
              placeholder="问我任何关于学习的问题，或让我帮你生成资源…"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
            />
            <button
              type="button"
              className="composer__send"
              onClick={() => send()}
              disabled={!input.trim() || sending}
              aria-label="发送"
            >
              {sending ? (
                <span className="btn__spinner" style={{ width: 13, height: 13 }} />
              ) : (
                <ArrowUp size={16} strokeWidth={2.6} />
              )}
            </button>
          </div>

          <div className="composer__hints">
            {HINTS.map((hint) => (
              <button
                key={hint}
                type="button"
                className="composer__hint"
                onClick={() => send(hint)}
                disabled={sending}
              >
                {hint}
              </button>
            ))}
          </div>
        </div>
      </div>
      </section>
    </div>
  );
}

function formatSessionTime(raw?: number) {
  if (!raw) return '刚刚';
  const value = Number(raw);
  if (!Number.isFinite(value)) return '刚刚';
  const ms = value > 1e12 ? value : value * 1000;
  return new Date(ms).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function questionConfigFromAction(action: ChatAction) {
  const source = action.data?.config || action.config || action.data || action;
  const rawType = source.question_type || action.question_type;
  const rawTypes = source.questionTypes || action.questionTypes;
  const questionTypes = Array.isArray(rawTypes) && rawTypes.length
    ? rawTypes
    : rawType === 'mixed'
      ? ['choice', 'fill', 'coding']
      : [String(rawType || 'choice')];
  return {
    subject: source.subject || source.skillName || action.skillName || '',
    count: Number(source.count || source.question_count || action.count || action.question_count || 5),
    difficulty: Number(source.difficulty || action.difficulty || 5),
    questionTypes,
    topics: Array.isArray(source.topics) ? source.topics : [],
    instructions: source.instructions || '',
    locale: source.locale || 'zh-CN',
    referenceLibrary: source.referenceLibrary ?? true,
    metadata: {
      ...(source.metadata || {}),
      fromAgentAction: action.type,
    },
  };
}

function statusText(status: string) {
  const map: Record<string, string> = {
    pending: '待处理',
    cleaning: '清洗中',
    inspecting: '质检中',
    approved: '已通过',
    rejected: '已拒绝',
    ingested: '已入库',
    failed: '失败',
  };
  return map[status] || status;
}

/** 按 action 类型渲染卡片内容，缺字段时不显示空壳 */
function ActionBody({ action }: { action: ChatAction }) {
  const skills: string[] = action.skills || [];

  switch (action.type) {
    case 'recommend_resources':
      return (
        <>
          <span className="small muted">围绕这些主题推荐了资源</span>
          {skills.length > 0 && (
            <div className="row wrap" style={{ gap: 6 }}>
              {skills.slice(0, 8).map((skill) => (
                <Tag key={skill} tone="brand">
                  {skill}
                </Tag>
              ))}
            </div>
          )}
        </>
      );

    case 'query_knowledge':
      return <span className="small">正在按“{action.query || action.skillName || '当前问题'}”检索知识库证据。</span>;

    case 'knowledge_results': {
      const data = action.data || {};
      const items = data.items || [];
      return (
        <>
          <span className="small">「{data.query || '检索'}」命中 <strong>{data.total ?? items.length}</strong> 条证据。</span>
          {items.length > 0 && (
            <div className="stack" style={{ gap: 5, marginTop: 4 }}>
              {items.slice(0, 3).map((item: any) => (
                <span className="small" key={item.chunkId}>
                  · 证据 #{item.chunkId} {item.title || ''}{typeof item.score === 'number' ? `（相关度 ${Math.round(item.score * 100)}%）` : ''}
                </span>
              ))}
            </div>
          )}
        </>
      );
    }

    case 'knowledge_ingest':
      return <span className="small">资料已提交给知识库智能体，处理时会先清洗并进行入库质检。</span>;

    case 'knowledge_ingestion_task': {
      const task = action.data?.task || action.task || {};
      const score = task.inspectionResult?.score;
      const status = task.ingestionStatus || task.ingestion_status || '';
      return (
        <>
          <span className="small">{task.title || '资料'}：{status ? statusText(status) : '已处理'}{typeof score === 'number' ? `，质检 ${score} 分` : ''}。</span>
          {task.failureReason && <span className="tiny muted">{task.failureReason}</span>}
          {Array.isArray(task.ingestedChunkIds) && task.ingestedChunkIds.length > 0 && (
            <span className="tiny muted">已写入 {task.ingestedChunkIds.length} 个证据切片。</span>
          )}
        </>
      );
    }

    case 'knowledge_news_refresh': {
      const data = action.data || {};
      return (
        <span className="small">
          资讯处理完成：创建 {data.totalTasks || 0} 个任务，入库 {data.ingested || 0} 条，拒绝 {data.rejected || 0} 条。
        </span>
      );
    }

    case 'generate_exam':
      return (
        <>
          <span className="small">
            已解析为严格出题配置：<strong>{action.skillName || action.data?.skillName || '当前能力项'}</strong>，
            {action.question_count || action.data?.count || 5} 题，难度 {action.difficulty || action.data?.difficulty || '默认'}。
          </span>
          <span className="tiny muted">进入出题器后仍会走生成任务、草稿保存、审核入库，不直接把聊天答案当题库题。</span>
        </>
      );

    case 'question_config': {
      const config = action.data?.config || action.config || action.data || action;
      return (
        <>
          <span className="small">
            智能体已整理出题参数：<strong>{config.subject || config.skillName || '待确认主题'}</strong>，
            {config.count || config.question_count || 5} 题，题型 {(config.questionTypes || []).join(' / ') || config.question_type || '默认'}。
          </span>
          {config.summary && <span className="tiny muted">{config.summary}</span>}
        </>
      );
    }

    case 'generate_path':
      return (
        <span className="small">
          生成路径建议{action.plan_name ? `：${action.plan_name}` : ''}
          {skills.length > 0 ? `，覆盖 ${skills.length} 个能力项` : ''}。
        </span>
      );

    case 'recommend_jobs':
      return <span className="small">已按你当前的能力档案重新计算岗位匹配情况。</span>;

    case 'show_progress':
    case 'progress': {
      // 后端带完整 phase 明细，直接画出来，比一句"已读取"有用得多
      const phases: Array<{ name?: string; total?: number; done?: number; status?: string }> =
        action.phases || action.data?.phases || [];
      const total = action.total_skills ?? action.data?.total_skills;
      const done = action.done_skills ?? action.data?.done_skills;
      const match = action.matchScore ?? action.data?.matchScore;
      return (
        <>
          {typeof total === 'number' && (
            <span className="small">
              能力项进度 <strong>{done ?? 0} / {total}</strong>
              {typeof match === 'number' && match > 0 ? `，当前匹配度 ${match}%` : ''}。
            </span>
          )}
          {phases.length > 0 && (
            <div className="stack" style={{ gap: 4, marginTop: 4 }}>
              {phases.slice(0, 5).map((phase, index) => (
                <div className="row" style={{ gap: 8, alignItems: 'center' }} key={index}>
                  <span
                    className="dot"
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background:
                        phase.status === 'current' ? 'var(--brand-600)' : (phase.done ?? 0) >= (phase.total ?? 1) ? 'var(--green-600)' : 'var(--border)',
                    }}
                  />
                  <span className="small">{phase.name || `阶段 ${index + 1}`}</span>
                  <span className="tiny muted">
                    {(phase.done ?? 0)}/{phase.total ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
          {phases.length === 0 && typeof total !== 'number' && (
            <span className="small">已读取你最新的进度与任务安排。</span>
          )}
        </>
      );
    }

    case 'show_today_tasks':
    case 'today_tasks':
      return <span className="small">已读取你最新的进度与任务安排。</span>;

    case 'path_generated': {
      const data = action.data || {};
      const skills = data.total_skills ?? action.total_skills;
      const date = data.estimatedDate ?? action.estimatedDate;
      return (
        <span className="small">
          学习路径已生成
          {typeof skills === 'number' ? `，共 ${skills} 个关键技能点` : ''}
          {date ? `，预计 ${date} 达成` : ''}。
        </span>
      );
    }

    case 'recommend_resources':
    case 'resources':
    case 'resource': {
      const items: Array<{ title?: string; resourceTitle?: string; skillName?: string; type?: string }> =
        action.resources || action.data?.resources || action.items || [];
      return (
        <>
          <span className="small muted">
            {items.length > 0 ? `为你找到 ${items.length} 份资源` : '围绕这些主题推荐了资源'}
          </span>
          {items.length > 0 ? (
            <div className="stack" style={{ gap: 4, marginTop: 4 }}>
              {items.slice(0, 5).map((item, index) => (
                <span className="small" key={index}>
                  · {item.title || item.resourceTitle || item.skillName || '资源'}
                  {item.type ? `（${item.type}）` : ''}
                </span>
              ))}
            </div>
          ) : (
            skills.length > 0 && (
              <div className="row wrap" style={{ gap: 6 }}>
                {skills.slice(0, 8).map((skill) => (
                  <Tag key={skill} tone="brand">{skill}</Tag>
                ))}
              </div>
            )
          )}
        </>
      );
    }

    case 'generate_exam':
    case 'exam': {
      const count = action.question_count ?? action.data?.total ?? action.data?.count;
      const skill = action.skillName ?? action.data?.skillName;
      return (
        <span className="small">
          已为 <strong>{skill || '当前能力项'}</strong> 准备 {count || 5} 道题的严格生成参数，可进入出题器审核后入库。
        </span>
      );
    }

    case 'recommend_jobs':
    case 'jobs': {
      const items: Array<{ jobTitle?: string; title?: string; matchScore?: number }> =
        action.jobs || action.data?.jobs || [];
      return (
        <>
          <span className="small">
            {items.length > 0 ? '为你推荐了这些岗位' : '已按你当前的能力档案重新计算岗位匹配。'}
          </span>
          {items.length > 0 && (
            <div className="stack" style={{ gap: 4, marginTop: 4 }}>
              {items.slice(0, 4).map((job, index) => (
                <span className="small" key={index}>
                  · {job.jobTitle || job.title}
                  {typeof job.matchScore === 'number' ? `（匹配 ${job.matchScore}%）` : ''}
                </span>
              ))}
            </div>
          )}
        </>
      );
    }

    case 'set_target_job':
    case 'target_set':
      return <span className="small">目标岗位已更新，匹配度会重新计算。</span>;

    case 'generate_diagram':
    case 'generate_animation':
    case 'generate_video':
    case 'generate_avatar':
      return (
        <span className="small">
          正在为 <strong>{action.skillName || '该主题'}</strong>{' '}
          {action.type === 'generate_diagram'
            ? `生成${action.diagramType || '流程图'}`
            : action.type === 'generate_video'
              ? '生成教学视频'
              : action.type === 'generate_avatar'
                ? '生成数字人讲解'
                : '生成动画演示'}
          。生成完成后会出现在资源库。
        </span>
      );

    // ── 多模态资源结果：内联展示产物，切页回来可恢复 ──
    case 'video_pending':
    case 'video':
      return (
        <VideoCard
          data={{
            taskId: action.taskId || action.data?.taskId,
            skillName: action.skillName || action.data?.skillName,
            skill: action.skill || action.data?.skill,
            difficulty: action.difficulty || action.data?.difficulty,
            status: action.type === 'video' ? 'completed' : action.status,
            message: action.message || action.data?.message,
            video_file_path: action.video_file_path || action.data?.video_file_path,
            videoFilePath: action.videoFilePath || action.data?.videoFilePath,
            video_file: action.video_file || action.data?.video_file,
            audio_file_path: action.audio_file_path || action.data?.audio_file_path,
            render_status: action.render_status || action.data?.render_status,
            render_error: action.render_error || action.data?.render_error,
            audio_merge_status: action.audio_merge_status || action.data?.audio_merge_status,
            audio_merge_error: action.audio_merge_error || action.data?.audio_merge_error,
            url: action.url || action.data?.url,
          }}
        />
      );
    case 'diagram':
      if (action.data?.mermaid || action.mermaid) {
        return <DiagramCard data={action.data || action} />;
      }
      return <span className="small muted">图表已生成，去资源库查看。</span>;
    case 'animation':
      if (action.data?.html || action.html) {
        return <AnimationCard data={action.data || action} />;
      }
      return <span className="small muted">动画已生成，去资源库查看。</span>;

    case 'set_target_job':
      return <span className="small">目标岗位已更新，匹配度会重新计算。</span>;

    default:
      return (
        <span className="small muted">
          {action.skillName ? `相关能力项：${action.skillName}` : '已执行对应动作。'}
        </span>
      );
  }
}

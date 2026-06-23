import { useState, useRef, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import type { ChatMessage, ChatAction, ChatSession, ResourceItem } from '../../types';
import { sendChat, getChatSessions, getChatSession, deleteChatSession, getKnowledge } from '../../api/user';
import { useChatStore } from '../../stores/chat';
import { useOfficeStore } from '../../stores/office';
import { useWorkspaceStore } from '../../stores/workspace';
import AgentPanel from '../../components/workspace/AgentPanel';
import AgentMessage from '../../components/chat/AgentMessage';
import '../../styles/hand-draw.css';
import '../../styles/chat.css';
import '../../styles/office-chat.css';
import '../../styles/agent-panel.css';
import {
  IconSend,
  IconRobot,
  IconChat,
  IconPlus,
  IconTrash,
  IconUser,
  IconCheck,
  IconLightbulb,
  IconRefresh,
} from '../../components/icons';
import JobCard from '../../components/JobCard';
import ProgressCard from '../../components/ProgressCard';
import TaskCard from '../../components/TaskCard';
import ExamCard from '../../components/ExamCard';
import ResourceCard from '../../components/ResourceCard';
import AnimationCard from '../../components/AnimationCard';
import DiagramCard from '../../components/DiagramCard';
import VideoCard from '../../components/VideoCard';
import AvatarCard from '../../components/AvatarCard';
import SkillGapCard from '../../components/SkillGapCard';

/** 拖拽智能体到输入框时的提示语映射 */
const AGENT_DROP_PROMPTS: Record<string, string> = {
  path: '请帮我制定一个学习路径',
  exam: '请帮我出几道练习题',
  jobs: '请根据我的技能推荐适合的岗位',
  video: '请帮我生成一个教学视频',
  animation: '请帮我做一个动画演示',
  diagram: '请帮我画一个流程图',
  progress: '请帮我查看学习进度',
  tasks: '请告诉我今天应该学什么',
  resources: '请帮我推荐一些学习资源',
  target: '请帮我设置目标岗位',
  gap: '请帮我分析匹配度差距',
};

/* ── simple toast helper (no antd) ── */
function showToast(text: string, type: 'success' | 'error' = 'success') {
  const el = document.createElement('div');
  el.className = `chat-toast ${type}`;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/** 将资源写入 localStorage，供智能体办公室"资源"tab 读取 */
function saveResource(item: Omit<ResourceItem, 'id' | 'savedAt' | 'source'>) {
  try {
    const key = 'zhpath_resources';
    const existing: ResourceItem[] = JSON.parse(localStorage.getItem(key) || '[]');
    // 去重：同 skill + type 不重复存
    const dup = existing.find(r => r.skill === item.skill && r.type === item.type);
    if (dup) {
      dup.data = item.data;
      dup.savedAt = Date.now();
    } else {
      existing.unshift({ ...item, id: `res_${Date.now()}`, savedAt: Date.now(), source: 'chat' });
    }
    // 最多保留 100 条
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 100)));
  } catch {}
}

export default function Chat() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // 持久化对话状态（页面切换不丢失）
  const {
    mainMessages,
    currentSessionId,
    setCurrentSessionId,
    setMainMessages,
    appendMainMessage,
    clearMainSession,
  } = useChatStore();

  const {
    sidebarOpen: officeSidebarOpen,
    toggleSidebar: toggleOfficeSidebar,
    setActiveAgent,
    setAgentStatus,
    addTask,
    updateTask,
  } = useOfficeStore();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prefillSent = useRef(false);
  const processedSSE = useRef(new Set<string>());

  // ── SSE 监听：资源就绪事件 → 在聊天中渲染资源卡片 ──
  // 直接用 EventSource，不走 useSSE hook（避免频繁 setEvents 触发重渲染）
  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!token) return;
    const es = new EventSource(`/api/user/events/stream?token=${encodeURIComponent(token)}`);

    es.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'resource_ready') return;
        const { skill_name, content_type } = data.data || {};
        if (!skill_name || !content_type) return;

        const eventKey = `${skill_name}_${content_type}_${data.timestamp || ''}`;
        if (processedSSE.current.has(eventKey)) return;
        processedSSE.current.add(eventKey);

        const res = await getKnowledge(encodeURIComponent(skill_name));
        if (res.code !== 200 || !res.data) return;
        const kb = res.data;
        const newActions: ChatAction[] = [];

        if (content_type === 'lecture' || content_type === 'reading') {
          if (kb.lecture) {
            newActions.push({ type: 'resources', data: [{ title: `${skill_name} 讲义`, type: 'lecture' }] });
            saveResource({ skill: skill_name, type: 'lecture', title: `${skill_name} 讲义`, data: kb.lecture });
          }
        } else if (content_type === 'quiz' || content_type === 'coding') {
          const quizData = content_type === 'quiz' ? kb.quiz : kb.coding;
          if (quizData) {
            const examPayload = { skill: skill_name, questions: Array.isArray(quizData) ? quizData : quizData.questions || [] };
            newActions.push({ type: 'exam', data: examPayload });
            saveResource({ skill: skill_name, type: content_type as 'quiz' | 'coding', title: `${skill_name} ${content_type === 'quiz' ? '练习题' : '编程题'}`, data: examPayload });
          }
        } else if (content_type === 'animation') {
          if (kb.animation) {
            newActions.push({ type: 'animation', data: { skill: skill_name, title: `${skill_name} 动画`, html: kb.animation } });
            saveResource({ skill: skill_name, type: 'animation', title: `${skill_name} 动画`, data: kb.animation });
          }
        } else if (content_type === 'diagram') {
          if (kb.diagram) {
            newActions.push({ type: 'diagram', data: { skill: skill_name, title: `${skill_name} 图表`, mermaid: kb.diagram } });
            saveResource({ skill: skill_name, type: 'diagram', title: `${skill_name} 图表`, data: kb.diagram });
          }
        }

        if (newActions.length === 0) return;

        // 追加到最新 assistant 消息的 actions（通过 store 获取最新状态）
        const store = useChatStore.getState();
        const curId = store.currentSessionId;
        const curMsgs = store.mainMessages[curId] || [];
        const lastIdx = curMsgs.length - 1;
        if (lastIdx < 0) return;
        const updated = [...curMsgs];
        updated[lastIdx] = { ...updated[lastIdx], actions: [...(updated[lastIdx].actions || []), ...newActions] };
        store.setMainMessages(curId, updated);

        showToast(`📎 ${skill_name} 资源已就绪`, 'success');
      } catch {}
    };

    return () => { es.close(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 从 store 获取当前 session 的消息
  const messages = mainMessages[currentSessionId] || [];

  // ── 加载历史会话列表 ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getChatSessions({ page: 1, pageSize: 50 });
        if (cancelled || res.code !== 200) return;
        const list = res.data as ChatSession[];
        setSessions(list);

        // 恢复上次会话或自动选中最新的
        const savedId = currentSessionId;
        const target = list.find(s => s.sessionId === savedId) || list[0];
        if (target) {
          setCurrentSessionId(target.sessionId);
          // 如果 store 中没有该会话消息，从后端加载
          if (!mainMessages[target.sessionId]) {
            const detail = await getChatSession(target.sessionId);
            if (!cancelled && detail.code === 200 && detail.data) {
              setMainMessages(target.sessionId, (detail.data as ChatSession).messages || []);
            }
          }
        }
      } catch (e) {
        console.warn('[Chat] Failed to load sessions:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 从 PlanCreate 跳转过来时，自动发送预填消息
  useEffect(() => {
    const prefill = (location.state as any)?.prefill;
    if (prefill && !prefillSent.current && !loading) {
      prefillSent.current = true;
      window.history.replaceState({}, '');
      handleSend(prefill);
    }
  }, [location.state, loading]);

  // 智能体派发 URL 参数：?agent=path&auto=1
  useEffect(() => {
    const agentKey = searchParams.get('agent');
    const auto = searchParams.get('auto');
    if (agentKey && auto === '1') {
      const prompt = AGENT_DROP_PROMPTS[agentKey] || `请帮我处理${agentKey}相关任务`;
      setInput(prompt);
      setTimeout(() => {
        handleSend(prompt);
        setSearchParams({}, { replace: true });
      }, 300);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // 切换会话时加载消息
  const handleSwitchSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setSidebarOpen(false);
    if (!mainMessages[sessionId]) {
      try {
        const detail = await getChatSession(sessionId);
        if (detail.code === 200 && detail.data) {
          setMainMessages(sessionId, (detail.data as ChatSession).messages || []);
        }
      } catch (e) {
        console.warn('[Chat] Failed to load session detail:', e);
      }
    }
  };

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || sending) return;

    const userMsg: ChatMessage = { role: 'user', content: msg, timestamp: Date.now() };
    const oldSessionId = currentSessionId || '__pending__';
    const prevMessages = mainMessages[oldSessionId] || [];
    setMainMessages(oldSessionId, [...prevMessages, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await sendChat(msg, currentSessionId || undefined, 'chat');
      // 智能体状态联动
      if (res.data?.agent) {
        setActiveAgent(res.data.agent);
        setAgentStatus(res.data.agent, 'working');

        // 2秒后恢复空闲
        setTimeout(() => {
          setAgentStatus(res.data.agent, 'idle');
        }, 2000);
      }

      // 视频任务进度
      if (res.data?.actions?.some((a: any) => a.type === 'video_pending')) {
        const videoAction = res.data.actions.find((a: any) => a.type === 'video_pending');
        if (videoAction?.data?.taskId) {
          addTask({
            taskId: videoAction.data.taskId,
            agentId: 'generate_video',
            name: `生成${videoAction.data.skillName || ''}教学视频`,
            progress: 0,
            status: 'running',
            message: '准备中...',
          });
        }
      }

      if (res.code === 200) {
        const reply = res.data.reply;
        const content = typeof reply === 'string' ? reply : (reply?.text || reply?.content || JSON.stringify(reply));
        const aiMsg: ChatMessage = {
          role: 'assistant',
          content,
          agent: res.data.agent,
          timestamp: Date.now(),
          actions: res.data.actions,
        };
        const newSessionId = res.data.sessionId;

        // 工作区事件发射：将后端 actions 桥接到跨页面事件总线
        try {
          const emit = useWorkspaceStore.getState().emit;
          if (res.data?.actions) {
            for (const action of res.data.actions) {
              switch (action.type) {
                case 'path_generated':
                  emit({
                    type: 'path_generated',
                    planId: action.data?.planId,
                    planName: action.data?.planName || '',
                    totalSkills: action.data?.totalSkills || 0,
                  });
                  break;
                case 'video':
                case 'animation':
                case 'diagram':
                  emit({
                    type: 'resource_ready',
                    skillName: action.data?.skillName || '',
                    contentType: action.type,
                  });
                  break;
              }
            }
          }
        } catch { /* workspace 事件发射失败不影响主流程 */ }

        // 将 action 资源同步写入 localStorage（供智能体办公室"资源"tab）
        if (res.data?.actions) {
          for (const action of res.data.actions) {
            const skill = action.data?.skillName || action.data?.skill || '';
            if (action.type === 'exam' && action.data?.questions && skill) {
              saveResource({ skill, type: 'quiz', title: `${skill} 练习题`, data: action.data });
            } else if (action.type === 'animation' && action.data?.html) {
              saveResource({ skill, type: 'animation', title: `${skill} 动画`, data: action.data });
            } else if (action.type === 'diagram' && action.data?.mermaid) {
              saveResource({ skill, type: 'diagram', title: `${skill} 图表`, data: action.data });
            } else if ((action.type === 'video' || action.type === 'video_pending') && skill) {
              saveResource({ skill, type: 'video', title: `${skill} 视频`, data: action.data });
            }
          }
        }

        // 去重：新的 video 卡片替换旧的同 skill 卡片
        let prevMsgs = mainMessages[oldSessionId] || [];
        const newVideoAction = aiMsg.actions?.find(
          (a: any) => a.type === 'video_pending' || a.type === 'video',
        );
        if (newVideoAction?.data?.skillName) {
          const newSkill = newVideoAction.data.skillName;
          prevMsgs = prevMsgs.map((m) => ({
            ...m,
            actions: m.actions?.filter(
              (a: any) => !(
                (a.type === 'video_pending' || a.type === 'video') &&
                a.data?.skillName === newSkill
              ),
            ),
          }));
        }
        const sentMessages = [...prevMsgs, aiMsg];

        if (newSessionId && newSessionId !== oldSessionId) {
          // 新会话：迁移消息到新 sessionId
          setMainMessages(newSessionId, sentMessages);
          clearMainSession(oldSessionId);
          setCurrentSessionId(newSessionId);
          setSessions((prev) => {
            const exists = prev.find((s) => s.sessionId === newSessionId);
            if (exists) return prev;
            return [{
              sessionId: newSessionId,
              userId: '',
              pageContext: 'chat',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              messages: sentMessages,
            }, ...prev];
          });
        } else {
          setMainMessages(newSessionId || oldSessionId, sentMessages);
        }
      }
    } catch (err: any) {
      showToast(err?.message || '发送失败，请稍后重试', 'error');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleNewSession = () => {
    setCurrentSessionId('');
    setSidebarOpen(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    // 先更新本地 UI
    setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    clearMainSession(sessionId);
    if (currentSessionId === sessionId) {
      const remaining = sessions.filter((s) => s.sessionId !== sessionId);
      if (remaining.length > 0) {
        handleSwitchSession(remaining[0].sessionId);
      } else {
        handleNewSession();
      }
    }
    // 调用后端删除
    try {
      await deleteChatSession(sessionId);
    } catch (e) {
      console.warn('[Chat] Failed to delete session:', e);
    }
  };

  return (
    <div className="chat-page with-office">
      {/* ── Mobile header ── */}
      <div className="chat-mobile-header">
        <button className="chat-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <span /><span /><span />
        </button>
        <div className="chat-mobile-title">
          <IconRobot size={18} />
          <span>AI 助教</span>
        </div>
        <button className="chat-mobile-new" onClick={handleNewSession}>
          <IconPlus size={16} />
        </button>
      </div>

      {/* ── Sidebar overlay ── */}
      {sidebarOpen && <div className="chat-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── Session sidebar ── */}
      <aside className={`chat-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Brand */}
        <div className="chat-sidebar-brand">
          <span className="chat-sidebar-logo">智途</span>
          <span className="chat-sidebar-tag">AI 助教</span>
        </div>

        {/* New session button */}
        <button className="chat-new-btn" onClick={handleNewSession}>
          <IconPlus size={14} />
          <span>新对话</span>
        </button>

        {/* Session list */}
        <div className="chat-session-list">
          {loading ? (
            <div className="chat-empty-sessions">
              <p>加载中...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="chat-empty-sessions">
              {/* Doodle of a chat bubble */}
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.4 }}>
                <path d="M8 10 C8 8 10 6 12 6 H36 C38 6 40 8 40 10 V28 C40 30 38 32 36 32 H18 L10 38 V32 H12 C10 32 8 30 8 28 Z"
                  stroke="var(--pencil)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="4 3" />
                <path d="M16 16 H32" stroke="var(--pencil)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                <path d="M16 22 H26" stroke="var(--pencil)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
              </svg>
              <p>暂无对话记录</p>
              <p className="sub">开始新对话试试吧</p>
            </div>
          ) : (
            sessions.map((s, i) => (
              <div
                key={s.sessionId}
                onClick={() => handleSwitchSession(s.sessionId)}
                className={`chat-session-item ${s.sessionId === currentSessionId ? 'active' : ''}`}
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <span className="chat-session-icon">
                  <IconChat size={14} />
                </span>
                <span className="chat-session-text">
                  {(() => {
                    const msgs = mainMessages[s.sessionId] || s.messages || [];
                    const first = msgs[0]?.content;
                    return typeof first === 'string' ? first.slice(0, 20) : '新对话';
                  })()}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.sessionId); }}
                  className="chat-session-delete"
                  title="删除对话"
                >
                  <IconTrash size={12} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Bottom doodle decoration */}
        <div className="chat-sidebar-doodle">
          <svg width="120" height="40" viewBox="0 0 120 40" fill="none" style={{ opacity: 0.2 }}>
            <path d="M10 30 Q30 10 60 25 T110 20" stroke="var(--pencil)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="6 4" />
            <circle cx="60" cy="25" r="3" fill="var(--accent)" opacity="0.6" />
          </svg>
        </div>
      </aside>

      {/* ── Chat area ── */}
      <main className="chat-main">
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-left">
            <div className="chat-header-avatar">
              <IconRobot size={20} />
            </div>
            <div>
              <h2>AI 助教</h2>
              <span className="chat-header-status">
                <span className="chat-status-dot" />
                在线
              </span>
            </div>
          </div>
          <div className="chat-header-right">
            <span className="chat-header-hint">
              {/* Doodle underline */}
              <svg width="80" height="8" viewBox="0 0 80 8" fill="none" style={{ position: 'absolute', bottom: -2, left: 0, right: 0 }}>
                <path d="M2 5 Q20 2 40 5 T78 4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
              </svg>
              试试问我任何问题
            </span>
          </div>
        </div>

        {/* Messages area */}
        <div className="chat-messages">
          {messages.length === 0 ? (
            /* ── Empty state ── */
            <div className="chat-empty">
              {/* Hand-drawn robot doodle */}
              <div className="chat-empty-avatar">
                <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
                  {/* Robot head */}
                  <rect x="16" y="14" width="40" height="32" rx="6" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
                  {/* Antenna */}
                  <path d="M36 14 V8" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="36" cy="6" r="3" fill="var(--accent)" stroke="var(--ink)" strokeWidth="1.5" />
                  {/* Eyes */}
                  <circle cx="28" cy="28" r="3.5" fill="var(--highlight)" stroke="var(--ink)" strokeWidth="1.5" />
                  <circle cx="44" cy="28" r="3.5" fill="var(--highlight)" stroke="var(--ink)" strokeWidth="1.5" />
                  <circle cx="29" cy="27" r="1.5" fill="var(--ink)" />
                  <circle cx="45" cy="27" r="1.5" fill="var(--ink)" />
                  {/* Mouth */}
                  <path d="M28 36 Q36 42 44 36" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" fill="none" />
                  {/* Body */}
                  <rect x="22" y="48" width="28" height="16" rx="4" stroke="var(--ink)" strokeWidth="2" fill="var(--paper-tint)" />
                  <path d="M30 52 H42" stroke="var(--pencil)" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M30 56 H38" stroke="var(--pencil)" strokeWidth="1.5" strokeLinecap="round" />
                  {/* Arms */}
                  <path d="M16 36 L8 40" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
                  <path d="M56 36 L64 40" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>

              <h2 className="chat-empty-title">你好，我是智途 AI 助教</h2>
              <p className="chat-empty-desc">
                直接告诉我你想做什么，我会自动匹配最合适的智能体。<br />
                也可以从右侧办公室拖一个智能体过来。
              </p>

              {/* 拖拽提示 */}
              <div className="chat-empty-drag-hint">
                <span className="chat-empty-drag-icon">👈</span>
                <span>从右侧拖入智能体，或直接打字</span>
              </div>

              {/* Decorative sticky note */}
              <div className="chat-empty-note">
                <div className="chat-note-tape" />
                <p><IconLightbulb size={16} style={{display:'inline',verticalAlign:'middle',marginRight:4}} /> 小贴士：你可以直接问<br />「推荐适合我的岗位」</p>
              </div>

              {/* Decorative doodles */}
              <svg className="chat-empty-doodle-1" width="60" height="60" viewBox="0 0 60 60" fill="none">
                <path d="M10 50 Q20 20 50 15" stroke="var(--pencil)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="5 4" opacity="0.3" />
                <circle cx="50" cy="15" r="4" fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity="0.3" />
              </svg>
              <svg className="chat-empty-doodle-2" width="80" height="40" viewBox="0 0 80 40" fill="none">
                <path d="M5 20 Q25 5 45 20 T75 18" stroke="var(--pencil)" strokeWidth="1" strokeLinecap="round" strokeDasharray="4 5" opacity="0.2" />
              </svg>
            </div>
          ) : (
            /* ── Message list ── */
            <div className="chat-message-list">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`chat-msg ${msg.role === 'user' ? 'user' : 'assistant'}`}
                  style={{ animationDelay: `${i * 0.03}s` }}
                >
                  {/* Avatar */}
                  <div className={`chat-msg-avatar ${msg.role === 'user' ? 'user' : 'bot'}`}>
                    {msg.role === 'user' ? <IconUser size={16} /> : <IconRobot size={16} />}
                  </div>

                  {/* Bubble */}
                  <div className="chat-msg-content">
                    {msg.role === 'assistant' ? (
                      <AgentMessage message={msg} isLast={i === messages.length - 1} />
                    ) : (
                      <div className={`chat-bubble ${msg.role === 'user' ? 'user' : 'bot'}`}>
                        {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                      </div>
                    )}

                    {/* Action cards */}
                    {msg.actions?.map((action, j) => (
                      <div key={j} className="chat-action-wrap">
                        <ActionRenderer action={action} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {sending && (
                <div className="chat-msg assistant">
                  <div className="chat-msg-avatar bot">
                    <IconRobot size={16} />
                  </div>
                  <div className="chat-msg-content">
                    <div className="chat-bubble bot chat-typing">
                      <span className="chat-typing-dot" />
                      <span className="chat-typing-dot" />
                      <span className="chat-typing-dot" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── Input bar (drop zone) ── */}
        <div
          className={`chat-input-bar ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const agentKey = e.dataTransfer.getData('application/zhipath-agent');
            if (agentKey) {
              const prompt = AGENT_DROP_PROMPTS[agentKey] || `请帮我处理${agentKey}相关任务`;
              setInput(prompt);
              inputRef.current?.focus();
            }
          }}
        >
          <div className="chat-input-inner">
            {/* Doodle pencil icon */}
            <svg className="chat-input-pencil" width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 16 L3.5 11.5 L13 2 L16 5 L6.5 14.5 Z" stroke="var(--pencil)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M11 4 L14 7" stroke="var(--pencil)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              className="chat-input"
              placeholder={dragOver ? '松开即可调用智能体...' : '写下你的问题...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              disabled={sending}
            />
            <button
              className="chat-send-btn"
              onClick={() => handleSend()}
              disabled={!input.trim() || sending}
            >
              <IconSend size={18} />
              <span>发送</span>
            </button>
          </div>
          <div className="chat-input-hint">
            <span>Enter 发送 · Shift+Enter 换行</span>
          </div>
        </div>
      </main>

      {/* 融合智能体面板 */}
      <AgentPanel
        isOpen={officeSidebarOpen}
        onToggle={toggleOfficeSidebar}
        onAgentClick={(agentKey) => {
          const prompt = AGENT_DROP_PROMPTS[agentKey] || `请帮我处理${agentKey}相关任务`;
          handleSend(prompt);
        }}
      />
    </div>
  );
}

/** Renders AI action cards */
function ActionRenderer({ action }: { action: ChatAction }) {
  switch (action.type) {
    case 'jobs':
      return (
        <div className="chat-action-jobs">
          {Array.isArray(action.data) ? action.data.map((job: any) => (
            <JobCard key={job.id} job={job} compact />
          )) : null}
        </div>
      );
    case 'target_set':
      return (
        <div className="chat-action-card success">
          <IconCheck size={16} />
          <span>已将「{typeof action.data.jobTitle === 'string' ? action.data.jobTitle : ''}」设为目标岗位</span>
        </div>
      );
    case 'path_generating':
      return (
        <div className="chat-action-card info">
          <span className="chat-spin"><IconRefresh size={16} /></span>
          <span>{typeof action.data.message === 'string' ? action.data.message : '学习路径生成中...'}</span>
        </div>
      );
    case 'progress':
      return <ProgressCard data={action.data} />;
    case 'today_tasks':
      return <TaskCard data={action.data} />;
    case 'exam':
      return <ExamCard data={action.data} />;
    case 'resources':
      return <ResourceCard data={action.data} />;
    case 'animation':
      return <AnimationCard data={action.data} />;
    case 'diagram':
      return <DiagramCard data={action.data} />;
    case 'video':
      return <VideoCard data={action.data} />;
    case 'video_pending':
      return <VideoCard data={{ ...action.data, status: 'pending' }} />;
    case 'avatar':
      return <AvatarCard data={action.data} />;
    case 'skill_gap':
      return <SkillGapCard data={action.data} />;
    case 'path_generated':
      return (
        <div className="chat-action-card success">
          <IconCheck size={16} />
          <span>学习路径「{typeof action.data?.planName === 'string' ? action.data.planName : ''}」已生成 ✨</span>
        </div>
      );
    case 'error':
      return (
        <div className="chat-action-card error">
          <span>{typeof action.data.message === 'string' ? action.data.message : '操作失败'}</span>
        </div>
      );
    default:
      return null;
  }
}

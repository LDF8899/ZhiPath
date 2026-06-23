import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { sendChat } from '../api/user';
import { useChatStore } from '../stores/chat';
import '../styles/hand-draw.css';

/** 路由 → 页面类型映射 */
function getPageType(pathname: string): string {
  if (pathname === '/user/home') return 'home';
  if (pathname.startsWith('/user/learning')) return 'learning_job';
  if (pathname.startsWith('/user/knowledge')) return 'learning_custom';
  if (pathname.startsWith('/user/jobs')) return 'jobs';
  if (pathname.startsWith('/user/profile')) return 'profile';
  if (pathname.startsWith('/user/news')) return 'news';
  if (pathname.startsWith('/user/exams')) return 'exams';
  if (pathname.startsWith('/user/graph')) return 'graph';
  return 'home';
}

/** 页面类型 → 快捷提示 */
const PAGE_HINTS: Record<string, string> = {
  home: '有什么学习上的问题？',
  learning_job: '需要解释这个知识点吗？',
  learning_custom: '想学什么新方向？',
  jobs: '需要分析这个岗位吗？',
  profile: '需要完善哪些信息？',
  news: '这篇文章讲了什么？',
  exams: '需要考前辅导吗？',
  graph: '想了解哪些技能关系？',
};

export default function AIFloatingChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 持久化对话状态
  const { floatingMessages, floatingSessionIds, appendFloatingMessage, setFloatingSessionId } = useChatStore();
  const pageType = getPageType(location.pathname);
  const messages = floatingMessages[pageType] || [];
  const sessionId = floatingSessionIds[pageType] || '';
  const setMessages = useCallback((updater: Array<{ role: 'user' | 'ai'; text: string }> | ((prev: Array<{ role: 'user' | 'ai'; text: string }>) => Array<{ role: 'user' | 'ai'; text: string }>)) => {
    const current = floatingMessages[pageType] || [];
    const next = typeof updater === 'function' ? updater(current) : updater;
    useChatStore.getState().setFloatingMessages(pageType, next);
  }, [pageType, floatingMessages]);

  // 拖拽状态
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const hint = PAGE_HINTS[pageType] || '有什么问题？';

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 拖拽：鼠标移动
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };
    const onUp = () => setDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  // 拖拽：触摸移动
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      setPos({
        x: t.clientX - dragOffset.current.x,
        y: t.clientY - dragOffset.current.y,
      });
    };
    const onEnd = () => setDragging(false);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    return () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
  }, [dragging]);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
    setDragging(true);
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);

    try {
      const currentSessionId = useChatStore.getState().floatingSessionIds[pageType] || '';
      const res = await sendChat(text, currentSessionId || undefined, pageType);
      const aiText = typeof res.data?.reply === 'string'
        ? res.data.reply
        : (res.data?.reply?.text || res.data?.reply?.content || '抱歉，我没有理解你的意思。');
      setMessages(prev => [...prev, { role: 'ai', text: aiText }]);
      // 保存 sessionId 以便后续复用
      if (res.data?.sessionId) {
        setFloatingSessionId(pageType, res.data.sessionId);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: '网络错误，请稍后重试。' }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, pageType, setFloatingSessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 跳转完整聊天页
  const goToFullChat = () => {
    navigate('/user/chat', { state: { prefill: input || undefined, pageType } });
  };

  // 面板定位：使用 pos 偏移，首次打开时 pos 为 (0,0) 对应 bottom:24 right:24
  const panelStyle: React.CSSProperties = pos.x === 0 && pos.y === 0
    ? { position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }
    : { position: 'fixed', left: pos.x, top: pos.y, zIndex: 1000 };

  return (
    <>
      {/* 浮动按钮 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="hd-btn"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 999,
            width: 56, height: 56, borderRadius: '50%',
            padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, transition: 'transform 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          title="AI 助手"
        >
          💬
        </button>
      )}

      {/* 聊天面板 */}
      {open && (
        <div
          ref={panelRef}
          className="hd-card"
          style={{
            ...panelStyle,
            width: 360, height: 480,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '6px 8px 0 -4px rgba(43,38,32,0.18)',
            animation: 'hd-msg-in 0.3s ease-out',
          }}
        >
          {/* 头部 — 可拖拽区域 */}
          <div
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            style={{
              padding: '12px 16px', borderBottom: '2px solid var(--ink)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--highlight)', cursor: dragging ? 'grabbing' : 'grab',
              userSelect: 'none',
            }}
          >
            <div>
              <div style={{ font: '700 15px/1 var(--hand-bold)', color: 'var(--ink)' }}>AI 助手</div>
              <div style={{ font: '11px/1 var(--mono)', color: 'var(--pencil)', marginTop: 2 }}>
                {hint}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={goToFullChat}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--pencil)', padding: 4 }}
                title="打开完整对话"
              >
                ⤢
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--pencil)', padding: 4 }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* 消息列表 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && (
              <div style={{ font: '13px/1.5 var(--hand)', color: 'var(--pencil)', textAlign: 'center', marginTop: 40 }}>
                {hint}
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                padding: '8px 12px',
                borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: msg.role === 'user' ? 'var(--accent)' : 'var(--note-yellow)',
                border: '1.5px solid var(--rule)',
                font: '14px/1.5 var(--hand)',
                color: msg.role === 'user' ? 'var(--paper)' : 'var(--ink)',
              }}>
                {msg.text}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', font: '13px/1 var(--hand)', color: 'var(--pencil)', padding: '8px 12px' }}>
                思考中…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入框 */}
          <div style={{ padding: 12, borderTop: '2px solid var(--rule)', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hint}
              className="hd-input"
              style={{ flex: 1, padding: '8px 12px', fontSize: 14 }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="hd-btn small"
              style={{ padding: '8px 14px' }}
            >
              →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

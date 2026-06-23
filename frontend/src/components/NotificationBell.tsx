import { useState, useEffect, useRef } from 'react';
import '../styles/hand-draw.css';
import { IconBell, IconCheck } from './icons';
import { useNavigate } from 'react-router-dom';
import { getUnreadCount, getUnreadNotifications, markNotificationRead, markAllNotificationsRead } from '../api/user';

const TYPE_LABEL: Record<string, { label: string; className: string }> = {
  learning: { label: '学习', className: 'hd-badge' },
  progress: { label: '进度', className: 'hd-badge green' },
  job: { label: '岗位', className: 'hd-badge accent' },
  exam: { label: '考试', className: 'hd-badge' },
  system: { label: '系统', className: 'hd-badge' },
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchCount = async () => {
    try {
      const res = await getUnreadCount();
      setCount(res.data?.count || 0);
    } catch {}
  };

  useEffect(() => {
    fetchCount();
    const timer = setInterval(fetchCount, 60000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleToggle = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      setLoading(true);
      try {
        const res = await getUnreadNotifications(10);
        setNotifications(res.data || []);
      } catch {} finally {
        setLoading(false);
      }
    }
  };

  const handleRead = async (id: number, link?: string) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setCount(prev => Math.max(0, prev - 1));
      if (link) navigate(link);
    } catch {}
  };

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications([]);
      setCount(0);
    } catch {}
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell button */}
      <button
        onClick={handleToggle}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--pencil)',
        }}
        title="通知"
      >
        <IconBell size={22} />
        {count > 0 && (
          <span style={{
            position: 'absolute',
            top: 2,
            right: 2,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            background: 'var(--accent)',
            color: 'var(--paper)',
            font: '11px/16px var(--mono)',
            textAlign: 'center',
            padding: '0 4px',
            border: '1.5px solid var(--paper)',
          }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="hd-card" style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          width: 320,
          maxHeight: 400,
          overflowY: 'auto',
          zIndex: 100,
          marginTop: 4,
        }}>
          <div className="hd-flex-between" style={{ marginBottom: 10 }}>
            <span style={{ fontWeight: 800, fontFamily: 'var(--hand-bold)', fontSize: 16 }}>通知</span>
            {notifications.length > 0 && (
              <button
                onClick={handleReadAll}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                  font: '13px/1 var(--hand)', color: 'var(--accent)',
                }}
              >
                <IconCheck size={14} />
                全部已读
              </button>
            )}
          </div>

          {loading ? (
            <div className="hd-loading">加载中...</div>
          ) : notifications.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {notifications.map((item: any) => {
                const typeInfo = TYPE_LABEL[item.type] || TYPE_LABEL.system;
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--paper-tint)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => handleRead(item.id, item.link)}
                  >
                    <div className="hd-flex" style={{ gap: 8, marginBottom: 4 }}>
                      <span className={typeInfo.className}>{typeInfo.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{item.title}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--pencil)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {item.content}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="hd-empty" style={{ padding: '24px 16px' }}>暂无未读通知</div>
          )}
        </div>
      )}
    </div>
  );
}

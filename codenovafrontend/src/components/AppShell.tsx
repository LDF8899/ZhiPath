import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BookMarked,
  Bot,
  CalendarCheck,
  ChevronDown,
  ClipboardList,
  Database,
  FileQuestion,
  LineChart as ChartIcon,
  LogOut,
  MessageSquareText,
  Route as RouteIcon,
  Target,
  User,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { disconnectStream, useStreamStatus } from '../lib/sse';
import { toast } from '../store/toast';
import { AgentActivityPill } from './AgentTrace';
import { Stardust } from './ui';
import { Logo } from './Logo';

type NavItem = { to: string; label: string; icon: ReactNode; end?: boolean };

const NAV_GROUPS: Array<{
  label: string;
  items: NavItem[];
}> = [
  {
    label: '学习',
    items: [
      { to: '/today', label: '今日', icon: <CalendarCheck size={16} />, end: true },
      { to: '/path', label: '学习路径', icon: <RouteIcon size={16} /> },
      { to: '/coach', label: 'AI 教练', icon: <MessageSquareText size={16} /> },
      { to: '/questions', label: '严格出题', icon: <FileQuestion size={16} /> },
      { to: '/exams', label: '考试演练', icon: <ClipboardList size={16} /> },
      { to: '/remediation', label: '补弱决策', icon: <Target size={16} /> },
    ],
  },
  {
    label: '资产',
    items: [
      { to: '/resources', label: '资源库', icon: <BookMarked size={16} /> },
      { to: '/knowledge', label: '知识库', icon: <Database size={16} /> },
      { to: '/report', label: '成长报告', icon: <ChartIcon size={16} /> },
    ],
  },
  {
    label: '系统',
    items: [{ to: '/agents', label: 'Agent 工作台', icon: <Bot size={16} /> }],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);
const MOBILE_TABS: NavItem[] = [
  ...ALL_NAV_ITEMS.filter((item) => ['/today', '/coach', '/questions', '/knowledge'].includes(item.to)),
  { to: '/profile', label: '我的', icon: <User size={17} /> },
];
const MOBILE_MORE = NAV_GROUPS.map((group) => ({
  ...group,
  items: group.items.filter((item) => !MOBILE_TABS.some((tab) => tab.to === item.to)),
})).filter((group) => group.items.length > 0);

export function AppShell() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const online = useStreamStatus();
  const [moreOpen, setMoreOpen] = useState(false);

  const handleLogout = () => {
    disconnectStream();
    logout();
    toast.info('已退出登录');
    navigate('/', { replace: true });
  };

  const displayName = user?.realName || user?.username || '学习者';
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="shell">
      <header className="mobile-header">
        <button type="button" className="mobile-brand" onClick={() => navigate('/today')}>
          <Logo size={30} />
          <span>
            <strong>CodeNova</strong>
            <small>AI 原生能力成长</small>
          </span>
        </button>
        <div className="mobile-header__actions">
          <div className="mobile-stream" title={online ? '已连接后端事件流' : '未连接实时通道'}>
            <span className={`stream-pill__dot ${online ? 'is-live' : ''}`} />
          </div>
          <button
            type="button"
            className="mobile-more-btn"
            onClick={() => setMoreOpen((value) => !value)}
            aria-expanded={moreOpen}
          >
            更多
            <ChevronDown size={14} />
          </button>
        </div>
        {moreOpen && (
          <div className="mobile-more-panel">
            {MOBILE_MORE.map((group) => (
              <div className="mobile-more-group" key={group.label}>
                <span className="mobile-more-label">{group.label}</span>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `mobile-more-item ${isActive ? 'is-active' : ''}`}
                    onClick={() => setMoreOpen(false)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
            <button type="button" className="mobile-more-item" onClick={handleLogout}>
              <LogOut size={16} />
              <span>退出登录</span>
            </button>
          </div>
        )}
      </header>

      <aside className="rail">
        <Stardust count={9} seed={13} />
        <div className="brand">
          <Logo size={34} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="brand__name">CodeNova</div>
            <div className="brand__sub">AI 原生能力成长</div>
          </div>
        </div>

        <nav className="nav" aria-label="主导航">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} style={{ display: 'contents' }}>
              <span className="nav__label">{group.label}</span>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav__item ${isActive ? 'is-active' : ''}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="rail__foot">
          <div style={{ padding: '0 4px' }}>
            <AgentActivityPill />
          </div>

          <div className="stream-pill" title={online ? '已连接后端事件流' : '未连接实时通道'}>
            <span className={`stream-pill__dot ${online ? 'is-live' : ''}`} />
            <span className="grow truncate">
              {online ? '实时通道已连接' : '实时通道未连接'}
            </span>
          </div>

          <div className="row" style={{ gap: 6, padding: '0 4px', alignItems: 'stretch' }}>
            <button
              type="button"
              className="user-chip grow"
              onClick={() => navigate('/profile')}
              title="进入用户中心"
              style={{ minWidth: 0 }}
            >
              <span className="user-chip__avatar">{initial}</span>
              <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
                <span className="user-chip__name truncate" style={{ display: 'block' }}>
                  {displayName}
                </span>
                <span className="user-chip__meta">用户中心</span>
              </span>
            </button>
            <button
              type="button"
              className="btn btn--quiet btn--sm"
              onClick={handleLogout}
              title="退出登录"
              aria-label="退出登录"
              style={{ flexShrink: 0, padding: '0 8px' }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar__title">
            <Zap size={15} style={{ color: 'var(--brand-600)' }} />
            <h1>AI 原生软件开发能力成长</h1>
          </div>
        </header>
        <Outlet />
      </main>

      <nav className="mobile-tabbar" aria-label="移动端主导航">
        {MOBILE_TABS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `mobile-tab ${isActive ? 'is-active' : ''}`}
            onClick={() => setMoreOpen(false)}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

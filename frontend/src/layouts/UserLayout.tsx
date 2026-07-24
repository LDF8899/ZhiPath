import { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useWorkspaceSync } from '../hooks/useWorkspaceSync';
import { useChatResourceSync } from '../hooks/useChatResourceSync';
import NotificationBell from '../components/NotificationBell';
import '../styles/hand-draw.css';
import {
  IconHome,
  IconBook,
  IconBriefcase,
  IconGradCap,
  IconUser,
  IconSettings,
  IconChat,
  IconRobot,
  IconChevronDown,
  IconDocument,
  IconChart,
} from '../components/icons';

const navSections = [
  {
    label: '黄金路径',
    items: [
      { key: '/user/home', icon: IconHome, label: '行动中枢' },
      { key: '/user/jobs', icon: IconBriefcase, label: '目标岗位' },
      { key: '/user/learning', icon: IconBook, label: '学习计划' },
      { key: '/user/agent-office', icon: IconRobot, label: '生成资源' },
      { key: '/user/exams', icon: IconGradCap, label: '测评' },
      { key: '/user/progress', icon: IconChart, label: '画像变化' },
      { key: '/user/resume', icon: IconDocument, label: '简历建议' },
    ],
  },
  {
    label: '辅助工具',
    items: [
      { key: '/user/chat', icon: IconChat, label: 'AI 助教' },
      { key: '/user/wrong-answers', icon: IconDocument, label: '错题本' },
    ],
  },
];

export default function UserLayout() {
  // 全局事件同步：toast + SSE 桥接
  useWorkspaceSync();
  useChatResourceSync();

  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const currentPath = location.pathname;
  const isActive = (key: string) => currentPath.startsWith(key);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const sidebarNav = (
    <ul className="hd-sidebar-nav">
      {navSections.map((section) => (
        <li key={section.label} style={{ listStyle: 'none' }}>
          <div
            style={{
              padding: '10px 14px 5px',
              font: '700 11px/1 var(--mono)',
              letterSpacing: '0.08em',
              color: 'var(--pencil)',
              opacity: 0.72,
            }}
          >
            {section.label}
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <button
                    onClick={() => {
                      navigate(item.key);
                      setSidebarOpen(false);
                    }}
                    className={`hd-sidebar-item ${isActive(item.key) ? 'active' : ''}`}
                  >
                    <span className="hd-sidebar-icon">
                      <Icon size={18} />
                    </span>
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );

  const userMenuDropdown = (
    <div
      ref={userMenuRef}
      className="hd-sidebar-footer"
      style={{ position: 'relative' }}
    >
      <button
        onClick={() => setUserMenuOpen((v) => !v)}
        className="hd-sidebar-item"
        style={{ gap: '10px' }}
      >
        <span className="hd-avatar small">
          {user?.realName?.[0] || 'U'}
        </span>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <span
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 700,
              fontFamily: 'var(--hand-bold)',
              color: 'var(--ink)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {user?.realName || '用户'}
          </span>
          <span
            style={{
              display: 'block',
              fontSize: '12px',
              color: 'var(--pencil)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {user?.username}
          </span>
        </span>
        <IconChevronDown size={14} />
      </button>

      {userMenuOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            marginBottom: 4,
            background: 'var(--paper)',
            border: '2px solid var(--ink)',
            borderRadius: 10,
            padding: '6px 0',
            boxShadow: '4px 5px 0 rgba(43,38,32,0.18)',
            zIndex: 50,
          }}
        >
          <button
            onClick={() => {
              navigate('/user/profile');
              setUserMenuOpen(false);
              setSidebarOpen(false);
            }}
            className="hd-sidebar-item"
            style={{ padding: '8px 14px' }}
          >
            <span className="hd-sidebar-icon"><IconUser size={16} /></span>
            个人信息
          </button>
          <button
            onClick={() => {
              setUserMenuOpen(false);
              setSidebarOpen(false);
            }}
            className="hd-sidebar-item"
            style={{ padding: '8px 14px' }}
          >
            <span className="hd-sidebar-icon"><IconSettings size={16} /></span>
            设置
          </button>
          <div className="hd-divider" style={{ margin: '4px 14px' }} />
          <button
            onClick={() => {
              handleLogout();
              setUserMenuOpen(false);
            }}
            className="hd-sidebar-item"
            style={{ padding: '8px 14px', color: 'var(--accent)' }}
          >
            <span className="hd-sidebar-icon"><IconUser size={16} /></span>
            退出登录
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="hd-page">
      <div className={`hd-layout${currentPath.startsWith('/user/chat') ? ' is-chat' : ''}`}>
        {/* ── Desktop sidebar ── */}
        <aside className="hd-sidebar">
          <div className="hd-sidebar-brand">智途 ZhiPath</div>
          {sidebarNav}
          {userMenuDropdown}
        </aside>

        {/* ── Main content area ── */}
        <div className="hd-main" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
          {/* Mobile header */}
          <div className="hd-mobile-header">
            <button
              onClick={() => setSidebarOpen(true)}
              className="hd-hamburger"
              aria-label="Open menu"
            >
              <span />
              <span />
              <span />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  font: '800 18px/1 var(--serif)',
                  fontStyle: 'italic',
                  color: 'var(--ink)',
                }}
              >
                智途
              </span>
            </div>
            <NotificationBell />
          </div>

          {/* Page content — Chat page needs full-bleed, no padding */}
          <div className={`hd-main-scroll${currentPath.startsWith('/user/chat') ? ' is-chat' : ''}`}>
            <Outlet />
          </div>
        </div>
      </div>

      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
          }}
          className="md:hidden"
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(43,38,32,0.3)',
            }}
            onClick={() => setSidebarOpen(false)}
          />
          <aside
            className="hd-sidebar open"
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              bottom: 0,
              width: 260,
              zIndex: 100,
            }}
          >
            <div className="hd-sidebar-brand">智途 ZhiPath</div>
            {sidebarNav}
            {userMenuDropdown}
          </aside>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useWorkspaceSync } from '../hooks/useWorkspaceSync';
import { useChatResourceSync } from '../hooks/useChatResourceSync';
import NotificationBell from '../components/NotificationBell';
import '../styles/hand-draw.css';
import {
  IconBook,
  IconBriefcase,
  IconChart,
  IconChat,
  IconChevronDown,
  IconDocument,
  IconGradCap,
  IconHome,
  IconRobot,
  IconSettings,
  IconTrophy,
  IconUser,
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
      { key: '/user/growth-report', icon: IconTrophy, label: '成长报告' },
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
  useWorkspaceSync();
  useChatResourceSync();

  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const currentPath = location.pathname;
  const isChat = currentPath.startsWith('/user/chat');
  const isActive = (key: string) => currentPath.startsWith(key);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

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
    <div ref={userMenuRef} className="hd-sidebar-footer" style={{ position: 'relative' }}>
      <button
        onClick={() => setUserMenuOpen((value) => !value)}
        className="hd-sidebar-item"
        style={{ gap: 10 }}
      >
        <span className="hd-avatar small">{user?.realName?.[0] || 'U'}</span>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <span
            style={{
              display: 'block',
              fontSize: 14,
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
              fontSize: 12,
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
      <div className={`hd-layout${isChat ? ' is-chat' : ''}`}>
        <aside className="hd-sidebar">
          <div className="hd-sidebar-brand">智途 ZhiPath</div>
          {sidebarNav}
          {userMenuDropdown}
        </aside>

        <div className="hd-main" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
          <div className="hd-mobile-header">
            <button onClick={() => setSidebarOpen(true)} className="hd-hamburger" aria-label="打开菜单">
              <span />
              <span />
              <span />
            </button>
            <span style={{ font: '800 18px/1 var(--serif)', fontStyle: 'italic', color: 'var(--ink)' }}>
              智途
            </span>
            <NotificationBell />
          </div>

          <div className={`hd-main-scroll${isChat ? ' is-chat' : ''}`}>
            <Outlet />
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} className="md:hidden">
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(43,38,32,0.3)' }}
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="hd-sidebar open" style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: 260, zIndex: 100 }}>
            <div className="hd-sidebar-brand">智途 ZhiPath</div>
            {sidebarNav}
            {userMenuDropdown}
          </aside>
        </div>
      )}
    </div>
  );
}

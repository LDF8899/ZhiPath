import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import '../styles/hand-draw.css';
import {
  IconBook,
  IconChart,
  IconUser,
  IconBriefcase,
  IconDocument,
  IconNewspaper,
  IconGradCap,
  IconSettings,
} from '../components/icons';
import { useAuthStore } from '../stores/auth';

/* ──────────────────────────────────────────
   Admin Navigation Items
   ────────────────────────────────────────── */

const navItems = [
  { key: '/admin/dashboard', icon: IconChart, label: '看板' },
  { key: '/admin/users', icon: IconUser, label: '用户管理' },
  { key: '/admin/jobs', icon: IconBriefcase, label: '岗位管理' },
  { key: '/admin/applications', icon: IconDocument, label: '申请审核' },
  { key: '/admin/enterprises', icon: IconBriefcase, label: '企业管理' },
  { key: '/admin/news', icon: IconNewspaper, label: '资讯管理' },
  { key: '/admin/exams', icon: IconGradCap, label: '考试管理' },
  { key: '/admin/questions', icon: IconBook, label: '题库管理' },
  { key: '/admin/resumes', icon: IconDocument, label: '简历管理' },
  { key: '/admin/settings', icon: IconSettings, label: '系统设置' },
];

/* ──────────────────────────────────────────
   Inline Logout Icon (not in library)
   ────────────────────────────────────────── */

function IconLogout({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21 H5 C4.5 21 4 20.5 4 20 V4 C4 3.5 4.5 3 5 3 H9" />
      <path d="M16 17 L21 12 L16 7" />
      <path d="M21 12 H9" />
    </svg>
  );
}

/* ──────────────────────────────────────────
   AdminLayout — Hand-drawn Design System
   Uses --note-pink tint to visually
   distinguish admin from user端.
   ────────────────────────────────────────── */

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentPath = location.pathname;
  const isActive = (key: string) => currentPath.startsWith(key);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="hd-page">
      <div className="hd-layout">
        {/* ── Sidebar — desktop ──────────────────────────── */}
        <aside
          className="hd-sidebar"
          style={{ background: 'var(--note-pink)' }}
        >
          {/* Brand */}
          <div className="hd-sidebar-brand">
            <span style={{ color: 'var(--accent)' }}>A</span>
            <span style={{ marginLeft: 8 }}>智途管理</span>
          </div>

          {/* Navigation */}
          <ul className="hd-sidebar-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <button
                    onClick={() => navigate(item.key)}
                    className={`hd-sidebar-item${isActive(item.key) ? ' active' : ''}`}
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

          {/* Footer — user + logout */}
          <div className="hd-sidebar-footer">
            <div
              className="hd-flex"
              style={{ marginBottom: 12, gap: 10 }}
            >
              <div className="hd-avatar small">
                {user?.realName?.[0] || 'A'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    font: '14px/1.2 var(--hand-bold)',
                    color: 'var(--ink)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user?.realName || '管理员'}
                </div>
                <div
                  style={{
                    font: '11px/1 var(--mono)',
                    color: 'var(--pencil)',
                    marginTop: 2,
                  }}
                >
                  admin
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="hd-sidebar-item"
              style={{ color: 'var(--accent)' }}
            >
              <span className="hd-sidebar-icon">
                <IconLogout size={18} />
              </span>
              退出登录
            </button>
          </div>
        </aside>

        {/* ── Mobile sidebar overlay ─────────────────────── */}
        {sidebarOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
            }}
          >
            {/* Backdrop */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(43,38,32,0.35)',
              }}
              onClick={() => setSidebarOpen(false)}
            />

            {/* Drawer */}
            <aside
              className="hd-sidebar open"
              style={{
                background: 'var(--note-pink)',
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 260,
                zIndex: 201,
              }}
            >
              {/* Brand */}
              <div className="hd-sidebar-brand">
                <span style={{ color: 'var(--accent)' }}>A</span>
                <span style={{ marginLeft: 8 }}>智途管理</span>
              </div>

              {/* Navigation */}
              <ul className="hd-sidebar-nav">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.key}>
                      <button
                        onClick={() => {
                          navigate(item.key);
                          setSidebarOpen(false);
                        }}
                        className={`hd-sidebar-item${isActive(item.key) ? ' active' : ''}`}
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

              {/* Footer */}
              <div className="hd-sidebar-footer">
                <button
                  onClick={handleLogout}
                  className="hd-sidebar-item"
                  style={{ color: 'var(--accent)' }}
                >
                  <span className="hd-sidebar-icon">
                    <IconLogout size={18} />
                  </span>
                  退出登录
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* ── Main content area ──────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Mobile header */}
          <header className="hd-mobile-header">
            <button
              onClick={() => setSidebarOpen(true)}
              className="hd-hamburger"
              aria-label="打开菜单"
            >
              <span />
              <span />
              <span />
            </button>

            <span
              style={{
                font: '700 16px/1 var(--hand-bold)',
                color: 'var(--ink)',
              }}
            >
              智途管理后台
            </span>

            <div
              className="hd-avatar small"
              style={{ background: 'var(--accent)', color: 'var(--paper)' }}
            >
              {user?.realName?.[0] || 'A'}
            </div>
          </header>

          {/* Page content */}
          <main className="hd-main">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

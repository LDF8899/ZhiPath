import React from 'react';

interface OfficeHeaderProps {
  agentCount: number;
  onHire: () => void;
  onDispatchTask: () => void;
  onRefresh: () => void;
}

/** 办公室顶部标题栏 */
export default function OfficeHeader({ agentCount, onHire, onDispatchTask, onRefresh }: OfficeHeaderProps) {
  return (
    <div className="office-header">
      <div className="header-row">
        <h1>
          <span>智途</span><em>智能体办公室</em>
          <span className="pin">AGENT OFFICE v0.5</span>
        </h1>
        <div className="header-actions">
          <button className="office-btn primary" onClick={onHire}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/></svg>
            招聘员工
          </button>
          <button className="office-btn secondary" onClick={onDispatchTask}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            派发任务
          </button>
          <button className="office-btn ghost" onClick={onRefresh}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 12a9 9 0 109-9"/><path d="M3 3v6h6"/></svg>
            刷新
          </button>
        </div>
      </div>
      <div className="header-meta">
        拖拽员工到工位 · 点击员工编辑形象 · 右侧管理任务队列
        {agentCount > 0 && (
          <span style={{ marginLeft: 12, opacity: 0.6 }}>
            共 {agentCount} 位员工
          </span>
        )}
      </div>
    </div>
  );
}

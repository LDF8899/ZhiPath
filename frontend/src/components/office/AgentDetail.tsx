import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { makeAnimalSVG } from './AnimalSVG';
import type { AgentProfile, AgentTask } from './types';
import { AGENT_LABELS } from '../../hooks/useAgentOffice';

interface AgentDetailProps {
  /** 当前选中的员工 ID，null 时不展示 */
  agentId: string | null;
  /** 关闭面板 */
  onClose: () => void;
  /** 所有员工配置 */
  profiles: AgentProfile[];
  /** 所有任务 */
  tasks: AgentTask[];
  /** 历史任务 */
  history: AgentTask[];
  /** 打开直接使用弹窗 */
  onDirectUse: (profile: AgentProfile) => void;
}

/**
 * Agent 详情面板 — 从右侧滑入
 * 展示员工信息、任务历史、统计数据
 */
export default function AgentDetail({
  agentId, onClose, profiles, tasks, history, onDirectUse,
}: AgentDetailProps) {
  const navigate = useNavigate();

  if (!agentId) return null;

  const profile = profiles.find(p => String(p.id) === agentId);
  if (!profile) return null;

  const agentHistory = history.filter(h => h.agentType === profile.agentType).slice(0, 10);
  const agentTasks = tasks.filter(t => t.agentType === profile.agentType);
  const totalTasks = agentHistory.length + agentTasks.length;
  const successCount = agentHistory.filter(t => t.taskStatus === 'success').length;
  const successRate = totalTasks > 0 ? Math.round((successCount / totalTasks) * 100) : 0;

  const avgDuration = agentHistory
    .filter(t => t.completedAt && t.startedAt)
    .reduce((acc, t) => acc + (t.completedAt! - t.startedAt!), 0) / (agentHistory.filter(t => t.completedAt && t.startedAt).length || 1);

  const handleDispatchToChat = useCallback(() => {
    navigate(`/user/chat?agent=${profile.agentType}&auto=1`);
    onClose();
  }, [navigate, profile.agentType, onClose]);

  const handleDirectUse = useCallback(() => {
    onDirectUse(profile);
  }, [onDirectUse, profile]);

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="office-modal-overlay"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 9990 }}
      />

      {/* 侧面板 */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 380, maxWidth: '90vw',
          background: 'var(--paper, #fff)',
          borderLeft: '2px solid var(--pencil, #2b2620)',
          zIndex: 9991,
          overflowY: 'auto',
          padding: 24,
          animation: 'slideInRight 0.3s ease-out',
        }}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: 'var(--pencil, #2b2620)', opacity: 0.6,
          }}
        >
          ✕
        </button>

        {/* 头像信息 */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div
            style={{ width: 80, height: 80, margin: '0 auto 12px' }}
            dangerouslySetInnerHTML={{ __html: makeAnimalSVG(profile.animalType, profile.color) }}
          />
          <h2 style={{ margin: 0, font: 'bold 18px/1.2 var(--hand)' }}>{profile.nickname}</h2>
          <div style={{ font: '13px/1.4 var(--hand)', color: 'var(--pencil)', opacity: 0.6, marginTop: 4 }}>
            {profile.displayRole}
          </div>
          <div style={{ display: 'inline-block', marginTop: 8, padding: '4px 12px', borderRadius: 20, fontSize: 12,
            background: profile.agentStatus === 'busy' ? 'var(--accent)' : 'var(--rule, #e8e4de)',
            color: profile.agentStatus === 'busy' ? '#fff' : 'var(--pencil)',
          }}>
            {profile.agentStatus === 'busy' ? '忙碌中' : '空闲'}
            {profile.stationId ? ` · 工位 ${profile.stationId}` : ' · 待命'}
          </div>
        </div>

        {/* 统计数据 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <StatCard label="总任务" value={totalTasks} />
          <StatCard label="成功率" value={`${successRate}%`} />
          <StatCard label="平均时长" value={avgDuration > 0 ? `${Math.round(avgDuration / 1000)}s` : '-'} />
        </div>

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            className="office-btn primary"
            style={{ flex: 1 }}
            onClick={handleDispatchToChat}
          >
            💬 派遣到对话
          </button>
          <button
            className="office-btn secondary"
            style={{ flex: 1 }}
            onClick={handleDirectUse}
          >
            ⚡ 直接使用
          </button>
        </div>

        {/* 任务历史 */}
        <div>
          <h3 style={{ font: 'bold 14px/1.2 var(--hand)', margin: '0 0 10px' }}>
            任务历史
          </h3>
          {agentHistory.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {agentHistory.map(task => (
                <div
                  key={task.id}
                  style={{
                    padding: '10px 12px',
                    border: '1.5px solid var(--rule, #e8e4de)',
                    borderRadius: 8,
                    borderLeft: `3px solid ${task.taskStatus === 'success' ? 'var(--accent)' : 'var(--accent, #ff6b6b)'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ font: 'bold 13px/1 var(--hand)' }}>{task.title}</span>
                    <span style={{ fontSize: 11, opacity: 0.5 }}>
                      {task.completedAt ? new Date(task.completedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                    {task.taskStatus === 'success' ? '✓ 已完成' : task.taskStatus === 'failed' ? '✕ 失败' : task.taskStatus}
                  </div>
                  {task.errorMessage && (
                    <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
                      {task.errorMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--pencil)', opacity: 0.4, font: '13px/1.5 var(--hand)' }}>
              暂无任务记录
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** 统计卡片子组件 */
function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      textAlign: 'center', padding: '10px 8px',
      border: '1.5px solid var(--rule, #e8e4de)',
      borderRadius: 8,
    }}>
      <div style={{ font: 'bold 18px/1 var(--hand)', color: 'var(--accent)' }}>{value}</div>
      <div style={{ font: '11px/1.4 var(--hand)', opacity: 0.5, marginTop: 4 }}>{label}</div>
    </div>
  );
}

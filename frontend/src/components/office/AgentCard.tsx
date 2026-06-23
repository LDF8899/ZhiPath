import React, { useRef } from 'react';
import { makeAnimalSVG } from './AnimalSVG';
import type { AgentProfile, AgentTask, AgentConfig } from './types';

interface AgentCardProps {
  /** 员工配置（后端数据） */
  profile: AgentProfile;
  /** 预设 Agent 配置 */
  config: AgentConfig;
  /** 当前运行中的任务 */
  task?: AgentTask;
  /** 点击派遣（打开派遣菜单） */
  onDispatch: () => void;
  /** 点击详情（打开详情面板） */
  onDetail: () => void;
  /** 点击直接使用 */
  onDirectUse: () => void;
  /** 点击编辑 */
  onEdit: () => void;
  /** 拖拽放下到工位（原生 HTML5 DnD） */
  onDragToStation: (profileId: number, stationId: number) => void;
  /** 拖拽放到待命区 */
  onDragToStandby: (profileId: number) => void;
  /** 所在工位 ID（可选） */
  stationId?: number | null;
  /** 额外 className（如 sleeping 状态） */
  className?: string;
}

/**
 * Agent 卡片组件 — 工位上 / 待命区共用
 * 支持原生 HTML5 拖拽、点击查看派遣菜单
 */
export default function AgentCard({
  profile, config, task, onDispatch, onDetail, onDirectUse, onEdit,
  onDragToStation, onDragToStandby, stationId, className: extraClassName = '',
}: AgentCardProps) {
  const dragRef = useRef<HTMLDivElement>(null);

  const isBusy = profile.agentStatus === 'busy';
  const isSleeping = profile.stationId === null;

  /* ── 拖拽处理 ── */
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'agent', profileId: profile.id }));
    e.dataTransfer.effectAllowed = 'move';
    dragRef.current?.classList.add('dragging');
    // 高亮所有工位 drop zone
    document.querySelectorAll('.office-workstation').forEach(ws => ws.classList.add('drop-target'));
    document.getElementById('office-delete-zone')?.classList.add('show');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    dragRef.current?.classList.remove('dragging');
    document.querySelectorAll('.office-workstation').forEach(ws => ws.classList.remove('drop-target'));
    document.getElementById('office-delete-zone')?.classList.remove('show');
  };

  /* ── 状态指示器 ── */
  const statusClass = isBusy ? 'busy' : isSleeping ? 'sleeping' : 'idle';

  /* ── 构造 CSS class ── */
  const className = `office-agent ${statusClass} ${extraClassName}`.trim();

  return (
    <div
      ref={dragRef}
      className={className}
      data-profile-id={profile.id}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onDispatch}
      style={{ cursor: 'pointer' }}
    >
      <div className="office-agent-avatar" dangerouslySetInnerHTML={{ __html: makeAnimalSVG(profile.animalType, profile.color) }} />
      <div className="office-agent-name">{profile.nickname}</div>
      <div className="office-agent-role">{profile.displayRole}</div>
      {task && isBusy && (
        <div className="office-agent-task-hint" title={task.title}>
          {task.title.slice(0, 8)}
        </div>
      )}
    </div>
  );
}

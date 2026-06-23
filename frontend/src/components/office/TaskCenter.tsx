import React, { useRef } from 'react';
import type { AgentProfile, AgentTask } from './types';
import { makeAnimalSVG } from './AnimalSVG';
import { AGENT_LABELS } from '../../hooks/useAgentOffice';

interface TaskCenterProps {
  profiles: AgentProfile[];
  tasks: AgentTask[];
  activeTasks: AgentTask[];
  completedOutputs: AgentTask[];
  failedTasks: AgentTask[];
  busyCount: number;
  idleCount: number;
  stationCount: number;
  agentCount: number;
  standbyAgents: AgentProfile[];
  onTaskAction: (action: string, taskId: number) => void;
  onTaskReorder: (orderedIds: number[]) => void;
  onDirectUse: (profile: AgentProfile) => void;
}

/**
 * 右侧任务面板 — 任务队列 + 员工花名册 + 工作产出 + 失败任务
 * 保留了原 monolith 中所有右侧面板的功能
 */
export default function TaskCenter({
  profiles, activeTasks, completedOutputs, failedTasks,
  busyCount, idleCount, stationCount, agentCount,
  standbyAgents, onTaskAction, onTaskReorder, onDirectUse,
}: TaskCenterProps) {
  /* ── 任务拖拽排序 ── */
  const dragTaskIdRef = useRef<number | null>(null);
  const taskOverRef = useRef<number | null>(null);

  const handleTaskDragStart = (e: React.DragEvent, taskId: number) => {
    dragTaskIdRef.current = taskId;
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'task', taskId }));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
  };

  const handleTaskDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.office-task-card').forEach(el => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    dragTaskIdRef.current = null;
    taskOverRef.current = null;
  };

  const handleTaskDragOver = (e: React.DragEvent, targetTaskId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragTaskIdRef.current === null || dragTaskIdRef.current === targetTaskId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const isAbove = e.clientY < midY;

    document.querySelectorAll('.office-task-card').forEach(el => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    if (isAbove) {
      e.currentTarget.classList.add('drag-over-top');
    } else {
      e.currentTarget.classList.add('drag-over-bottom');
    }
    taskOverRef.current = targetTaskId;
  };

  const handleTaskDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom');
  };

  const handleTaskDrop = (e: React.DragEvent, targetTaskId: number) => {
    e.preventDefault();
    document.querySelectorAll('.office-task-card').forEach(el => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    if (dragTaskIdRef.current === null || dragTaskIdRef.current === targetTaskId) return;

    const sourceTaskId = dragTaskIdRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertBefore = e.clientY < midY;

    // 计算新顺序
    const currentTasks = [...activeTasks];
    const sourceIdx = currentTasks.findIndex(t => t.id === sourceTaskId);
    const targetIdx = currentTasks.findIndex(t => t.id === targetTaskId);
    if (sourceIdx < 0 || targetIdx < 0) return;

    const [moved] = currentTasks.splice(sourceIdx, 1);
    let insertIdx = currentTasks.findIndex(t => t.id === targetTaskId);
    if (!insertBefore) insertIdx += 1;
    currentTasks.splice(insertIdx, 0, moved);

    onTaskReorder(currentTasks.map(t => t.id));
  };

  return (
    <div className="office-panel">
      {/* ── 任务队列标题 ── */}
      <div className="office-panel-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 9h6M9 13h4M9 17h5"/></svg>
        任务队列
        <span className="count">{activeTasks.length}</span>
      </div>

      {/* ── 统计 ── */}
      <div className="office-stats">
        <div className="office-stat"><div className="num busy-num">{busyCount}</div><div className="lbl">忙碌</div></div>
        <div className="office-stat"><div className="num free-num">{idleCount}</div><div className="lbl">空闲</div></div>
        <div className="office-stat"><div className="num">{stationCount}</div><div className="lbl">工位</div></div>
      </div>

      {/* ── 员工花名册 ── */}
      <div className="office-roster">
        <div className="office-roster-title">员工花名册 <span style={{ color: 'var(--accent)' }}>{agentCount} 人</span></div>
        <div className="office-roster-list">
          {profiles.map(p => {
            const statusClass = p.agentStatus === 'busy' ? 'busy' : p.stationId !== null ? 'idle' : 'sleeping';
            return (
              <div
                key={p.id}
                className={`office-roster-chip ${p.stationId !== null ? 'on-station' : ''}`}
                title={`${p.nickname} · ${p.displayRole}${p.stationId ? ' · 工位' + p.stationId : ' · 待命'} · 点击直接使用`}
                onClick={() => onDirectUse(p)}
                style={{ cursor: 'pointer' }}
              >
                <div className="mini-dot" dangerouslySetInnerHTML={{ __html: makeAnimalSVG(p.animalType, p.color) }} />
                <span>{p.nickname}</span>
                <div className={`chip-status ${statusClass}`} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 任务队列列表 ── */}
      <div className="office-task-queue">
        {activeTasks.length > 0 ? activeTasks.map((task, i) => {
          const agent = profiles.find(p => p.agentType === task.agentType);
          return (
            <div
              key={task.id}
              className={`office-task-card ${task.taskStatus === 'running' ? 'processing' : ''}`}
              draggable={task.taskStatus === 'pending'}
              onDragStart={e => handleTaskDragStart(e, task.id)}
              onDragEnd={handleTaskDragEnd}
              onDragOver={e => handleTaskDragOver(e, task.id)}
              onDragLeave={handleTaskDragLeave}
              onDrop={e => handleTaskDrop(e, task.id)}
            >
              <div className="task-order">{i + 1}</div>
              <div className="task-header">
                <span className="task-id">#{String(task.id).padStart(3, '0')}</span>
                <span className={`task-priority ${task.isUrgent ? 'priority-high' : 'priority-mid'}`}>
                  {task.isUrgent ? '紧急' : '普通'}
                </span>
              </div>
              <div className="task-name">{task.title}</div>
              <div className="task-desc">{task.description || AGENT_LABELS[task.agentType] || ''}</div>
              <div className="task-agent">
                {agent ? (
                  <>
                    <span style={{ width: 14, height: 14, borderRadius: '50%', background: agent.color, border: '1.5px solid var(--pencil)', display: 'inline-block' }} />
                    {agent.nickname} · {task.taskStatus === 'running' ? '处理中' : '排队中'}
                  </>
                ) : (
                  <span style={{ opacity: 0.5 }}>等待分配 · {AGENT_LABELS[task.agentType]}</span>
                )}
              </div>
              {task.taskStatus === 'running' && (
                <div style={{ marginTop: 6, height: 4, background: 'var(--rule)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${task.progress || 0}%`, height: '100%', background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                {task.taskStatus === 'pending' && (
                  <>
                    <button className="office-btn ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => onTaskAction('urgent', task.id)} title="标记紧急">🔥</button>
                    <button className="office-btn ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => onTaskAction('skip', task.id)} title="跳过">⏭</button>
                  </>
                )}
                {['pending', 'running'].includes(task.taskStatus) && (
                  <button className="office-btn ghost" style={{ padding: '4px 8px', fontSize: 11, color: 'var(--accent)' }} onClick={() => onTaskAction('cancel', task.id)} title="取消">✕</button>
                )}
              </div>
            </div>
          );
        }) : (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--pencil)', font: '13px/1.5 var(--hand)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.3, marginBottom: 4 }}><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/></svg>
            <br/>暂无任务<br/>
            <span style={{ font: '10px/1 var(--mono)', opacity: 0.5 }}>点击「派发任务」开始</span>
          </div>
        )}
      </div>

      {/* ── 工作产出 ── */}
      <div className="office-output">
        <div className="office-output-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
          工作产出
          <span className="done-count">{completedOutputs.length}</span>
        </div>
        <div className="office-output-list">
          {completedOutputs.length > 0 ? completedOutputs.map(task => {
            const agent = profiles.find(p => p.agentType === task.agentType);
            return (
              <div key={task.id} className="office-output-card">
                <div className="out-header">
                  <span className="out-task">{task.title}</span>
                  <span className="out-time">
                    {task.completedAt ? new Date(task.completedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <div className="out-agent">
                  <span className="mini-color" style={{ background: agent?.color || '#ccc' }} />
                  {agent?.nickname || '未知'} · {AGENT_LABELS[task.agentType] || ''}
                </div>
                {task.result && (
                  <div className="out-result">
                    {typeof task.result === 'string' ? task.result : JSON.stringify(task.result).slice(0, 100)}
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="output-empty">完成任务后产出将显示在这里</div>
          )}
        </div>
      </div>

      {/* ── 失败任务 ── */}
      {failedTasks.length > 0 && (
        <div className="office-output" style={{ borderTop: '2px solid var(--accent)', marginTop: 8 }}>
          <div className="office-output-title" style={{ color: 'var(--accent)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
            失败任务
            <span className="done-count" style={{ background: 'var(--accent)', color: '#fff' }}>{failedTasks.length}</span>
          </div>
          <div className="office-output-list">
            {failedTasks.map(task => {
              const agent = profiles.find(p => p.agentType === task.agentType);
              return (
                <div key={task.id} className="office-output-card" style={{ borderLeft: '3px solid var(--accent)' }}>
                  <div className="out-header">
                    <span className="out-task">{task.title}</span>
                    <span className="out-time" style={{ color: 'var(--accent)' }}>失败</span>
                  </div>
                  <div className="out-agent">
                    <span className="mini-color" style={{ background: agent?.color || '#ccc' }} />
                    {agent?.nickname || '未知'} · {AGENT_LABELS[task.agentType] || ''}
                  </div>
                  {task.errorMessage && (
                    <div className="out-result" style={{ color: 'var(--accent)' }}>
                      ❌ {task.errorMessage}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

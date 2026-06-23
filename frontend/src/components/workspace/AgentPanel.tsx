import { useState, useEffect, useCallback } from 'react';
import { useOfficeStore } from '../../stores/office';
import { useWorkspaceStore } from '../../stores/workspace';
import { useGraphEvents } from '../../hooks/useGraphEvents';
import { AGENT_CONFIGS } from '../office/types';
import AnimalAvatar from '../office/AnimalAvatar';
import {
  getAgentOfficeTasks,
  getAgentProfiles,
} from '../../api/user';
import type { AgentProfile, AgentTask } from '../office/types';
import type { ResourceItem } from '../../types';

type Tab = 'room' | 'tasks' | 'resources';
type ResourceSubTab = 'lecture' | 'graph' | 'quiz' | 'video';

/**
 * 智能体融合面板 — 替代 ChatSidebar
 *
 * 上半部分：房间视图（动物 + 工位 + 实时状态）
 * 下半部分：任务队列（进度 + 操作）
 * LangGraph SSE 事件驱动实时动画
 */
export default function AgentPanel({ isOpen, onToggle, onAgentClick }: { isOpen: boolean; onToggle: () => void; onAgentClick?: (agentKey: string) => void }) {
  const [tab, setTab] = useState<Tab>('room');
  const [resSubTab, setResSubTab] = useState<ResourceSubTab>('quiz');
  const { activeAgent, agentStatuses, tasks } = useOfficeStore();

  // 资源数据（从 localStorage 读取）
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [expandedRes, setExpandedRes] = useState<string | null>(null);

  const loadResources = useCallback(() => {
    try {
      setResources(JSON.parse(localStorage.getItem('zhpath_resources') || '[]'));
    } catch {}
  }, []);

  useEffect(() => {
    loadResources();
    // 每 5 秒刷新一次（SSE 写入后自动可见）
    const iv = setInterval(loadResources, 5000);
    return () => clearInterval(iv);
  }, [loadResources]);

  // 启用 LangGraph SSE 事件监听
  useGraphEvents();

  // 从后端加载真实数据
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [backendTasks, setBackendTasks] = useState<AgentTask[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [pRes, tRes] = await Promise.all([getAgentProfiles(), getAgentOfficeTasks()]);
      if (pRes?.data) setProfiles(pRes.data);
      if (tRes?.data) setBackendTasks(tRes.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 10000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const agentList = Object.entries(AGENT_CONFIGS).filter(([k]) => k !== 'chat');
  const activeTasks = tasks.filter(t => t.status === 'running' || t.status === 'pending');

  return (
    <>
      <button className="office-sidebar-toggle" onClick={onToggle} title="智能体办公室">
        <span className="office-toggle-icon">{isOpen ? '›' : '‹'}</span>
      </button>
      <aside className={`office-sidebar ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="office-sidebar-header">
          <h3>智能体办公室</h3>
          <div className="office-tab-bar">
            <button className={`office-tab ${tab === 'room' ? 'active' : ''}`} onClick={() => setTab('room')}>
              🏠 房间
            </button>
            <button className={`office-tab ${tab === 'tasks' ? 'active' : ''}`} onClick={() => setTab('tasks')}>
              📋 任务 {activeTasks.length > 0 && <span className="office-tab-badge">{activeTasks.length}</span>}
            </button>
            <button className={`office-tab ${tab === 'resources' ? 'active' : ''}`} onClick={() => { setTab('resources'); loadResources(); }}>
              📦 资源 {resources.length > 0 && <span className="office-tab-badge">{resources.length}</span>}
            </button>
          </div>
        </div>

        {/* ── 房间视图 ── */}
        {tab === 'room' && (
          <div className="agent-panel-room">
            {/* 迷你房间 */}
            <div className="agent-panel-scene">
              <div className="agent-panel-wall">
                <div className="agent-panel-poster">🎯 智途办公室</div>
                <div className="agent-panel-window">
                  <div className="agent-panel-cloud" />
                </div>
              </div>
              <div className="agent-panel-floor">
                {/* 工位 */}
                {agentList.map(([key, config]) => {
                  const status = agentStatuses[key] || 'idle';
                  const isActive = activeAgent === key;
                  const task = activeTasks.find(t => t.agentId === key);
                  return (
                    <div key={key} className={`agent-panel-workstation ${isActive ? 'active' : ''}`}>
                      <div className="agent-panel-desk">
                        <div className={`agent-panel-monitor ${status === 'working' ? 'working' : ''}`}>
                          {status === 'working' ? '⚡' : '💤'}
                        </div>
                      </div>
                      <div className="agent-panel-chair">
                        <AnimalAvatar type={config.animal} color={config.color} size={28} status={status} />
                      </div>
                      <div className="agent-panel-label">{config.name}</div>
                      {task && (
                        <div className="agent-panel-task-bar">
                          <div className="agent-panel-task-fill" style={{ width: `${task.progress}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 智能体列表 */}
            <div className="agent-panel-list">
              {agentList.map(([key, config]) => {
                const status = agentStatuses[key] || 'idle';
                const isActive = activeAgent === key;
                return (
                  <div
                    key={key}
                    className={`agent-panel-item ${isActive ? 'active' : ''}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/zhipath-agent', config.id);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => {
                      onAgentClick?.(config.id);
                      useWorkspaceStore.getState().emit({
                        type: 'agent_dispatched',
                        agentType: config.id,
                        target: 'chat',
                      });
                    }}
                    style={{ cursor: onAgentClick ? 'pointer' : 'grab' }}
                    title={`点击或拖拽调用 ${config.name}`}
                  >
                    <AnimalAvatar type={config.animal} color={config.color} size={24} status={status} />
                    <span className="agent-panel-name">{config.name}</span>
                    <span className={`agent-panel-status ${status}`}>
                      {status === 'working' ? '⚡ 工作中' : '💤 空闲'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 任务队列 ── */}
        {tab === 'tasks' && (
          <div className="agent-panel-tasks">
            {activeTasks.length === 0 && backendTasks.filter(t => t.taskStatus === 'running' || t.taskStatus === 'pending').length === 0 ? (
              <div className="agent-panel-empty">
                <span style={{ fontSize: 28 }}>😴</span>
                <p>暂无进行中的任务</p>
                <p className="agent-panel-hint">在对话中发送指令，智能体会自动开始工作</p>
              </div>
            ) : (
              <>
                {/* 前端任务（SSE 驱动） */}
                {activeTasks.map(task => {
                  const agentConfig = Object.entries(AGENT_CONFIGS).find(([k]) => k === task.agentId);
                  return (
                    <div key={task.taskId} className="agent-panel-task-card">
                      <div className="agent-panel-task-header">
                        {agentConfig && (
                          <AnimalAvatar type={agentConfig[1].animal} color={agentConfig[1].color} size={20} status="working" />
                        )}
                        <span className="agent-panel-task-name">{task.name}</span>
                      </div>
                      <div className="agent-panel-task-progress">
                        <div className="agent-panel-task-bar">
                          <div className="agent-panel-task-fill" style={{ width: `${task.progress}%` }} />
                        </div>
                        <span className="agent-panel-task-pct">{task.progress}%</span>
                      </div>
                      <div className="agent-panel-task-msg">{task.message}</div>
                    </div>
                  );
                })}

                {/* 后端任务（轮询驱动） */}
                {backendTasks.filter(t => t.taskStatus === 'running' || t.taskStatus === 'pending').map(task => (
                  <div key={task.id} className="agent-panel-task-card">
                    <div className="agent-panel-task-header">
                      <span className="agent-panel-task-name">{task.title}</span>
                      <span className={`agent-panel-task-status ${task.taskStatus}`}>
                        {task.taskStatus === 'running' ? '处理中' : '排队中'}
                      </span>
                    </div>
                    {task.taskStatus === 'running' && (
                      <div className="agent-panel-task-progress">
                        <div className="agent-panel-task-bar">
                          <div className="agent-panel-task-fill" style={{ width: `${task.progress || 0}%` }} />
                        </div>
                        <span className="agent-panel-task-pct">{task.progress || 0}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── 资源库 ── */}
        {tab === 'resources' && (
          <div className="agent-panel-resources">
            {/* 子标签 */}
            <div className="office-subtab-bar">
              {([['lecture', '📄 文档'], ['graph', '🕸️ 图谱'], ['quiz', '📝 题目'], ['video', '🎬 视频']] as [ResourceSubTab, string][]).map(([key, label]) => (
                <button key={key} className={`office-subtab ${resSubTab === key ? 'active' : ''}`} onClick={() => setResSubTab(key)}>
                  {label}
                </button>
              ))}
            </div>

            {/* 资源列表 */}
            <div className="agent-panel-res-list">
              {(() => {
                const filtered = resources.filter(r => {
                  if (resSubTab === 'lecture') return r.type === 'lecture' || r.type === 'coding';
                  if (resSubTab === 'graph') return r.type === 'animation' || r.type === 'diagram';
                  if (resSubTab === 'quiz') return r.type === 'quiz' || r.type === 'coding';
                  if (resSubTab === 'video') return r.type === 'video';
                  return false;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="agent-panel-empty">
                      <span style={{ fontSize: 28 }}>{resSubTab === 'lecture' ? '📄' : resSubTab === 'graph' ? '🕸️' : resSubTab === 'quiz' ? '📝' : '🎬'}</span>
                      <p>暂无{resSubTab === 'lecture' ? '文档' : resSubTab === 'graph' ? '图谱' : resSubTab === 'quiz' ? '题目' : '视频'}资源</p>
                      <p className="agent-panel-hint">在对话中生成资源后会自动出现在这里</p>
                    </div>
                  );
                }

                return filtered.map(item => (
                  <div key={item.id} className="agent-panel-res-item" onClick={() => setExpandedRes(expandedRes === item.id ? null : item.id)}>
                    <div className="agent-panel-res-header">
                      <span className="agent-panel-res-icon">
                        {item.type === 'lecture' ? '📄' : item.type === 'quiz' ? '📝' : item.type === 'coding' ? '💻' : item.type === 'animation' ? '🎬' : item.type === 'diagram' ? '🕸️' : '🎥'}
                      </span>
                      <div className="agent-panel-res-info">
                        <span className="agent-panel-res-title">{item.title}</span>
                        <span className="agent-panel-res-meta">{item.skill} · {new Date(item.savedAt).toLocaleDateString()}</span>
                      </div>
                      <span className="agent-panel-res-expand">{expandedRes === item.id ? '▲' : '▼'}</span>
                    </div>

                    {expandedRes === item.id && (
                      <div className="agent-panel-res-detail">
                        {resSubTab === 'quiz' && item.data?.questions && (
                          <div className="res-quiz-preview">
                            {item.data.questions.slice(0, 3).map((q: any, i: number) => (
                              <div key={i} className="res-quiz-q">
                                <span className="res-quiz-num">Q{i + 1}.</span>
                                <span>{q.question}</span>
                              </div>
                            ))}
                            {item.data.questions.length > 3 && <div className="res-quiz-more">共 {item.data.questions.length} 题</div>}
                          </div>
                        )}
                        {resSubTab === 'lecture' && (
                          <div className="res-lecture-preview">
                            {typeof item.data === 'string' ? item.data.slice(0, 200) : JSON.stringify(item.data).slice(0, 200)}...
                          </div>
                        )}
                        {resSubTab === 'graph' && (
                          <div className="res-graph-preview">
                            {item.type === 'diagram' ? `Mermaid 图表 (${item.data?.diagramType || 'flowchart'})` : `HTML 动画演示`}
                          </div>
                        )}
                        {resSubTab === 'video' && (
                          <div className="res-video-preview">教学视频 · {item.skill}</div>
                        )}
                        <div className="res-actions">
                          {resSubTab === 'quiz' && (
                            <button className="hd-btn small" onClick={(e) => { e.stopPropagation(); window.location.href = `/user/exams`; }}>
                              去练习
                            </button>
                          )}
                          <button className="hd-btn small ghost" onClick={(e) => {
                            e.stopPropagation();
                            const updated = resources.filter(r => r.id !== item.id);
                            localStorage.setItem('zhpath_resources', JSON.stringify(updated));
                            setResources(updated);
                          }}>
                            删除
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

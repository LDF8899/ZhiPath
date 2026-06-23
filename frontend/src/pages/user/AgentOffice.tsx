import React, { useCallback } from 'react';
import { useAgentOffice } from '../../hooks/useAgentOffice';
import { useAgentOnboarding } from '../../hooks/useAgentOnboarding';
import OfficeHeader from '../../components/office/OfficeHeader';
import AgentCard from '../../components/office/AgentCard';
import AgentDispatchMenu from '../../components/office/AgentDispatchMenu';
import AgentDetail from '../../components/office/AgentDetail';
import TaskCenter from '../../components/office/TaskCenter';
import OfficeModals from '../../components/office/OfficeModals';
import '../../styles/office.css';

/* ═══════════════════════════════════════════════
   Agent 办公室 — 瘦壳组件
   ═══════════════════════════════════════════════ */

export default function AgentOffice() {
  const office = useAgentOffice();
  const { showGuide, dismiss } = useAgentOnboarding();

  /* ── 派遣菜单定位 ── */
  const [menuPosition, setMenuPosition] = React.useState({ x: 0, y: 0 });

  const openDispatchMenu = useCallback((agentKey: string, e?: React.MouseEvent) => {
    if (e) {
      setMenuPosition({ x: e.clientX + 10, y: e.clientY + 10 });
    } else {
      setMenuPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }
    office.setDispatchMenuAgent(agentKey);
  }, [office.setDispatchMenuAgent]);

  /* ── 获取 Agent 配置 ── */
  const getAgentConfigByType = useCallback((agentType: string) => {
    // 从 profiles 的 agentType 匹配预设配置
    const configMap: Record<string, { id: string; animal: string; color: string; name: string; intent: string }> = {
      lecture: { id: 'lecture', animal: 'cat', color: '#f5a623', name: '讲义专家', intent: 'lecture' },
      reading: { id: 'reading', animal: 'owl', color: '#1e90ff', name: '阅读向导', intent: 'reading' },
      code: { id: 'code', animal: 'dog', color: '#7b68ee', name: '代码大师', intent: 'code' },
      path: { id: 'path', animal: 'fox', color: '#ffa502', name: '路径规划师', intent: 'path' },
      assess: { id: 'assess', animal: 'penguin', color: '#2b2620', name: '评估官', intent: 'assess' },
      exam: { id: 'exam', animal: 'dog', color: '#7b68ee', name: '出题专家', intent: 'exam' },
      skillgap: { id: 'skillgap', animal: 'duck', color: '#4169e1', name: '差距分析师', intent: 'skillgap' },
      resume: { id: 'resume', animal: 'hamster', color: '#ff69b4', name: '简历生成', intent: 'resume' },
      profile: { id: 'profile', animal: 'owl', color: '#1e90ff', name: '画像分析', intent: 'profile' },
      news: { id: 'news', animal: 'parrot', color: '#32cd32', name: '资讯推荐', intent: 'news' },
    };
    return configMap[agentType] || configMap.lecture;
  }, []);

  /* ── 原生拖拽放下处理（传递给子组件） ── */
  const handleStationDropFromAgent = useCallback((profileId: number, stationId: number) => {
    office.handleStationDrop(profileId, stationId);
  }, [office.handleStationDrop]);

  const handleStandbyDropFromAgent = useCallback((profileId: number) => {
    office.handleStandbyDrop(profileId);
  }, [office.handleStandbyDrop]);

  /* ── Loading 状态 ── */
  if (office.loading) {
    return (
      <div className="office-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ font: '20px/1 var(--hand-bold)', color: 'var(--pencil)' }}>加载中...</div>
      </div>
    );
  }

  /* ── 当前选中的 Agent 信息（用于派遣菜单和详情面板） ── */
  const dispatchProfile = office.dispatchMenuAgent
    ? office.profiles.find(p => p.agentType === office.dispatchMenuAgent)
    : null;

  const dispatchConfig = office.dispatchMenuAgent
    ? getAgentConfigByType(office.dispatchMenuAgent)
    : null;

  return (
    <div className="office-root">
      {/* ── 顶部标题栏 ── */}
      <OfficeHeader
        agentCount={office.profiles.length}
        onHire={() => office.setModalType('hire')}
        onDispatchTask={office.handleDispatchTask}
        onRefresh={office.fetchData}
      />

      {/* ── 新手引导 ── */}
      {showGuide && (
        <div style={{
          padding: '12px 20px', margin: '0 16px 8px',
          background: 'var(--note-yellow, #fef3c7)',
          border: '2px solid var(--pencil, #2b2620)',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          font: '13px/1.5 var(--hand)',
        }}>
          <div>
            <strong>欢迎来到智能体办公室!</strong>
            <span style={{ marginLeft: 8, opacity: 0.6 }}>
              点击员工卡片打开操作菜单 · 拖拽员工到工位安排上岗 · 右侧管理任务队列
            </span>
          </div>
          <button
            className="office-btn ghost"
            style={{ fontSize: 12, padding: '4px 12px', flexShrink: 0 }}
            onClick={dismiss}
          >
            我知道了
          </button>
        </div>
      )}

      <div className="office-layout">
        {/* ── 左侧：办公室场景 ── */}
        <div className="office-scene">
          <div className="office-room">
            {/* 墙壁 */}
            <div className="office-wall">
              <div className="office-light-ray" />
              <div className="office-poster">🎯 今日目标<br/>完成 3 个匹配任务</div>
              <div className="office-poster2">☕ 休息一下~</div>
              <div className="office-whiteboard">
                <div className="office-whiteboard-line" />
                <div className="office-whiteboard-line" />
                <div className="office-whiteboard-line" />
                <div className="office-whiteboard-line" />
              </div>
              <div className="office-window">
                <div className="office-curtain-l" />
                <div className="office-curtain-r" />
                <div className="office-curtain-rod" />
                <div className="office-cloud"><div className="office-cloud-shape" /></div>
              </div>
              <div className="office-clock">
                <div className="clock-face">
                  <div className="clock-hand-h" style={{ transform: `rotate(${(new Date().getHours() % 12) * 30 + new Date().getMinutes() * 0.5}deg)` }} />
                  <div className="clock-hand-m" style={{ transform: `rotate(${new Date().getMinutes() * 6}deg)` }} />
                  <div className="clock-hand-s" />
                  <div className="clock-dot" />
                </div>
              </div>
            </div>

            {/* 地板 */}
            <div className="office-floor">
              <div className="office-carpet" />

              <svg className="office-brand-accent" viewBox="0 0 100 100">
                <text x="50" y="68" textAnchor="middle" fontSize="72" fontFamily="'DM Serif Display',serif" fontWeight="800" fill="#2b2620">智</text>
              </svg>

              {/* 绿植 */}
              <div className="office-plant office-plant-left">
                <svg width="40" height="56" viewBox="0 0 40 56">
                  <rect x="12" y="38" width="16" height="16" rx="3" fill="#c9842a" stroke="#2b2620" strokeWidth="2"/>
                  <rect x="10" y="35" width="20" height="5" rx="2" fill="#b87420" stroke="#2b2620" strokeWidth="1.5"/>
                  <ellipse cx="20" cy="28" rx="8" ry="10" fill="#5a9e5a" stroke="#2b2620" strokeWidth="1.5"/>
                  <ellipse cx="14" cy="22" rx="6" ry="8" fill="#6ab06a" stroke="#2b2620" strokeWidth="1.5" transform="rotate(-20 14 22)"/>
                  <ellipse cx="26" cy="24" rx="5" ry="7" fill="#4a8e4a" stroke="#2b2620" strokeWidth="1.5" transform="rotate(15 26 24)"/>
                  <path d="M20 36 Q20 28 14 18" fill="none" stroke="#2b2620" strokeWidth="1.5"/>
                  <path d="M20 36 Q22 30 28 22" fill="none" stroke="#2b2620" strokeWidth="1.2"/>
                </svg>
              </div>
              <div className="office-plant office-plant-right">
                <svg width="36" height="50" viewBox="0 0 36 50">
                  <rect x="10" y="34" width="16" height="14" rx="3" fill="#c9842a" stroke="#2b2620" strokeWidth="2"/>
                  <rect x="8" y="31" width="20" height="5" rx="2" fill="#b87420" stroke="#2b2620" strokeWidth="1.5"/>
                  <ellipse cx="18" cy="22" rx="10" ry="12" fill="#6ab06a" stroke="#2b2620" strokeWidth="1.5"/>
                  <ellipse cx="12" cy="18" rx="5" ry="8" fill="#7ac07a" stroke="#2b2620" strokeWidth="1.2" transform="rotate(-15 12 18)"/>
                  <ellipse cx="24" cy="20" rx="4" ry="6" fill="#5a9e5a" stroke="#2b2620" strokeWidth="1.2" transform="rotate(20 24 20)"/>
                  <path d="M18 32 Q18 24 10 16" fill="none" stroke="#2b2620" strokeWidth="1.2"/>
                </svg>
              </div>

              {/* ── 工位列表 ── */}
              <div className="office-workstations">
                {office.stations.map(st => {
                  const agent = office.getAgentAtStation(st.id);
                  const isBusy = agent?.agentStatus === 'busy';
                  const currentTask = agent ? office.getStationTask(agent.agentType) : null;
                  const screenText = isBusy && currentTask ? currentTask.title.slice(0, 6) : agent ? 'IDLE' : '---';

                  return (
                    <div
                      key={st.id}
                      className={`office-workstation ${isBusy ? 'drop-target' : ''}`}
                      data-station-id={st.id}
                      onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drop-target'); }}
                      onDragLeave={e => e.currentTarget.classList.remove('drop-target')}
                      onDrop={e => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('drop-target');
                        try {
                          const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                          if (data.type === 'agent') {
                            office.handleStationDrop(data.profileId, st.id);
                          }
                        } catch { /* ignore */ }
                      }}
                    >
                      <div className="office-station-label">工位 {st.id}</div>
                      <div className="office-desk">
                        {agent && <div className={`office-status-dot ${isBusy ? 'working' : 'idle'}`} />}
                        <div className="office-desk-items">
                          <div>
                            <div className="office-monitor">
                              <div className={`office-monitor-screen ${isBusy ? 'working' : ''}`}>
                                <span className="office-monitor-text">{screenText}</span>
                              </div>
                              <div className="office-monitor-led" />
                            </div>
                            <div className="office-monitor-stand" />
                            <div className="office-monitor-base" />
                          </div>
                          <div>
                            <div className="office-keyboard" />
                            {isBusy && (
                              <div className="office-coffee">
                                <div className="office-steam">
                                  <div className="office-steam-line" /><div className="office-steam-line" /><div className="office-steam-line" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="office-desk-leg-l" /><div className="office-desk-leg-r" />
                      </div>

                      <div className="office-chair">
                        <div className="office-chair-arm-l" /><div className="office-chair-arm-r" />
                        {agent && (
                          <AgentCard
                            profile={agent}
                            config={getAgentConfigByType(agent.agentType)}
                            task={currentTask}
                            onDispatch={(e: any) => openDispatchMenu(agent.agentType, e)}
                            onDetail={() => office.setSelectedAgentId(String(agent.id))}
                            onDirectUse={() => {
                              office.setEditingProfile(agent);
                              office.setModalType('direct-use');
                            }}
                            onEdit={() => office.openEditModal(agent)}
                            onDragToStation={handleStationDropFromAgent}
                            onDragToStandby={handleStandbyDropFromAgent}
                          />
                        )}
                      </div>

                      <div className={`office-task-label ${currentTask ? 'active' : ''}`}>
                        {currentTask ? currentTask.title : agent ? '等待分配…' : '空工位'}
                      </div>
                    </div>
                  );
                })}

                <div className="office-add-station" onClick={office.handleAddStation}>
                  <div className="office-add-station-inner">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    <span>添加工位</span>
                  </div>
                </div>
              </div>

              {/* ── 待命休息区 ── */}
              <div
                className="office-standby"
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = ''; }}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = '';
                  try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    if (data.type === 'agent') {
                      office.handleStandbyDrop(data.profileId);
                    }
                  } catch { /* ignore */ }
                }}
              >
                <div className="office-standby-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 8A6 6 0 106 8c0 7-3 9-3 9h18s-3-2-3-9"/></svg>
                  待命休息区
                </div>
                <div className="office-standby-agents">
                  {office.standbyAgents.length > 0 ? office.standbyAgents.map(agent => (
                    <div key={agent.id} className="office-standby-slot">
                      <AgentCard
                        profile={agent}
                        config={getAgentConfigByType(agent.agentType)}
                        onDispatch={(e: any) => openDispatchMenu(agent.agentType, e)}
                        onDetail={() => office.setSelectedAgentId(String(agent.id))}
                        onDirectUse={() => {
                          office.setEditingProfile(agent);
                          office.setModalType('direct-use');
                        }}
                        onEdit={() => office.openEditModal(agent)}
                        onDragToStation={handleStationDropFromAgent}
                        onDragToStandby={handleStandbyDropFromAgent}
                        className="sleeping"
                      />
                      <span className="zzz">zzZ</span>
                    </div>
                  )) : (
                    <div style={{ font: '12px/1.4 var(--hand)', color: 'var(--pencil)', opacity: 0.4, padding: 8 }}>
                      所有员工都已上岗 ✨
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="office-sticky" style={{ position: 'absolute', top: 6, right: 10, background: 'var(--note-yellow)', transform: 'rotate(2deg)', zIndex: 20 }}>
              <div className="tape" />
              点击员工编辑形象 →
            </div>
          </div>
        </div>

        {/* ── 右侧：任务中心 ── */}
        <TaskCenter
          profiles={office.profiles}
          activeTasks={office.activeTasks}
          completedOutputs={office.completedOutputs}
          failedTasks={office.failedTasks}
          busyCount={office.busyCount}
          idleCount={office.idleCount}
          stationCount={office.stations.length}
          agentCount={office.profiles.length}
          standbyAgents={office.standbyAgents}
          onTaskAction={office.handleTaskAction}
          onTaskReorder={office.handleTaskReorder}
          onDirectUse={(profile) => {
            office.setEditingProfile(profile);
            office.setModalType('direct-use');
          }}
        />
      </div>

      {/* ── 删除区域 ── */}
      <div
        className="office-delete-zone"
        id="office-delete-zone"
        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('hover'); }}
        onDragLeave={e => e.currentTarget.classList.remove('hover')}
        onDrop={e => {
          e.preventDefault();
          e.currentTarget.classList.remove('hover');
          try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.type === 'agent') {
              office.handleDeleteDrop(data.profileId);
            }
          } catch { /* ignore */ }
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        拖到此处移出工位
      </div>

      {/* ── 派遣菜单 ── */}
      {office.dispatchMenuAgent && dispatchProfile && dispatchConfig && (
        <AgentDispatchMenu
          agentKey={office.dispatchMenuAgent}
          agentName={dispatchProfile.nickname}
          agentAnimal={dispatchProfile.animalType}
          agentColor={dispatchProfile.color}
          position={menuPosition}
          onClose={() => office.setDispatchMenuAgent(null)}
          onDetail={() => {
            office.setSelectedAgentId(String(dispatchProfile.id));
          }}
          onDirectUse={() => {
            office.setEditingProfile(dispatchProfile);
            office.setModalType('direct-use');
          }}
          onEdit={() => {
            office.openEditModal(dispatchProfile);
          }}
        />
      )}

      {/* ── Agent 详情面板 ── */}
      <AgentDetail
        agentId={office.selectedAgentId}
        onClose={() => office.setSelectedAgentId(null)}
        profiles={office.profiles}
        tasks={office.tasks}
        history={office.history}
        onDirectUse={(profile) => {
          office.setEditingProfile(profile);
          office.setModalType('direct-use');
        }}
      />

      {/* ── 弹窗 ── */}
      <OfficeModals
        modalType={office.modalType}
        editingProfile={office.editingProfile}
        agentTypes={office.agentTypes}
        onClose={() => { office.setModalType(null); office.setEditingProfile(null); }}
        onHire={office.handleHire}
        onSaveProfile={office.handleSaveProfile}
        onFireAgent={office.handleFireAgent}
        onDirectUse={(profileId, prompt) => office.handleDirectUse(profileId, prompt)}
      />

      {/* ── Toast ── */}
      <div className="office-toast" id="office-toast" />
    </div>
  );
}

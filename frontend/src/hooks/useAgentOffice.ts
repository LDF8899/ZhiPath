import { useState, useEffect, useCallback } from 'react';
import {
  getAgentOfficeStats,
  getAgentOfficeTasks,
  getAgentOfficeHistory,
  getAgentProfiles,
  getAgentTypes,
  hireAgent,
  updateAgentProfile,
  fireAgent,
  assignAgentStation,
  directUseAgent,
  createAgentOfficeTask,
  markAgentTaskUrgent,
  skipAgentTask,
  cancelAgentTask,
  deleteAgentTask,
  reorderAgentTasks,
} from '../api/user';
import type { AgentProfile, AgentTask, Station } from '../components/office/types';
import { useSSE } from './useSSE';

/** Toast helper — 复用原 office-toast DOM */
function showToast(msg: string) {
  const el = document.getElementById('office-toast');
  if (el) {
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
  }
}

/** agentType → label 映射 */
export const AGENT_LABELS: Record<string, string> = {
  lecture: '讲义生成',
  reading: '拓展阅读',
  code: '代码案例',
  path: '学习路径',
  assess: '学习评估',
  exam: '考试出题',
  skillgap: '技能差距',
  resume: '简历生成',
  profile: '画像分析',
  news: '资讯推荐',
};

export function useAgentOffice() {
  /* ── 核心数据 ── */
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [history, setHistory] = useState<AgentTask[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [agentTypes, setAgentTypes] = useState<Record<string, { label: string; defaultRole: string }>>({});

  /* ── UI 状态 ── */
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [dispatchMenuAgent, setDispatchMenuAgent] = useState<string | null>(null);
  const [modalType, setModalType] = useState<'hire' | 'edit' | 'direct-use' | 'fire' | null>(null);
  const [editingProfile, setEditingProfile] = useState<AgentProfile | null>(null);
  const [directUseTarget, setDirectUseTarget] = useState<AgentProfile | null>(null);

  /* ── 数据拉取 ── */
  const fetchData = useCallback(async () => {
    try {
      const [profRes, tasksRes, histRes, statsRes, typesRes] = await Promise.all([
        getAgentProfiles().catch(() => ({ data: [] })),
        getAgentOfficeTasks().catch(() => ({ data: [] })),
        getAgentOfficeHistory(10).catch(() => ({ data: [] })),
        getAgentOfficeStats().catch(() => ({ data: null })),
        getAgentTypes().catch(() => ({ data: {} })),
      ]);

      const profs = (profRes.data || []) as AgentProfile[];
      setProfiles(profs);
      setTasks((tasksRes.data || []) as AgentTask[]);
      setHistory((histRes.data || []) as AgentTask[]);
      setStats(statsRes.data);
      setAgentTypes(typesRes.data || {});

      // 根据 profiles 构建工位列表
      const maxStation = profs.reduce((max, p) => Math.max(max, p.stationId || 0), 0);
      const stationCount = Math.max(maxStation, 8);
      setStations(Array.from({ length: stationCount }, (_, i) => ({ id: i + 1 })));
    } catch {
      // 静默
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── 初始化 + 轮询 ── */
  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 8000);
    return () => clearInterval(timer);
  }, [fetchData]);

  /* ── SSE 实时事件 ── */
  const { latestEvent } = useSSE();
  useEffect(() => {
    if (!latestEvent) return;
    switch (latestEvent.type) {
      case 'resource_ready':
        showToast(`资源已生成：${latestEvent.data?.skill_name || ''}`);
        fetchData();
        break;
      case 'agent_progress':
        if (latestEvent.data?.message) showToast(latestEvent.data.message);
        break;
      case 'agent_status':
        if (latestEvent.data?.status === 'error') {
          showToast(`Agent 异常：${latestEvent.data?.message || ''}`);
        }
        fetchData();
        break;
      default:
        break;
    }
  }, [latestEvent, fetchData]);

  /* ── 工位操作 ── */
  const handleStationDrop = useCallback(async (profileId: number, stationId: number) => {
    try {
      await assignAgentStation(profileId, stationId);
      showToast(`已分配到工位 ${stationId}`);
      fetchData();
    } catch { /* ignore */ }
  }, [fetchData]);

  const handleStandbyDrop = useCallback(async (profileId: number) => {
    try {
      await assignAgentStation(profileId, null);
      showToast('已移至待命区');
      fetchData();
    } catch { /* ignore */ }
  }, [fetchData]);

  const handleDeleteDrop = useCallback(async (profileId: number) => {
    try {
      await assignAgentStation(profileId, null);
      showToast('已移出工位');
      fetchData();
    } catch { /* ignore */ }
  }, [fetchData]);

  /* ── 招聘 ── */
  const handleHire = useCallback(async (data: {
    agentType: string; animalType: string; color: string; nickname: string; displayRole: string;
  }) => {
    try {
      await hireAgent(data);
      showToast(`${data.nickname} 已入职！`);
      setModalType(null);
      fetchData();
    } catch (e: any) {
      showToast(e?.message || '招聘失败');
    }
  }, [fetchData]);

  /* ── 编辑 ── */
  const openEditModal = useCallback((profile: AgentProfile) => {
    setEditingProfile(profile);
    setModalType('edit');
  }, []);

  const handleSaveProfile = useCallback(async (profileId: number, data: {
    animalType: string; color: string; nickname: string; displayRole: string;
  }) => {
    if (!data.nickname.trim()) { showToast('请输入昵称'); return; }
    try {
      await updateAgentProfile(profileId, data);
      setModalType(null);
      setEditingProfile(null);
      showToast(`${data.nickname} 配置已更新`);
      fetchData();
    } catch (e: any) {
      showToast(e?.message || '更新失败');
    }
  }, [fetchData]);

  /* ── 解雇 ── */
  const handleFireAgent = useCallback(async (profileId: number) => {
    const prof = profiles.find(p => p.id === profileId);
    if (!prof) return;
    try {
      await fireAgent(profileId);
      showToast(`${prof.nickname} 已离职`);
      setModalType(null);
      setEditingProfile(null);
      fetchData();
    } catch (e: any) {
      showToast(e?.message || '操作失败');
    }
  }, [profiles, fetchData]);

  /* ── 直接使用 ── */
  const handleDirectUse = useCallback(async (profileId: number, prompt: string) => {
    if (!prompt.trim()) return;
    try {
      await directUseAgent(profileId, prompt.trim());
      showToast('已派发任务');
      setDirectUseTarget(null);
      setModalType(null);
      fetchData();
    } catch (e: any) {
      showToast(e?.message || '派发失败');
    }
  }, [fetchData]);

  /* ── 派发任务（随机模板） ── */
  const handleDispatchTask = useCallback(async () => {
    try {
      const templates = [
        { agentType: 'lecture', title: '生成 React Hooks 讲义', params: { skillName: 'React Hooks' } },
        { agentType: 'code', title: '生成 TypeScript 代码案例', params: { skillName: 'TypeScript', language: 'TypeScript' } },
        { agentType: 'reading', title: '生成 CSS Grid 拓展阅读', params: { skillName: 'CSS Grid' } },
        { agentType: 'path', title: '规划前端学习路径', params: { goal: '前端开发工程师' } },
        { agentType: 'assess', title: '评估 JavaScript 掌握度', params: { learningData: '已完成基础学习', goal: 'JavaScript' } },
      ];
      const tpl = templates[Math.floor(Math.random() * templates.length)];
      await createAgentOfficeTask({
        agentType: tpl.agentType,
        title: tpl.title,
        params: tpl.params,
        description: AGENT_LABELS[tpl.agentType],
      });
      showToast(`新任务: ${tpl.title}`);
      fetchData();
    } catch (e: any) {
      showToast(e?.message || '派发失败');
    }
  }, [fetchData]);

  /* ── 任务操作 ── */
  const handleTaskAction = useCallback(async (action: string, taskId: number) => {
    try {
      switch (action) {
        case 'urgent': await markAgentTaskUrgent(taskId); break;
        case 'skip': await skipAgentTask(taskId); showToast('已跳过'); break;
        case 'cancel': await cancelAgentTask(taskId); showToast('已取消'); break;
        case 'delete': await deleteAgentTask(taskId); showToast('已删除'); break;
      }
      fetchData();
    } catch { /* ignore */ }
  }, [fetchData]);

  /* ── 任务排序 ── */
  const handleTaskReorder = useCallback(async (orderedIds: number[]) => {
    // 乐观更新
    const reordered = orderedIds.map(id => tasks.find(t => t.id === id)).filter(Boolean) as AgentTask[];
    // 把不在列表中的任务追加到末尾
    const remaining = tasks.filter(t => !orderedIds.includes(t.id));
    setTasks([...reordered, ...remaining]);

    try {
      const activeIds = [...reordered, ...remaining]
        .filter(t => t.taskStatus !== 'done' && t.taskStatus !== 'cancelled' && t.taskStatus !== 'failed')
        .map(t => t.id);
      await reorderAgentTasks(activeIds);
    } catch {
      fetchData();
    }
  }, [tasks, fetchData]);

  /* ── 添加工位 ── */
  const handleAddStation = useCallback(() => {
    setStations(prev => [...prev, { id: prev.length + 1 }]);
    showToast(`工位 ${stations.length + 1} 已添加`);
  }, [stations.length]);

  /* ── 计算属性 ── */
  const standbyAgents = profiles.filter(p => p.stationId === null);
  const busyCount = profiles.filter(p => p.agentStatus === 'busy').length;
  const idleCount = profiles.filter(p => p.agentStatus === 'idle' && p.stationId !== null).length;
  const activeTasks = tasks.filter(t => t.taskStatus !== 'done' && t.taskStatus !== 'cancelled' && t.taskStatus !== 'failed');
  const completedOutputs = history.filter(t => t.taskStatus === 'success').slice(0, 10);
  const failedTasks = tasks.filter(t => t.taskStatus === 'failed').slice(0, 5);

  const getAgentAtStation = useCallback((stationId: number) =>
    profiles.find(p => p.stationId === stationId), [profiles]);

  const getStationTask = useCallback((agentType: string) =>
    tasks.find(t => t.agentType === agentType && t.taskStatus === 'running'), [tasks]);

  return {
    // 数据
    profiles, stations, tasks, history, stats, loading, agentTypes,
    standbyAgents, busyCount, idleCount, activeTasks, completedOutputs, failedTasks,

    // UI 状态
    selectedAgentId, setSelectedAgentId,
    dispatchMenuAgent, setDispatchMenuAgent,
    modalType, setModalType,
    editingProfile, setEditingProfile,
    directUseTarget, setDirectUseTarget,

    // 工具函数
    getAgentAtStation, getStationTask,

    // 操作
    fetchData, handleStationDrop, handleStandbyDrop, handleDeleteDrop,
    handleHire, openEditModal, handleSaveProfile, handleFireAgent,
    handleDirectUse, handleDispatchTask, handleTaskAction, handleTaskReorder,
    handleAddStation,
  };
}

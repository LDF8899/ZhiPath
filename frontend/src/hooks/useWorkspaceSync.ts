import { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../stores/workspace';
import { useSSE } from './useSSE';
import type { WorkspaceEvent } from '../types/workspace';
import type { ProfessionalIconName } from '../components/icons';

// ── 轻量 Toast（与 Chat.tsx / AgentOffice.tsx 风格一致） ──

const TOAST_CONTAINER_ID = 'zhpath-workspace-toast-container';

const TOAST_ICON_SVG: Record<ProfessionalIconName, string> = {
  book: '<path d="M2 4 C2 4 5 3 12 3 C19 3 22 4 22 4 V19 C22 19 19 18 12 18 C5 18 2 19 2 19 Z"/><path d="M12 3 V18"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7 V5 C16 3.9 15.1 3 14 3 H10 C8.9 3 8 3.9 8 5 V7"/><path d="M2 12 H22"/>',
  building: '<rect x="3" y="3" width="18" height="19" rx="1.5"/><path d="M7 7 H10"/><path d="M14 7 H17"/><path d="M7 11 H10"/><path d="M14 11 H17"/><path d="M10 22 V18 H14 V22"/>',
  camera: '<rect x="2" y="3" width="20" height="18" rx="2"/><circle cx="8" cy="9" r="2"/><path d="M21 16 L16 11 L10 17 L7 14 L2 19"/>',
  chart: '<path d="M3 21 V3"/><path d="M3 21 H21"/><path d="M7 17 V12"/><path d="M12 17 V8"/><path d="M17 17 V5"/>',
  chat: '<path d="M4 4 H20 C20.5 4 21 4.5 21 5 V16 C21 16.5 20.5 17 20 17 H8 L3 21 V5 C3 4.5 3.5 4 4 4 Z"/><path d="M8 9 H16"/><path d="M8 12.5 H13"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5 L11 15.5 L16.5 8.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6.5 V12 L16 15"/>',
  code: '<path d="M7 8 L3 12 L7 16"/><path d="M17 8 L21 12 L17 16"/><path d="M14 4 L10 20"/>',
  coffee: '<path d="M5 8 H16 V14 C16 17 13.8 19 10.5 19 C7.2 19 5 17 5 14 Z"/><path d="M16 10 H18 C20 10 21 11 21 12.5 C21 14 20 15 18 15 H16"/><path d="M4 21 H18"/>',
  document: '<path d="M5 2 C5 1.5 5.5 1 6 1 H15 L20 6 V22 C20 22.5 19.5 23 19 23 H6 C5.5 23 5 22.5 5 22 Z"/><path d="M15 1 V6 H20"/><path d="M9 11 H16"/><path d="M9 14.5 H16"/>',
  edit: '<path d="M16 3 L21 8 L8 21 L3 21 L3 16 Z"/><path d="M14 5 L19 10"/>',
  film: '<rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 2 V22"/><path d="M17 2 V22"/><path d="M2 7 H7"/><path d="M17 7 H22"/>',
  fire: '<path d="M12 2 C12 2 8 7 8 11 C8 14 9.8 16 12 16 C14.2 16 16 14 16 11 C16 7 12 2 12 2 Z"/><path d="M12 16 C12 16 10 18 10 19.5 C10 21 10.8 22 12 22 C13.2 22 14 21 14 19.5 C14 18 12 16 12 16 Z"/>',
  grad: '<path d="M12 3 L2 8 L12 13 L22 8 Z"/><path d="M6 10.5 V17 C6 17 9 20 12 20 C15 20 18 17 18 17 V10.5"/>',
  graph: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M10 7 L6.5 15.5"/><path d="M14 7 L17.5 15.5"/><path d="M7.5 18 H16.5"/>',
  home: '<path d="M3 10.5 L12 3 L21 10.5"/><path d="M5 9.5 V20 C5 20.5 5.5 21 6 21 H18 C18.5 21 19 20.5 19 20 V9.5"/><path d="M9 21 V15 C9 14.5 9.5 14 10 14 H14 C14.5 14 15 14.5 15 15 V21"/>',
  link: '<path d="M9 7 H7 C5 7 3 9 3 11 C3 13 5 15 7 15 H9"/><path d="M15 7 H17 C19 7 21 9 21 11 C21 13 19 15 17 15 H15"/><path d="M8 11 H16"/>',
  map: '<path d="M12 2 C8.13 2 5 5.13 5 9 C5 14.25 12 22 12 22 C12 22 19 14.25 19 9 C19 5.13 15.87 2 12 2 Z"/><circle cx="12" cy="9" r="2.5"/>',
  package: '<path d="M3 7 L12 2 L21 7 L12 12 Z"/><path d="M3 7 V17 L12 22 V12"/><path d="M21 7 V17 L12 22"/>',
  pin: '<path d="M12 2 C8.13 2 5 5.13 5 9 C5 14.25 12 22 12 22 C12 22 19 14.25 19 9 C19 5.13 15.87 2 12 2 Z"/><circle cx="12" cy="9" r="2.5"/>',
  refresh: '<path d="M20 8 A8 8 0 1 0 21 12"/><path d="M16 4 L20 8 L16 8"/><path d="M4 16 A8 8 0 1 0 3 12"/><path d="M8 20 L4 16 L8 16"/>',
  robot: '<rect x="4" y="8" width="16" height="12" rx="2.5"/><circle cx="9" cy="14" r="1.5"/><circle cx="15" cy="14" r="1.5"/><path d="M12 3 V8"/><path d="M9 17.5 H15"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 1.5 L13.5 4.5 L16 3.5 L15.5 6.5 L18.5 7 L17 9.5 L20 10.5 L17.5 12 L20 13.5 L17 14.5 L18.5 17 L15.5 17.5 L16 20.5 L13.5 19.5 L12 22.5 L10.5 19.5 L8 20.5 L8.5 17.5 L5.5 17 L7 14.5 L4 13.5 L6.5 12 L4 10.5 L7 9.5 L5.5 7 L8.5 6.5 L8 3.5 L10.5 4.5 Z"/>',
  sleep: '<path d="M5 8 H12 L5 16 H12"/><path d="M14 5 H20 L14 12 H20"/><path d="M15 18 H19 L15 22 H19"/>',
  spark: '<path d="M12 3 L13.6 9.4 L20 11 L13.6 12.6 L12 19 L10.4 12.6 L4 11 L10.4 9.4 Z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.5"/><path d="M12 1 V4"/><path d="M12 20 V23"/><path d="M1 12 H4"/><path d="M20 12 H23"/>',
  warning: '<path d="M12 3 L21 20 H3 Z"/><path d="M12 9 V14"/><circle cx="12" cy="17" r="0.8"/>',
  x: '<circle cx="12" cy="12" r="9"/><path d="M9 9 L15 15"/><path d="M15 9 L9 15"/>',
  zap: '<path d="M13 2 L4 14 H11 L10 22 L20 9 H13 Z"/>',
};

function ensureContainer(): HTMLDivElement {
  let el = document.getElementById(TOAST_CONTAINER_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = TOAST_CONTAINER_ID;
    el.style.cssText =
      'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(el);
  }
  return el;
}

function showToastDom(message: string, icon: ProfessionalIconName = 'pin', duration = 3000) {
  const container = ensureContainer();
  const el = document.createElement('div');
  el.className = 'chat-toast success';
  el.style.cssText =
    'pointer-events:auto;display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:8px;' +
    'background:var(--paper,#fff8f0);border:2px solid var(--ink,#2d2d2d);box-shadow:3px 3px 0 var(--ink,#2d2d2d);' +
    'font:600 14px/1.4 var(--hand,system-ui);color:var(--ink,#2d2d2d);animation:hd-msg-in 0.3s ease-out;';
  const iconEl = document.createElement('span');
  iconEl.style.cssText = 'display:inline-flex;width:18px;height:18px;align-items:center;justify-content:center;flex:0 0 auto;';
  iconEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TOAST_ICON_SVG[icon]}</svg>`;
  const textEl = document.createElement('span');
  textEl.textContent = message;
  el.append(iconEl, textEl);
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ── Toast 防抖队列 ──
const pendingToasts = new Map<
  string,
  { count: number; timer: ReturnType<typeof setTimeout>; message: string; icon: ProfessionalIconName }
>();

function debouncedToast(key: string, message: string, icon: ProfessionalIconName = 'pin', delay = 2000) {
  const existing = pendingToasts.get(key);
  if (existing) {
    existing.count++;
    clearTimeout(existing.timer);
    existing.timer = setTimeout(() => {
      const count = existing.count;
      showToastDom(count > 1 ? `${existing.message}（共 ${count} 项）` : existing.message, existing.icon);
      pendingToasts.delete(key);
    }, delay);
  } else {
    const entry = {
      count: 1,
      message,
      icon,
      timer: setTimeout(() => {
        showToastDom(message, icon);
        pendingToasts.delete(key);
      }, delay),
    };
    pendingToasts.set(key, entry);
  }
}

// ── 处理 workspace 事件 → toast + 状态更新 ──
function handleWorkspaceEvent(e: WorkspaceEvent) {
  switch (e.type) {
    case 'path_generated':
      // P1: 2s 防抖
      debouncedToast('path', `学习路径「${e.planName}」已生成（${e.totalSkills}个技能）`, 'book');
      break;

    case 'skill_completed':
      // P1: 2s 防抖，合并同类
      debouncedToast('skill', `技能「${e.skillName}」学习完成！`, 'spark');
      // 更新图谱快照
      useWorkspaceStore.getState().applySnapshot(e.snapshot);
      if (e.newMatchScore !== undefined) {
        useWorkspaceStore.getState().setMatchScore(e.newMatchScore);
      }
      break;

    case 'exam_completed':
      // P0: 立即显示
      if (e.passed) {
        showToastDom(`「${e.skillName}」考试通过！得分 ${e.score}`, 'check', 4000);
      } else {
        showToastDom(`「${e.skillName}」考试未通过（${e.score}分），继续巩固`, 'target', 4000);
      }
      break;

    case 'agent_task_completed':
      // P1: 2s 防抖
      debouncedToast('agent_done', `Agent 完成：${e.agentType}`, 'robot');
      break;

    case 'agent_task_started':
      // P3: 不弹 toast，只更新状态（由订阅方自行处理）
      break;

    case 'resource_ready':
      // P2: 5s 防抖，静默合并
      debouncedToast('resource', `资源已就绪：${e.skillName}`, 'document', 5000);
      break;

    case 'agent_dispatched':
      showToastDom(`已派遣 Agent：${e.agentType}`, 'zap');
      break;

    case 'agent_bound_to_path':
      showToastDom('Agent 已绑定到学习路径', 'robot');
      break;

    case 'agent_advice':
      // P0: 立即显示
      showToastDom(`${e.agentType} 建议：${e.advice}`, 'chat', 6000);
      break;

    case 'match_updated':
      // 由 SSE 桥接处理，这里不重复
      break;

    case 'today_tasks_refresh':
      // P2: 静默，不弹 toast
      break;
  }
}

/**
 * 全局事件同步 Hook
 *
 * 职责：
 * 1. 订阅前端 workspace store 事件 → 触发 toast 通知 + 状态更新
 * 2. 订阅后端 SSE 事件 → 桥接到 workspace store
 *
 * 使用方式：在顶层 App 组件中挂载一次即可
 */
export function useWorkspaceSync() {
  const seqRef = useRef(0);
  const { latestEvent } = useSSE();

  // ── 订阅前端事件总线 → toast + 状态更新 ──
  useEffect(() => {
    const unsubscribe = useWorkspaceStore.subscribe((state) => {
      if (!state.lastEvent || state.eventSeq <= seqRef.current) return;
      seqRef.current = state.eventSeq;
      handleWorkspaceEvent(state.lastEvent);
    });

    return unsubscribe;
  }, []);

  // ── 订阅后端 SSE → 桥接到 workspace store ──
  useEffect(() => {
    if (!latestEvent) return;

    switch (latestEvent.type) {
      case 'match_update': {
        const score = latestEvent.data?.newScore ?? latestEvent.data?.score ?? 0;
        useWorkspaceStore.getState().setMatchScore(score);
        // P0: 匹配度 >= 80% 立即显示
        if (score >= 80) {
          showToastDom(`匹配度 ${score}%，可以投递了！`, 'target', 5000);
        } else {
          showToastDom(`匹配度更新为 ${score}%`, 'chart');
        }
        break;
      }

      case 'agent_status': {
        // 从 SSE 数据更新 agent 计数
        const busy = latestEvent.data?.busyCount;
        const idle = latestEvent.data?.idleCount;
        if (busy !== undefined && idle !== undefined) {
          useWorkspaceStore.getState().setAgentCounts(busy, idle);
        }
        break;
      }

      case 'notification': {
        const count = latestEvent.data?.count ?? 0;
        useWorkspaceStore.getState().setUnreadCount(count);
        break;
      }

      case 'agent_advice': {
        const agentType = latestEvent.data?.agentType ?? 'Agent';
        const advice = latestEvent.data?.advice ?? '';
        showToastDom(`${agentType} 的建议：${advice}`, 'robot', 6000);
        break;
      }
    }
  }, [latestEvent]);
}

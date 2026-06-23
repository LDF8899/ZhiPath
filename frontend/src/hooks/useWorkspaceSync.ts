import { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../stores/workspace';
import { useSSE } from './useSSE';
import type { WorkspaceEvent } from '../types/workspace';

// ── 轻量 Toast（与 Chat.tsx / AgentOffice.tsx 风格一致） ──

const TOAST_CONTAINER_ID = 'zhpath-workspace-toast-container';

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

function showToastDom(message: string, icon: string, duration = 3000) {
  const container = ensureContainer();
  const el = document.createElement('div');
  el.className = 'chat-toast success';
  el.style.cssText =
    'pointer-events:auto;display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:8px;' +
    'background:var(--paper,#fff8f0);border:2px solid var(--ink,#2d2d2d);box-shadow:3px 3px 0 var(--ink,#2d2d2d);' +
    'font:600 14px/1.4 var(--hand,system-ui);color:var(--ink,#2d2d2d);animation:hd-msg-in 0.3s ease-out;';
  el.innerHTML = `<span style="font-size:18px">${icon}</span><span>${message}</span>`;
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
  { count: number; timer: ReturnType<typeof setTimeout>; message: string; icon: string }
>();

function debouncedToast(key: string, message: string, icon = '📌', delay = 2000) {
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
      debouncedToast('path', `学习路径「${e.planName}」已生成（${e.totalSkills}个技能）`, '📚');
      break;

    case 'skill_completed':
      // P1: 2s 防抖，合并同类
      debouncedToast('skill', `技能「${e.skillName}」学习完成！`, '🎉');
      // 更新图谱快照
      useWorkspaceStore.getState().applySnapshot(e.snapshot);
      if (e.newMatchScore !== undefined) {
        useWorkspaceStore.getState().setMatchScore(e.newMatchScore);
      }
      break;

    case 'exam_completed':
      // P0: 立即显示
      if (e.passed) {
        showToastDom(`「${e.skillName}」考试通过！得分 ${e.score}`, '✅', 4000);
      } else {
        showToastDom(`「${e.skillName}」考试未通过（${e.score}分），加油！`, '💪', 4000);
      }
      break;

    case 'agent_task_completed':
      // P1: 2s 防抖
      debouncedToast('agent_done', `Agent 完成：${e.agentType}`, '🤖');
      break;

    case 'agent_task_started':
      // P3: 不弹 toast，只更新状态（由订阅方自行处理）
      break;

    case 'resource_ready':
      // P2: 5s 防抖，静默合并
      debouncedToast('resource', `资源已就绪：${e.skillName}`, '📄', 5000);
      break;

    case 'agent_dispatched':
      showToastDom(`已派遣 Agent：${e.agentType}`, '⚡');
      break;

    case 'agent_bound_to_path':
      showToastDom('Agent 已绑定到学习路径', '🤖');
      break;

    case 'agent_advice':
      // P0: 立即显示
      showToastDom(`${e.agentType} 建议：${e.advice}`, '💬', 6000);
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
        const score = latestEvent.data?.score ?? 0;
        useWorkspaceStore.getState().setMatchScore(score);
        // P0: 匹配度 >= 80% 立即显示
        if (score >= 80) {
          showToastDom(`匹配度 ${score}%，可以投递了！`, '🚀', 5000);
        } else {
          showToastDom(`匹配度更新为 ${score}%`, '📈');
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
        showToastDom(`${agentType} 的建议：${advice}`, '🤖', 6000);
        break;
      }
    }
  }, [latestEvent]);
}

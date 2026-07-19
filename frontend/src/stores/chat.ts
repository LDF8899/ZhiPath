import { create } from 'zustand';
import type { ChatAction, ChatMessage } from '../types';

/**
 * 对话状态持久化 Store
 *
 * 解决问题：页面切换后对话记录丢失
 * 方案：用 sessionStorage 持久化，页面切换后自动恢复
 */

interface ChatState {
  /** 主聊天页的消息（按 sessionId 分组） */
  mainMessages: Record<string, ChatMessage[]>;
  /** 当前主聊天 sessionId */
  currentSessionId: string;
  /** 浮窗聊天的消息（按 pageType 分组） */
  floatingMessages: Record<string, ChatMessage[]>;
  /** 浮窗聊天的 sessionId（按 pageType 分组） */
  floatingSessionIds: Record<string, string>;

  // ── 主聊天页操作 ──
  setMainMessages: (sessionId: string, messages: ChatMessage[]) => void;
  appendMainMessage: (sessionId: string, message: ChatMessage) => void;
  upsertMainMessageAction: (sessionId: string, action: ChatAction, actionKey: string) => boolean;
  setCurrentSessionId: (sessionId: string) => void;
  clearMainSession: (sessionId: string) => void;

  // ── 浮窗聊天操作 ──
  setFloatingMessages: (pageType: string, messages: ChatMessage[]) => void;
  appendFloatingMessage: (pageType: string, message: ChatMessage) => void;
  clearFloatingMessages: (pageType: string) => void;
  setFloatingSessionId: (pageType: string, sessionId: string) => void;
}

const STORAGE_KEY = 'zhpath_chat';

function loadState(): Partial<ChatState> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      mainMessages: parsed.mainMessages || {},
      currentSessionId: parsed.currentSessionId || '',
      floatingMessages: parsed.floatingMessages || {},
      floatingSessionIds: parsed.floatingSessionIds || {},
    };
  } catch {
    return {};
  }
}

function saveState(state: ChatState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      mainMessages: state.mainMessages,
      currentSessionId: state.currentSessionId,
      floatingMessages: state.floatingMessages,
      floatingSessionIds: state.floatingSessionIds,
    }));
  } catch { /* quota exceeded, ignore */ }
}

const initial = loadState();

export const useChatStore = create<ChatState>((set, get) => ({
  mainMessages: initial.mainMessages || {},
  currentSessionId: initial.currentSessionId || '',
  floatingMessages: initial.floatingMessages || {},
  floatingSessionIds: initial.floatingSessionIds || {},

  setMainMessages: (sessionId, messages) => {
    set({ mainMessages: { ...get().mainMessages, [sessionId]: messages } });
    saveState(get());
  },

  appendMainMessage: (sessionId, message) => {
    const prev = get().mainMessages[sessionId] || [];
    set({ mainMessages: { ...get().mainMessages, [sessionId]: [...prev, message] } });
    saveState(get());
  },

  upsertMainMessageAction: (sessionId, action, actionKey) => {
    const prev = get().mainMessages[sessionId] || [];
    if (!sessionId) return false;

    // 全局去重：检查 action key 是否已在会话的任何消息中存在
    const normalized = { ...action, key: actionKey };
    const alreadyExists = prev.some((m) =>
      (m.actions || []).some((a) => {
        if (a.key && a.key === actionKey) return true;
        const aData = a.data || {};
        const nData = normalized.data || {};
        const sameVideoTask = aData.taskId && nData.taskId && aData.taskId === nData.taskId;
        const sameVideoSkill =
          (a.type === 'video' || a.type === 'video_pending') &&
          (normalized.type === 'video' || normalized.type === 'video_pending') &&
          (aData.skillName || aData.skill) &&
          (aData.skillName || aData.skill) === (nData.skillName || nData.skill);
        const sameByData = !a.key && !actionKey && a.type === normalized.type &&
          JSON.stringify(aData).slice(0, 120) === JSON.stringify(nData).slice(0, 120);
        return sameVideoTask || sameVideoSkill || sameByData;
      }),
    );
    if (alreadyExists) return false;

    const targetIndex = [...prev].reverse().findIndex((m) => m.role === 'assistant');
    const assistantIndex = targetIndex < 0 ? prev.length : prev.length - 1 - targetIndex;
    const next = targetIndex < 0
      ? [
          ...prev,
          {
            role: 'assistant' as const,
            content: '已恢复本次对话生成的资源。',
            timestamp: Date.now(),
            actions: [],
          },
        ]
      : [...prev];
    const target = next[assistantIndex];

    next[assistantIndex] = {
      ...target,
      actions: [...(target.actions || []), normalized],
    };
    set({ mainMessages: { ...get().mainMessages, [sessionId]: next } });
    saveState(get());
    return true;
  },

  setCurrentSessionId: (sessionId) => {
    set({ currentSessionId: sessionId });
    saveState(get());
  },

  clearMainSession: (sessionId) => {
    const { [sessionId]: _, ...rest } = get().mainMessages;
    set({ mainMessages: rest });
    saveState(get());
  },

  setFloatingMessages: (pageType, messages) => {
    set({ floatingMessages: { ...get().floatingMessages, [pageType]: messages } });
    saveState(get());
  },

  appendFloatingMessage: (pageType, message) => {
    const prev = get().floatingMessages[pageType] || [];
    set({ floatingMessages: { ...get().floatingMessages, [pageType]: [...prev, message] } });
    saveState(get());
  },

  clearFloatingMessages: (pageType) => {
    const { [pageType]: _, ...rest } = get().floatingMessages;
    set({ floatingMessages: rest });
    saveState(get());
  },

  setFloatingSessionId: (pageType, sessionId) => {
    set({ floatingSessionIds: { ...get().floatingSessionIds, [pageType]: sessionId } });
    saveState(get());
  },
}));

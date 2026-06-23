import { create } from 'zustand';
import type { ChatMessage } from '../types';

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

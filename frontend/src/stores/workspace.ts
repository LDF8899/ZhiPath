import { create } from 'zustand';
import type { WorkspaceEvent, GraphSnapshot } from '../types/workspace';

interface WorkspaceState {
  // ── 共享数据 ──
  matchScore: number;
  agentBusyCount: number;
  agentIdleCount: number;
  unreadNotificationCount: number;

  // ── 图谱数据 ──
  currentSnapshot: GraphSnapshot | null;

  // ── 事件系统 ──
  lastEvent: WorkspaceEvent | null;
  eventSeq: number;

  // ── Actions ──
  emit: (event: WorkspaceEvent) => void;
  setMatchScore: (score: number) => void;
  setAgentCounts: (busy: number, idle: number) => void;
  setUnreadCount: (count: number) => void;
  applySnapshot: (snapshot: GraphSnapshot) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  matchScore: 0,
  agentBusyCount: 0,
  agentIdleCount: 0,
  unreadNotificationCount: 0,
  currentSnapshot: null,
  lastEvent: null,
  eventSeq: 0,

  emit: (event) =>
    set((s) => ({
      lastEvent: event,
      eventSeq: s.eventSeq + 1,
    })),

  setMatchScore: (score) => set({ matchScore: score }),
  setAgentCounts: (busy, idle) => set({ agentBusyCount: busy, agentIdleCount: idle }),
  setUnreadCount: (count) => set({ unreadNotificationCount: count }),
  applySnapshot: (snapshot) => set({ currentSnapshot: snapshot }),
}));

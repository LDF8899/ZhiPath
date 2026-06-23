import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentConfig, SceneType } from '../components/office/types';
import { AGENT_CONFIGS, DEFAULT_AGENT } from '../components/office/types';

interface TaskProgress {
  taskId: string;
  agentId: string;
  name: string;
  progress: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
}

interface OfficeState {
  activeAgent: string | null;
  agentStatuses: Record<string, 'idle' | 'working' | 'completed'>;
  currentScene: SceneType;
  tasks: TaskProgress[];
  sidebarOpen: boolean;
  
  setActiveAgent: (agentId: string | null) => void;
  setAgentStatus: (agentId: string, status: 'idle' | 'working' | 'completed') => void;
  addTask: (task: TaskProgress) => void;
  updateTask: (taskId: string, updates: Partial<TaskProgress>) => void;
  removeTask: (taskId: string) => void;
  setScene: (scene: SceneType) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  getAgentConfig: (agentId: string) => AgentConfig;
  getActiveTasks: () => TaskProgress[];
}

export const useOfficeStore = create<OfficeState>()(
  persist(
    (set, get) => ({
      activeAgent: null,
      agentStatuses: {},
      currentScene: 'village',
      tasks: [],
      sidebarOpen: true,
      
      setActiveAgent: (agentId) => set({ activeAgent: agentId }),
      setAgentStatus: (agentId, status) => set((state) => ({
        agentStatuses: { ...state.agentStatuses, [agentId]: status }
      })),
      addTask: (task) => set((state) => ({
        tasks: [...state.tasks, task]
      })),
      updateTask: (taskId, updates) => set((state) => ({
        tasks: state.tasks.map(t => t.taskId === taskId ? { ...t, ...updates } : t)
      })),
      removeTask: (taskId) => set((state) => ({
        tasks: state.tasks.filter(t => t.taskId !== taskId)
      })),
      setScene: (scene) => set({ currentScene: scene }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      getAgentConfig: (agentId) => AGENT_CONFIGS[agentId] || DEFAULT_AGENT,
      getActiveTasks: () => get().tasks.filter(t => t.status === 'running' || t.status === 'pending'),
    }),
    {
      name: 'office-storage',
      partialize: (state) => ({
        currentScene: state.currentScene,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);

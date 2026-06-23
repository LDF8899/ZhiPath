# 智能体办公室与 AI 对话深度结合实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将智能体办公室与 AI 对话深度融合，实现双栏联动架构，让每个智能体都有人格、任务可视化、场景成长

**Architecture:** 主对话区 + 可折叠办公室侧边栏，智能体状态实时联动，场景随学习进度升级

**Tech Stack:** React, TypeScript, Zustand, Tailwind CSS, Hand-Drawn Design System

---

## 文件结构

```
frontend/src/
├── components/
│   ├── office/
│   │   ├── AnimalAvatar.tsx        (新增 - 统一动物头像组件)
│   │   ├── AgentStation.tsx        (新增 - 智能体工位)
│   │   ├── OfficeScene.tsx         (新增 - 办公室场景)
│   │   ├── TaskProgress.tsx        (新增 - 任务进度面板)
│   │   ├── VideoPipeline.tsx       (新增 - 视频制作流水线)
│   │   └── types.ts                (修改 - 添加新类型)
│   └── chat/
│       ├── AgentMessage.tsx        (新增 - 带身份标识的消息)
│       └── ChatSidebar.tsx         (新增 - 办公室侧边栏)
├── stores/
│   └── office.ts                   (新增 - 办公室状态管理)
├── pages/user/
│   └── Chat.tsx                    (重构 - 集成办公室侧边栏)
└── styles/
    └── office-chat.css             (新增 - 办公室对话样式)
```

---

## Task 1: 创建统一动物头像组件

**Covers:** S4

**Files:**
- Create: `frontend/src/components/office/AnimalAvatar.tsx`
- Modify: `frontend/src/components/office/types.ts`

- [ ] **Step 1: 添加智能体配置类型**

```typescript
// types.ts 新增
export interface AgentConfig {
  id: string;
  animal: AnimalType;
  color: string;
  name: string;
  intent: string;
}

export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  'generate_path':      { id: 'path',      animal: 'cat',     color: '#f5a623', name: '路径规划师', intent: 'generate_path' },
  'generate_exam':      { id: 'exam',      animal: 'dog',     color: '#7b68ee', name: '出题专家',   intent: 'generate_exam' },
  'recommend_jobs':     { id: 'jobs',      animal: 'rabbit',  color: '#ff6b6b', name: '岗位顾问',   intent: 'recommend_jobs' },
  'generate_video':     { id: 'video',     animal: 'panda',   color: '#2ed573', name: '视频制作人', intent: 'generate_video' },
  'generate_animation': { id: 'animation', animal: 'fox',     color: '#ffa502', name: '动画设计师', intent: 'generate_animation' },
  'generate_diagram':   { id: 'diagram',   animal: 'fox',     color: '#ffa502', name: '动画设计师', intent: 'generate_diagram' },
  'show_progress':      { id: 'progress',  animal: 'owl',     color: '#1e90ff', name: '进度管理员', intent: 'show_progress' },
  'show_today_tasks':   { id: 'tasks',     animal: 'parrot',  color: '#ff4500', name: '任务调度员', intent: 'show_today_tasks' },
  'recommend_resources':{ id: 'resources', animal: 'hamster', color: '#ff69b4', name: '资源推荐官', intent: 'recommend_resources' },
  'set_target_job':     { id: 'target',    animal: 'rabbit',  color: '#ff6b6b', name: '岗位顾问',   intent: 'set_target_job' },
  'match_analysis':     { id: 'gap',       animal: 'duck',    color: '#4169e1', name: '差距分析师', intent: 'analyze_skill_gap' },
  'chat':               { id: 'chat',      animal: 'hamster', color: '#ff69b4', name: 'AI 助教',    intent: 'chat' },
};

export const DEFAULT_AGENT: AgentConfig = {
  id: 'chat',
  animal: 'hamster',
  color: '#ff69b4',
  name: 'AI 助教',
  intent: 'chat',
};
```

- [ ] **Step 2: 创建 AnimalAvatar 组件**

```tsx
// AnimalAvatar.tsx
import { type AnimalType, ANIMAL_COLORS } from './types';
import AnimalSVG from './AnimalSVG';

interface AnimalAvatarProps {
  type: AnimalType;
  color?: string;
  size?: number;
  status?: 'idle' | 'working' | 'completed';
  className?: string;
}

export default function AnimalAvatar({ 
  type, 
  color = ANIMAL_COLORS[type] || '#f5a623',
  size = 40,
  status = 'idle',
  className = '' 
}: AnimalAvatarProps) {
  return (
    <div 
      className={`animal-avatar animal-${status} ${className}`}
      style={{ width: size, height: size }}
    >
      <AnimalSVG type={type} color={color} size={size} />
      {status === 'working' && (
        <div className="working-indicator">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
      )}
      {status === 'completed' && (
        <div className="completed-check">✓</div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 添加样式**

```css
/* office-chat.css */
.animal-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.animal-idle {
  opacity: 0.8;
  transition: all 0.3s ease;
}

.animal-working {
  animation: agent-pulse 1.5s ease-in-out infinite;
}

.animal-completed {
  animation: agent-celebrate 0.5s ease-out;
}

.working-indicator {
  position: absolute;
  bottom: -4px;
  display: flex;
  gap: 2px;
}

.working-indicator .dot {
  width: 4px;
  height: 4px;
  background: var(--accent);
  border-radius: 50%;
  animation: dot-bounce 1.2s ease-in-out infinite;
}

.working-indicator .dot:nth-child(2) { animation-delay: 0.2s; }
.working-indicator .dot:nth-child(3) { animation-delay: 0.4s; }

.completed-check {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 16px;
  height: 16px;
  background: #2ed573;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
}

@keyframes agent-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes agent-celebrate {
  0% { transform: scale(1) rotate(0); }
  50% { transform: scale(1.1) rotate(5deg); }
  100% { transform: scale(1) rotate(0); }
}

@keyframes dot-bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-4px); }
}
```

- [ ] **Step 4: 验证构建**

Run: `cd D:\X\ZhiPath\frontend && npm run build`
Expected: 构建成功

---

## Task 2: 创建办公室状态管理

**Covers:** S3, S7, S9

**Files:**
- Create: `frontend/src/stores/office.ts`

- [ ] **Step 1: 创建 Zustand store**

```typescript
// stores/office.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentConfig, SceneType } from '../components/office/types';
import { AGENT_CONFIGS, DEFAULT_AGENT } from '../components/office/types';

interface TaskProgress {
  taskId: string;
  agentId: string;
  name: string;
  progress: number;  // 0-100
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
}

interface OfficeState {
  // 智能体状态
  activeAgent: string | null;
  agentStatuses: Record<string, 'idle' | 'working' | 'completed'>;
  
  // 场景
  currentScene: SceneType;
  
  // 任务进度
  tasks: TaskProgress[];
  
  // 侧边栏
  sidebarOpen: boolean;
  
  // Actions
  setActiveAgent: (agentId: string | null) => void;
  setAgentStatus: (agentId: string, status: 'idle' | 'working' | 'completed') => void;
  addTask: (task: TaskProgress) => void;
  updateTask: (taskId: string, updates: Partial<TaskProgress>) => void;
  removeTask: (taskId: string) => void;
  setScene: (scene: SceneType) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  
  // Helpers
  getAgentConfig: (agentId: string) => AgentConfig;
  getActiveTasks: () => TaskProgress[];
}

export const useOfficeStore = create<OfficeState>()(
  persist(
    (set, get) => ({
      // State
      activeAgent: null,
      agentStatuses: {},
      currentScene: 'village',
      tasks: [],
      sidebarOpen: true,
      
      // Actions
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
      
      // Helpers
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
```

- [ ] **Step 2: 验证构建**

Run: `cd D:\X\ZhiPath\frontend && npm run build`
Expected: 构建成功

---

## Task 3: 创建智能体消息组件

**Covers:** S4, S7

**Files:**
- Create: `frontend/src/components/chat/AgentMessage.tsx`

- [ ] **Step 1: 创建 AgentMessage 组件**

```tsx
// AgentMessage.tsx
import AnimalAvatar from '../office/AnimalAvatar';
import { useOfficeStore } from '../../stores/office';
import type { ChatMessage } from '../../types';

interface AgentMessageProps {
  message: ChatMessage;
  isLast?: boolean;
}

export default function AgentMessage({ message, isLast }: AgentMessageProps) {
  const { getAgentConfig, agentStatuses } = useOfficeStore();
  
  // 从消息中获取 agent 标识
  const agentId = message.agent || 'chat';
  const config = getAgentConfig(agentId);
  const status = agentStatuses[agentId] || 'idle';
  
  return (
    <div className="agent-message">
      <div className="agent-badge">
        <AnimalAvatar 
          type={config.animal} 
          color={config.color} 
          size={32}
          status={isLast ? status : 'idle'}
        />
        <div className="agent-info">
          <span className="agent-name">{config.name}</span>
          {isLast && status === 'working' && (
            <span className="agent-status-text">工作中...</span>
          )}
        </div>
      </div>
      <div className="agent-content">
        {message.content}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 添加样式**

```css
/* office-chat.css */
.agent-message {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agent-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: var(--paper-tint);
  border-radius: 8px;
  width: fit-content;
}

.agent-info {
  display: flex;
  flex-direction: column;
}

.agent-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
}

.agent-status-text {
  font-size: 10px;
  color: var(--accent);
  animation: status-blink 1.5s ease-in-out infinite;
}

.agent-content {
  padding: 12px 16px;
  background: var(--paper-tint);
  border-radius: 12px;
  border-top-left-radius: 4px;
}

@keyframes status-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

- [ ] **Step 3: 验证构建**

Run: `cd D:\X\ZhiPath\frontend && npm run build`
Expected: 构建成功

---

## Task 4: 创建办公室侧边栏

**Covers:** S3, S5, S6

**Files:**
- Create: `frontend/src/components/chat/ChatSidebar.tsx`
- Create: `frontend/src/components/office/OfficeScene.tsx`
- Create: `frontend/src/components/office/AgentStation.tsx`
- Create: `frontend/src/components/office/TaskProgress.tsx`

- [ ] **Step 1: 创建 AgentStation 组件**

```tsx
// AgentStation.tsx
import AnimalAvatar from './AnimalAvatar';
import type { AgentConfig } from './types';

interface AgentStationProps {
  agent: AgentConfig;
  status: 'idle' | 'working' | 'completed';
  isActive: boolean;
  onClick?: () => void;
}

export default function AgentStation({ agent, status, isActive, onClick }: AgentStationProps) {
  return (
    <div 
      className={`agent-station ${isActive ? 'active' : ''} ${status}`}
      onClick={onClick}
    >
      <div className="station-desk">
        <AnimalAvatar 
          type={agent.animal}
          color={agent.color}
          size={48}
          status={status}
        />
      </div>
      <div className="station-label">
        <span className="station-name">{agent.name}</span>
        {status === 'working' && <span className="station-status">忙碌中</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 TaskProgress 组件**

```tsx
// TaskProgress.tsx
import AnimalAvatar from './AnimalAvatar';
import { useOfficeStore } from '../../stores/office';

export default function TaskProgress() {
  const { tasks, getAgentConfig } = useOfficeStore();
  const activeTasks = tasks.filter(t => t.status === 'running' || t.status === 'pending');
  
  if (activeTasks.length === 0) return null;
  
  return (
    <div className="task-progress-panel">
      <h4 className="progress-title">
        <span className="progress-icon">📋</span>
        进行中的任务
      </h4>
      
      <div className="progress-list">
        {activeTasks.map(task => {
          const config = getAgentConfig(task.agentId);
          return (
            <div key={task.taskId} className="progress-item">
              <AnimalAvatar 
                type={config.animal}
                color={config.color}
                size={24}
                status="working"
              />
              <div className="progress-info">
                <span className="progress-name">{task.name}</span>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                <span className="progress-text">
                  {task.message || `${task.progress}%`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 OfficeScene 组件**

```tsx
// OfficeScene.tsx
import AgentStation from './AgentStation';
import TaskProgress from './TaskProgress';
import { useOfficeStore } from '../../stores/office';
import { AGENT_CONFIGS } from './types';

const SCENE_AGENTS: Record<string, string[]> = {
  village: ['generate_path', 'chat', 'recommend_jobs'],
  advanced: ['generate_path', 'chat', 'recommend_jobs', 'generate_exam', 'show_progress', 'generate_video'],
  master: Object.keys(AGENT_CONFIGS),
};

const SCENE_CONFIGS = {
  village: { name: '新手村', bg: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  advanced: { name: '进阶区', bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  master: { name: '大师殿', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
};

export default function OfficeScene() {
  const { currentScene, activeAgent, agentStatuses, setActiveAgent } = useOfficeStore();
  
  const sceneConfig = SCENE_CONFIGS[currentScene];
  const agentIds = SCENE_AGENTS[currentScene];
  
  return (
    <div className="office-scene" style={{ background: sceneConfig.bg }}>
      <div className="scene-header">
        <span className="scene-name">🏢 {sceneConfig.name}</span>
      </div>
      
      <div className="scene-grid">
        {agentIds.map(agentId => {
          const config = AGENT_CONFIGS[agentId];
          if (!config) return null;
          
          return (
            <AgentStation
              key={agentId}
              agent={config}
              status={agentStatuses[agentId] || 'idle'}
              isActive={activeAgent === agentId}
              onClick={() => setActiveAgent(agentId)}
            />
          );
        })}
      </div>
      
      <TaskProgress />
    </div>
  );
}
```

- [ ] **Step 4: 创建 ChatSidebar 组件**

```tsx
// ChatSidebar.tsx
import OfficeScene from '../office/OfficeScene';
import { useOfficeStore } from '../../stores/office';

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function ChatSidebar({ isOpen, onToggle }: ChatSidebarProps) {
  return (
    <>
      {/* Toggle button */}
      <button 
        className="sidebar-toggle"
        onClick={onToggle}
        title={isOpen ? '收起办公室' : '展开办公室'}
      >
        <span className="toggle-icon">{isOpen ? '◀' : '▶'}</span>
        <span className="toggle-label">{isOpen ? '' : '🏢'}</span>
      </button>
      
      {/* Sidebar */}
      <aside className={`chat-sidebar office-sidebar ${isOpen ? 'open' : 'closed'}`}>
        <OfficeScene />
      </aside>
    </>
  );
}
```

- [ ] **Step 5: 添加样式**

```css
/* office-chat.css */

/* Sidebar toggle */
.sidebar-toggle {
  position: fixed;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 100;
  background: var(--paper-tint);
  border: 2px solid var(--ink);
  border-radius: 8px 0 0 8px;
  padding: 8px 4px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.toggle-icon {
  font-size: 12px;
  color: var(--ink);
}

.toggle-label {
  font-size: 16px;
}

/* Office sidebar */
.office-sidebar {
  width: 280px;
  min-width: 280px;
  border-left: 2px dashed var(--pencil);
  overflow-y: auto;
  transition: all 0.3s ease;
}

.office-sidebar.closed {
  width: 0;
  min-width: 0;
  border-left: none;
  overflow: hidden;
}

/* Office scene */
.office-scene {
  padding: 16px;
  border-radius: 12px;
  margin: 8px;
  min-height: 300px;
}

.scene-header {
  text-align: center;
  margin-bottom: 16px;
}

.scene-name {
  font-size: 14px;
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

.scene-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 12px;
}

/* Agent station */
.agent-station {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.agent-station:hover {
  background: rgba(255,255,255,0.3);
}

.agent-station.active {
  background: rgba(255,255,255,0.5);
  box-shadow: 0 0 0 2px var(--accent);
}

.agent-station.working .station-desk {
  animation: desk-glow 1.5s ease-in-out infinite;
}

.station-desk {
  background: rgba(255,255,255,0.6);
  border-radius: 12px;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.station-label {
  text-align: center;
}

.station-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--ink);
}

.station-status {
  font-size: 8px;
  color: var(--accent);
  display: block;
}

/* Task progress */
.task-progress-panel {
  margin-top: 16px;
  padding: 12px;
  background: rgba(255,255,255,0.6);
  border-radius: 8px;
}

.progress-title {
  font-size: 12px;
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.progress-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-info {
  flex: 1;
  min-width: 0;
}

.progress-name {
  font-size: 10px;
  font-weight: 600;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.progress-bar {
  height: 4px;
  background: rgba(0,0,0,0.1);
  border-radius: 2px;
  overflow: hidden;
  margin: 4px 0;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 9px;
  color: var(--pencil);
}

@keyframes desk-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(216, 72, 43, 0); }
  50% { box-shadow: 0 0 8px 2px rgba(216, 72, 43, 0.3); }
}
```

- [ ] **Step 6: 验证构建**

Run: `cd D:\X\ZhiPath\frontend && npm run build`
Expected: 构建成功

---

## Task 5: 重构 Chat 页面集成侧边栏

**Covers:** S3, S7, S8

**Files:**
- Modify: `frontend/src/pages/user/Chat.tsx`

- [ ] **Step 1: 导入新组件和 store**

```typescript
// Chat.tsx 顶部添加
import ChatSidebar from '../../components/chat/ChatSidebar';
import AgentMessage from '../../components/chat/AgentMessage';
import { useOfficeStore } from '../../stores/office';
```

- [ ] **Step 2: 在 Chat 组件中集成**

```tsx
// Chat 组件内部添加
const { 
  sidebarOpen, 
  toggleSidebar, 
  setActiveAgent, 
  setAgentStatus,
  addTask,
  updateTask 
} = useOfficeStore();

// 在 handleSend 中添加联动逻辑
const handleSend = async (text?: string) => {
  const msg = (text || input).trim();
  if (!msg || sending) return;
  
  // ... 现有逻辑 ...
  
  // 新增：设置活跃智能体（从响应中获取）
  if (response.agent) {
    setActiveAgent(response.agent);
    setAgentStatus(response.agent, 'working');
  }
  
  // 新增：如果有视频任务，添加到进度
  if (response.actions?.some(a => a.type === 'video_pending')) {
    const videoAction = response.actions.find(a => a.type === 'video_pending');
    addTask({
      taskId: videoAction.data.taskId,
      agentId: 'generate_video',
      name: `生成${videoAction.data.skillName}教学视频`,
      progress: 0,
      status: 'running',
      message: '准备中...',
    });
  }
  
  // 新增：回复完成后设置空闲
  setTimeout(() => {
    if (response.agent) {
      setAgentStatus(response.agent, 'idle');
    }
  }, 2000);
};
```

- [ ] **Step 3: 修改渲染结构**

```tsx
// Chat.tsx return 部分
return (
  <div className="chat-page with-office">
    {/* 现有侧边栏（会话列表） */}
    <aside className={`chat-sidebar ${sidebarOpen ? 'open' : ''}`}>
      {/* ... 现有代码 ... */}
    </aside>
    
    {/* 主对话区 */}
    <main className="chat-main">
      {/* ... 现有代码 ... */}
      
      {/* 修改消息渲染：使用 AgentMessage */}
      {messages.map((msg, i) => (
        <div key={i} className={`chat-msg ${msg.role}`}>
          <div className={`chat-msg-avatar ${msg.role}`}>
            {msg.role === 'user' ? <IconUser size={16} /> : <IconRobot size={16} />}
          </div>
          <div className="chat-msg-content">
            {msg.role === 'assistant' ? (
              <AgentMessage message={msg} isLast={i === messages.length - 1} />
            ) : (
              <div className="chat-bubble user">{msg.content}</div>
            )}
            {/* Action cards */}
            {msg.actions?.map((action, j) => (
              <div key={j} className="chat-action-wrap">
                <ActionRenderer action={action} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </main>
    
    {/* 新增：办公室侧边栏 */}
    <ChatSidebar isOpen={officeSidebarOpen} onToggle={toggleOfficeSidebar} />
  </div>
);
```

- [ ] **Step 4: 添加响应式逻辑**

```tsx
// 响应式：小屏幕自动关闭办公室侧边栏
useEffect(() => {
  const handleResize = () => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };
  
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

- [ ] **Step 5: 验证构建**

Run: `cd D:\X\ZhiPath\frontend && npm run build`
Expected: 构建成功

---

## Task 6: 后端返回格式增强

**Covers:** S10

**Files:**
- Modify: `backend-ts/src/modules/chat/chat.service.ts`

- [ ] **Step 1: 添加 agentInfo 到响应**

```typescript
// chat.service.ts - chat 方法返回部分
const agentInfo = AGENT_CONFIGS[agent] || AGENT_CONFIGS['chat'];

return {
  reply,
  session_id: sessionId,
  agent,
  agentInfo: {
    name: agentInfo.name,
    animal: agentInfo.animal,
    color: agentInfo.color,
  },
  profile_version: profileVersion,
  actions: actionResults,
};
```

- [ ] **Step 2: 验证构建**

Run: `cd D:\X\ZhiPath\backend-ts && npm run build`
Expected: 构建成功

---

## Task 7: 视频制作流水线组件

**Covers:** S5

**Files:**
- Create: `frontend/src/components/office/VideoPipeline.tsx`

- [ ] **Step 1: 创建 VideoPipeline 组件**

```tsx
// VideoPipeline.tsx
import AnimalAvatar from './AnimalAvatar';
import { useOfficeStore } from '../../stores/office';

const PIPELINE_STAGES = [
  { id: 'script', label: '脚本', icon: '🐼', agentId: 'generate_video' },
  { id: 'render', label: '渲染', icon: '🎬', agentId: 'video_renderer' },
  { id: 'tts', label: '配音', icon: '🎙️', agentId: 'tts' },
  { id: 'compose', label: '合成', icon: '🎬', agentId: 'ffmpeg' },
];

interface VideoPipelineProps {
  taskId: string;
  currentStage: string;
  progress: number;
}

export default function VideoPipeline({ taskId, currentStage, progress }: VideoPipelineProps) {
  const { getAgentConfig } = useOfficeStore();
  
  const currentStageIndex = PIPELINE_STAGES.findIndex(s => s.id === currentStage);
  
  return (
    <div className="video-pipeline">
      <h4 className="pipeline-title">🎬 视频制作</h4>
      
      <div className="pipeline-stages">
        {PIPELINE_STAGES.map((stage, i) => {
          const isCompleted = i < currentStageIndex;
          const isActive = i === currentStageIndex;
          const isPending = i > currentStageIndex;
          
          return (
            <div 
              key={stage.id}
              className={`pipeline-stage ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${isPending ? 'pending' : ''}`}
            >
              <div className="stage-icon">
                {isCompleted ? '✓' : stage.icon}
              </div>
              <span className="stage-label">{stage.label}</span>
              {isActive && (
                <div className="stage-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="progress-text">{progress}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 添加样式**

```css
/* office-chat.css */
.video-pipeline {
  margin-top: 16px;
  padding: 12px;
  background: rgba(255,255,255,0.6);
  border-radius: 8px;
}

.pipeline-title {
  font-size: 12px;
  margin: 0 0 12px 0;
}

.pipeline-stages {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pipeline-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  position: relative;
}

.pipeline-stage:not(:last-child)::after {
  content: '→';
  position: absolute;
  right: -12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--pencil);
  font-size: 14px;
}

.stage-icon {
  width: 32px;
  height: 32px;
  background: var(--paper-tint);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.pipeline-stage.completed .stage-icon {
  background: #2ed573;
  color: white;
}

.pipeline-stage.active .stage-icon {
  background: var(--accent);
  animation: pulse 1.5s ease-in-out infinite;
}

.stage-label {
  font-size: 9px;
  color: var(--ink);
}

.stage-progress {
  width: 100%;
  text-align: center;
}

.stage-progress .progress-bar {
  height: 3px;
  margin-bottom: 2px;
}

.stage-progress .progress-text {
  font-size: 8px;
}
```

- [ ] **Step 3: 验证构建**

Run: `cd D:\X\ZhiPath\frontend && npm run build`
Expected: 构建成功

---

## Task 8: 集成测试和响应式验证

**Covers:** S11

- [ ] **Step 1: 启动开发服务器**

Run: `cd D:\X\ZhiPath\frontend && npm run dev`
Expected: 服务器启动成功

- [ ] **Step 2: 测试基本功能**

1. 打开聊天页面
2. 发送 "帮我规划学习路径"
3. 验证：
   - 侧边栏 PathAgent 工位高亮
   - 消息气泡显示 PathAgent 头像和名称
   - 工位显示"工作中"动画
   - 2秒后恢复空闲

- [ ] **Step 3: 测试视频任务**

1. 发送 "生成 Docker 教学视频"
2. 验证：
   - 侧边栏显示视频制作进度
   - 进度条实时更新
   - 完成后显示完成动画

- [ ] **Step 4: 测试响应式**

1. 调整浏览器窗口到 < 768px
2. 验证：
   - 办公室侧边栏自动隐藏
   - 底部出现办公室按钮
   - 点击按钮全屏显示办公室

- [ ] **Step 5: 最终构建验证**

Run: `cd D:\X\ZhiPath\frontend && npm run build`
Expected: 构建成功，无错误

---

## 完成检查

- [ ] 所有智能体都有对应的动物形象
- [ ] 消息气泡显示智能体身份标识
- [ ] 侧边栏办公室场景正常显示
- [ ] 智能体状态联动正常
- [ ] 任务进度可视化正常
- [ ] 响应式布局正常
- [ ] 后端返回 agentInfo 正常
- [ ] 所有测试通过

---
feature: office-chat-integration
status: design
---

# 智能体办公室与 AI 对话深度结合设计

## [S1] 问题

当前 AI 对话采用传统卡片形式，用户与智能体的交互缺乏沉浸感和情感连接。智能体办公室（AgentOffice）虽然有趣，但与主对话场景割裂，用户需要在两个页面间切换。

**目标**：将智能体办公室与 AI 对话深度融合，让每个智能体都有"人格"，任务执行可视化，学习过程更有代入感。

## [S2] 解决方案

采用**双栏联动**架构：主对话区 + 可折叠的办公室侧边栏。

### 核心理念

1. **智能体有人格**：每个功能对应一个动物形象的智能体
2. **工作可视化**：智能体在办公室工位上"工作"，状态实时同步
3. **场景成长**：办公室场景随学习进度升级（新手村→进阶区→大师殿）
4. **任务叙事**：AI 回复带身份标识，让用户知道"谁在帮我"

## [S3] 架构设计

### 组件结构

```
ChatPage.tsx (重构)
├── ChatSidebar.tsx (新增 - 办公室侧边栏)
│   ├── OfficeScene.tsx (办公室场景)
│   │   ├── AgentStation.tsx (智能体工位)
│   │   │   └── AnimalAvatar.tsx (动物头像 + 状态动画)
│   │   └── TaskProgress.tsx (任务进度面板)
│   └── SceneSelector.tsx (场景切换)
├── ChatMain.tsx (主对话区 - 重构现有)
│   ├── MessageList.tsx
│   │   └── AgentMessage.tsx (新增 - 带身份标识的消息)
│   └── InputArea.tsx
└── ChatHeader.tsx (新增 - 统一头部)
```

### 数据流

```typescript
// 新增 store
interface OfficeState {
  agents: AgentProfile[];
  activeAgent: string | null;
  currentScene: 'village' | 'advanced' | 'master';
  taskProgress: Map<string, number>;
  sidebarOpen: boolean;
}

// 联动流程
1. 用户发送消息 → 识别意图 → 设置 activeAgent
2. Agent 回复 → 对应工位显示"工作中"动画
3. 任务完成 → 进度条更新 → 场景可能升级
```

## [S4] 智能体身份系统

### 动物映射

| 意图 | 动物 | 颜色 | 昵称 |
|------|------|------|------|
| generate_path | 🐱 猫 | #f5a623 | 路径规划师 |
| generate_exam | 🐶 狗 | #7b68ee | 出题专家 |
| recommend_jobs | 🐰 兔子 | #ff6b6b | 岗位顾问 |
| generate_video | 🐼 熊猫 | #2ed573 | 视频制作人 |
| generate_animation | 🦊 狐狸 | #ffa502 | 动画设计师 |
| show_progress | 🦉 猫头鹰 | #1e90ff | 进度管理员 |
| chat | 🐹 仓鼠 | #ff69b4 | AI 助教 |

### 消息气泡增强

```tsx
// 带身份标识的消息
<div className="message assistant agent-message">
  <div className="agent-badge">
    <AnimalAvatar type="cat" color="#f5a623" size={32} />
    <span className="agent-name">路径规划师</span>
    <span className="agent-status working">工作中...</span>
  </div>
  <div className="content">我帮你规划了学习路径...</div>
</div>
```

## [S5] 任务进度可视化

### 进度面板（侧边栏底部）

```tsx
<div className="task-progress-panel">
  <h4>📋 进行中的任务</h4>
  
  <div className="progress-item">
    <AnimalAvatar type="panda" size={24} />
    <div className="progress-info">
      <span className="task-name">生成 Docker 教学视频</span>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: '60%' }} />
      </div>
      <span className="progress-text">渲染中... 60%</span>
    </div>
  </div>
</div>
```

### 状态动画

```css
.agent-working { animation: pulse 1.5s ease-in-out infinite; }
.agent-idle { opacity: 0.7; }
.agent-completed { animation: celebrate 0.5s ease-out; }
```

## [S6] 场景动态变化

### 场景定义

| 场景 | 名称 | 工位数 | 解锁条件 |
|------|------|--------|----------|
| village | 新手村 | 3 | 默认 |
| advanced | 进阶区 | 6 | 技能 ≥ 5，任务 ≥ 20 |
| master | 大师殿 | 12 | 技能 ≥ 10，任务 ≥ 50 |

### 视觉差异

```typescript
const SCENES = {
  village: {
    background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    furniture: '木质桌椅，温馨氛围',
  },
  advanced: {
    background: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    furniture: '现代办公桌，玻璃墙',
  },
  master: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    furniture: '高端办公区，全息屏幕',
  },
};
```

## [S7] 交互流程

### 完整联动流程

```
1. 用户发送 "帮我规划学习路径"
   ↓
2. 前端识别意图 → activeAgent = 'generate_path'
   ↓
3. 侧边栏 PathAgent 工位高亮 + "站起来" 动画
   ↓
4. 后端返回回复 → 带 agent 标识
   ↓
5. 消息气泡显示 PathAgent 头像和名称
   ↓
6. 如果有任务 → 侧边栏进度条更新
   ↓
7. 任务完成 → PathAgent "坐下" + 完成动画
```

### 实时状态同步

```typescript
// 复用现有 SSE 连接
useSSE('/api/events', (event) => {
  if (event.type === 'agent_status') {
    updateAgentStatus(event.agentId, event.status);
  }
  if (event.type === 'task_progress') {
    updateTaskProgress(event.taskId, event.progress);
  }
});
```

## [S8] 响应式设计

| 屏幕尺寸 | 侧边栏行为 |
|----------|------------|
| ≥ 1200px | 默认展开，可折叠 |
| 768-1199px | 默认折叠，点击展开 |
| < 768px | 隐藏，底部按钮触发全屏 |

## [S9] 技术实现要点

### 状态管理

```typescript
// stores/office.ts
export const useOfficeStore = create<OfficeState>((set) => ({
  agents: [],
  activeAgent: null,
  currentScene: 'village',
  taskProgress: new Map(),
  sidebarOpen: true,
  
  setActiveAgent: (agentId) => set({ activeAgent: agentId }),
  updateTaskProgress: (taskId, progress) => set((state) => {
    const newMap = new Map(state.taskProgress);
    newMap.set(taskId, progress);
    return { taskProgress: newMap };
  }),
}));
```

### 意图识别（前端）

```typescript
// 从后端返回的 agent 字段直接获取
const agentId = response.agent; // 'generate_path', 'chat', etc.
const agentConfig = AGENT_ANIMAL_MAP[agentId];
```

## [S10] 后端改动

### 返回格式增强

```typescript
// 现有
{ reply: "...", actions: [...], agent: "generate_path" }

// 新增
{ 
  reply: "...", 
  actions: [...], 
  agent: "generate_path",
  agentInfo: {
    name: "路径规划师",
    animal: "cat",
    color: "#f5a623"
  }
}
```

## [S11] 验证标准

1. **功能验证**
   - 发送消息后，对应智能体工位高亮
   - 消息气泡显示智能体头像和名称
   - 任务进度实时更新
   - 场景随进度升级

2. **性能验证**
   - 侧边栏动画 60fps
   - 不影响消息发送延迟

3. **响应式验证**
   - 三种屏幕尺寸正常显示
   - 折叠/展开动画流畅

## Source Materials

| 文件 | 用途 |
|------|------|
| `frontend/src/pages/user/Chat.tsx` | 主聊天页面，需重构 |
| `frontend/src/pages/user/AgentOffice.tsx` | 办公室页面，复用组件 |
| `frontend/src/components/office/AnimalSVG.tsx` | 动物头像生成器 |
| `frontend/src/stores/chat.ts` | 聊天状态管理 |
| `frontend/src/styles/hand-draw.css` | 手绘设计系统 |

---
feature: langgraph-migration
status: delivered
specs:
  - docs/compose/plans/2026-06-18-langgraph-migration.md
plans:
  - docs/compose/plans/2026-06-18-langgraph-migration.md
branch: main
---

# LangGraph 智能体迁移 — 最终报告

## What Was Built

将 ZhiPath 智能教育系统的 17 个智能体从 `ActionExecutorService` 的 switch-case 模式迁移到 LangGraph 状态图编排。每个智能体现在是 LangGraph 图中的独立节点，支持条件路由和并行执行。

**核心改进：**
- 17 个智能体全部节点化（含 3 个复合意图）
- 复合意图支持并行执行（`Promise.allSettled`）
- Orchestrator 兜底机制确保所有请求都能被处理
- 通过环境变量 `USE_LANGGRAPH=true` 可切换引擎

## Architecture

### 状态图结构

```
START → loadProfile → intentRouter → [条件路由]
                                      ├─ recommendJobs → aiSummarize → END
                                      ├─ setTargetJob → aiSummarize → END
                                      ├─ generatePath → aiSummarize → END
                                      ├─ generateExam → aiSummarize → END
                                      ├─ generateAnimation → aiSummarize → END
                                      ├─ generateDiagram → aiSummarize → END
                                      ├─ generateVideo → aiSummarize → END
                                      ├─ generateAvatar → aiSummarize → END
                                      ├─ showProgress → aiSummarize → END
                                      ├─ showTodayTasks → aiSummarize → END
                                      ├─ recommendResources → aiSummarize → END
                                      ├─ analyzeSkillGap → aiSummarize → END
                                      ├─ prepareInterview → aiSummarize → END（并行）
                                      ├─ startLearning → aiSummarize → END（串行）
                                      ├─ checkMatch → aiSummarize → END
                                      ├─ orchestratorFallback → [LLM 路由] → 对应节点
                                      └─ chatFallback → END
```

### State 定义

```typescript
const ChatState = Annotation.Root({
  // 输入
  userId: Annotation<number>,
  message: Annotation<string>,
  messages: Annotation<Array<{ role: string; content: string }>>,
  pageContext: Annotation<string>,

  // 中间状态
  intent: Annotation<{ name: string; filters: Record<string, any> } | null>,
  intentPhase: Annotation<string>,
  profile: Annotation<any>,
  student: Annotation<any>,
  userContext: Annotation<string>,

  // Agent 执行结果
  jobResults: Annotation<any[]>,
  pathResult: Annotation<any>,
  examResult: Annotation<any>,
  animationResult: Annotation<any>,
  diagramResult: Annotation<any>,
  videoResult: Annotation<any>,
  avatarResult: Annotation<any>,
  progressResult: Annotation<any>,
  dailyTasksResult: Annotation<any>,
  resourcesResult: Annotation<any[]>,
  skillGapResult: Annotation<any>,

  // 输出
  reply: Annotation<string>,
  actions: Annotation<any[]>,
  agent: Annotation<string>,
});
```

### 节点清单

| 节点名称 | 功能 | 类型 |
|----------|------|------|
| loadProfile | 加载用户画像 | 基础 |
| intentRouter | 意图路由（Phase B + C） | 基础 |
| recommendJobs | 推荐岗位 | 单 Agent |
| setTargetJob | 设置目标岗位 | 单 Agent |
| generatePath | 生成学习路径 | 单 Agent |
| generateExam | 生成考试 | 单 Agent |
| showProgress | 查看学习进度 | 单 Agent |
| showTodayTasks | 查看今日任务 | 单 Agent |
| generateAnimation | 生成动画 | 多模态 |
| generateDiagram | 生成图解 | 多模态 |
| generateVideo | 生成视频 | 多模态 |
| generateAvatar | 生成数字人 | 多模态 |
| recommendResources | 推荐资源 | 单 Agent |
| analyzeSkillGap | 分析技能差距 | 单 Agent |
| prepareInterview | 面试准备 | 复合并行 |
| startLearning | 开始学习 | 复合串行 |
| checkMatch | 检查匹配度 | 复合 |
| orchestratorFallback | Orchestrator 兜底 | LLM 路由 |
| chatFallback | 普通聊天 | 兜底 |
| aiSummarize | AI 总结动作结果 | 基础 |

## Usage

### 启用 LangGraph

在 `.env` 文件中设置：
```env
USE_LANGGRAPH=true
```

### 代码调用

```typescript
// ChatService 自动根据环境变量选择引擎
const result = await chatService.chat(userId, {
  message: '推荐岗位',
  session_id: sessionId,
  page_context: 'jobs',
});
```

### 复合意图示例

```typescript
// 面试准备 - 并行执行 JD 解析 + 技能差距 + 考试生成
await chatService.chat(userId, { message: '帮我准备面试' });

// 开始学习 - 串行执行 路径生成 + 今日任务
await chatService.chat(userId, { message: '开始学习' });
```

## Verification

### 构建验证

```bash
cd D:\X\ZhiPath\backend-ts
npm run build
# ✅ 构建成功，无错误
```

### 功能验证

1. **基本聊天**：发送 "你好" → 返回正常回复
2. **单 Agent 意图**：发送 "推荐岗位" → 返回岗位推荐
3. **复合意图**：发送 "帮我准备面试" → 并行执行多个 Agent
4. **兜底机制**：发送模糊请求 → OrchestratorFallback 通过 LLM 路由

### 代码审查

- ✅ 节点完整性：17 个智能体全部迁移
- ✅ State 定义：覆盖所有节点需要的字段
- ✅ 路由完整性：15 个意图映射完整
- ✅ 依赖注入：14 个服务/仓库全部注入
- ✅ 错误处理：每个节点都有 try-catch
- ✅ 复合意图：并行/串行执行正确

## Journey Log

- [lesson] LangGraph `Annotation.Root` state 中使用 `...spread` 合并多个节点返回值时，同名字段会被后者覆盖 — 复合节点必须手动合并
- [lesson] `addNode` 注册的节点如果没有任何边指向它，就是死节点 — 建议编译后做可达性检查
- [lesson] `orchestratorFallback` 作为 LLM-based 路由器，其 `intentNodeMap` 应与 `routeAfterIntent` 的 `intentMap` 保持同步
- [pivot] 从 ActionExecutorService 的 switch-case 模式迁移到 LangGraph 状态图，实现了更好的解耦和可扩展性
- [dead end] 最初尝试在单个节点中处理所有动作，后来改为每个智能体独立节点

## Source Materials

| File | Role | Notes |
|------|------|-------|
| `backend-ts/src/modules/chat/langgraph-engine.service.ts` | LangGraph 引擎 | 核心实现 |
| `backend-ts/src/modules/chat/chat.service.ts` | Chat 服务 | 引擎切换逻辑 |
| `backend-ts/src/modules/chat/chat.module.ts` | Chat 模块 | 依赖注入 |
| `backend-ts/src/services/agents/*.ts` | 智能体服务 | 被节点调用 |
| `docs/compose/plans/2026-06-18-langgraph-migration.md` | 迁移计划 | 实施参考 |

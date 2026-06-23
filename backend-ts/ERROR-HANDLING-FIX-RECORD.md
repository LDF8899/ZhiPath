# ZhiPath Backend 错误处理修复记录

**日期**: 2026-06-18  
**范围**: `backend-ts/src/` 全量审计 + 修复  
**验证**: NestJS build 零错误，TypeScript 编译零错误

---

## 一、审计发现汇总

| 严重度 | 数量 | 状态 |
|--------|------|------|
| Critical（会崩溃） | 0 | — |
| Important（功能缺失/代码脆弱） | 2 | ✅ 已修复 |
| Medium（运行时风险） | 3 | ✅ 已修复 |
| Low（静默吞错误） | 6 | ✅ 已修复 |

---

## 二、Important 修复

### 2.1 orchestrator `recognizeIntent` LLM 调用无 try/catch

**文件**: `src/services/agents/orchestrator-agent.service.ts`  
**问题**: `recognizeIntent()` 中 `this.llmService.chatCompletion()` 无错误处理，网络故障直接 500 崩溃。  
**修复**:
- `recognizeIntent()` 内 LLM 调用加 try/catch，失败时回退到关键词匹配
- `handleRequest()` 加顶层 try/catch，失败返回 `OrchestrationResult { success: false }`

### 2.2 chat.controller MongoDB 操作裸跑

**文件**: `src/modules/chat/chat.controller.ts`  
**问题**: `listSessions`、`getSession`、`deleteSession` 三个接口的 MongoDB 操作无 try/catch。  
**修复**: 每个接口加 try/catch，失败抛 `HttpException(500)` + 中文错误信息。

### 2.3 `review_content` 意图断层

**文件**: `src/services/agents/orchestrator-agent.service.ts`  
**问题**: LLM tool 定义声明了 `review_content` 意图，但 handleRequest switch 无对应 case，用户请求返回"不理解"。  
**修复**: 补 `case 'review_content'` → `executeReviewContent()` → 调用 `reviewerAgent.reviewContent()`。

### 2.4 私有属性 `['mongoConnection']` 访问

**文件**: `src/modules/chat/chat.controller.ts`、`src/services/chat-history.service.ts`  
**问题**: Controller 用 `this.chatHistory['mongoConnection'].db!` 绕过 TypeScript private 访问，重命名即崩。  
**修复**: `ChatHistoryService` 新增公开 `getDb()` 方法（null 时抛明确错误），Controller 三处改为调用 `this.chatHistory.getDb()`。

---

## 三、Medium 修复

### 3.1 LangGraph stream 静默中断

**文件**: `src/modules/chat/langgraph-engine.service.ts`、`src/modules/chat/chat.service.ts`  
**问题**: `graph.stream()` 返回 Promise 未 await；节点异常导致整个 generator 静默终止，用户无响应。  
**修复**:
- `streamExecute` 加 `await` 获取 stream
- 整个流式循环 try/catch，失败回退到 `graph.invoke()` 同步执行
- `chat.service.ts` 消费端加 try/catch + reply 为空时二次回退到 `execute()`

### 3.2 `chatCompletionStream` 无内部错误处理

**文件**: `src/services/llm.service.ts`  
**问题**: 流式 AsyncGenerator 无 try/catch，stream 中途断裂时错误传播无日志。  
**修复**: 创建流和迭代流分别 try/catch，失败时 `console.error` + generator 优雅终止。

### 3.3 `videoTasks` 内存 Map 重启丢失

**文件**: `src/modules/chat/action-executor.service.ts`、`src/modules/chat/langgraph-engine.service.ts`、`src/modules/chat/chat.controller.ts`  
**问题**: `static videoTasks = new Map()` 存储视频生成任务，服务器重启全部丢失。  
**修复**:
- 新增 `saveVideoTask()` / `syncVideoTask()` 方法，任务创建、进度更新、完成/失败时同步写 Redis
- `getVideoTaskStatic()` 查询时内存优先 → Redis 兜底
- Controller 注入 Redis，调用异步查询方法

### 3.4 `buildVideoScript` / `buildAvatarScript` 空 catch

**文件**: `src/services/multimodal.service.ts`  
**问题**: LLM 调用失败时 catch 块无日志，静默返回 fallback。  
**修复**: 加 `console.warn` 日志，保留 fallback 返回值。

---

## 四、Low 修复

### 4.1 13 个 Agent 的 `extractJson` 统一复用

**文件**: `src/services/agents/` 下 14 个 agent 文件 + `src/services/resource-agent.service.ts`  
**问题**: 每个 agent 都有本地 `extractJson()` 方法，catch 块完全静默（空 catch），LLM 返回垃圾数据时无日志。项目已有 `common/json-repair.ts` 但未复用。  
**修复**:
- 删除所有本地 `extractJson` 方法
- 统一 import `{ extractJson } from '../../common/json-repair'`
- catch 块加 `console.error('[AgentName] JSON parse failed:', e.message)`

### 4.2 `tts.service.ts` getAudioDuration 空 catch

**文件**: `src/services/tts.service.ts`  
**问题**: ffprobe 和 file stat 失败时 catch 块无日志。  
**修复**: 加 `console.warn` 日志，保留 fallback（文件大小估算 / 默认 5 秒）。

### 4.3 `cache.service.ts` del / delPattern 空 catch

**文件**: `src/services/agents/cache.service.ts`  
**问题**: Redis 删除操作失败时静默吞错。  
**修复**: 加 `console.warn` 日志。

### 4.4 `news-crawl.service.ts` Redis 操作空 catch

**文件**: `src/services/news-crawl.service.ts`  
**问题**: Redis `sismember` 和 `sadd` 失败时无日志。  
**修复**: 加 `console.warn` 日志，保留降级到 DB 的策略。

### 4.5 `reviewer-agent.service.ts` 死代码

**文件**: `src/services/reviewer-agent.service.ts`  
**问题**: `const correctCount = 0` 声明后从未更新，实际用的是 `correct` 变量。  
**修复**: 删除 `correctCount` 死代码。

---

## 五、改动文件清单

| # | 文件 | 改动类型 |
|---|------|----------|
| 1 | `src/modules/chat/langgraph-engine.service.ts` | stream 错误处理 + await + videoTasks Redis |
| 2 | `src/modules/chat/chat.service.ts` | stream 消费端保护 + reply 空回退 |
| 3 | `src/modules/chat/chat.controller.ts` | MongoDB try/catch + getDb() + Redis 注入 |
| 4 | `src/modules/chat/chat.module.ts` | 导入 EventsModule |
| 5 | `src/modules/chat/action-executor.service.ts` | videoTasks Redis 持久化 |
| 6 | `src/modules/chat/action-executor.service.ts` | videoTasks Redis 持久化 |
| 7 | `src/services/llm.service.ts` | chatCompletionStream 错误处理 |
| 8 | `src/services/multimodal.service.ts` | buildVideoScript / buildAvatarScript 加日志 |
| 9 | `src/services/tts.service.ts` | getAudioDuration 加日志 |
| 10 | `src/services/chat-history.service.ts` | 新增 getDb() 公开方法 |
| 11 | `src/services/news-crawl.service.ts` | Redis 操作加日志 |
| 12 | `src/services/agents/cache.service.ts` | del / delPattern 加日志 |
| 13 | `src/services/reviewer-agent.service.ts` | 删除 correctCount 死代码 |
| 14 | `src/services/agents/orchestrator-agent.service.ts` | recognizeIntent try/catch + review_content case |
| 15-27 | `src/services/agents/*.ts` (13 个 agent) | extractJson 统一复用 + 日志 |

---

## 六、设计原则

- **不吞错误**: 所有 catch 块都有 `console.warn` 或 `console.error`，含模块名前缀
- **优雅降级**: stream 失败 → invoke → error reply，Redis 不可用 → 内存兜底
- **最小改动**: 不加新抽象、不重构、不改业务逻辑
- **复用已有**: `common/json-repair.ts` 的 `extractJson` 已有 4 层修复策略，直接复用

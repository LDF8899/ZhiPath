# cqcet-spark-agent 项目分析与 ZhiPath 启发

> 来源：`D:\AAA\ZHIJIAO\cqcet-spark-agent\cqcet-spark-agent`
> 分析日期：2026-06-24

## 一、项目概览

cqcet-spark-agent 是一个基于 Python/FastAPI 的智能教育系统，核心功能：
- **AI 智能出题**（6 种题型，异步队列处理）
- **智能批改**（客观题自动判 + 主观题 AI 批改）
- **代码评审系统**（多 Agent 编排，前后端+数据库三维评审）
- **课程管理 + RAG 检索增强**

技术栈：FastAPI + LangChain + ChromaDB + MongoDB + Redis + asyncio 消息队列

---

## 二、值得吸收的架构模式

### 1. 🏗️ asyncio 消息队列 + WorkerPool（最核心的启发）

**文件**：`message_queue/core/queue.py`, `worker.py`, `task.py`

这是一个**纯 asyncio 实现的优先级任务队列**，不依赖 RabbitMQ/Redis 等外部中间件：

```python
# 核心组件
AsyncQueue      → asyncio.PriorityQueue 封装，支持优先级、任务组、WAL持久化
Worker          → 单个工作协程，带自动重试和指数退避
WorkerPool      → 管理多个 Worker + Semaphore 并发限流
Task            → 任务对象，含状态机 (PENDING→PROCESSING→COMPLETED/FAILED/RETRY)
RetryPolicy     → 指数退避/固定/线性 策略枚举
```

**ZhiPath 可借鉴**：
- ZhiPath 的 Agent 任务（学习计划生成、技能评估、视频生成等）都是耗时 AI 调用
- 当前是同步等待或简单 Promise，如果用户量上来会阻塞
- **建议**：在 NestJS 后端引入类似的任务队列（可用 BullMQ + Redis，或纯内存队列）
- 优先级设计：用户主动请求 > 后台预计算 > 批量任务

**关键设计细节**：
- 任务状态原子更新（`update_task_status_atomic` + `asyncio.Lock`）
- 任务组支持（`group_id` 批量查询进度）
- 定期清理过期任务，避免内存泄漏
- 延迟清理结果（保留元数据供状态查询）

---

### 2. 📡 WebSocket 实时状态推送

**文件**：`util/task_websocket_manager.py`

```python
class TaskWebSocketManager:
    # 注册 WebSocket 到指定任务
    async def register_websocket(task_id, websocket)
    # 广播状态到所有订阅者
    async def broadcast_status(task_id, status)
    # 自动清理断开的连接
    # 心跳支持 (ping/pong)
```

**ZhiPath 可借鉴**：
- ZhiPath 的 Dashboard 有 SSE 进度推送，但 WebSocket 更灵活
- 学习计划生成、Agent 任务执行等长耗时操作，用 WS 推送进度
- 批改/评估场景：逐题推送批改进度

---

### 3. 🤖 多 Agent 评审编排器 (Review Orchestrator)

**文件**：`agents/review_runtime/orchestrator.py`

这是一个**非常精密的多 Agent 编排系统**：

```
需求解析 → 需求分类 → 需求标准化 → 代码搜索 → 证据选择 → 上下文构建 → Agent评审 → 评分聚合
```

**核心亮点**：
- **多轮证据补读**：AI 可以请求更多代码证据，最多 5 轮，带覆盖率追踪
- **智能停止条件**：覆盖率停滞 / 证据引用无增长 / 低收益 → 提前停止
- **多维度 Agent**：BackendReviewAgent / FrontendReviewAgent / DatabaseReviewAgent
- **需求规格缓存**：`ReviewSpecStore` 缓存已构建的评审规格，避免重复计算
- **证据质量评估**：高/中/低质量分级，优先读取高质量证据

**ZhiPath 可借鉴**：
- ZhiPath 的 Agent 体系（A1-A9）目前是串行调用
- 可以借鉴 Orchestrator 模式：**规划 → 搜索 → 证据 → 评审 → 聚合**
- 特别是"多轮证据补读"思路：当 AI 分析不充分时，自动请求更多上下文

---

### 4. 🛡️ 安全验证模块

**文件**：`util/security_validator.py`

```python
class SecurityValidator:
    # SQL注入检测（严格模式 + 上下文模式）
    STRICT_SQL_INJECTION_PATTERNS = [...]
    # XSS攻击模式
    XSS_PATTERNS = [...]
    # 系统敏感表名保护
    SENSITIVE_TABLE_NAMES = [...]
    # 学生答案清理（保留学习内容，过滤攻击）
    sanitize_student_answer()
    # 批改记录清理
    sanitize_grade_record()
```

**ZhiPath 可借鉴**：
- ZhiPath 有用户输入（学习目标、自定义路径描述等）
- 如果未来有代码提交/编程题功能，安全验证必不可少
- 建议在 `src/common/guards/` 下增加 `InputSanitizer`

---

### 5. ⏱️ 动态超时计算

**文件**：`agents/topic_manager.py`

```python
def _calculate_task_timeout(self, topic_num, topic_type):
    # 编程题 base=120s, 每题+30s, 最大600s
    # 普通题 base=60s, 每题+15s, 最大300s
    # 前N题免费配额（不加时间）
    extra_questions = max(0, topic_num - free_quota)
    timeout = base_timeout + extra_questions * per_question
    return min(max_timeout, timeout)
```

**ZhiPath 可借鉴**：
- 学习计划生成时间取决于方向复杂度和用户背景
- 当前硬编码超时，应该根据内容量动态调整

---

### 6. 📋 占位符记录模式 (Placeholder Records)

**文件**：`agents/grading_manager.py`

```python
async def _save_placeholder_records(self, topic_list, headers):
    # 提交时立即保存 res=-1 的占位符记录
    # 批改完成后更新实际分数
    # 确保学生答案不丢失（即使批改失败）
```

**ZhiPath 可借鉴**：
- Onboarding 完成后立即保存初始快照（即使 Agent 还没跑完）
- 学习计划生成时先存占位符，生成后更新
- 避免因 Agent 超时导致用户数据丢失

---

### 7. 🔄 批量拆分 + 结果聚合

**文件**：`agents/topic_manager.py`

```python
async def _generate_with_batching(self, dto, task_id):
    # 大批量请求拆分为小批次
    # 每批独立调用 AI
    # 聚合所有批次结果
    # 某批失败则整体失败
```

**ZhiPath 可借鉴**：
- 学习计划如果需要生成大量课程/资源，可以分批调用 LLM
- 每批独立处理，失败可单独重试

---

### 8. 📊 监控统计 + 告警

```python
# 批改监控
monitoring_stats = {
    "total_submissions", "total_tasks", "failed_tasks",
    "successful_tasks", "retry_attempts"
}
# 失败率超过10%告警
if (failed / total) > 0.1:
    logger.warning("失败率过高")
# 队列积压告警
if queue_stats["queue_size"] > 100:
    logger.warning("队列积压严重")
```

**ZhiPath 可借鉴**：
- Agent 执行成功率、平均耗时、队列深度监控
- 失败率告警 → 自动降级或通知

---

### 9. 🎯 全局单例 + 延迟初始化

```python
_grading_manager = None

def get_grading_manager() -> GradingManager:
    global _grading_manager
    if _grading_manager is None:
        _grading_manager = GradingManager()
    return _grading_manager
```

**ZhiPath 可借鉴**：
- NestJS 已有 IoC 容器，但某些重量级服务（如向量数据库连接、模型实例）可以用类似模式

---

## 三、ZhiPath 独有的优势（不需要借鉴的部分）

| 维度 | cqcet-spark-agent | ZhiPath |
|------|-------------------|---------|
| 技术栈 | Python/FastAPI（单体） | TypeScript/NestJS+React（前后端分离） |
| 数据库 | MySQL + MongoDB 混用 | PostgreSQL（统一） |
| Agent 架构 | 硬编码流程 | 声明式 AgentConfig + 流程编排 |
| 前端 | 无（纯后端） | React 19 + 完整 UI 体系 |
| 实时推送 | WebSocket | SSE（更适合单向进度推送） |
| 类型安全 | 无 | TypeScript 全栈 |

---

## 四、建议的吸收优先级

### P0（立即可做）
1. **任务队列**：在 NestJS 中用 BullMQ 实现 Agent 任务队列
2. **占位符模式**：Onboarding/计划生成时先存初始状态

### P1（近期规划）
3. **WebSocket 进度推送**：替代或补充当前 SSE
4. **动态超时**：根据任务复杂度调整 Agent 超时
5. **监控统计**：Agent 执行成功率/耗时/队列深度

### P2（中期目标）
6. **多 Agent 编排器**：借鉴 Orchestrator 模式优化 A1-A9 流程
7. **安全验证**：输入清理和注入防护
8. **批量拆分**：大量 LLM 调用时分批处理

---

## 五、代码片段速查

### 消息队列核心
```
message_queue/core/queue.py    → AsyncQueue（优先级队列 + 任务组 + WAL）
message_queue/core/worker.py   → Worker + WorkerPool（并发控制 + 重试）
message_queue/core/task.py     → Task + TaskStatus（状态机）
message_queue/core/retry.py    → RetryStrategy（指数退避）
```

### 批改系统
```
agents/grading_manager.py      → GradingManager（异步批改 + 占位符 + WebSocket推送）
agents/topic_manager.py        → TopicGenerationManager（出题队列 + 批量拆分）
```

### 代码评审
```
agents/review_runtime/orchestrator.py  → ModuleReviewOrchestrator（多Agent编排）
agents/review_agents/                  → 各维度评审Agent
```

### 工具
```
util/security_validator.py     → SecurityValidator（SQL注入/XSS防护）
util/task_websocket_manager.py → TaskWebSocketManager（WS状态推送）
```

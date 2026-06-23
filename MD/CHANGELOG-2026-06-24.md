# ZhiPath 改进日志 — 2026-06-24

> 参考 cqcet-spark-agent 项目，吸收其异步队列、智能批改、课程管理等架构优点，对 ZhiPath 进行全面增强。

---

## 一、架构层增强（9 个文件）

### 1.1 任务队列系统增强
**文件**: `backend-ts/src/modules/queue/queue.service.ts` (208→481 行)

- **任务组支持**: `addAgentTaskGroup()` 一次提交多个关联任务，返回 groupId，Redis Hash 存储成员关系
- **动态超时计算**: `calculateTimeout()` 根据 agent 类型和参数量自动调整（lecture 120s / exam 180s / path 300s / video 600s）
- **详细统计**: `getDetailedStats()` 返回每个 agent 类型的成功率、平均耗时、队列积压
- **批量操作**: `cancelGroupJobs()` 批量取消一组任务
- **任务组进度**: `getGroupProgress()` 查询任务组整体进度百分比

### 1.2 事件推送系统增强
**文件**: `backend-ts/src/modules/events/events.service.ts` (148→466 行)

- **任务组进度推送**: `emitGroupProgress()` 推送任务组整体进度
- **批量任务状态**: `emitBatchTaskUpdate()` 批量推送多个任务状态
- **连接管理增强**: `getConnectionStats()` 返回连接数、活跃用户、事件发送统计
- **事件历史缓存**: 缓存最近 50 条事件，新连接时重放（避免断连丢失）
- **心跳检测**: 30s 定期检查连接活性，清理死连接

### 1.3 输入安全验证模块（新建）
**文件**: `backend-ts/src/common/input-sanitizer.ts` + `input-sanitizer.guard.ts`

- **SQL 注入检测**: 13 条严格模式规则 + 3 条上下文模式规则
- **XSS 攻击检测**: 18 条模式（script/iframe/事件属性/javascript 协议/eval/document 等）
- **日志注入防护**: CRLF / ANSI 转义 / NULL 字节清理
- **全局 Guard**: `InputSanitizerGuard` 自动检查 query/params/body，发现风险记录 `[BLOCKED]` 日志并拒绝

### 1.4 Agent 任务服务增强
**文件**: `backend-ts/src/services/agent-task.service.ts` (245→531 行)

- **占位符任务创建**: `createPlaceholderTask()` 立即创建 pending/progress=0 记录
- **批量创建任务**: `createBatchTasks()` 一次创建多个关联任务，支持 groupId
- **任务组查询**: `getTasksByGroup()` / `getGroupProgress()`
- **自动清理**: `cleanupStaleTasks()` 清理超时未完成的任务
- **幂等更新**: `upsertTaskStatus()` 基于 externalId 幂等更新

### 1.5 Agent 处理器增强
**文件**: `backend-ts/src/modules/queue/agent.processor.ts` (74→301 行)

- **细粒度进度推送**: 5 个进度点（0→10→30→60→80→100）
- **占位符模式**: 任务开始时立即推送"任务已接收"状态
- **错误分类**: `RetryableError`（网络超时/LLM 限流/5xx）vs `NonRetryableError`（参数无效）
- **结果缓存**: 静态 Map 缓存成功结果 5 分钟，相同参数直接返回
- **参数校验前置**: 缺失必填字段直接抛 NonRetryableError，不浪费 LLM 调用

### 1.6 前端 WebSocket 支持（新建）
**文件**: `frontend/src/hooks/useWebSocket.ts` + `useTaskGroup.ts` + `components/TaskGroupProgress.tsx`

- **自动重连**: 指数退避（间隔 × 1.5^n）
- **心跳检测**: 30s 发送 ping
- **订阅管理**: `subscribe(groupId)` / `unsubscribe(groupId)`
- **任务组进度 Hook**: 自动订阅、计算整体进度、区分状态
- **进度条组件**: 总进度条 + 子任务列表 + 取消按钮

### 1.7 数据库 Entity 增强
**文件**: `backend-ts/src/entities/agent-task.entity.ts`

- 新增 `groupId` 字段（varchar(64)）— 任务组 ID
- 新增 `externalId` 字段（varchar(128), UNIQUE）— 幂等 ID

---

## 二、考试系统深度改造（6 个文件）

### 2.1 编程题/简答题 AI 批改
**文件**: `backend-ts/src/modules/exams/exams.service.ts` (476→746 行)

| 题型 | 改造前 | 改造后 |
|------|--------|--------|
| 单选 choice | ✅ 自动判分 | ✅ 自动判分 |
| 填空 fill | ✅ 自动判分 | ✅ 自动判分 |
| 编程 coding | ❌ 返回 false | ✅ AI 批改（功能 70% + 语法 20% + 结构 10%） |
| 简答 essay | ❌ 返回 false | ✅ AI 批改（语义相似即得分） |

- `aiGrade()` 方法：编程题按功能/语法/结构三维度评分，简答题按语义相似度评分
- AI 批改加 try-catch 容错，JSON 解析失败默认 0 分

### 2.2 出题质量管线
**文件**: `backend-ts/src/services/agents/exam-agent.service.ts` (322→440 行)

- **自动入库**: `generateExam()` 返回前异步触发 `saveToBank()` 写入 `exam_questions_v3`
- **质量管线**: `qualityPipeline()` = 生成 → 答案交叉验证 → 入库
- **题库统计**: `getQuestionBankStats()` 按技能/类型/难度聚合

### 2.3 占位符记录
- `createPlaceholderRecord()` 立即创建 `score=null, passed=null` 的占位符
- `exam_records_v3.passed` 字段改为可空

### 2.4 错题自动补强
- `createReinforcementTasks()` 从错题分析的补强计划自动创建 LearningTask
- 任务类型为 `side`（支线），优先级 8（高）

### 2.5 通过率统计回写
- `updatePassRate()` 考后自动回写 `ExamQuestion.passRate`
- 在 `submitExam` 和 `submitByRecord` 末尾异步调用

### 2.6 考试重试调度
- `getRetryableExams()` 查询可重试考试（passed=0 且 nextRetryTime ≤ now）
- `scheduleRetry()` 指数退避：1 天、2 天、3 天...

---

## 三、P2/P3 新模块（8 个文件）

### 3.1 Admin 题库管理 API
**文件**: `backend-ts/src/modules/admin/admin.controller.ts` + `admin.service.ts`

| 端点 | 功能 |
|------|------|
| `GET /admin/questions` | 题库列表（分页 + 按技能/题型/难度/状态筛选） |
| `PUT /admin/questions/:id` | 编辑题目 |
| `POST /admin/questions/:id/review` | 审核题目（通过/下架） |
| `GET /admin/questions/stats` | 题库统计 |

### 3.2 课程章节管理模块（新建）
**文件**: `backend-ts/src/modules/courses/` (3 个新文件)

| 端点 | 功能 |
|------|------|
| `GET /user/courses/:planId/chapters` | 获取章节树 |
| `POST /user/courses/:planId/chapters/generate` | AI 生成章节目录 |
| `POST /user/courses/:planId/chapters/parse` | 解析树形文本导入 |
| `PUT /user/courses/:planId/chapters/:id` | 编辑章节 |
| `DELETE /user/courses/:planId/chapters/:id` | 删除章节 |

核心能力：
- **树形文本解析器**: 支持 Markdown 标题（#/##/###）、列表（-/*）、树形符号（├└）
- **栈式父子关系构建**: O(n) 时间构建 3 层树
- **AI 生成章节目录**: 根据计划 phases 自动生成 3-5 个子章节

### 3.3 能力模型构建
**文件**: 同上（Courses 模块内）

| 端点 | 功能 |
|------|------|
| `GET /user/courses/:planId/abilities` | 获取能力点列表 |
| `POST /user/courses/:planId/abilities/generate` | AI 生成 4-8 个能力点 |
| `POST /user/courses/:planId/abilities/save` | 保存能力点 + AI 匹配章节映射 |
| `POST /user/courses/:planId/abilities/match` | AI 匹配章节-能力映射 |

核心能力：
- **"生成-展示-确认-保存"四步模式**: 先 AI 生成供用户审核，确认后写入
- **多轮重试匹配**: 每轮只处理未匹配章节，最多 3 次，累积合并
- **叶子节点优先绑定**: 只绑定 level=2 的章节

### 3.4 数据库新建表

```sql
-- 课程章节表（3 层树形）
CREATE TABLE course_chapters_v3 (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  plan_id BIGINT NOT NULL,
  name VARCHAR(200) NOT NULL,
  level TINYINT NOT NULL DEFAULT 0,  -- 0=根, 1=章, 2=节
  parent_id BIGINT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  skill_name VARCHAR(100) NULL,
  ability_id BIGINT NULL,            -- 关联能力点
  status TINYINT NOT NULL DEFAULT 1,
  create_time BIGINT NULL,
  update_time BIGINT NULL
);

-- 能力点表
CREATE TABLE course_abilities_v3 (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  plan_id BIGINT NOT NULL,
  name VARCHAR(50) NOT NULL,         -- 能力名称 (<=8 字)
  description VARCHAR(200) NULL,     -- 能力描述 (<=50 字)
  sort_order INT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  create_time BIGINT NULL,
  update_time BIGINT NULL
);
```

---

## 四、前端适配（4 个文件）

### 4.1 API 层新增 14 个方法
**文件**: `frontend/src/api/user.ts` + `admin.ts`

- 考试重试: `getRetryableExams` / `retryExam`
- 课程章节: `getChapters` / `generateChapters` / `parseChapters` / `updateChapter` / `deleteChapter`
- 能力模型: `getAbilities` / `generateAbilities` / `saveAbilities` / `matchChapterAbility`
- 题库管理: `getAdminQuestions` / `updateAdminQuestion` / `reviewAdminQuestion` / `getAdminQuestionStats`

### 4.2 Admin 题库管理页面（新建）
**文件**: `frontend/src/pages/admin/AdminQuestions.tsx`

- 复用 AdminPageHeader + AdminTable + AdminPagination
- 筛选栏：技能名 / 题型 / 难度 / 状态
- 操作列：编辑 / 审核（通过/下架）
- 统计卡片：总题数 + 按类型分布

### 4.3 考试重试按钮
**文件**: `frontend/src/pages/user/Exams.tsx`

- 未通过考试卡片显示"重新考试"按钮
- 调用 `retryExam` API 后自动刷新列表

---

## 五、数据库迁移汇总

| 操作 | 表 | 说明 |
|------|---|------|
| ALTER | `agent_tasks_v3` | 新增 `group_id` + `external_id` |
| ALTER | `exam_records_v3` | `passed` 改为可空 |
| CREATE | `course_chapters_v3` | 课程章节表 |
| CREATE | `course_abilities_v3` | 能力点表 |

---

## 六、新增 API 端点总览（23 个）

| 模块 | 端点 | 功能 |
|------|------|------|
| Admin 题库 | `GET /admin/questions` | 题库列表 |
| Admin 题库 | `PUT /admin/questions/:id` | 编辑题目 |
| Admin 题库 | `POST /admin/questions/:id/review` | 审核题目 |
| Admin 题库 | `GET /admin/questions/stats` | 题库统计 |
| 考试重试 | `GET /user/exams/retryable` | 可重试考试 |
| 考试重试 | `POST /user/exams/:examId/retry` | 调度重试 |
| 课程章节 | `GET /user/courses/:planId/chapters` | 章节树 |
| 课程章节 | `POST /user/courses/:planId/chapters/generate` | AI 生成章节 |
| 课程章节 | `POST /user/courses/:planId/chapters/parse` | 树形文本解析 |
| 课程章节 | `PUT /user/courses/:planId/chapters/:id` | 编辑章节 |
| 课程章节 | `DELETE /user/courses/:planId/chapters/:id` | 删除章节 |
| 能力模型 | `GET /user/courses/:planId/abilities` | 能力点列表 |
| 能力模型 | `POST /user/courses/:planId/abilities/generate` | AI 生成能力点 |
| 能力模型 | `POST /user/courses/:planId/abilities/save` | 保存 + 映射 |
| 能力模型 | `POST /user/courses/:planId/abilities/match` | AI 匹配映射 |

---

## 七、参考项目

- **来源**: `cqcet-spark-agent` (D:\AAA\ZHIJIAO\cqcet-spark-agent)
- **吸收的 15 个设计模式**: 策略模式+工厂、消息队列+Worker 池、批量拆分、JSON 修复重试链、三级状态存储、占位符先写、可重试异常、信号量+共享 HTTP 客户端、完成监控+WS 广播、兜底服务、树形文本解析器、多轮对话记忆、增量重试匹配、全局单例+延迟初始化、统一队列工厂

# 智途 ZhiPath — 实施计划

> 基于 CONSTITUTION.md 业务规范 + 项目现状分析
> 目标：将现有项目重构为严格符合业务规范的完整系统
> 2026-06-12

---

## 现状总览

### 已完成（可直接使用）

| 模块 | 状态 | 说明 |
|------|------|------|
| NestJS 脚手架 | ✅ | 13 个模块，4 个数据库连接 |
| TypeORM 实体 | ✅ | 17 张表，字段完整 |
| Auth 模块 | ✅ | bcrypt + JWT，登录/注册/鉴权 |
| 前端页面框架 | ✅ | 27 个路由，Ant Design UI |
| API 层 | ✅ | 30+ 端点，axios 拦截器 |
| IntentRouter | ✅ | Phase B 关键词 + Phase C Tool Calling |
| ActionExecutor | ✅ | 7 个动作（但部分是 stub） |
| AgentEngine | ✅ | Fallback 聊天 + 画像提取 |
| LlmService | ✅ | 多模型支持（Ollama/DeepSeek/OpenAI） |
| ProfileService | ✅ | MongoDB 画像 CRUD + 增量合并 |
| ChatHistoryService | ✅ | Redis 热数据 + MongoDB 冷数据 |
| KnowledgeBaseService | ✅ | MongoDB 知识库查询 |

### 未完成（需要实现）

| 缺失项 | 优先级 | 涉及章节 | 状态 |
|--------|--------|---------|------|
| 学习路径 LLM 生成 | 🔴 P0 | 第四章 | ✅ 已完成 |
| UserSkill 服务（技能模型） | 🔴 P0 | 第八章 | ✅ 已完成 |
| MatchAgent（匹配度计算） | 🔴 P0 | 第九章 | ✅ 已完成 |
| 学习任务调度 | 🔴 P0 | 附录D.1 | ✅ 已完成 |
| 前端核心页面对接 | 🔴 P0 | 全部页面 | ✅ 已完成 |
| LearningSession 服务 | 🟡 P1 | 第十三章 | 待做 |
| Notification 服务 | 🟡 P1 | 第十八章 | 待做 |
| Resume 服务 | 🟡 P1 | 第十二章 | 待做 |
| 考试系统完善 | 🟡 P1 | 第十四章 | 待做 |
| Neo4j 图谱服务 | 🟡 P1 | 附录D.3 | 待做 |
| SSE 实时推送 | 🟡 P1 | 附录D.6 | 待做 |
| BullMQ 异步任务 | 🟡 P1 | 第二章 | 待做 |
| 管理端 API | 🟢 P2 | 第十九章 | 待做 |
| 智能体办公室 | 🟢 P2 | 第十一章 | 待做 |
| 简历 PDF 生成 | 🟢 P2 | 附录D.5 | 待做 |
| 资讯系统 | 🟢 P2 | 附录D.4 | 待做 |

---

## Phase 1：核心闭环（P0） ✅ 已完成

> 目标：用户能创建计划 → 学习 → 考试 → 匹配度提升
> 这是整个系统的骨架，不通则后续全部阻塞

### 1.1 UserSkill 服务 ✅

**为什么做**：第八章技能模型是匹配度计算的基础，当前 `user_skills_v3` 表存在但无任何服务读写。

**要做的事**：

```
后端：
├── 创建 backend-ts/src/services/skill.service.ts
│   ├── getSkills(userId) → 查询 user_skills_v3
│   ├── addSkill(userId, skillName, source, trustWeight)
│   ├── updateMastery(userId, skillName, delta) → 更新掌握度
│   ├── getEffectiveSkills(userId) → 返回加权后的有效技能
│   └── syncFromStudentSkills() → 迁移 students_v3.skills JSON 到 user_skills_v3
│
├── 修改 StudentService
│   └── onboarding 完成后调用 skillService.addSkill() 写入 user_skills_v3
│
└── 修改 ChatService
    └── 对话中提取的技能写入 user_skills_v3（source=conversation, trustWeight=0.5）
```

**验收标准**：
- 用户完成 Onboarding 后，`user_skills_v3` 有对应记录
- 对话中提到新技能后，`user_skills_v3` 自动新增
- `mastery_pct` 字段被正确更新

---

### 1.2 学习路径 LLM 生成（PlannerAgent） ✅

**为什么做**：第四章核心功能，当前 `createPath()` 只创建空壳，路径没有实际内容。

**要做的事**：

```
后端：
├── 创建 backend-ts/src/services/planner-agent.service.ts
│   ├── generatePath(userId, targetJobId, dailyHours, deadline)
│   │   ├── 1. 获取目标岗位的必须技能（MySQL job_positions_v3 + Neo4j 依赖）
│   │   ├── 2. 获取用户已掌握技能（user_skills_v3）
│   │   ├── 3. 计算技能差距
│   │   ├── 4. 按依赖拓扑排序
│   │   ├── 5. 按每日时长分配到阶段
│   │   ├── 6. 生成日程表
│   │   └── 7. 写入 learning_plans_v3 + learning_tasks_v3
│   │
│   └── adjustPath(planId, newDailyHours, newMainRatio)
│       ├── 重新计算日程
│       ├── 返回变化摘要（用于弹窗提醒）
│       └── 更新 learning_plans_v3
│
├── 修改 LearningPathsService.createPath()
│   └── 调用 plannerAgent.generatePath() 替代空壳
│
└── 修改 ActionExecutorService.generatePath()
    └── 调用 plannerAgent.generatePath() 替代 Redis 队列 stub
```

**验收标准**：
- 用户选目标岗位后，`learning_plans_v3` 有完整的 `path_data` JSON
- `learning_tasks_v3` 有每日任务记录
- 前端学习路径页能展示分阶段技能列表

---

### 1.3 MatchAgent（匹配度计算） ✅

**为什么做**：第九章核心功能，当前 `recommend_jobs` 里有简单匹配逻辑，但不是独立服务，无法被其他模块调用。

**要做的事**：

```
后端：
├── 创建 backend-ts/src/services/match-agent.service.ts
│   ├── calculateMatch(userId, jobId)
│   │   ├── 1. 获取用户有效技能（skillService.getEffectiveSkills）
│   │   ├── 2. 获取岗位必须/加分技能（job_positions_v3）
│   │   ├── 3. 获取项目经历相关度（MongoDB user_profiles.projects）
│   │   ├── 4. 获取考试成绩（exam_records_v3）
│   │   ├── 5. 获取学习路径进度（learning_plans_v3）
│   │   ├── 6. 按权重公式计算总分
│   │   └── 7. 返回结构化结果（含各项贡献度 + 差距分析）
│   │
│   ├── calculateForAllJobs(userId) → 批量计算所有岗位匹配度
│   ├── recalculateOnSkillChange(userId) → 技能变化时触发
│   └── recalculateOnJobChange(jobId) → 新岗位录入时触发所有用户
│
├── 修改 ActionExecutorService.recommend_jobs()
│   └── 调用 matchAgent.calculateMatch() 替代简单逻辑
│
└── 修改 ActionExecutorService.match_analysis()
    └── 调用 matchAgent.calculateMatch() 返回详细差距分析
```

**验收标准**：
- 岗位页显示的匹配度是 5 因子加权计算的结果
- 匹配度有可解释的分解（必须技能/加分技能/项目/考试/进度）
- 用户完成技能学习后匹配度自动更新

---

### 1.4 学习任务调度 ✅

**为什么做**：附录D.1，主页"今日任务"的数据来源，当前无调度逻辑。

**要做的事**：

```
后端：
├── 创建 backend-ts/src/services/task-scheduler.service.ts
│   ├── getTodayTasks(userId, planId)
│   │   ├── 1. 读取计划的当前阶段技能列表
│   │   ├── 2. 过滤已完成技能（mastery_pct ≥ 80%）
│   │   ├── 3. 按依赖排序取 N 个（N = 可用时长 × 主线比例 ÷ 预估时长）
│   │   ├── 4. 支线同理
│   │   └── 5. 返回今日任务列表
│   │
│   ├── updateTaskStatus(taskId, newStatus)
│   │   └── 更新 learning_tasks_v3.task_status（8态FSM）
│   │
│   └── adjustForSpeed(userId, planId)
│       ├── 检测用户学习速度
│       └── 动态调整后续日程
│
├── 修改 DashboardService
│   └── 调用 taskScheduler.getTodayTasks() 获取今日任务数据
│
└── 修改 LearningTasksService（如不存在则创建）
    └── CRUD 操作 + 状态机校验
```

**验收标准**：
- 主页今日任务展示正确的主线/支线任务
- 任务状态流转符合 8 态 FSM
- 用户学得快/慢时日程自动调整

---

### 1.5 前端核心页面对接 ✅

**为什么做**：当前 ExamTake、JobDetail、Projects 用 mock 数据，必须替换为真实 API。

**要做的事**：

```
前端：
├── ExamTake.tsx
│   ├── 替换 mockQuestions 为 API 调用
│   ├── POST /api/user/exams/:id/take 获取题目
│   └── POST /api/user/exams/:id/submit 提交答案
│
├── JobDetail.tsx
│   ├── 替换 mockJobs 为 API 调用
│   ├── GET /api/user/jobs/:id 获取岗位详情
│   └── 展示匹配度分解 + 技能差距
│
├── Projects.tsx
│   ├── 替换 mockProfile 为 API 调用
│   ├── GET /api/user/profile 获取项目经历
│   └── POST /api/user/projects/save 保存项目
│
└── Dashboard.tsx
    └── 确保今日任务数据来自 taskScheduler API
```

---

## Phase 2：数据闭环（P1）

> 目标：学习记录、通知、简历、考试、图谱全部打通
> 在 Phase 1 完成后才能开始

### 2.1 LearningSession 服务（Git Commit 模型）

**为什么做**：第十三章，学习记录是用户留存的核心激励。

```
后端：
├── 创建 backend-ts/src/services/session.service.ts
│   ├── startSession(userId, planId)
│   │   └── 创建 learning_sessions_v3 记录
│   │
│   ├── recordProgress(sessionId, skillId, progressData)
│   │   └── 更新 tasks_snapshot JSON
│   │
│   ├── endSession(sessionId)
│   │   ├── 计算 total_duration_ms
│   │   ├── 记录 skill_changes（技能掌握度变化）
│   │   ├── 记录 match_score_before/after
│   │   └── 写入 Redis → MongoDB → MySQL 三层
│   │
│   ├── getHistory(userId, page)
│   │   └── 查询 learning_sessions_v3（git log）
│   │
│   ├── rollback(sessionId, targetDate)
│   │   ├── 恢复技能掌握度到目标日期状态
│   │   └── 恢复学习任务状态
│   │
│   └── diff(userId, dateA, dateB)
│       ├── 对比两个日期的技能变化
│       └── 返回雷达图数据
│
前端：
├── 创建 frontend/src/pages/user/Progress.tsx（重写）
│   ├── 时间线展示每日学习记录（git log）
│   ├── 回退按钮（git reset）
│   └── 对比视图（git diff）+ 雷达图
```

---

### 2.2 Notification 服务

**为什么做**：第十八章，用户激励和召回的关键手段。

```
后端：
├── 创建 backend-ts/src/services/notification.service.ts
│   ├── create(userId, type, title, content, link)
│   ├── getUnread(userId) → 查询未读通知
│   ├── markAsRead(notificationId)
│   ├── getUnreadCount(userId) → Redis 缓存
│   │
│   └── 触发器集成：
│       ├── 学习进度变化 → create(progress, ...)
│       ├── 匹配度变化 → create(progress, ...)
│       ├── 新岗位匹配 → create(job, ...)
│       ├── 考试结果 → create(exam, ...)
│       └── 简历审核结果 → create(system, ...)
│
前端：
├── 顶部通知铃铛组件（显示未读数）
├── 通知列表下拉面板
└── 点击通知跳转对应页面
```

---

### 2.3 Resume 服务

**为什么做**：第十二章，简历是求职闭环的出口。

```
后端：
├── 创建 backend-ts/src/services/resume-agent.service.ts
│   ├── generateResume(userId, targetJobId)
│   │   ├── 1. 读取个人中心全部数据
│   │   ├── 2. 根据岗位调整重点
│   │   ├── 3. 调用 LLM 生成 HTML 简历
│   │   └── 4. 存入 resumes_v3
│   │
│   ├── createVersion(baseResumeId, targetJobId)
│   │   └── 从 base 创建新版本（Git branch）
│   │
│   ├── mergeToAllVersions(userId, field, value)
│   │   └── 更新 base + 所有版本（Git merge）
│   │
│   └── exportPdf(resumeId)
│       ├── 调用 Puppeteer 生成 A4 PDF
│       └── 上传到 MinIO
│
前端：
├── 创建 frontend/src/pages/user/Resume.tsx
│   ├── 版本列表（base + 各岗位版本）
│   ├── HTML 在线编辑器（TipTap 或 contentEditable）
│   ├── 导出 PDF 按钮
│   └── 一键投递按钮
```

---

### 2.4 考试系统完善

**为什么做**：第十四章，当前 ExamService 基本功能有，但缺错题分析和补强计划。

```
后端：
├── 修改 ExamService.submitExam()
│   ├── 批改后调用 reviewerAgent.analyzeWrongAnswers()
│   ├── 生成错题分析（wrong_analysis JSON）
│   └── 如果未通过，自动生成补强计划
│
├── 创建 backend-ts/src/services/reviewer-agent.service.ts
│   ├── analyzeWrongAnswers(answers, questions)
│   │   ├── 归类错误知识点
│   │   ├── 归因（概念不清 vs 粗心）
│   │   └── 生成针对性学习计划
│   │
│   └── reviewContent(content, type)
│       └── 通用质量审查（讲义/题目/简历）
│
前端：
├── ExamTake.tsx 完善
│   ├── 考试结果页（分数 + 错题分析 + 补强计划）
│   └── 重考按钮（检查是否完成补强计划）
```

---

### 2.5 Neo4j 图谱服务

**为什么做**：附录D.3，技能依赖图和岗位关系是路径生成和匹配度计算的数据基础。

```
后端：
├── 创建 backend-ts/src/services/graph.service.ts（重写现有）
│   ├── addSkillNode(skillData)
│   ├── addJobNode(jobData)
│   ├── addDependency(fromSkillId, toSkillId)
│   ├── addSkillJobRelation(skillId, jobId, type, weight)
│   ├── getSkillDependencies(skillId) → 获取前置依赖链
│   ├── getJobRequiredSkills(jobId) → 获取岗位所有必须技能
│   └── updateUserMastered(userId, skillId, level)
│
├── 修改 JDParserAgent
│   └── 解析 JD 后自动更新 Neo4j 节点和关系
│
前端：
├── Graph.tsx 重写
│   ├── 使用 @xyflow/react（React Flow v2）
│   ├── 展示技能-岗位关系图
│   ├── 展示技能依赖链
│   └── 用户掌握的技能高亮
```

---

### 2.6 SSE 实时推送

**为什么做**：附录D.6，智能体办公室和进度通知需要实时更新。

```
后端：
├── 创建 backend-ts/src/modules/events/events.module.ts
│   ├── events.controller.ts — SSE 端点 GET /api/user/events/stream
│   └── events.service.ts — 用户事件流管理
│
├── 各 Agent 服务集成
│   ├── 任务进度变化 → eventsService.emitProgress()
│   ├── 资源生成完成 → eventsService.emitResourceReady()
│   └── 匹配度变化 → eventsService.emitMatchUpdate()
│
前端：
├── 创建 frontend/src/hooks/useSSE.ts
│   └── EventSource 封装 + 自动重连
│
├── 智能体办公室页面
│   └── 实时显示 Agent 状态和进度条
```

---

### 2.7 BullMQ 异步任务

**为什么做**：第二章，Agent 间通信的基础，当前用 Redis List 手动实现，需要升级为 BullMQ。

```
后端：
├── 安装依赖：bullmq, @nestjs/bullmq
│
├── 创建 backend-ts/src/queue/queue.module.ts
│   ├── agent.processor.ts — Agent 任务处理器
│   └── resource.processor.ts — 资源生成处理器
│
├── 修改 ResourceAgent
│   └── 生成任务加入 BullMQ 队列（替代直接调用）
│
└── 修改 PlannerAgent
    └── 路径生成完成后，自动创建资源生成任务入队
```

---

## Phase 3：管理端 + 前端完善（P2）

> 目标：管理端全部功能可用，前端无 mock 数据

### 3.1 管理端 API 对接

```
后端 API 完善：
├── AdminService — 补充所有查询逻辑
│   ├── getDashboard() → 返回真实统计数据
│   ├── getUsers() → 分页 + 搜索
│   ├── getJobs() → 分页 + 筛选
│   ├── getApplications() → 投递列表 + ReviewerAgent 建议
│   ├── getExams() → 题库管理
│   ├── getNews() → 资讯管理
│   └── getResumes() → 简历管理
│
前端 mock 替换：
├── AdminDashboard.tsx — 调用 getDashboard API
├── AdminUsers.tsx — 调用 getUsers API
├── AdminJobs.tsx — 调用 getJobs API + JDParserAgent
├── AdminApplications.tsx — 调用 getApplications API
├── AdminEnterprises.tsx — 调用 getEnterprises API
├── AdminNews.tsx — 调用 getNews API
├── AdminExams.tsx — 调用 getExams API
├── AdminResumes.tsx — 调用 getResumes API
└── AdminSettings.tsx — 调用 SystemConfig API
```

---

### 3.2 智能体办公室页面

```
前端：
├── 创建 frontend/src/pages/user/AgentOffice.tsx
│   ├── Agent 状态列表（idle/working/error）
│   ├── 任务队列（可拖拽排序）
│   ├── 紧急标记按钮
│   ├── 跳过/取消按钮
│   └── 已完成任务历史
│
└── 使用 SSE hook 实时更新
```

---

### 3.3 简历 PDF 生成

```
后端：
├── 安装依赖：puppeteer
├── 创建 backend-ts/src/services/pdf.service.ts
│   ├── Puppeteer 连接池
│   ├── generatePdf(html) → Buffer
│   └── 上传到 MinIO → 返回下载链接
│
前端：
├── 简历编辑页的"导出 PDF"按钮
└── 调用后端 API → 触发下载
```

---

### 3.4 资讯系统

```
后端：
├── 创建 backend-ts/src/services/news.service.ts
│   ├── fetchFromSearXNG() — 定时抓取
│   ├── generateTechTrends() — Agent 生成技术趋势
│   ├── recommend(userId) — 个性化推荐
│   └── markAsRead(userId, newsId) — 已读记录
│
├── 修改 SchedulerModule
│   └── 添加资讯抓取定时任务
```

---

## Phase 4：体验增强（P3） ✅ 已完成

> 目标：游戏化、动画、细节打磨

### 4.1 匹配度实时反馈 ✅

```
前端：
├── 匹配度变化时 Toast 动画
├── 阶段考试通过时全屏庆祝动画
├── 连续学习天数激励
└── 匹配度分解可视化（贡献度柱状图）
```

### 4.2 5分钟速测 ✅

```
后端：
├── 创建 POST /api/user/quick-test
│   ├── 根据用户意向方向抽 5 道基础题
│   ├── 即时评分
│   └── 更新 user_skills_v3（source=exam, trustWeight=1.0）
│
前端：
├── Onboarding 完成后弹出速测入口
└── 答题页 + 即时结果 + 匹配度变化展示
```

### 4.3 雷达图 + 技能可视化 ✅

```
前端：
├── Profile.tsx 添加技能雷达图
├── Progress.tsx 添加对比雷达图（git diff）
└── JobDetail.tsx 添加匹配度分解图
```

---

## 执行顺序总结

```
Phase 1（核心闭环）— 预计 5-7 天
├── 1.1 UserSkill 服务           （1天）
├── 1.2 PlannerAgent 路径生成    （2天）
├── 1.3 MatchAgent 匹配度计算    （1天）
├── 1.4 任务调度                 （1天）
└── 1.5 前端核心页面对接         （1-2天）

Phase 2（数据闭环）— 预计 5-7 天
├── 2.1 LearningSession 服务     （1天）
├── 2.2 Notification 服务        （0.5天）
├── 2.3 Resume 服务              （2天）
├── 2.4 考试系统完善             （1天）
├── 2.5 Neo4j 图谱服务           （1天）
├── 2.6 SSE 实时推送             （0.5天）
└── 2.7 BullMQ 异步任务          （0.5天）

Phase 3（管理端 + 前端）— 预计 3-5 天
├── 3.1 管理端 API 对接          （2天）
├── 3.2 智能体办公室页面         （1天）
├── 3.3 简历 PDF 生成            （1天）
└── 3.4 资讯系统                 （1天）

Phase 4（体验增强）— 预计 2-3 天
├── 4.1 匹配度实时反馈           （0.5天）
├── 4.2 5分钟速测                （1天）
└── 4.3 雷达图 + 技能可视化      （1天）
```

**总计：15-22 天**

---

## 每个 Phase 的验收标准

### Phase 1 验收
```
□ 用户完成 Onboarding → user_skills_v3 有记录
□ 用户选目标岗位 → learning_plans_v3 有完整 path_data
□ 前端学习路径页展示分阶段技能列表
□ 岗位页显示 5 因子加权匹配度
□ 主页今日任务展示正确的主线/支线任务
□ ExamTake 页面使用真实题目
□ JobDetail 页面使用真实数据
```

### Phase 2 验收
```
□ 用户学习后 learning_sessions_v3 有记录
□ 学习记录页展示 Git log 风格的历史
□ 用户收到站内通知（铃铛显示未读数）
□ 用户可以生成针对岗位的简历
□ 考试未通过后自动生成补强计划
□ 知识图谱页面展示真实的技能-岗位关系
□ 智能体办公室实时显示 Agent 状态
```

### Phase 3 验收
```
□ 管理端所有页面使用真实 API
□ 管理员可以录入岗位 → JDParserAgent 自动解析
□ 管理员可以审核题库
□ 管理员可以审核简历投递
□ 简历可以导出 PDF
□ 资讯页有自动抓取的内容
```

### Phase 4 验收
```
□ 匹配度变化时有 Toast 动画
□ 阶段考试通过时有庆祝动画
□ 用户可以做 5 分钟速测
□ 个人中心有技能雷达图
□ 学习记录有对比雷达图
```

---

*文档结束 — 实施计划*

# CodeNova 比赛版代码导航

本文档面向后续编程智能体。目标不是重写 ZhiPath，而是最大程度复用 1.1 分支已有底座，把它收束成比赛项目：

**焕星·码枢 CodeNova —— 基于原生多智能体协同与动态可视化引擎的垂直软件开发按需导学决策系统**

赛题原名：领域知识个性化生成与多智能体协同决策系统研究  
发榜单位：上海云之脑智能科技有限公司  
推荐垂直领域：特定软件开发 / AI 原生软件开发技能培训

---

## 0. 改造原则

1. 优先复用已有能力，不另起炉灶。
2. 比赛版主线固定为：`学情画像 -> 多 Agent 协同 -> 知识库约束生成 -> 审核纠偏 -> 可视化报告 -> 反馈迭代`。
3. 页面可以新增比赛入口，但不要大面积破坏老业务页面。
4. 后端优先补“编排接口”和“样例数据”，不要先做复杂数据库迁移。
5. 前端优先做可演示闭环，让评审 3 分钟内看懂系统能力。
6. 所有新增比赛资产放到 `docs/competition/`、`frontend/src/pages/Competition*` 或 `backend-ts/src/modules/competition/`，方便回收和打包。

---

## 1. 仓库总览

| 区域 | 路径 | 作用 | 比赛版用法 |
| --- | --- | --- | --- |
| 前端主应用 | `frontend/` | React + Vite 用户端/管理端 | 新增 `/competition` 演示入口，复用已有页面链接 |
| 后端主服务 | `backend-ts/` | NestJS API | 暴露比赛闭环 demo API 或复用现有 Agent API |
| Agent 服务 | `backend-ts/src/services/agents/` | 各类智能体实现 | 重命名/组合为比赛 Agent 群 |
| Agent 办公室 | `backend-ts/src/modules/agent-office/`、`frontend/src/pages/user/AgentOffice.tsx` | 可视化调度、任务、结果 | 改造成“多智能体协同决策舱” |
| 领域注册 | `backend-ts/src/domains/learning-domain.registry.ts` | 学习领域、路线模板 | 扩展 `software-engineering` 为 CodeNova 软件开发领域 |
| 学习路径 | `backend-ts/src/modules/learning-paths/`、`frontend/src/pages/user/LearningPaths.tsx` | 路径/技能/资源 | 承接“学习路径规划图” |
| 画像与雷达 | `frontend/src/pages/user/Profile.tsx` | 个人画像、技能图谱 | 承接“先验画像 + 知识盲区” |
| 成长与反馈 | `frontend/src/pages/user/Progress.tsx`、`GrowthReport.tsx` | commit、快照、报告 | 承接“动态反馈迭代” |
| Evidence RAG | `backend-ts/src/services/evidence-rag.service.ts`、`backend-ts/src/modules/evidence/` | 个人证据检索与引用校验 | 包装为“知识溯源/幻觉防控” |
| 资源沉淀 | `backend-ts/src/services/generated-resource.service.ts` | Agent 产物统一登记 | 承接“定制讲义/实操指南/分阶测试题” |
| 题目生成 | `backend-ts/src/modules/question-generation/`、`frontend/src/pages/user/QuestionGenerator.tsx` | 题目生成、审核、入库 | 承接“分阶测试题” |
| 补弱机制 | `backend-ts/src/modules/remediation/` | 错题/弱点生成补救任务 | 承接“降维解释/进阶挑战” |
| 演示视频 | `video-renderer/`、`frontend/src/pages/user/VideoShowcase.tsx` | 演示视频生成/素材展示 | 后期生成 10 分钟以内比赛演示视频 |

---

## 2. 赛题条款到代码的映射

### 2.1 垂直领域技能培训

赛题要求：智能制造、工业互联网、特定软件开发、人工智能等垂直领域，体现不同背景学习者适配。

已有基础：

- `backend-ts/src/domains/learning-domain.registry.ts`
  - 已有 `SOFTWARE_ENGINEERING_DOMAIN`
  - 已有 starter path：`fullstack-project`
  - 已有雷达维度：产品与界面、服务与数据、质量与交付
- `frontend/src/pages/PlanCreate.tsx`
- `frontend/src/pages/PlanHub.tsx`
- `frontend/src/pages/user/LearningPaths.tsx`
- `frontend/src/pages/user/Profile.tsx`

建议改造：

1. 把 `software-engineering` 展开成 CodeNova 主领域。
2. 新增或替换 starter path：
   - `ai-native-fullstack`
   - `multi-agent-app-development`
   - `rag-engineering`
3. 能力项建议：
   - React/Vite 前端工程
   - NestJS API 设计
   - TypeORM/MySQL 数据建模
   - RAG 知识库检索
   - 多 Agent 编排
   - 测试与交付
4. 三类学习者画像：
   - A：大一零基础学生，理论弱、时间多
   - B：软件工程本科生，项目经验不足
   - C：企业转岗学习者，业务强、代码弱

优先级：P0  
验收：创建计划时能看到 CodeNova 软件开发路线；画像页和路径页展示软件开发能力维度。

---

### 2.2 多智能体协同与生成机制

赛题要求：至少 3 个 Agent，完成“分析-生成-校验-决策”闭环。

已有基础：

- `backend-ts/src/services/agents/profile-agent.service.ts`
- `backend-ts/src/services/agents/lecture-agent.service.ts`
- `backend-ts/src/services/agents/code-agent.service.ts`
- `backend-ts/src/services/agents/exam-agent.service.ts`
- `backend-ts/src/services/agents/reviewer-agent.service.ts`
- `backend-ts/src/services/agents/path-agent.service.ts`
- `backend-ts/src/services/agents/assess-agent.service.ts`
- `backend-ts/src/services/agents/orchestrator-agent.service.ts`
- `backend-ts/src/modules/agent-office/agent-office.controller.ts`
- `frontend/src/hooks/useAgentOffice.ts`
- `frontend/src/pages/user/AgentOffice.tsx`
- `frontend/src/components/office/TaskCenter.tsx`

比赛版 Agent 命名建议：

| 比赛 Agent | 复用服务 | 职责 |
| --- | --- | --- |
| 学情诊断 Agent | `ProfileAgentService` + `AssessAgentService` | 读取画像、测评、错题，定位强项与盲区 |
| 领域专家 Agent | `LectureAgentService` + Knowledge/RAG | 基于软件开发知识库生成高保真讲义 |
| 实操生成 Agent | `CodeAgentService` | 生成项目任务、代码案例、工程步骤 |
| 分阶测评 Agent | `ExamAgentService` + `QuestionGenerationService` | 生成基础/进阶/挑战题 |
| 审核裁判 Agent | `ReviewerAgentService` | 检查事实、格式、难度、引用和安全 |
| 决策编排 Agent | `OrchestratorAgentService` + `PathAgentService` | 汇总多 Agent 输出，给出下一步学习决策 |

建议改造：

1. 不必新增所有服务，优先在前端和文档中换成比赛 Agent 名称。
2. 后端如要新增统一接口，建议新增：
   - `backend-ts/src/modules/competition/competition.module.ts`
   - `backend-ts/src/modules/competition/competition.controller.ts`
   - `backend-ts/src/modules/competition/competition.service.ts`
3. 新接口建议：
   - `GET /api/competition/demo-cases`
   - `POST /api/competition/run-loop`
   - `POST /api/competition/feedback`
4. `run-loop` 返回结构建议：

```ts
type CompetitionLoopResult = {
  learner: LearnerProfile;
  domain: 'ai-native-software-development';
  stages: Array<{
    id: 'analyze' | 'retrieve' | 'generate' | 'review' | 'decide';
    agent: string;
    status: 'success' | 'warning' | 'failed';
    summary: string;
    evidence?: string[];
  }>;
  report: {
    blindSpots: Array<{ skill: string; severity: number; reason: string }>;
    difficultyCurve: Array<{ week: string; target: number; actual: number }>;
    pathNodes: Array<{ id: string; title: string; level: string; status: string }>;
    matchScore: number;
  };
  resources: {
    lecture: ResourcePreview;
    labGuide: ResourcePreview;
    stagedQuiz: ResourcePreview;
  };
  decision: {
    action: '降维解释' | '保持节奏' | '进阶挑战';
    reason: string;
    nextTasks: string[];
  };
};
```

优先级：P0  
验收：前端能展示每个 Agent 的中间结论，而不是只展示最终文本。

---

### 2.3 三种个性化学习资源

赛题要求：至少生成定制化资源、实操指南、分阶测试题三种形态。

已有基础：

- 定制讲义：`backend-ts/src/services/agents/lecture-agent.service.ts`
- 拓展阅读：`backend-ts/src/services/agents/reading-agent.service.ts`
- 代码案例：`backend-ts/src/services/agents/code-agent.service.ts`
- 分阶题目：`backend-ts/src/services/agents/exam-agent.service.ts`
- 通用出题器：`backend-ts/src/modules/question-generation/`
- 资源台账：`backend-ts/src/services/generated-resource.service.ts`
- 前端资源展示：`frontend/src/components/office/TaskCenter.tsx`
- API 封装：`frontend/src/api/user.ts`
  - `generateLecture`
  - `generateReading`
  - `generateCode`
  - `generateLearningPath`
  - `assessLearning`
  - `getGeneratedResources`
  - `setGeneratedResourceFeedback`

建议改造：

1. 比赛页资源区固定展示三栏：
   - 定制讲义：概念、核心知识、误区、复盘问题
   - 实操指南：环境、步骤、验收标准、常见错误
   - 分阶测试题：基础题、应用题、挑战题
2. 后端产物统一写入 `GeneratedResource`，便于后续“有用/无用”反馈。
3. 题目生成尽量走 `question-generation` 模块，因为它已有审核、快照、入库概念。

优先级：P0  
验收：同一个知识点对三类学习者输出不同难度、不同解释方式、不同任务要求。

---

### 2.4 可视化学情与资源匹配报告

赛题要求：知识盲区定位、资源难度匹配曲线、学习路径规划图。

已有基础：

- `frontend/src/pages/user/Profile.tsx`
  - 技能雷达
  - 3D 技能图谱
  - 证据面板
- `frontend/src/pages/user/Progress.tsx`
  - 学习 commit
  - 快照对比
  - delta 变化
- `frontend/src/pages/user/GrowthReport.tsx`
  - 阶段成长报告
- `frontend/src/components/SkillGraph3D/`
  - 3D 图谱组件
- `frontend/src/components/RadarChart.tsx`
- `frontend/src/components/MatchBreakdown.tsx`
- `backend-ts/src/modules/graph/`
- `backend-ts/src/modules/progress/`

建议改造：

1. 新增 `frontend/src/pages/Competition.tsx`：
   - 不登录也能访问
   - 使用静态 demo 数据
   - 展示完整闭环
2. 页面布局建议：
   - 顶部：项目名 + 赛题对齐指标
   - 左侧：学习者画像选择器
   - 中间：Agent 协同时间线
   - 右侧：知识盲区与匹配报告
   - 下方：三类资源预览 + 反馈决策
3. 后续再把静态数据替换为 `/api/competition/run-loop`。

优先级：P0  
验收：评审不登录也能看到比赛闭环，截图可直接放 PPT。

---

### 2.5 动态反馈迭代

赛题要求：根据答题正确率，决策降维解释或进阶挑战。

已有基础：

- `backend-ts/src/modules/remediation/`
  - `GET /api/user/remediation/weak-points`
  - `POST /api/user/remediation/prepare`
  - `POST /api/user/remediation/generate`
  - `GET /api/user/remediation/history`
- `frontend/src/pages/user/WrongAnswers.tsx`
- `frontend/src/pages/user/QuickTest.tsx`
- `frontend/src/pages/user/Exams.tsx`
- `frontend/src/api/user.ts`
  - `getWrongAnswers`
  - `getQuickTestQuestions`
  - `submitQuickTest`
  - `getRetryableExams`
  - `retryExam`

建议改造：

1. 在比赛页做一个反馈模拟控件：
   - 正确率 `< 60%`：降维解释
   - 正确率 `60%-85%`：保持节奏 + 补弱练习
   - 正确率 `> 85%`：进阶挑战任务
2. 真接口后续可接 `remediation` 或 `quick-test`。
3. 把决策原因展示为“多 Agent 会议纪要”，突出协同决策。

优先级：P1  
验收：调节正确率后，下一步任务和资源难度会变化。

---

### 2.6 幻觉防控、辩论与交叉验证

赛题要求：多 Agent 辩论、交叉验证、高保真知识溯源、约束生成。

已有基础：

- `backend-ts/src/services/evidence-rag.service.ts`
  - `ingest`
  - `search`
  - `buildContext`
  - `validateCitations`
  - `getSummary`
- `backend-ts/src/modules/evidence/evidence.controller.ts`
  - `GET /api/user/evidence/search`
  - `POST /api/user/evidence/reindex`
  - `GET /api/user/evidence/summary`
- `backend-ts/src/services/agents/reviewer-agent.service.ts`
- `backend-ts/src/services/agents/orchestrator-agent.service.ts`
- 测试：
  - `backend-ts/src/services/evidence-rag.service.spec.ts`
  - `backend-ts/src/services/evidence-rag.eval.spec.ts`
  - `backend-ts/test-fixtures/evidence-rag/eval-cases.json`

建议包装成比赛机制：

```text
领域专家 Agent：只能基于知识库片段生成
实操生成 Agent：把知识转成实验步骤和验收标准
审核裁判 Agent：检查引用、事实、难度、格式
决策编排 Agent：如果审核未通过，要求生成 Agent 修订；如果通过，进入资源包
```

建议新增字段：

- `evidenceIds`
- `citationCoverage`
- `reviewScore`
- `hallucinationRisk`
- `debateNotes`
- `revisionRequired`

优先级：P1  
验收：每份资源都能展示“依据哪些知识片段生成、审核发现什么、是否通过”。

---

## 3. 推荐新增文件

### 3.1 前端比赛入口

新增：

- `frontend/src/pages/Competition.tsx`
- `frontend/src/pages/competition.css`

修改：

- `frontend/src/App.tsx`
  - import `Competition`
  - 新增公开路由：`<Route path="/competition" element={<Competition />} />`
- `frontend/index.html`
  - title 改成 CodeNova 比赛版

页面必须包含：

1. 项目名：焕星·码枢 CodeNova
2. 赛题名：领域知识个性化生成与多智能体协同决策系统研究
3. 三类学习者画像选择
4. 多 Agent 闭环可视化
5. 资源匹配报告
6. 三类资源预览
7. 反馈迭代决策
8. 已有系统入口按钮：
   - `/user/agent-office`
   - `/user/profile`
   - `/user/learning`
   - `/user/question-generator`
   - `/user/growth-report`

注意：`/competition` 应该不依赖登录，否则评审打开不方便。

---

### 3.2 后端比赛 API

可选新增：

- `backend-ts/src/modules/competition/competition.module.ts`
- `backend-ts/src/modules/competition/competition.controller.ts`
- `backend-ts/src/modules/competition/competition.service.ts`
- `backend-ts/src/modules/competition/competition.fixtures.ts`

修改：

- `backend-ts/src/app.module.ts`
  - import 并注册 `CompetitionModule`

建议接口：

| Method | Path | 用途 |
| --- | --- | --- |
| GET | `/api/competition/health` | 比赛模块健康检查 |
| GET | `/api/competition/demo-cases` | 返回 3 组学习者画像 |
| POST | `/api/competition/run-loop` | 执行或模拟多 Agent 闭环 |
| POST | `/api/competition/feedback` | 根据正确率返回动态决策 |

第一阶段可以用 fixtures 返回，不必真的调用 LLM。这样演示稳定。

---

### 3.3 比赛数据与材料

新增：

- `docs/competition/CodeNova比赛改造方案.md`
- `docs/competition/CodeNova演示脚本.md`
- `docs/competition/CodeNova测试数据说明.md`
- `docs/competition/data/learners.json`
- `docs/competition/data/software-knowledge-slice.md`
- `docs/competition/data/agent-loop-examples.json`

用途：

- 文档/PPT/视频脚本可直接复用
- 后端 fixtures 可直接读取或手工同步
- 评审要求的“至少 1 个知识库切片 + 不少于 2 组学习者数据”可以直接满足

---

## 4. 当前代码中最应该先读的文件

### 前端

1. `frontend/src/App.tsx`
   - 路由总入口
   - 新增 `/competition` 必读
2. `frontend/src/api/user.ts`
   - 所有用户端 API 封装
   - 找已有接口，不要重复写 axios
3. `frontend/src/pages/user/AgentOffice.tsx`
   - Agent 办公室页面
   - 后续改“协同决策舱”
4. `frontend/src/hooks/useAgentOffice.ts`
   - Agent 类型、任务状态、历史记录、资源输出
5. `frontend/src/components/office/TaskCenter.tsx`
   - 任务中心和生成资源展示
6. `frontend/src/pages/user/Profile.tsx`
   - 画像、雷达、3D 图谱入口
7. `frontend/src/pages/user/LearningPaths.tsx`
   - 学习路径主页面
8. `frontend/src/pages/user/GrowthReport.tsx`
   - 成长报告，可包装为匹配报告
9. `frontend/src/pages/user/QuestionGenerator.tsx`
   - 分阶测试题生成主页面
10. `frontend/src/pages/user/VideoShowcase.tsx`
   - 后期演示视频能力

### 后端

1. `backend-ts/src/app.module.ts`
   - 模块总注册
2. `backend-ts/src/services/agents/orchestrator-agent.service.ts`
   - 中控智能体，适合承接比赛“协同决策”
3. `backend-ts/src/modules/agent-office/agent-office.controller.ts`
   - Agent 调度 API
4. `backend-ts/src/services/agents/reviewer-agent.service.ts`
   - 审核裁判，适合承接幻觉防控
5. `backend-ts/src/services/evidence-rag.service.ts`
   - 知识溯源、引用校验、RAG 检索
6. `backend-ts/src/services/generated-resource.service.ts`
   - 生成资源统一台账
7. `backend-ts/src/modules/question-generation/question-generation.service.ts`
   - 分阶题目生成与审核
8. `backend-ts/src/modules/remediation/remediation.service.ts`
   - 动态补弱/反馈迭代
9. `backend-ts/src/domains/learning-domain.registry.ts`
   - CodeNova 软件开发领域配置
10. `backend-ts/src/services/resource-agent.service.ts`
   - 基于领域上下文生成学习资源

---

## 5. API 快速索引

### Agent 直接生成

来源：`frontend/src/api/user.ts`

```ts
generateLecture({ skillName, level, extra })
generateReading({ skillName, count, focus })
generateCode({ skillName, language, count })
generateLearningPath({ goal, currentLevel, availableTime, preferences })
assessLearning({ learningData, goal, currentProgress, skillName })
```

后端入口：

- `POST /api/user/agents/lecture`
- `POST /api/user/agents/reading`
- `POST /api/user/agents/code`
- `POST /api/user/agents/path`
- `POST /api/user/agents/assess`

### Agent Office

```ts
getAgentOfficeStats()
getAgentTypes()
getAgentOfficeTasks(status?)
createAgentOfficeTask({ agentType, title, params, description })
directUseAgent(profileId, prompt, params?)
getAgentOfficeHistory(limit?)
getGeneratedResources({ limit })
```

后端入口：

- `GET /api/user/agent-office/stats`
- `GET /api/user/agent-office/agent-types`
- `GET /api/user/agent-office/tasks`
- `POST /api/user/agent-office/tasks`
- `POST /api/user/agent-office/profiles/:profileId/use`
- `GET /api/user/agent-office/history`

### 画像、路径、图谱

```ts
getProfile()
getProfileRadar()
getProfileAbilityMetrics()
getLearningDomains()
getLearningPaths()
getLearningPathDetail(id)
getGraph({ skill, job_id, limit })
getGrowthReport(days)
```

### RAG 与证据

```ts
searchEvidence({ query, skill, sourceType, limit })
getEvidenceSummary()
getSkillEvidence(skillName)
```

后端入口：

- `GET /api/user/evidence/search`
- `GET /api/user/evidence/summary`
- `GET /api/user/skills/:skillName/evidence`

### 题目与反馈

```ts
getQuickTestQuestions(direction?)
submitQuickTest({ skillName, answers, questions })
getWrongAnswers(skillName?)
getRetryableExams()
retryExam(examId)
```

QuestionGeneration：

- `GET /api/user/question-generation/tasks`
- `POST /api/user/question-generation/tasks`
- `POST /api/user/question-generation/tasks/:taskId/start`
- `GET /api/user/question-generation/tasks/:taskId/snapshot`
- `PATCH /api/user/question-generation/tasks/:taskId/questions/approve`

Remediation：

- `GET /api/user/remediation/weak-points`
- `POST /api/user/remediation/prepare`
- `POST /api/user/remediation/generate`
- `GET /api/user/remediation/history`

---

## 6. P0 开发顺序

### Step 1：新增评审可见入口

文件：

- `frontend/src/pages/Competition.tsx`
- `frontend/src/pages/competition.css`
- `frontend/src/App.tsx`

目标：

- 打开 `/competition` 不登录也能看。
- 静态模拟完整闭环。
- 用 CodeNova 品牌和赛题语言。

不要做：

- 不要先接真实 LLM。
- 不要依赖登录态。

验收：

```powershell
cd frontend
npm run build
```

---

### Step 2：扩展软件开发领域

文件：

- `backend-ts/src/domains/learning-domain.registry.ts`

目标：

- 把 `SOFTWARE_ENGINEERING_DOMAIN` 文案修成中文无乱码。
- starter path 改成 CodeNova 推荐路线。
- 雷达维度改成比赛表达：
  - 前端工程
  - 后端服务
  - 数据与 RAG
  - 多智能体协同
  - 质量与交付

验收：

```powershell
cd backend-ts
npm run build
```

---

### Step 3：Agent Office 比赛命名

文件：

- `backend-ts/src/modules/agent-office/agent-office.controller.ts`
- `frontend/src/hooks/useAgentOffice.ts`
- `frontend/src/pages/user/AgentOffice.tsx`
- `frontend/src/components/office/*`

目标：

- 把“员工/工位/办公室”的解释降一点，把“Agent 协同决策舱”升上来。
- Agent 类型仍用原 key，显示名换比赛名。

建议映射：

```ts
lecture -> 领域专家 Agent
code -> 实操生成 Agent
exam -> 分阶测评 Agent
reviewer/review -> 审核裁判 Agent
profile -> 学情诊断 Agent
path -> 路径决策 Agent
assess -> 学习评估 Agent
```

注意：

- 当前 `AGENT_TYPE_MAP` 没有 reviewer 类型，Reviewer 更多在后端服务内部用。
- 如果前端要展示 reviewer，可以先作为“审核阶段”展示，不一定要变成可招聘 Agent。

---

### Step 4：准备比赛测试数据

文件：

- `docs/competition/data/learners.json`
- `docs/competition/data/software-knowledge-slice.md`
- `docs/competition/data/agent-loop-examples.json`

目标：

- 至少 3 组差异化学习者画像。
- 至少 1 个软件开发知识库切片。
- 每组都有输入画像、中间 Agent 数据、最终资源示例。

验收：

- 文档中能直接说明满足赛题“测试数据”要求。
- `/competition` 页面可以复用这些数据。

---

### Step 5：补后端比赛模块

文件：

- `backend-ts/src/modules/competition/*`
- `backend-ts/src/app.module.ts`

目标：

- 给 `/competition` 页提供稳定 demo 数据。
- 后续再逐步接真实 Agent。

第一版建议只返回 fixtures，保证演示稳定。

---

## 7. P1 开发顺序

1. `ReviewerAgentService` 增强为“审核裁判 Agent”
   - 输出引用覆盖率、幻觉风险、修改建议。
2. `OrchestratorAgentService` 增强比赛闭环
   - 输出 `stages[]` 和 `decision`。
3. `QuestionGenerationService` 增加“分阶测试题”配置模板
   - 基础、应用、挑战。
4. `RemediationService` 增加比赛决策策略
   - `<60%` 降维解释
   - `60%-85%` 补弱巩固
   - `>85%` 进阶挑战
5. `GeneratedResourceService` 资源预览增强
   - 讲义、实操、题目分别有更清楚的 preview。

---

## 8. P2 开发顺序

1. 登录后页面整体品牌替换为 CodeNova。
2. 修复旧页面乱码。
3. 后端真实调用多 Agent，并把中间结果入库。
4. 加 SSE 展示实时 Agent 状态。
5. 用 `video-renderer/` 生成 10 分钟以内演示视频。
6. 输出 Word/PPT/部署文档/测试报告。

---

## 9. 风险点

1. 旧页面存在乱码
   - 风险：评审看到旧品牌时观感差。
   - 处理：先让 `/competition` 成为第一入口；后续逐页修核心文案。
2. 真实 LLM 不稳定
   - 风险：演示现场失败。
   - 处理：比赛页第一版用稳定 fixtures；真实 Agent 作为“可运行增强模式”。
3. Agent 类型命名和数据库枚举
   - 风险：新增 reviewer 类型可能影响任务表。
   - 处理：P0 不新增类型，只做展示映射。
4. `.gitmodules` 中没有 `vibing vidio` 映射
   - 风险：嵌套仓库状态影响主仓库显示。
   - 处理：比赛主线不动该目录，除非后期做视频。
5. 中间件较多
   - 风险：评审部署成本高。
   - 处理：提交时提供“最小演示模式”和“完整模式”两套说明。

---

## 10. 最小可提交版本定义

满足以下条件即可形成比赛初版：

1. `/competition` 可打开，展示完整闭环。
2. CodeNova 项目名、赛题名、发榜单位清晰。
3. 展示 3 个以上 Agent 的职责和中间输出。
4. 展示 3 类资源：定制讲义、实操指南、分阶测试题。
5. 展示可视化报告：盲区、难度曲线、路径图。
6. 展示反馈决策：降维解释/补弱/进阶挑战。
7. `docs/competition/data` 中有知识库切片和 3 组学习者数据。
8. `frontend npm run build` 通过。
9. `backend-ts npm run build` 通过。

---

## 11. 给编程智能体的任务模板

### 任务模板 A：新增比赛入口页

请按 `docs/competition/CodeNova代码导航.md` 新增 CodeNova 比赛入口页：

- 新增 `frontend/src/pages/Competition.tsx`
- 新增 `frontend/src/pages/competition.css`
- 修改 `frontend/src/App.tsx` 加公开路由 `/competition`
- 页面使用静态 demo 数据，不依赖登录、不调用后端
- 必须展示：学习者画像、多 Agent 闭环、知识盲区、难度曲线、学习路径、三类资源、反馈决策
- 完成后运行 `cd frontend && npm run build`

### 任务模板 B：扩展软件开发领域

请按 `docs/competition/CodeNova代码导航.md` 修改：

- `backend-ts/src/domains/learning-domain.registry.ts`

目标：

- 修正 `SOFTWARE_ENGINEERING_DOMAIN` 乱码文案
- 将 starter path 调整为 CodeNova 软件开发方向
- 保留现有类型结构，不改外部接口
- 完成后运行 `cd backend-ts && npm run build`

### 任务模板 C：准备比赛测试数据

请新增：

- `docs/competition/data/learners.json`
- `docs/competition/data/software-knowledge-slice.md`
- `docs/competition/data/agent-loop-examples.json`

要求：

- 3 组学习者画像
- 1 个软件开发知识库切片
- 每组包含输入画像、Agent 中间数据、资源输出和反馈决策
- 数据可被 `/competition` 页面直接复制使用

### 任务模板 D：后端比赛 demo API

请新增：

- `backend-ts/src/modules/competition/competition.module.ts`
- `backend-ts/src/modules/competition/competition.controller.ts`
- `backend-ts/src/modules/competition/competition.service.ts`
- `backend-ts/src/modules/competition/competition.fixtures.ts`

要求：

- 注册到 `backend-ts/src/app.module.ts`
- 提供 `/api/competition/demo-cases`
- 提供 `/api/competition/run-loop`
- 提供 `/api/competition/feedback`
- 第一版使用 fixtures，不调用 LLM
- 完成后运行 `cd backend-ts && npm run build`

---

## 12. 推荐演示路线

1. 打开 `/competition`
2. 选择“大一零基础学生”
3. 展示 Agent 闭环：
   - 学情诊断：理论底盘不足
   - 领域检索：命中 React/Vite/NestJS/RAG 知识片段
   - 资源生成：讲义、实操、题目
   - 审核裁判：通过，引用覆盖率 92%
   - 决策编排：先降维解释，再进入小项目
4. 切换“本科进阶学习者”
5. 展示资源难度上移，生成进阶挑战
6. 跳转 Agent Office，说明真实系统已有 Agent 调度底座
7. 跳转 Profile/GrowthReport，说明画像和反馈闭环已有真实页面

---

## 13. 当前已落地入口

### 前端

- 比赛演示页：`frontend/src/pages/Competition.tsx`
- 比赛页样式：`frontend/src/pages/competition.css`
- 路由入口：`frontend/src/App.tsx` 中的 `/competition`
- 页面标题：`frontend/index.html`

页面已覆盖：

- 三类学习者画像切换
- 交互反馈正确率滑条
- 多 Agent 协同闭环
- 资源匹配度、盲区、难度曲线和路径规划图
- 个性化资源包：定制讲义、实操指南、分阶测试题
- 知识库切片溯源
- 审核辩论与交叉验证记录

### 后端

- 模块注册：`backend-ts/src/app.module.ts`
- 模块入口：`backend-ts/src/modules/competition/competition.module.ts`
- Controller：`backend-ts/src/modules/competition/competition.controller.ts`
- Service：`backend-ts/src/modules/competition/competition.service.ts`
- Fixtures/类型：`backend-ts/src/modules/competition/competition.fixtures.ts`
- 单元测试：`backend-ts/src/modules/competition/competition.service.spec.ts`

接口：

- `GET /api/competition/health`
- `GET /api/competition/demo-cases`
- `POST /api/competition/run-loop`
- `POST /api/competition/feedback`

返回结构重点看：

- `agents`：分析、生成、校验、决策闭环
- `report`：匹配度、盲区、难度曲线、路径节点
- `resources`：三类个性化资源
- `evidenceTrail`：知识库切片和覆盖率
- `debate`：审核裁判与路径决策的交叉验证意见
- `decision`：降维解释、补弱巩固、进阶挑战

---

## 14. 常用命令

```powershell
# 查看状态
git status --short --branch

# 前端构建
cd frontend
npm run build

# 后端构建
cd backend-ts
npm run build

# 后端测试
cd backend-ts
npm test -- --runInBand

# 本地启动前端
cd frontend
npm run dev -- --host 0.0.0.0

# 本地启动后端
cd backend-ts
npm run start:dev
```

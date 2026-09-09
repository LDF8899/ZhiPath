# ZhiPath 多定制前端平台化升级方案

版本：Draft 1.4（持续实施）  
基线：`2.0` 分支，`f4e7733`  
适用客户端：智途 ZhiPath（`frontend/`）与 CodeNova（`codenovafrontend/`）

## 1. 目标与结论

目标不是把两套前端合并成一套，而是建设一个稳定的学习平台内核，让多个定制前端独立演进：

- 智途与 CodeNova 保留各自的信息架构、交互、品牌和发布节奏。
- 身份、学习画像、路径、任务、测评、证据、资源和 AI 编排只在一个后端实现。
- 一个用户可在多个客户端访问同一份核心数据，同时拥有每个客户端独立的偏好和功能入口。
- 学校/企业等数据隔离通过租户实现，不能与“客户端品牌”混为一谈。
- 新增第三套前端时，只需注册客户端、选择功能和消费统一 SDK，不复制业务服务。

建议采用“模块化单体 + 统一契约 + 多客户端体验层”，当前阶段不拆微服务。现有数据量、团队协作和部署形态更适合先把边界理顺；过早拆服务只会把当前混乱变成分布式混乱。

### 1.1 当前实施快照（2026-09-09）

本方案不是纯设计稿，当前工作区已经完成首批平台底座：

- 智途 ZhiPath 与 CodeNova 已固定使用独立的 `X-Client-App`、Token 存储和体验配置。
- 访问令牌的 `azp` 与 `X-Client-App` 强绑定，禁止跨客户端复用；历史 `azp=unknown` 令牌在兼容期保留。
- `client_apps`、`client_features`、`tenants`、membership、RBAC、refresh token 已迁移并回填。
- 客户端注册和功能开关提供 `/api/v1/admin/client-apps` 管理接口；写入使用事务并同时生成 outbox 与审计记录。
- CORS 同时支持部署静态白名单与数据库客户端来源；新注册来源可动态生效。
- `/api/v1/auth`、`/api/v1/me`、`/api/v1/experience` 以及首批学习/测评/证据查询已经上线。
- 核心学习、能力、测评、证据表已规范化并从历史表回填，历史 `_v3` 表仍保留用于兼容迁移。
- 根 workspace 与 `@zhipath/api-client` 已建立；两套前端共享登录、刷新、错误处理、request ID 和 token 生命周期，OpenAPI 当前导出 367 条路径。
- 学习目标、路径节点/边、学习活动、测评提交和证据写入已具备事务、幂等、审计、outbox 和历史表兼容写。
- `/api/v1/jobs` 已统一 Agent/资源作业的创建、查询、取消与重试；运行中任务使用协作取消，终态通过 durable outbox 发布到 SSE。
- `ai_usage_ledger` 已接入请求与队列上下文，可按 tenant、user、client、request、agent run、provider 和 model 归因 token/耗时。
- 旧 `/api/user/*` 与 `/api/admin/auth/*` 仍可用，并返回 `Deprecation`、`Sunset`、`Link` 响应头。
- 当前数据库 77 张表、134 个外键、25 个已执行 migration；后端 40 个测试套件、137 个单测、共享 API Client 契约测试及 E2E 均通过。
- 路径列表与状态写入已接入 `/api/v1/learning-paths`，路径边、测评回答/得分、证据关联和 Agent 步骤均已显式保存 `tenant_id`，并以复合外键保证子记录不能关联其他租户的父记录。
- `npm run smoke:multi-frontend` 会用真实 Chromium 重放两套客户端的品牌、登录、bootstrap、规范资源/学习活动读取、资源检索、SSE 和双向跨客户端 Token 拒绝。
- 2026-09-09：规范学习目标创建会按注册表起步路线物化 `competencies`、路径节点、学习活动与有向边，并将同一快照写入兼容 `learning_plans_v3`；两套前端的创建路径与添加能力已优先使用 `/api/v1/learning-goals`、`/api/v1/learning-paths/:id/nodes`，旧路由仅作兼容回退。
- 2026-09-09：测评历史读取已优先使用 `/api/v1/assessments/attempts`，并在前端适配为原有报告模型；统一资源台账、学习路径和测评三条主链路均已具备 v1 读写烟测。
- 2026-09-09：速测题目读取统一到 `/api/v1/assessments/quick-test`，资源关键词检索统一到 `/api/v1/resources/search`；评测上下文对历史失效领域 key 增加安全降级，避免旧数据阻塞测评入口。
- 2026-09-09：考试列表优先读取规范 `assessment_attempts`；新增 `/api/v1/assessments/legacy-exams/:legacyExamId/attempts` 兼容适配器，考试开始/提交和速测提交均优先走 v1；补弱新增 `/api/v1/remediation/*`（带客户端、租户鉴权及幂等键约束），旧入口仅保留回退。
- 2026-09-09：两套前端的讲义、阅读、代码、路径和评估 Agent 已优先提交到 `/api/v1/jobs`，共享客户端增加 `waitForJob` 终态轮询；证据关键词检索新增 `/api/v1/evidence/search`，旧 RAG/知识接口继续作为兼容回退。
- 2026-09-09：多模态动画、Mermaid 图表、短视频、数字人统一注册为 `resource.animation|diagram|video|avatar` 作业类型，由资源队列执行并写入规范资源台账；两套前端的多模态生成和 Agent 办公室任务中心已优先走 `/api/v1/jobs`，旧同步端点仅作兼容回退。
- 2026-09-09：新增 `/api/v1/profile`、`/api/v1/profile/radar`、`/api/v1/profile/ability-metrics` 统一画像契约，智途与 CodeNova 的画像页面已优先读取/更新该契约，租户和客户端上下文由统一鉴权中间件注入。
- 2026-09-09：新增 `/api/v1/profile/onboarding` 规范引导写入口；两套前端均携带幂等键优先提交，旧 `/api/user/onboarding` 仅作兼容回退。画像更新同时支持清空可选字段并规范化 `dailyHours` 范围，避免两个客户端写入语义漂移。
- 2026-09-09：新增 `/api/v1/learning-tasks/today` 与 `/api/v1/learning-tasks/adjust-speed` 任务投影适配器，统一 scopes、客户端上下文和幂等键；两套前端的速度调整已优先走 v1，旧 scheduler 路由只作为回退。
- 2026-09-09：学习领域与起步路线目录、onboarding 状态读取纳入 v1（`/api/v1/learning-domains`、`/api/v1/profile/onboarding/status`），计划创建和引导页面不再把旧目录接口作为主调用。
- 2026-09-09：两套前端今日任务读取改为直接使用 `/api/v1/learning-tasks/today`，不再先把全部活动误当作“今日任务”；仅在旧环境中回退活动列表或历史接口。
- 2026-09-09：站内通知增加 `/api/v1/notifications/*` 稳定适配器，统一分页、未读投影、scope 和幂等已读命令；migration 10 已将历史 `notifications_v3` 回填至带 `tenant_id` 的规范 `notifications` 表，旧表改名保留审计/回滚。
- 2026-09-09：题库、考试记录和资讯增加显式 `tenant_id`（migration 11）；公共题目/资讯允许 NULL 表示平台目录，考试历史按 membership 回填；migration 12 为尚未下线的历史考试写入口提供默认租户保护。
- 2026-09-09：两套前端增加客户端身份自检：智途只接受 `zhipath-web`，CodeNova 只接受 `codenova-web`；端口或代理配错时显示明确诊断，不再静默渲染成另一套品牌。
- 2026-09-09：用户自带 LLM 配置增加 `/api/v1/user-llm/*`，CodeNova 设置页已优先迁移；密钥继续服务端加密、只返回脱敏值，写入要求幂等键和 `learning:write`。
- 2026-09-09：简历 PDF 下载纳入 v1（`/api/v1/resumes/:id/pdf`），共享 API Client 增加 Blob 响应解码，避免文档下载重新绕回旧客户端。
- 2026-09-09：为画像、技能、匹配、会话、简历、聊天、证据、岗位和题目生成 v1 适配器补齐 `ScopesGuard`；读操作统一要求 `learning:read`/`assessment:take`，写操作统一要求对应写权限，避免仅有登录态即可调用业务命令。
- 2026-09-09：技能画像新增 `/api/v1/me/skills`、`stats`、`effective` 与单技能 `evidence` 读模型；简历和学习会话页面不再把旧路由作为主调用。会话关闭的 `beforeunload` 改为携带客户端身份的 v1 keepalive 请求。
- 2026-09-09：智途 `getMyPlans()` 与 CodeNova 路径列表/详情统一优先读取规范学习路径，边界适配器将 UUID 读模型转换为各自页面所需的旧摘要字段；只有 v1 不可用时才回退 `/api/user/learning-paths`。
- 2026-09-09：Git 学习分支、提交、快照和比较新增 `/api/v1/git/*` 稳定适配器，智途 API 层已优先使用 v1；历史数字 ID 暂作为兼容引用，后续随 Git 表规范化迁移为公共 UUID。
- 2026-09-09：知识详情新增 `/api/v1/knowledge/:skill`，智途与 CodeNova 技能页面优先读取统一知识契约；知识正文仍处于 Mongo/规范资源台账收敛期。
- 2026-09-09：Agent Office 新增 `/api/v1/agent-office/*`；任务创建、查询、取消、重试、历史和员工直接使用统一落到 `async_jobs` durable jobs，支持 10 类 Agent 并由统一队列处理；员工配置与任务表通过 migration 13 增加 `tenant_id`、索引和外键，CodeNova 任务中心已优先使用该契约。
- 2026-09-09：聊天会话的 Mongo 查询已收敛到 `ChatHistoryService` repository（列表、详情、删除），旧入口和 v1 入口共用同一租户过滤；画像调度器的 Redis 活跃用户标记改为 `tenantId:userId`，后台画像分析、会话归档和画像合并保持租户一致。
- 2026-09-09：题目生成新增 `question.generate` durable job 类型；migration 14 为生成任务/快照增加 `tenant_id` 与 `platform_job_id`，migration 15 增加幂等键唯一约束；`/api/v1/question-generation/tasks` 创建后由统一 outbox/队列执行，审核编辑仍使用原任务快照兼容模型。
- 2026-09-09：题目生成创建增加 `Idempotency-Key` 数据库唯一约束（migration 15），并将幂等键贯穿题目任务与 durable job；并发重复请求只会保留一个任务和一个作业。旧聊天入口补齐租户/客户端上下文，画像、知识资源和会话的 Mongo 读写增加显式 `tenantId` 过滤。
- 2026-09-09：migration 16 为 `async_jobs` 增加持久化 `priority`、`sort_order` 与 `deleted_at`，并建立调度/租户队列索引；Agent Office v1 新增任务 urgent、skip（延后至队尾）、reorder 与 DELETE 软删除，调度器支持强制重排投递且按数据库优先级/顺序入队。两套前端 API Client 均已接入这些规范命令，旧路由继续只作兼容回退。
- 2026-09-09：migration 17 新增 `api_route_usage_daily` 兼容路由调用量台账；请求日志会按日期、租户、客户端、方法和规范化路由聚合旧 `/api/user/*` 与 `/api/admin/auth/*` 调用，平台管理员可通过 `/api/v1/admin/client-apps/legacy-route-usage` 查询，作为连续两个发布周期零调用后的下线门禁。
- 2026-09-09：学习进度热层 Redis key、Mongo `learning_sessions` 温层及归档/恢复流程统一带 `tenantId`，并补齐租户维度索引；`/api/v1/progress/*` 的五类写操作现在强制 `Idempotency-Key`，重复请求只返回幂等重放结果，避免掌握度和学习时长重复累计。
- 2026-09-09：migration 18 将历史 `students_v3`、`user_skills_v3`、`learning_plans_v3` 纳入统一租户边界，按 active membership 回填 `tenant_id`，增加复合索引与外键；v1 画像/技能读写按 JWT 租户过滤，旧入口继续以默认租户兼容。
- 2026-09-09：migration 19–20 将 Git、会话、简历、补弱、LLM、课程、测评、证据、资源、岗位申请、知识摄取、操作日志等剩余用户表全部补齐 `tenant_id` 与租户索引；计划→分支→提交、计划→任务/会话增加复合外键，数据库层不再存在缺少租户列的 `user_id` 表。
- 2026-09-09：测评历史 v1 查询、学习进度四类闭环写入、速测提交、传统考试提交均贯穿 JWT `tenantId`；题库与考试读取只允许公共题目或当前租户题目，考试记录详情/开始/提交按用户与租户双重约束，避免同一用户跨租户串读。
- 2026-09-09：Dashboard、今日任务调度、Agent Office 旧兼容链路、生成资源、知识摄取、证据 RAG/Chroma、岗位匹配和简历证据查询补齐租户参数；后台队列产物沿用 durable job 的租户上下文，Mongo/向量过滤与 MySQL 事实保持一致。
- 2026-09-09：migration 21 新增 `legacy_orphan_archive`，完整归档并移除 1 条引用不存在 branch/commit 的历史技能快照；`skill_snapshots_v3` 增加 `(tenant_id, branch_id)` 与 `(tenant_id, commit_id)` 复合外键，数据库层禁止再次写入悬空或跨租户引用。
- 2026-09-09：新增 `/api/v1/events` 租户作用域 SSE；事件历史、连接和重放按 `tenantId:userId` 分区，两套前端已从旧 `/api/user/events/stream` 切换到规范流，旧流继续保留兼容。
- 2026-09-09：migration 22 为 `students_v3` 增加 `profile_meta_json`；画像核心字段、技能、项目和扩展 traits/goals/chat insights 由 ProfileService 同步落 MySQL，Mongo `user_profiles` 仅保留兼容/派生读模型。
- 2026-09-09：migration 23 为历史 `match_history_v3` 补齐 `tenant_id`、租户索引和外键；匹配历史写入、趋势读取、考试/进度/速度评分均按租户过滤。
- 2026-09-09：继续收敛兼容链路租户边界：匹配趋势、学习提交速度/快照、旧技能/速测、岗位搜索、证据重建、GitHub 项目、聊天/LangGraph、考试反馈/重试及分支/评测 SSE 均显式传递 `tenantId`；默认租户兼容调用保持旧签名，非默认租户强制三元组过滤。
- 2026-09-09：题库 OCR 导入批次与候选题表纳入租户模型（migration 24），补齐复合导入批次外键；旧题库导入控制器的列表、详情、确认和删除均改为用户+租户双重归属。
- 2026-09-09：身份层新增 `/api/v1/me/tenants` 与 `/api/v1/auth/switch-tenant`。登录令牌固定当前租户，切换前重新校验 active membership 并轮换访问/刷新令牌；体验 bootstrap、`/v1/me` 和客户端偏好读取均使用 JWT 当前租户，不再静默取第一条 membership。共享 API Client 与两套前端封装已同步更新。
- 2026-09-09：教学视频入口已从两套前端的旧 `/api/user/video-task` 优先迁移到 `resource.video` durable job；状态查询统一读取 `/api/v1/jobs/:id` 并在边界层转换为旧页面模型，旧视频接口仅作为兼容回退。画像服务改为 MySQL 先提交结构化字段，Mongo 仅做兼容读模型，Mongo 故障不再阻塞画像更新。
- 2026-09-09：新增 `/api/v1/health/live` 与 `/api/v1/health/ready`。live 只检查进程，ready 会真实检查 MySQL 与 `typeorm_migrations`，部署探针不再把“Node 进程存活”误判为“业务可用”。
- 2026-09-09：新增 migration 25 `knowledge_assets`。知识资产的租户归属、技能/类型唯一性、生命周期、版本和内容哈希进入 MySQL；Mongo `knowledge_base` 只保存大正文，写入期间由服务做兼容双写，便于后续从 outbox 重建向量索引。
- 2026-09-09：知识读取增加 MySQL 目录优先策略：已归档资产不会被 Mongo 旧正文复活；新增 `GET /api/v1/knowledge` 目录端点，返回租户可见的已发布资产元数据，并明确 `mysql.knowledge_assets`（事实源）与 `mongodb.knowledge_base`（正文存储）职责。
- 2026-09-09：新增 `rebuild:platform-indexes` 与 `check:platform-consistency` 运维命令。前者按租户/用户从 MySQL 重建 Chroma 向量并尝试重建 Neo4j 岗位图谱；后者报告知识目录、证据向量状态、异步作业及 Mongo/Chroma 可用性，外部索引不可用时标记 degraded，不阻塞主站。

仍未完成的部分必须按 Phase 3–5 继续推进：Agent Office 的排序等旧兼容动作、题目/视频入口转发到统一 job application service、
Mongo/Chroma/Neo4j 职责收敛、两套前端深层页面迁移、前端自动化测试和旧契约最终下线。当前状态不能表述为“全量升级完成”。

页面级迁移的逐项清单见 [`docs/api-route-migration-matrix.md`](./api-route-migration-matrix.md)；本机三端使用根 workspace 的
`dev:backend`、`dev:zhipath`、`dev:codenova` 命令启动，避免误把两个客户端当作同一个前端。

## 2. 现状审计

### 2.1 升级前基线审计

- 两套独立 React/Vite 前端，共用 `backend-ts/`。
- 后端约 39 个一级业务模块、251 个控制器端点。
- MySQL 升级前为 39 张历史表、86 个普通/唯一索引且没有数据库外键；当前平台化结构见 1.1。
- 32 张表仍带 `_v3` 后缀，版本信息进入了永久表名。
- 61 个 JSON 字段，35 张表重复使用语义不一致的 `status` 软状态列。
- 后端存在 26 处 `body: any` 或 `Record<string, any>` 控制器入参，没有 DTO 目录。
- 两套前端各自手写 API 客户端：静态路径粗略统计，智途 177 个、CodeNova 103 个，其中共同路径约 87 个。
- 升级前后端只有 26 个单元测试文件、两套前端没有自动化测试；当前已新增共享 API Client 契约测试和真实 Chromium 双客户端烟测，组件级前端测试仍待补齐。
- 数据库升级依赖散落的 SQL、JS 迁移脚本和完整快照；TypeORM `synchronize=false`，但没有统一 migrations 流程。

### 2.2 主要结构问题

1. 客户端身份缺失。后端不知道请求来自智途还是 CodeNova，无法稳定地做能力清单、品牌配置、灰度和客户端级观测。
2. 身份路由语义错误。学生与管理员都使用 `/api/admin/auth/login`，公共身份能力被放进管理命名空间。
3. 领域边界重叠。`student` 与 `learning-paths` 都处理计划；`tasks`、`task-scheduler`、`queue`、`agent-office` 都有“任务”；`knowledge`、`evidence`、`knowledge-ingestion` 职责交叉。
4. 数据关系只存在于注释和应用代码。大量 `user_id`、`plan_id`、`source_task_id` 没有外键，容易出现孤儿数据。
5. 核心数据在 MySQL 与 MongoDB 间双写或交叉读取。Mongo 通过原生 collection 名直接访问 `user_profiles`、`knowledge_base`、`chat_sessions`，无 schema 和版本约束。
6. JSON 被同时用于扩展字段和核心关系。学习路径、技能、项目、产物目标等重要结构难以约束、查询和迁移。
7. API 契约不稳定。没有 `/v1` 版本、OpenAPI、生成 SDK、统一异常过滤器和 request ID；成功与异常响应形状不一致。
8. 两套前端重复维护鉴权、错误处理和 API 类型，令牌键分别为 `zhpath_*` 与 `codenova_*`，容易产生行为漂移。
9. 同步接口与异步任务混用。生成资源、Agent 任务、题目生成和视频管线都有各自的状态与重试约定。
10. 可观测性不足。一次登录或业务失败无法从“客户端 → 请求 → 用户 → 数据库/队列任务”串成同一条链路。

## 3. 核心设计决策

### 3.1 三个概念必须分离

- `client_app`：前端产品/渠道，例如 `zhipath-web`、`codenova-web`。决定品牌、导航、功能开关和体验聚合，不是数据安全边界。
- `tenant`：学校、企业、演示组织或个人空间。决定数据隔离、配额、管理员范围和组织策略。
- `user`：全平台唯一身份。用户通过 membership 加入租户，通过 preference 保存各客户端独立偏好。

客户端传入的 `X-Client-App` 是公开信息，可用于配置、统计和兼容策略，但不能单独用于授权。授权必须由已验证 Token 中的用户、租户、角色和 scopes 决定。

### 3.2 先做模块化单体

后端仍部署为一个 NestJS 应用，但内部按领域拆分：

- Identity & Access
- Client Experience
- Learner Profile
- Goals & Learning Paths
- Learning Activity
- Assessment
- Competency & Evidence
- Content & Resources
- AI Orchestration
- Notification
- Administration
- Integration Adapters

模块之间通过公开 application service 或领域事件交互，禁止跨模块直接注入对方 repository。未来只有出现明确的独立扩缩容、故障隔离或团队所有权需求时再拆服务。

### 3.3 明确数据源职责

- MySQL：所有事务型业务事实的唯一真相源，包括身份、路径、任务、测评、证据元数据、资源元数据、Agent 运行与审计。
- Redis：缓存、分布式锁、限流、幂等短期状态、队列；不得作为最终业务数据源。
- MongoDB：过渡期只保留长对话正文或超大非结构化原文。停止保存第二份用户画像、学习进度和知识状态。
- Chroma：从 MySQL evidence/outbox 异步构建的派生向量索引，可随时重建。
- Neo4j：从能力与证据关系异步构建的派生读模型，可选且不可阻塞主业务。
- MinIO：文件和媒体二进制；MySQL 保存对象元数据、归属和访问策略。

## 4. 目标数据库设计

### 4.1 平台控制面

`client_apps`

- `id`、`client_key`、`name`、`status`
- `default_tenant_id`、`config_version`
- `allowed_origins_json`、`theme_config_json`
- 初始数据：`zhipath-web`、`codenova-web`

`client_features`

- `client_app_id`、`feature_key`、`enabled`
- `config_json`、`rollout_percent`
- 唯一键：`client_app_id + feature_key`

`tenants`

- `id`、`tenant_key`、`name`、`tenant_type`
- `status`、`plan_code`、`quota_config_json`

`tenant_memberships`

- `tenant_id`、`user_id`、`role_key`、`status`
- 唯一键：`tenant_id + user_id`

`user_client_preferences`

- `user_id`、`client_app_id`、`tenant_id`
- `onboarding_state`、`locale`、`preference_json`
- 唯一键：`user_id + client_app_id + tenant_id`

### 4.2 身份与权限

`users`

- 保留全局身份字段；删除表名中的 `_v3`。
- `username` 和规范化邮箱使用唯一约束。
- `password_hash` 与资料字段分开命名，明确不可返回。
- 使用 `disabled_at` / `deleted_at`，不再用模糊的 `status=0/1/2`。

`roles`、`permissions`、`role_permissions`

- 替代用户表上只能二选一的 `admin/student` enum。
- 管理员权限绑定 membership，不再默认拥有所有租户数据。

`refresh_tokens` / `sessions`

- 访问令牌短时有效；刷新令牌可撤销、可审计。
- Token 至少包含 `sub`、`tenant_id`、`roles`、`scopes`、`azp/client_app`、`jti`。

### 4.3 学习核心

`learner_profiles`

- 一名用户在一个租户内一份核心画像。
- 学校、专业、年级、投入时长等稳定字段结构化。
- 项目、获奖、经历拆成 `learner_projects`、`learner_awards`、`learner_experiences`，不继续堆在 JSON。

`learning_goals`

- 将目标从计划中独立出来。
- 支持 career/course/exam/certificate/project/interest。
- 一个目标可产生多个版本的路径。

`learning_paths`

- 关联 `goal_id`，保存路径生命周期、版本和激活状态。
- 删除大而不可查询的 `path_data` 作为主结构，只保留 `snapshot_json` 用于审计快照。

`learning_path_nodes`、`learning_path_edges`

- 节点表示阶段、能力或活动；边表示先修、并行、可选。
- 支持不同前端用不同方式渲染同一条路径。

`learning_tasks`

- 只表示用户要完成的学习活动。
- 使用明确状态机：planned → ready → in_progress → completed/skipped/cancelled。
- 日期使用 `DATE`，时间使用 `DATETIME(3)`，不再混用 varchar 与 bigint 时间戳。

### 4.4 能力、测评与证据

`competencies`、`competency_relations`

- 能力名称、领域、层级和先修关系成为平台公共词表。
- 路径、题目、证据、岗位要求统一引用 `competency_id`，不再靠自由文本 `skill_name` 连接。

`user_competency_states`

- 保存当前掌握度、置信度、证据版本和计算时间。
- 当前值是派生快照，原始事实来自 attempt/evidence，不直接覆盖历史。

`assessment_definitions`、`assessment_items`

- 定义测评/试卷与题目；支持题库复用和版本冻结。

`assessment_attempts`、`assessment_responses`、`assessment_scores`

- 一次作答、一题回答、分维度得分分别建模。
- 补弱、速测、考试、AI 测评共享同一评测内核，通过 `assessment_kind` 区分。

`evidence_items`、`evidence_links`

- evidence item 保存原始证据、哈希、来源、可信度和可见性。
- link 将证据关联到能力、目标、任务、测评或资源，替代 `source_type + source_id` 的弱多态关联。
- 向量状态放在 `evidence_index_jobs`，不要污染证据本身的业务状态。

### 4.5 AI、任务与产物

必须明确区分三类任务：

- `learning_tasks`：用户学习日程。
- `agent_runs` / `agent_run_steps`：智能体编排及执行过程。
- `async_jobs`：视频、题目批量生成、索引等基础设施后台作业。

`generated_artifacts`

- 统一讲义、题集、代码练习、报告、视频、路径建议等产物。
- `artifact_type`、`schema_version`、`content_json/object_key`、`producer_run_id`、`provenance_json`。
- migration 8 已将历史 `generated_resources_v3` 回填到该表，使用 `legacy_resource_id` 幂等关联并保留失败/运行中状态。
- 产物与任务、能力、证据之间通过关系表关联，不再把 `target_entity` 全塞进 JSON。

`ai_provider_credentials`

- scope 支持 user 或 tenant；唯一键包含 scope 与 provider。
- API Key 使用 KMS/主密钥 envelope encryption，记录 `key_version`。
- `base_url` 必须经过 allowlist/SSRF 校验。

`ai_usage_ledger`

- 记录 client、tenant、user、provider、model、tokens、latency、cost、request_id。
- 为不同定制前端做成本归因，而不是修改核心业务表。

### 4.6 一致性与基础设施表

`outbox_events`

- 业务事务和事件同库提交。
- 异步更新 Chroma、Neo4j、通知和分析数据，避免跨库双写丢失。

`idempotency_keys`

- 生成类 POST 接受 `Idempotency-Key`，防止前端重试产生重复任务和费用。

`audit_logs`

- 记录 tenant、client、actor、action、resource、request_id、结果和时间。

### 4.7 数据库约定

- 所有业务表都有明确外键；高吞吐日志表可按审慎评估例外。
- 内部主键可继续 BIGINT，新增稳定 `public_id`（ULID/UUIDv7）暴露给 API。
- 时间统一 `DATETIME(3)` UTC；API 使用 ISO 8601。
- 软删除统一 `deleted_at`；业务状态使用有名称的状态列。
- JSON 只用于低频扩展和不可预知的供应商原始响应，不能替代核心关系。
- 每张多租户业务表显式包含 `tenant_id`，常用索引以 `tenant_id` 开头。
- 所有唯一约束考虑租户边界，例如 `tenant_id + external_id`。
- 使用 TypeORM migrations 作为唯一 schema 变更源；`database-schema.sql` 只作为自动生成的发布产物。

## 5. 目标后端结构

建议目录：

```text
backend-ts/src/
  platform/
    identity/
    tenancy/
    client-experience/
    observability/
  domains/
    learner-profile/
    learning-goal/
    learning-path/
    learning-activity/
    assessment/
    competency/
    evidence/
    content-resource/
    ai-orchestration/
  integrations/
    llm/
    vector-store/
    graph-store/
    object-storage/
    search/
  api/
    v1/
    compatibility/
  shared/
    contracts/
    persistence/
    events/
```

每个领域内部使用 `domain`、`application`、`infrastructure`、`presentation` 四层。控制器只做认证上下文、DTO 校验和调用 use case，不直接编排多个 repository。

## 6. API 与路由升级

### 6.1 统一入口

```text
/api/v1/auth/*                 公共身份
/api/v1/me/*                   当前用户与当前上下文
/api/v1/learning-goals/*       学习目标
/api/v1/learning-paths/*       学习路径
/api/v1/learning-tasks/*       学习任务
/api/v1/assessments/*          测评定义与作答
/api/v1/competencies/*         能力词表与用户能力
/api/v1/evidence/*             证据
/api/v1/resources/*            内容与生成产物
/api/v1/agent-runs/*           Agent 编排
/api/v1/jobs/*                 异步后台作业
/api/v1/admin/*                管理能力
/api/v1/experience/*           前端体验聚合/BFF
```

### 6.2 关键路由调整

- `/api/admin/auth/login` → `/api/v1/auth/login`
- `/api/admin/auth/register` → `/api/v1/auth/register`
- `/api/admin/auth/me` → `/api/v1/me`
- `/api/user/profile` → `/api/v1/me/learner-profile`
- `/api/user/dashboard` 与 `/api/user/today-actions` → `/api/v1/experience/home`
- `/api/user/learning-paths` → `/api/v1/learning-paths`
- `/api/user/progress/*` → learning activity commands 与 competency query 分离
- `/api/user/agent-office/tasks` → `/api/v1/agent-runs`
- `/api/user/question-generation/tasks` → `/api/v1/jobs` + assessment resource
- `/api/user/generated-resources` → `/api/v1/resources`

旧 `/api/user/*` 和 `/api/admin/auth/*` 暂时由 compatibility controllers 转发到新 application services，并返回 `Deprecation`、`Sunset`、`Link` 响应头。

### 6.3 客户端上下文

前端请求携带：

```text
X-Client-App: zhipath-web | codenova-web
X-Client-Version: <build version>
X-Request-Id: <uuid，可由网关补齐>
Authorization: Bearer <access token>
```

登录接口也接收 client context；Token 的 `azp` 记录签发客户端。后端根据 host/origin 与 client registry 校验允许组合。客户端标识只影响体验配置、开关和统计，权限仍从 tenant membership 计算。

### 6.4 体验聚合层

两套前端通常需要不同首页数据，但不能在核心模块里出现 `if (client === 'codenova')`。

使用 `ExperienceComposer`：

- `GET /api/v1/experience/bootstrap`：用户、租户、客户端配置、权限、功能开关。
- `GET /api/v1/experience/home`：按客户端 manifest 组合首页所需 read models。
- `GET /api/v1/experience/navigation`：返回允许的模块和路由元数据。

体验层只组合读模型，不拥有核心业务事实。写操作始终调用领域 API。

### 6.5 契约标准

成功响应：

```json
{
  "data": {},
  "meta": { "requestId": "...", "client": "zhipath-web" }
}
```

错误响应：

```json
{
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "用户名或密码错误",
    "details": [],
    "requestId": "..."
  }
}
```

- HTTP 状态码表达协议结果，不再出现 HTTP 201 + body code 200 的混搭。
- 所有入参使用 class-validator DTO；禁止新控制器使用 `any`。
- OpenAPI 是契约唯一来源，CI 检查 breaking changes。
- 由 OpenAPI 生成 `@zhipath/api-client` 和类型，两套前端不再手写重复接口。
- 分页统一 cursor 或 `{items, pageInfo}`，不混用顶层 total 与 data 数组。

### 6.6 异步作业协议

所有耗时生成接口统一：

1. POST 创建命令，返回 HTTP 202 与 `jobId`。
2. `GET /api/v1/jobs/{id}` 查询状态。
3. SSE `/api/v1/events` 推送进度，事件带 `jobId`、`requestId`、`clientApp`。
4. 失败返回稳定 error code、是否可重试和 retryAfter。
5. 使用 Idempotency-Key 防重复计费。

## 7. 两套前端的目标组织方式

建议升级为 npm workspaces/pnpm workspace：

```text
apps/
  zhipath-web/       智途体验与品牌
  codenova-web/      CodeNova 体验与品牌
packages/
  api-client/        OpenAPI 生成，不手改
  auth-react/        登录、刷新、权限、客户端上下文
  domain-types/      前端可见的稳定领域类型
  query-core/        缓存、错误映射、重试策略
  ui-foundation/     无品牌基础组件
  test-fixtures/     契约与端到端测试数据
```

共享边界：

- 必须共享：API client、鉴权、错误模型、请求追踪、基础领域类型。
- 可以共享：无品牌表单、可访问性组件、加载/错误态。
- 不强制共享：页面、导航、品牌组件、主题、文案、领域展示方式。

每个应用固定配置 `VITE_CLIENT_APP`，构建产物带版本号。不同客户端的 sessionStorage key 保持隔离，但 Token 生命周期与刷新逻辑来自同一个包。

## 8. 现有数据迁移策略

采用 expand → backfill → dual-read → cutover → contract，不直接重命名生产表。

### 8.1 第一批基础映射

- `users_v3` → `users`
- `students_v3` → `learner_profiles` + projects/awards/experiences 子表
- `learning_plans_v3.path_data` → `learning_paths` + nodes + edges
- `learning_tasks_v3` → `learning_tasks`
- `agent_tasks_v3` → `agent_runs` + `agent_run_steps`
- `generated_resources_v3` → `generated_artifacts`
- `evaluation_*_v3`、`exam_*_v3` → assessment 聚合
- `evidence_chunks` → `evidence_items` + `evidence_links`
- `user_skills_v3`、`skill_snapshots*` → competency states/history
- `user_llm_config` → `ai_provider_credentials`

### 8.2 双库数据收敛

- `user_profiles` Mongo 数据回填到 MySQL 规范表；完成后 Mongo 该 collection 只读并最终停用。
- `knowledge_base` Mongo 原文迁移到 MinIO/MySQL；知识状态与元数据统一进 MySQL。
- `chat_sessions` 可暂留 Mongo，但增加显式 schemaVersion、tenantId、clientApp、索引和 repository 封装。
- 所有新写入先落 MySQL + outbox；派生存储消费者异步同步。

### 8.3 迁移安全要求

- 每个 migration 有 up/down 或明确不可逆说明、数据校验 SQL 和预计锁表时间。
- 回填任务可断点、幂等、限速；按主键区间执行。
- 切换前做双读比对，不做长期双写。
- 旧路由下线至少跨两个发布周期，并统计每个 client 的旧路由调用量。

## 9. 测试与质量门禁

### 9.1 后端

- 每个 use case 有单元测试，repository 用 contract tests。
- OpenAPI schema snapshot 与 breaking-change 检查。
- Testcontainers 启动 MySQL/Redis/Mongo，验证真实 migration 和查询。
- 关键状态机做属性测试：学习任务、Agent run、assessment attempt。
- 多租户隔离测试必须覆盖跨租户 ID 猜测、管理员范围、导出和异步任务。

### 9.2 前端

- 两套应用共享 API mock server，由同一 OpenAPI 生成 mock。
- Vitest/Testing Library 覆盖登录、权限、错误态和关键表单。
- Playwright 项目分别运行 `zhipath-web` 与 `codenova-web`。
- 每套至少覆盖：登录 → bootstrap → 首页 → 一次学习/测评 → 退出。

### 9.3 CI 门禁

- migration 从空库执行成功，并能从当前快照升级成功。
- 两套前端 build、typecheck、unit、e2e 全通过。
- 新路由必须有 DTO、OpenAPI、权限声明、审计分类和测试。
- 禁止新增跨领域 repository 注入、无租户查询和裸 `Record<string, any>` 控制器输入。

## 10. 安全与可观测性

- CORS 从 `*` 改为 `client_apps.allowed_origins` 白名单；带 credentials 时禁止通配符。
- JWT secret 与 LLM encryption secret 启动时强校验，不能回落到源码默认值。
- request ID 贯穿 HTTP、日志、队列、Agent run、LLM usage 与前端错误页。
- 日志统一结构化字段：clientApp、clientVersion、tenantId、userId、route、latency、status、errorCode。
- 指标至少包含每客户端登录成功率、API 5xx、p95、任务失败率、队列积压、LLM 成本、向量索引延迟。
- 用户自定义 base URL 做协议、DNS/IP、重定向和私网地址检查，防止 SSRF。
- API Key 不进入日志、任务 payload、raw_request 或前端响应。

## 11. 分阶段实施路线

截至 2026-09-09：Phase 0–2 的底座已落地并通过快照重放，租户作用域已下沉至关键关系子表；Phase 3 已完成规范学习/测评/证据核心及兼容双写；Phase 4 已完成统一作业、协作取消、终态 SSE 和 AI 用量归因，但派生库消费者仍待完成；Phase 5 已完成鉴权/bootstrap、共享客户端契约测试、学习路径主链路迁移与可重复双客户端浏览器烟测，深层页面仍待按返回语义逐页迁移。

### Phase 0：冻结混乱扩散（2–3 天）

- 建 API 清单、表清单和两套前端 smoke baseline。
- 新功能暂不再新增 `/api/user/*` 路由。
- 修复智途页面标题，明确两套应用名称和端口。
- 加 request ID、全局异常过滤器、结构化日志。

验收：任意登录失败能用 request ID 在日志中定位；两套前端 smoke 可重复运行。

### Phase 1：统一契约与客户端上下文（1 周）

- 增加 `client_apps`、`client_features`。
- 引入 `/api/v1/auth`、`/api/v1/me`、`experience/bootstrap`。
- 引入 OpenAPI、DTO 和生成 API client。
- 两套前端先迁移鉴权与 bootstrap，不动深层页面。

验收：两套前端使用同一 auth package 与生成 client；后端日志可区分客户端。

### Phase 2：租户与数据库治理（2 周）

- 建 tenants、memberships、roles/permissions。
- 建 TypeORM migrations 基线，停止手工快照作为升级手段。
- 新表采用 FK、DATETIME(3)、deleted_at 和 tenant-first indexes。
- 建 outbox、idempotency、audit 基础表。

验收：跨租户访问自动化测试全部拒绝；当前快照可自动升级且行数/校验和一致。

### Phase 3：核心领域重构（3–4 周）

- 先拆 learning goal/path/task，再拆 assessment/competency/evidence。
- 将 Mongo 用户画像与学习进度收敛到 MySQL。
- 建 compatibility controllers，旧前端可继续使用旧路由。

验收：核心写入只落一个真相源；旧、新路由对同一用户返回等价业务结果。

### Phase 4：AI 与异步任务统一（2 周）

- 合并 Agent、题目、视频、索引的 job/run 状态协议。
- 统一产物、成本账本、重试和 SSE 事件。
- Chroma/Neo4j 改为 outbox 派生消费者。

验收：重复请求不重复扣费；派生存储宕机不影响核心写入，并可恢复重放。

### Phase 5：前端独立迁移与旧契约下线（2–3 周）

- 智途与 CodeNova 分别迁移剩余页面。
- 以真实调用量决定旧路由下线，不按代码感觉删除。
- 完成 workspace 整理、独立部署与版本矩阵。

验收：两套前端可以独立发布；后端无客户端品牌条件分支；旧路由调用归零。

整体建议投入约 8–12 周，可按 Phase 独立交付价值，不需要大爆炸重写。

## 12. 优先级与首批 PR

建议先做以下 6 个小 PR，而不是直接重写数据库：

1. `chore/architecture-baseline`：路由/表/API 调用清单与 smoke tests。
2. `feat/request-context`：request ID、client context、统一日志、全局异常过滤。
3. `feat/api-v1-auth`：新 auth/me 路由、DTO、OpenAPI，旧路由兼容转发。
4. `feat/client-registry`：client_apps/features + bootstrap endpoint。
5. `feat/generated-api-client`：生成 SDK，两套前端迁移登录链路。
6. `feat/migration-baseline`：TypeORM migrations 基线、空库/快照升级 CI。

首批 PR 完成后，再决定具体 v4 表结构和领域切分；此时已有契约测试与观测保护，后续改造风险显著降低。

## 13. 最终验收标准

- 一个后端、一套核心数据库事实，可稳定服务至少三套客户端。
- 新客户端接入不修改核心领域服务，只注册配置并消费 SDK。
- 智途与 CodeNova 的品牌、导航和页面可以不同，核心业务结果一致。
- 100% 活跃 API 有 OpenAPI、DTO、权限声明和稳定错误码。
- 100% 多租户表有 tenant 约束与隔离测试。
- 关键业务表无孤儿数据，核心关系具备 FK 或经批准的明确例外。
- MySQL 是核心事实唯一真相源；Mongo、Chroma、Neo4j 均可解释、可重建或明确限定职责。
- 两套前端独立构建、发布、回滚，且共享鉴权/API client 不漂移。
- 登录与关键业务故障能在 5 分钟内通过 request ID 定位。

## 14. 明确不做

- 不把两套前端强行合并成同一套页面。
- 不立即拆微服务或引入 Kubernetes。
- 不在第一阶段一次性重命名/替换全部 39 张表。
- 不让 `X-Client-App` 成为安全授权依据。
- 不长期维护新旧表双写。
- 不再把完整数据库 dump 当作日常迁移工具。

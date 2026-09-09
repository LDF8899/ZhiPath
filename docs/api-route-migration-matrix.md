# 双前端 API 路由迁移矩阵

这份矩阵是实施清单，不是第三套路由。`frontend/`（智途 ZhiPath）和
`codenovafrontend/`（CodeNova）是两个并列客户端，共享同一个
`backend-ts/` 和同一个 `zhipath` 核心数据库。

## 客户端边界

| 客户端 | 目录 | 开发端口 | `X-Client-App` | 浏览器存储前缀 |
| --- | --- | ---: | --- | --- |
| 智途 ZhiPath | `frontend/` | 5173 | `zhipath-web` | `zhpath_*` |
| CodeNova | `codenovafrontend/` | 5180 | `codenova-web` | `codenova_*` |

页面可以有不同的导航、主题和文案，但业务事实只由后端领域服务维护。客户端标识只参与体验配置和观测，不能参与租户授权判断。

## 路由分层

| 层 | 路由前缀 | 责任 | 新功能是否允许使用 |
| --- | --- | --- | --- |
| 平台契约 | `/api/v1/*` | 稳定 DTO、权限、审计、幂等和 OpenAPI 契约 | 是 |
| 体验聚合 | `/api/v1/experience/*` | 按客户端组合首页、导航和启动配置，只读 | 是（读模型） |
| 兼容层 | `/api/user/*`、`/api/admin/auth/*` | 旧页面过渡，转发到同一 application service | 只允许修 bug，不得新增 |
| 基础设施 | `/api/v1/jobs/*`、`/api/v1/events` | 异步作业、进度和终态事件 | 是 |

## 页面迁移顺序

| 业务页面 | 智途入口 | CodeNova 入口 | 当前调用 | 目标调用 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 登录/注册/租户切换 | `/login`、`/register` | `/login`、`/register` | 各自页面 + 旧兼容路由 | `/api/v1/auth/*`、`/api/v1/me`、`/api/v1/me/tenants`、`/api/v1/auth/switch-tenant` | 登录、刷新、跨客户端令牌隔离与租户切换已完成 |
| 启动配置/导航 | 应用启动 | 应用启动 | 无统一配置 | `/api/v1/experience/bootstrap`、`navigation` | 已完成 |
| 学习领域/起步路线 | 计划创建、Onboarding | 路径创建、Onboarding | `/api/user/learning-domains`、`onboarding/status` | `/api/v1/learning-domains`、`/api/v1/profile/onboarding/status` | v1 目录与状态读取已完成，旧接口仅作兼容回退 |
| 首页/今日 | `/user/home` | `/today` | `/api/user/dashboard`、`today-actions`、`learning-tasks/today` | `/api/v1/experience/home`，任务投影走 `/api/v1/learning-tasks/today`，写操作走领域 API | 聚合层与今日任务 v1 已作为主调用，旧任务入口仅作兼容回退 |
| 用户画像/Onboarding | `/user/profile`、`/user/onboarding` | `/profile`、`/onboarding` | profile/onboarding 旧入口 | `/api/v1/profile*`、`/api/v1/me`、体验偏好 | 画像读写与 onboarding 提交均优先切到 v1；旧入口仅作失败回退，偏好模型继续补齐 |
| 岗位匹配 | `/user/jobs/*` | `/jobs/*` | `/user/match*` | `/api/v1/match/*` | best/all/recalculate/detail/trend 已提供 v1 适配器，两套客户端已优先调用 |
| 学习会话 | `/user/sessions/*` | 由工作台按需使用 | `/user/sessions/*` | `/api/v1/sessions/*` | start/end/progress/history/stats/diff/rollback 已提供统一契约 |
| 聊天会话 | `/user/chat`、`/user/chat-sessions` | `/coach` | `/user/chat*` | `/api/v1/chat`、`/api/v1/chat/sessions/*` | CodeNova 已优先迁移；智途页面继续接入同一客户端适配层 |
| 简历 | `/user/resumes/*` | `/profile` 相关能力 | `/user/resumes/*` | `/api/v1/resumes/*` | JSON 读写、生成/分支/删除和 PDF 下载均已提供 v1，旧端点仅作兼容回退 |
| 题目生成编辑 | `/user/question-generation/*` | `/question-generator` | `/user/question-generation/*` | `/api/v1/question-generation/*` | 全量 v1 适配器已上线，旧接口仅作回退 |
| 学习路径 | `/user/learning` | `/path` | `/api/user/learning-paths/*` | `/api/v1/learning-paths/*` | 列表读、UUID 详情、状态写、节点写和新增路径已迁移；页面只在 v1 不可用时回退旧路由，merge/旧分支操作保留兼容 |
| Git 学习分支 | `/user/git/*` | 由路径/技能页使用 | `/api/user/git/*` | `/api/v1/git/*` | 分支、提交、快照、比较、回滚和合并均已提供 v1 适配器；写入口要求 learning:write 与幂等键 |
| 学习活动 | `/user/learning/*` | `/skill/*` | 多个 progress/task 路由 | `/api/v1/learning-activities/*`、`/api/v1/progress/*` | 后端规范接口已完成；学习闭环写入统一经过 v1 幂等门禁并带租户上下文，页面仍需继续将少量数字历史 ID 写操作替换为活动 UUID |
| 技能画像/证据链 | `/user/skills/*` | `/skills/*` | 各自读取 user_skills_v3 | `/api/v1/me/skills/*` | 技能列表、统计、有效技能和单技能证据均已提供 v1，旧接口仅作回退 |
| 站内通知 | 全局通知入口 | 工作台通知入口 | `/api/user/notifications/*` | `/api/v1/notifications/*` | v1 读、已读和批量已读已上线；规范 `notifications` 表已带 tenant_id，`notifications_v3_legacy` 仅作回滚/审计 |
| 测评/考试 | `/user/exams` | `/exams` | exams/evaluations/quick-test 多套契约 | `/api/v1/assessments/*` | 评测历史、考试开始/提交、速测题目读取与提交均优先走 v1；题库/考试记录已增加 tenant_id，旧路由仅作回退 |
| 题库/组卷 | `/user/question-bank` | `/question-generator` 相关能力 | `/api/user/question-bank/*` | `/api/v1/question-bank/*` | v1 列表与组卷已上线，题目按公共目录/当前租户过滤；旧入口保留兼容 |
| 资讯目录 | `/user/news/*` | 知识工作台资讯能力 | `/api/user/news/*` | `/api/v1/news/*` | v1 列表与详情已上线，公共资讯 tenant_id=NULL，租户资讯按当前租户过滤 |
| 证据/知识 | `/user/knowledge`、`/user/evidence` | `/knowledge`、`/remediation` | evidence/knowledge 双写 | `/api/v1/evidence/*` + 派生索引 | 统一证据读写已上线；知识索引继续兼容迁移 |
| 技能知识详情 | `/user/learning-paths/knowledge/:skill` | `/skill/:skill` | 旧学习路径知识接口 | `/api/v1/knowledge/:skill` | 两套前端已优先切换，仍保留旧接口回退 |
| 知识资产目录 | 知识管理/资源页 | `/knowledge` | 各页面自行扫描 Mongo | `/api/v1/knowledge` | MySQL `knowledge_assets` 返回租户可见已发布元数据；正文仍按技能从 Mongo 按需读取 |
| Agent/资源 | `/user/agent-office`、`question-generator` | `/agents`、`resources` | agent-office/question-generation/video 各自状态 | `/api/v1/jobs/*`、`/api/v1/agent-office/*`、`/api/v1/resources/*` | 10 类 Agent 生成、动画/图表/视频/数字人均优先走统一 jobs 并等待终态；办公室任务中心已优先读取/取消/重试/历史/员工直接使用，并支持 urgent、skip、reorder、DELETE 软删除；任务优先级和顺序持久化于 `async_jobs`，题目编辑页仍保留兼容读写 |
| 用户 AI 配置 | 设置页（智途暂无独立页面） | 设置页 | `/api/user/llm/*` | `/api/v1/user-llm/*` | CodeNova 已优先使用 v1，API Key 仍只返回脱敏视图，旧配置路由仅作回退 |
| 实时事件流 | 全局任务/资源更新 | 工作台任务/资源更新 | `/api/user/events/stream` | `/api/v1/events` | v1 租户隔离流已上线，两套前端已切换；旧流保留兼容 |
| 退出/刷新 | 任意受保护页面 | 任意受保护页面 | 各自拦截器 | 共享 `@zhipath/api-client` | 已完成 |

## 每个页面的迁移验收

1. 先在 API Client 增加类型化方法，禁止页面直接拼接 `/api` URL。
2. 保留兼容路由，确认新旧响应的业务语义一致；数字历史 ID 不得当作规范 UUID 使用。
   `/v1/learning-paths` 当前仅在迁移期返回 `legacyPlanId` 兼容引用，新增业务必须使用 `id`（UUID）。
3. GET 页面增加 loading/error/empty 三态；写操作必须携带 `Idempotency-Key`。
4. 浏览器烟测同时以两个客户端运行，检查品牌、`X-Client-App`、`meta.requestId` 和权限。
5. 统计旧路由调用量连续两个发布周期为零后，才删除兼容控制器。
   当前统计由 `api_route_usage_daily` 提供，平台管理员可查询
   `/api/v1/admin/client-apps/legacy-route-usage?days=30&clientApp=...`。

兼容回退门禁：前端只有在 v1 返回 404/405（明确表示尚未部署该规范路由）时才允许调用 `/api/user/*`；401、403、409、429、5xx 和超时必须原样展示，尤其是异步写操作不能因为网络抖动而重复提交。

## 建议的发布批次

- **批次 A：** 学习路径列表/详情和首页只读聚合；风险低、可快速验证租户过滤。
- **批次 B：** 学习活动状态、测评开始/提交；重点验证状态机、幂等和重复提交。（已完成首轮）
- **批次 C：** 证据、补弱、知识索引；重点验证 MySQL 真相源与 outbox 重放。（补弱 v1 入口已完成，索引收敛进行中）
- **批次 D：** Agent、题目、视频；统一 202 + `jobId` + SSE，最后再下线旧入口。

运维索引批次：`npm run rebuild:platform-indexes` 从 MySQL 重建 Chroma/Neo4j，
`npm run check:platform-consistency` 生成一致性报告。Chroma/Neo4j 只作为可重建派生层，
不可用时状态为 degraded，不能阻塞登录、学习路径和测评主链路。

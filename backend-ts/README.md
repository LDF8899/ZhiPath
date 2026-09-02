# ZhiPath Backend

ZhiPath 后端是 NestJS + TypeScript 服务，提供认证、学生画像、学习路径、岗位匹配、考试测评、资讯、智能体办公室、资源台账和管理后台 API。

## 技术栈

- NestJS 11
- TypeScript
- TypeORM + MySQL
- Mongoose + MongoDB
- Redis / ioredis
- BullMQ
- JWT / Passport
- SSE
- OpenAI-compatible SDK
- Search Stack / SearXNG
- 高德 Web Service

## 安装

```powershell
cd backend-ts
npm install
```

## 环境变量

后端读取 `backend-ts/.env`。

```env
APP_HOST=0.0.0.0
APP_PORT=3000

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3307
MYSQL_USER=root
MYSQL_PASSWORD=root123
MYSQL_DATABASE=zhipath

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

MONGODB_URL=mongodb://root:root@127.0.0.1:27017/?authSource=admin
MONGODB_DATABASE=zhipath

LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_FLASH_MODEL=deepseek-v4-flash
LLM_GEN_MODEL=deepseek-v4-flash-vision-exp
VISION_MODEL=deepseek-v4-flash-vision-exp

SEARCH_STACK_URL=http://127.0.0.1:17080
SEARCH_STACK_API_KEY=your_search_stack_key

SEARXNG_URL=http://127.0.0.1:8080
NEWS_SEARXNG_URL=http://127.0.0.1:8080
NEWS_SEARXNG_ENGINES=bing,baidu

AMAP_WEB_SERVICE_KEY=your_amap_web_service_key
VIDEO_OUTPUT_DIR=D:/tmp/zhipath/video
```

LLM provider 可选：

- `ollama`：使用本地 `OLLAMA_BASE_URL` 和 `OLLAMA_MODEL`
- `deepseek`：使用 DeepSeek OpenAI-compatible API
- `mimo`：使用 MiMo API
- 其它值：按 OpenAI-compatible 配置读取 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`

## 启动

开发模式：

```powershell
npm run start:dev
```

生产构建：

```powershell
npm run build
npm run start:prod
```

默认监听：

- `http://localhost:3000`
- API 前缀：`/api`

## 中间件

推荐从仓库根目录启动 Docker Compose：

```powershell
docker compose -f deploy/docker-compose.yml -p middleware --profile core up -d
```

完整服务：

```powershell
docker compose -f deploy/docker-compose.yml -p middleware --profile core --profile optional up -d
```

核心依赖：

- MySQL：结构化业务数据
- Redis：缓存、队列、活跃状态
- MongoDB：画像、聊天历史、知识库内容
- RabbitMQ：可选异步中间件
- Neo4j/Chroma/MinIO/SearXNG：按功能启用

## 脚本

```powershell
npm run build
npm run test
npm run test:e2e
npm run lint
```

迁移脚本：

```powershell
npm run migrate:generated-resources
npm run migrate:git-v2
npm run migrate:learning-portfolio
npm run migrate:evaluation-spine
```

危险操作，仅确认清空旧学习轨迹时使用：

```powershell
npm run reset:git-v2-data -- --confirm-clear-learning-history
```

## 主要模块

| 模块 | 说明 |
| --- | --- |
| `auth` | 登录、注册、JWT 鉴权 |
| `student` | 学生信息、onboarding |
| `dashboard` | 学生首页数据 |
| `chat` | AI 助教对话 |
| `agent-office` | 智能体办公室、任务、员工、资源同步 |
| `agents` | 讲义、阅读、代码、路径、测评、出题等 Agent 服务 |
| `jobs` | 岗位搜索、详情、匹配、投递、技能导入 |
| `match` | 岗位匹配计算 |
| `learning-paths` | 学习路径 |
| `git-learning` | Git 式学习记录 |
| `evaluation` | 测评沉淀和能力影响 |
| `quick-test` | 快速测试 |
| `exams` | 考试 |
| `progress` | 学习进度 |
| `knowledge` | 知识库 |
| `resume` | 简历 |
| `github` | GitHub 项目导入 |
| `news` | 资讯 |
| `events` | SSE 事件流 |
| `queue` | BullMQ 队列 |
| `admin` | 管理后台 API |

## 关键接口

认证：

| 方法 | 路径 |
| --- | --- |
| `POST` | `/api/auth/login` |
| `POST` | `/api/auth/register` |

岗位：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/user/jobs` | 支持 `searchMode=local|hybrid|online` |
| `GET` | `/api/user/jobs/:jobId` | 岗位详情 |
| `GET` | `/api/user/jobs/:jobId/company-context` | 企业介绍和地图上下文 |
| `GET` | `/api/user/jobs/:jobId/match` | 岗位匹配分析 |
| `POST` | `/api/user/jobs/:jobId/apply` | 投递 |
| `POST` | `/api/user/jobs/:jobId/import-skills` | 导入缺失技能 |

智能体办公室：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/user/agent-office/profiles` | 员工配置，会清理无任务占用工位 |
| `POST` | `/api/user/agent-office/profiles` | 招募员工 |
| `PUT` | `/api/user/agent-office/profiles/:profileId` | 更新员工 |
| `POST` | `/api/user/agent-office/profiles/:profileId/use` | 直接使用某个员工 |
| `GET` | `/api/user/agent-office/tasks` | 任务队列 |
| `POST` | `/api/user/agent-office/tasks` | 创建任务 |
| `POST` | `/api/user/agent-office/tasks/:taskId/cancel` | 取消任务并释放工位 |
| `GET` | `/api/user/agent-office/history` | 最近完成任务 |

事件流：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/user/events/stream` | Agent 状态、进度、资源 ready 等 SSE |

## 岗位搜索实现

`JobsService.searchJobs` 当前流程：

1. `local` 或 `hybrid` 模式下，从 MySQL 多字段搜索岗位。
2. 有关键词且模式为 `hybrid`，或明确 `online/includeOnline` 时，调用 `JobSearchService.search`。
3. `JobSearchService` 先走 Search Stack；搜索结果再由 LLM 提取结构化岗位。
4. Search Stack 不可用或结果不足时，使用 LLM 生成候选岗位兜底。
5. 联网岗位按 `关键词 + 用户技能` 做 15 分钟内存缓存。
6. 本地和联网结果按公司、标题、地点去重。
7. 最终按匹配度排序返回。

注意：联网岗位不是平台可控岗位，前端需要显示来源和外链，AI 兜底结果必须标识为参考候选。

## 智能体状态实现

智能体员工状态以任务状态为准：

- 创建任务或直接使用员工后，员工进入 busy。
- 任务执行过程中通过 SSE 推送 working/progress。
- 任务成功、失败或取消后，如果没有其它运行中任务，则释放工位并回到 idle。
- 读取 profiles 时会根据当前 pending/running 任务清理历史残留工位。

## 开发注意事项

- TypeORM `synchronize` 为 `false`，表结构变更必须走 SQL 或迁移脚本。
- MySQL 默认端口是宿主机 `3307`，不是 `3306`。
- Redis/MongoDB 连接失败时部分功能会降级，但核心 API 仍应尽量启动。
- 长耗时 AI 任务不要阻塞请求，优先进入任务队列或异步执行。
- 生成资源要同步到资源台账，避免只存在任务返回值或前端内存中。
- 不要提交真实密钥。

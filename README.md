# ZhiPath

ZhiPath 是一个面向软件工程学习与就业准备的 AI 学习平台。它不只是生成课程内容，而是把学习动作、能力画像、评价记录、岗位匹配、智能体资源生产和资讯推送串成一条可追踪的成长链路。

当前主线可以概括为：

```text
学习动作 -> Git 学习 commit -> 技能快照/雷达变化 -> 评价沉淀 -> 岗位匹配更新 -> 资源与资讯持续补给
```

## 当前能力

| 模块 | 当前状态 | 关键能力 |
| --- | --- | --- |
| AI 助教聊天 | 可用，已接资源生产链路 | 对话触发讲义、阅读、代码、考试、评估、岗位等智能体动作 |
| 智能体办公室 | 可用，已接资源台账 | 任务、资源、智能体状态可以从侧栏/办公室同步查看 |
| Git 学习系统 v2 | 已升级 | 每次学习动作生成 commit、snapshot、delta、雷达变化 |
| 评价系统 | 已升级 | progress、quick test、exam、AI assess 统一沉淀 evaluation attempt/result/impact |
| 画像雷达图 | 已升级 | 从“技能前 8 展示”升级为固定能力维度雷达 |
| 进度页 | 已重构 | 分支、提交时间线、快照、对比、合并、回滚 |
| 岗位模块 | 已升级 | 本地多字段搜索 + 联网岗位搜索 + 匹配度排序 |
| AI 资讯推送 | 已升级 | SearXNG/RSS 抓取 AI 新闻，DeepSeek 摘要和标签入库 |
| 学习资源生成 | 可用 | 生成资源独立入库，切页后可从资源台账恢复 |
| 后台管理 | 可用 | 用户、企业、岗位、考试、资讯等基础管理 |

## 2026-07-18 更新摘要

今天完成了几条核心链路的修复和升级：

- `generated_resources_v3` 资源台账接入聊天和智能体办公室，资源生成不再只依赖当前聊天页面内存状态。
- Git 学习系统 v2 落地：新增 branch、commit、snapshot、delta、radar、ability metrics、branch compare、merge、rollback。
- 评价系统主线落地：学习动作、速测、考试、AI 评估都沉淀统一评价记录，并和 Git commit 关联。
- 岗位搜索升级为混合搜索：本地岗位支持标题、公司、城市、薪资、JD、必备技能、加分技能搜索；有关键词时可合并联网岗位结果。
- AI 资讯推送升级：支持 RSS/feed + SearXNG 抓取，AI 领域过滤，DeepSeek 摘要和标签，空库自动刷新，前端手动刷新。
- SearXNG 修复：运行容器已允许 `json/rss` 输出；资讯抓取默认指定 `bing,baidu`，避免默认全引擎超时。
- Docker MySQL 中补入基础企业/岗位种子数据，保证岗位页不是空体验。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19, Vite 8, TypeScript, Zustand, React Router, Three.js, CodeMirror |
| 后端 | NestJS 11, TypeORM, JWT, SSE, BullMQ, LangGraph |
| 数据 | MySQL 8, MongoDB 7, Redis 7, Neo4j 5, Chroma, MinIO |
| AI | DeepSeek/OpenAI-compatible API, local Ollama fallback, agent services |
| 搜索 | SearXNG JSON API, RSS/feed fallback |
| 部署 | Docker Compose middleware stack |

## 目录结构

```text
ZhiPath/
├── backend-ts/                 # NestJS 后端
│   ├── src/entities/           # TypeORM 实体
│   ├── src/modules/            # 业务模块
│   ├── src/services/           # Agent、LLM、Git 学习、评价、资讯等服务
│   └── scripts/                # 数据迁移脚本
├── frontend/                   # React 前端
│   ├── src/pages/user/         # 学生端页面
│   ├── src/pages/admin/        # 管理端页面
│   ├── src/components/         # 通用组件、办公室、聊天、图表等
│   └── src/api/                # API client
├── deploy/                     # Docker Compose、SQL 迁移和部署文档
├── MD/                         # 设计文档、方案文档、项目说明
└── README.md
```

## 环境要求

- Windows + Docker Desktop
- Node.js 22+ 建议；项目当前本机环境已使用 Node 22
- npm
- 可用的 DeepSeek 或 OpenAI-compatible API key
- 可选：本地代理或外网版 SearXNG，用于 AI 新闻/联网搜索

## 启动中间件

核心服务：

```powershell
docker compose -f deploy/docker-compose.yml -p middleware --profile core up -d
```

完整服务：

```powershell
docker compose -f deploy/docker-compose.yml -p middleware --profile core --profile optional up -d
```

常用端口：

| 服务 | 端口 |
| --- | --- |
| MySQL | `3307 -> 3306` |
| Redis | `6379` |
| MongoDB | `27017` |
| RabbitMQ | `5672`, `15672` |
| Neo4j | `7474`, `7687` |
| Chroma | `8000` |
| MinIO | `9000`, `9001` |
| SearXNG | `8080` |
| RedisInsight | `5540` |

## 后端配置

后端配置文件：`backend-ts/.env`

关键配置示例：

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3307
MYSQL_USER=root
MYSQL_PASSWORD=root123
MYSQL_DATABASE=zhipath

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

MONGODB_URL=mongodb://root:root@127.0.0.1:27017/?authSource=admin
MONGODB_DATABASE=zhipath

LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_FLASH_MODEL=deepseek-v4-flash

SEARXNG_URL=http://127.0.0.1:8080
NEWS_SEARXNG_URL=http://127.0.0.1:8080
NEWS_SEARXNG_ENGINES=bing,baidu
```

说明：

- `SEARXNG_URL` 是通用联网搜索入口，岗位搜索等模块默认使用它。
- `NEWS_SEARXNG_URL` 是 AI 资讯抓取入口，建议指向“走外网代理”的 SearXNG 实例。
- 如果有两个 SearXNG 实例，国内实例可放 `SEARXNG_URL`，外网实例放 `NEWS_SEARXNG_URL`。
- 不要把真实 API key 提交到仓库。

## 安装和迁移

后端：

```powershell
cd backend-ts
npm install
npm run migrate:generated-resources
npm run migrate:git-v2
npm run migrate:evaluation-spine
```

如果确认要清空旧学习轨迹并重建 Git 学习基线：

```powershell
npm run reset:git-v2-data -- --confirm-clear-learning-history
```

前端：

```powershell
cd frontend
npm install
```

## 本地启动

后端开发模式：

```powershell
cd backend-ts
npm run start:dev
```

后端生产构建运行：

```powershell
cd backend-ts
npm run build
node dist/main.js
```

前端：

```powershell
cd frontend
npm run dev -- --host 0.0.0.0
```

默认访问：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3000`
- API 前缀：`/api`

## 验证命令

```powershell
cd backend-ts
npm run build
npm test -- --runInBand

cd ..\frontend
npm run build
```

当前验证结果：

- 后端 build：通过
- 后端 Jest：`8 passed, 30 tests passed`
- 前端 build：通过
- Vite 大 chunk 警告仍存在，属于已有打包体积提示，不影响功能

## SearXNG 注意事项

资讯和联网岗位搜索依赖 SearXNG JSON API。运行中的 SearXNG 必须允许 `json` 输出。

容器内 `/etc/searxng/settings.yml` 需要包含：

```yaml
search:
  formats:
    - html
    - json
    - rss

server:
  method: "GET"
```

如果 JSON 请求返回 403，通常是 `formats` 没有启用 `json`。

测试命令：

```powershell
curl.exe -i -A "Mozilla/5.0" "http://127.0.0.1:8080/search?q=AI%20news&format=json"
```

如果返回 `200 application/json` 但 `results` 为空，通常是上游搜索引擎超时或代理未打通。资讯模块默认使用：

```env
NEWS_SEARXNG_ENGINES=bing,baidu
```

## 主要 API

### 学习 Git 系统

| 方法 | 路径 |
| --- | --- |
| GET | `/api/user/git/branches` |
| POST | `/api/user/git/branches` |
| GET | `/api/user/git/branches/:branchId/log` |
| POST | `/api/user/git/branches/:branchId/commit` |
| GET | `/api/user/git/commits/:commitId` |
| POST | `/api/user/git/commits/:commitId/rollback` |
| GET | `/api/user/git/snapshots` |
| GET | `/api/user/git/snapshots/compare` |
| GET | `/api/user/git/branches/compare` |
| POST | `/api/user/git/branches/:branchId/merge` |

### 画像和评价

| 方法 | 路径 |
| --- | --- |
| GET | `/api/user/profile` |
| GET | `/api/user/profile/radar` |
| GET | `/api/user/profile/ability-metrics` |
| GET | `/api/user/evaluations` |
| GET | `/api/user/evaluations/:attemptId` |

### 学习动作

兼容旧接口，但内部已走 Git commit 和评价链路：

| 方法 | 路径 |
| --- | --- |
| POST | `/api/user/progress/read` |
| POST | `/api/user/progress/quiz` |
| POST | `/api/user/progress/code` |
| POST | `/api/user/progress/complete` |
| GET | `/api/user/progress/summary` |

### 岗位

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/user/jobs` | 支持 `keyword`, `level`, `searchMode=hybrid/local/online`, `includeOnline` |
| GET | `/api/user/jobs/:jobId` | 岗位详情 |
| POST | `/api/user/jobs/:jobId/apply` | 投递 |
| POST | `/api/user/jobs/:jobId/import-skills` | 导入岗位技能 |

### 资讯

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/user/news` | 资讯列表，空库时自动抓取 |
| POST | `/api/user/news/refresh` | 手动刷新 AI 资讯 |
| GET | `/api/user/news/:newsId` | 资讯详情 |
| GET | `/api/user/news/recommend` | 个性化推荐 |
| GET | `/api/user/news/trends` | 技术趋势分析 |

### 聊天和资源

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/user/chat` | AI 助教聊天 |
| GET | `/api/user/chat-sessions` | 聊天会话列表 |
| GET | `/api/user/generated-resources` | 资源台账 |
| GET | `/api/user/events/stream` | SSE 事件流 |

## 核心数据表

| 表 | 说明 |
| --- | --- |
| `generated_resources_v3` | AI 生成资源台账 |
| `learning_branches_v3` | Git 学习分支 |
| `learning_commits_v3` | 学习动作 commit |
| `skill_snapshots_v3` | 技能快照、雷达、能力指标 |
| `evaluation_attempts_v3` | 评价尝试 |
| `evaluation_results_v3` | 评价结果 |
| `evaluation_impacts_v3` | 评价对技能/雷达/匹配度的影响 |
| `job_positions_v3` | 岗位 |
| `news_v3` | AI 资讯、摘要、标签 |

## 当前开发重点

后续优先级建议：

1. 继续补齐岗位模块：岗位详情体验、投递反馈、岗位技能导入后的学习分支联动。
2. 继续补齐资讯模块：资讯去重质量、来源白名单、外网 SearXNG 独立实例配置、资讯推荐和学生画像联动。
3. 继续补齐智能体办公室：任务状态和聊天调用状态更强绑定，避免用户不知道资源在哪里生成。
4. 为 Git 学习系统和评价系统补更多端到端测试。
5. 前端做代码分包，降低 Vite 大 chunk 警告。

## 故障排查

### `/api/user/news` 没有资讯

1. 检查 `news_v3` 是否为空。
2. 检查 SearXNG JSON 是否可用：

```powershell
curl.exe -i -A "Mozilla/5.0" "http://127.0.0.1:8080/search?q=AI%20news&format=json"
```

3. 检查 `backend-ts/.env`：

```env
NEWS_SEARXNG_URL=http://127.0.0.1:8080
NEWS_SEARXNG_ENGINES=bing,baidu
```

### 岗位搜索只有本地结果

确认请求参数：

```text
searchMode=hybrid
includeOnline=true
keyword=React
```

如果在线结果为空，先测 SearXNG：

```powershell
curl.exe -A "Mozilla/5.0" "http://127.0.0.1:8080/search?q=React%20招聘&format=json&engines=bing,baidu"
```

### 资源生成切页后看不到

检查 `generated_resources_v3` 和接口：

```text
GET /api/user/generated-resources
```

资源不应只依赖聊天页面内存状态。

## 代码质量基线

提交前至少跑：

```powershell
cd backend-ts
npm run build
npm test -- --runInBand

cd ..\frontend
npm run build
```

如果修改了数据库模型，同时补充：

- SQL migration
- 脚本入口
- README 或部署文档说明


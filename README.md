# ZhiPath / 智途

ZhiPath 是面向学生学习成长与求职准备的 AI 产品。它把学习路径、技能画像、Git 式学习记录、测评、岗位匹配、简历、资讯和智能体办公室串成一条闭环：用户不是只拿到一份计划，而是能持续学习、评估、补齐能力并对齐岗位。

当前主线：

```text
个人画像 -> 岗位目标 -> 学习计划 -> 知识/练习/项目 -> 测评沉淀
        -> 技能雷达/进度变化 -> 岗位匹配更新 -> 简历与投递
        -> 智能体办公室异步生产学习资源
```

## 当前能力

| 模块 | 能力说明 |
| --- | --- |
| 登录与引导 | 支持学生/管理员角色，学生完成 onboarding 后进入学习与求职工作台。 |
| AI 助教聊天 | 基于用户画像、页面上下文和工具调用，提供学习计划、岗位推荐、资源生成、测评等入口。 |
| 智能体办公室 | 支持讲义、阅读、代码案例、路径、测评、出题、技能差距、简历、画像、资讯等 Agent；员工有忙闲状态、工位状态和任务历史。 |
| 学习路径 | 支持主线/支线计划、阶段技能、知识详情、资源沉淀和进度推进。 |
| Git 学习系统 | 用 branch、commit、snapshot、delta 记录学习动作，支撑技能雷达和进度页。 |
| 测评闭环 | 快速测试、正式考试、错题、AI 评估统一沉淀到 evaluation attempt/result/impact。 |
| 岗位搜索 | 支持本地、多字段、混合、联网搜索；按匹配度排序；联网结果带短期缓存和详情地图补充。 |
| 岗位详情 | 展示 JD、技能要求、匹配分析、技能导入、投递、企业介绍和高德地图位置。 |
| 简历与项目 | 支持个人资料、项目经历、GitHub 项目导入、简历生成与投递关联。 |
| AI 资讯 | 支持 RSS/SearXNG/Search Stack 抓取、摘要、标签和个性化推荐。 |
| 管理后台 | 支持用户、岗位、企业、投递、资讯、考试、题库、简历和系统设置管理。 |

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19, Vite 8, TypeScript 6, React Router 7, Zustand, Tailwind CSS 4, Three.js, CodeMirror, Mermaid, AMap JSAPI |
| 后端 | NestJS 11, TypeScript, TypeORM, Mongoose, JWT, SSE, BullMQ, LangGraph packages, OpenAI-compatible SDK |
| 数据与中间件 | MySQL 8, MongoDB 7, Redis 7, RabbitMQ, Neo4j, Chroma, MinIO, SearXNG |
| AI/Search | DeepSeek/OpenAI/Ollama/MiMo 兼容接口，Search Stack，SearXNG |
| 地图 | 高德 Web JS API、Web Service 地理编码与静态图 |

## 目录结构

```text
ZhiPath/
|-- backend-ts/                 # NestJS 后端
|   |-- src/entities/           # TypeORM 实体
|   |-- src/modules/            # 业务模块和 Controller
|   |-- src/services/           # Agent、LLM、搜索、学习、测评等服务
|   `-- scripts/                # 数据迁移和维护脚本
|-- frontend/                   # React 前端
|   |-- src/pages/user/         # 学生端页面
|   |-- src/pages/admin/        # 管理端页面
|   |-- src/components/         # 组件、地图、办公室、图表、聊天等
|   `-- src/api/                # API client
|-- deploy/                     # Docker Compose、SQL、部署说明
|-- MD/                         # 产品、设计、API、开发记录文档
`-- README.md
```

## 环境要求

- Windows + Docker Desktop
- Node.js 22+，npm
- MySQL/Redis/MongoDB 等中间件，推荐用 `deploy/docker-compose.yml`
- 可选但建议配置：LLM API Key、Search Stack 或 SearXNG、高德地图 Key

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

后端读取 `backend-ts/.env`。最小开发配置示例：

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

MONGODB_URL=mongodb://root:root@127.0.0.1:27017/?authSource=admin
MONGODB_DATABASE=zhipath

LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_FLASH_MODEL=deepseek-v4-flash

SEARCH_STACK_URL=http://127.0.0.1:17080
SEARCH_STACK_API_KEY=your_search_stack_key

SEARXNG_URL=http://127.0.0.1:8080
NEWS_SEARXNG_URL=http://127.0.0.1:8080
NEWS_SEARXNG_ENGINES=bing,baidu

AMAP_WEB_SERVICE_KEY=your_amap_web_service_key
```

说明：

- `LLM_PROVIDER` 支持 `ollama`、`deepseek`、`mimo` 或 OpenAI-compatible 配置。
- `SEARCH_STACK_URL` 用于联网岗位搜索等多引擎检索；不可用时会降级。
- `SEARXNG_URL`/`NEWS_SEARXNG_URL` 用于搜索和资讯抓取。
- `AMAP_WEB_SERVICE_KEY` 用于后端企业位置地理编码和静态地图。
- 不要提交真实 API Key。

## 前端配置

前端读取 `frontend/.env` 或 Vite 环境变量：

```env
VITE_AMAP_WEB_KEY=your_amap_web_js_key
VITE_AMAP_SECURITY_JS_CODE=your_amap_security_js_code
```

如果没有高德前端 Key，岗位详情仍可展示文字位置；地图交互能力会降级。

## 安装与启动

后端：

```powershell
cd backend-ts
npm install
npm run start:dev
```

前端：

```powershell
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

默认访问：

- 前端：`http://localhost:5173`，如果 5173 被占用，Vite 会自动切到 5174 等端口
- 后端：`http://localhost:3000`
- API 前缀：`/api`

## 数据迁移

按需执行：

```powershell
cd backend-ts
npm run migrate:generated-resources
npm run migrate:git-v2
npm run migrate:learning-portfolio
npm run migrate:evaluation-spine
```

仅在确认要清空旧学习轨迹并重建 Git 学习基线时执行：

```powershell
npm run reset:git-v2-data -- --confirm-clear-learning-history
```

## 核心页面

| 路由 | 说明 |
| --- | --- |
| `/` | 公开首页，包含登录/注册入口 |
| `/onboarding` | 学生初始化画像和目标 |
| `/user/home` | 学生工作台 |
| `/user/chat` | AI 助教聊天 |
| `/user/learning` | 学习路径 |
| `/user/knowledge/:skill` | 知识详情 |
| `/user/jobs` | 岗位搜索与匹配 |
| `/user/jobs/:id` | 岗位详情、地图、投递、技能导入 |
| `/user/exams` | 考试列表 |
| `/user/quick-test` | 快速测试 |
| `/user/wrong-answers` | 错题 |
| `/user/progress` | 学习进度 |
| `/user/resume` | 简历 |
| `/user/projects` | 项目经历 |
| `/user/agent-office` | 智能体办公室 |
| `/admin/*` | 管理后台 |

## 岗位搜索策略

`GET /api/user/jobs` 支持 `searchMode=local|hybrid|online`、`includeOnline`、`keyword`、`company`、`location`、`level`。

- `local`：只查 MySQL 岗位库，标题、公司、城市、薪资、JD、必备技能、加分技能多字段检索。
- `hybrid`：默认策略。有关键词时先查本地，再走联网搜索补充，并合并去重。
- `online`：只取联网候选岗位。
- 联网搜索先走 Search Stack 多引擎搜索，再由 LLM 从搜索结果摘要中提取岗位卡片；搜索不可用或有效结果不足时，降级为 LLM 根据市场常识生成候选岗位。
- 联网结果以关键词和用户技能作为缓存键，内存缓存 15 分钟，避免切页或重复查询时反复调用外部搜索。
- 最终结果会按匹配度优先排序，并保留 `searchMeta` 标识来源、命中字段和是否 AI 兜底。

## 智能体办公室状态

智能体员工有两类状态：

- 工作状态：`pending`/`running` 任务会使对应 Agent 进入忙碌，前端显示在工位工作。
- 空闲状态：任务成功、失败或取消后，后端会检查该 Agent 是否还有其它运行中任务；没有则释放工位并回到空闲。

办公室页面会在读取员工配置时清理历史残留工位：如果某类 Agent 当前没有待处理或运行中的任务，不应继续占用工位。

## 验证命令

```powershell
cd backend-ts
npm run build
npm test -- --runInBand

cd ..\frontend
npm run build
```

文档-only 修改不要求重新构建；涉及代码或依赖变更时至少运行对应目录的 build。

## 更多文档

- 产品文档：[MD/ZhiPath_产品文档_v3.0.md](MD/ZhiPath_产品文档_v3.0.md)
- 中间件部署：[deploy/中间件部署指南.md](deploy/中间件部署指南.md)
- 后端开发：[backend-ts/README.md](backend-ts/README.md)
- 前端开发：[frontend/README.md](frontend/README.md)

# ZhiPath / 智途

ZhiPath 是面向在校学生的岗位能力成长平台。它把目标岗位、技能差距、学习任务、测评、项目证据、简历建议和学校就业看板串成一条闭环，帮助学生知道自己离目标岗位差什么、今天该做什么、做完以后能力和求职准备度如何变化。

核心路径：

```text
个人画像 -> 目标岗位 -> 岗位差距卡 -> 今日任务
-> 学习 / 测评 / 项目证据 -> 技能画像与匹配度变化
-> 岗位版简历建议 -> 学校就业准备度看板
```

## 当前能力

| 模块 | 能力 |
| --- | --- |
| 登录与引导 | 支持学生和管理员角色，学生完成 onboarding 后进入学习与求职工作台。 |
| AI 助教 | 支持上下文问答、文件问答、岗位差距分析、学习资源生成和任务引导。 |
| 岗位目标 | 支持本地、混合、联网岗位搜索，按匹配度排序，岗位详情展示 JD、技能要求、地图和可信度提示。 |
| 岗位差距卡 | 展示匹配度、Top 技能缺口、推荐动作和预计影响。 |
| 今日任务 | 根据目标岗位、技能缺口、学习进度和测评结果推荐主任务与辅助任务。 |
| 学习计划 | 支持岗位主线与自选计划，包含阶段技能、知识详情、练习、资源沉淀和进度推进。 |
| Git 式学习记录 | 使用 branch、commit、snapshot、delta 记录学习动作，支撑技能雷达、画像变化和回滚对比。 |
| 测评闭环 | 支持考试、速测、错题本和 AI 评估，测评结果会沉淀为技能证据。 |
| 项目与简历 | 支持项目经历沉淀、技能证据链、岗位版简历建议和简历生成。 |
| 智能体办公室 | 支持讲义、阅读、代码、路径、测评、出题、技能差距、简历等 Agent 任务，产物可进入业务页面。 |
| 学校看板 | 管理端支持就业准备度看板、技能缺口 Top10、任务完成率、测评达标率和 CSV 导出。 |

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19, Vite 8, TypeScript 6, React Router 7, Zustand, Three.js, CodeMirror, Mermaid |
| 后端 | NestJS 11, TypeScript, TypeORM, Mongoose, JWT, SSE, BullMQ, OpenAI-compatible SDK |
| 数据与中间件 | MySQL, MongoDB, Redis, RabbitMQ, Neo4j, Chroma, MinIO, SearXNG |
| AI / Search | DeepSeek / OpenAI-compatible / Ollama / MiMo, Search Stack, SearXNG |
| 地图 | 高德 Web JS API 与 Web Service |

## 目录结构

```text
ZhiPath/
|-- backend-ts/        # NestJS 后端
|-- frontend/          # React 前端
|-- deploy/            # Docker Compose 和部署配置
|-- docs/              # 工程文档
|-- MD/                # 产品、设计、API、迭代方案
|-- agents/            # 智能体相关资料
|-- video-renderer/    # 视频渲染相关能力
`-- README.md
```

## 环境要求

- Node.js 22+ 和 npm
- Windows + Docker Desktop
- MySQL / Redis / MongoDB 等中间件，推荐使用 `deploy/docker-compose.yml`
- 可选配置：LLM API Key、Search Stack 或 SearXNG、高德地图 Key

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

不要提交真实 API Key。

## 前端配置

前端读取 `frontend/.env` 或 Vite 环境变量：

```env
VITE_AMAP_WEB_KEY=your_amap_web_js_key
VITE_AMAP_SECURITY_JS_CODE=your_amap_security_js_code
```

没有高德前端 Key 时，岗位详情仍可展示文字位置，地图交互会降级。

## 本地启动

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

- 前端：`http://localhost:5173`
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
node scripts/migrate-agent-output.js
```

仅在确认要清空旧学习轨迹并重建 Git 学习基线时执行：

```powershell
npm run reset:git-v2-data -- --confirm-clear-learning-history
```

## 核心页面

| 路由 | 说明 |
| --- | --- |
| `/` | 公开首页，包含登录和注册入口 |
| `/onboarding` | 学生初始化画像和目标 |
| `/user/home` | 行动中枢 |
| `/user/chat` | AI 助教，支持文件问答 |
| `/user/jobs` | 岗位搜索与匹配 |
| `/user/jobs/:id` | 岗位详情、差距卡、地图、投递、技能导入 |
| `/user/learning` | 学习计划 |
| `/user/knowledge/:skill` | 知识详情、讲义、练习、资源 |
| `/user/exams` | 测评列表 |
| `/user/quick-test` | 快速测评 |
| `/user/wrong-answers` | 错题本 |
| `/user/progress` | 画像变化和 Git 学习记录 |
| `/user/growth-report` | 阶段成长报告 |
| `/user/projects` | 项目经历 |
| `/user/resume` | 简历建议 |
| `/user/agent-office` | 智能体办公室 |
| `/admin/employment` | 就业准备度看板 |
| `/admin/*` | 管理后台 |

## 验证命令

```powershell
cd backend-ts
npm run build
npm test -- --runInBand

cd ..\frontend
npm run build
```

## 迭代重点

短期优先级：

1. 修复核心页面乱码和演示观感。
2. Projects 去 mock，让项目经历成为真实技能证据。
3. 文件问答升级为可保存证据。
4. 图谱页接入真实技能/岗位关系。
5. 管理端从“看数据”升级为“下发干预动作”。

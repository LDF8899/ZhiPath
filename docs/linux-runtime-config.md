# ZhiPath Linux 运行配置单

更新时间：2026-09-09（分支 `2.0`，提交 `f4e7733`）

本文将“当前 Linux 主机的实际运行配置”与“仓库原有依赖”分开记录。前者是本机适配，不代表项目的通用要求；后者以仓库中的 `package.json`、`.env.example` 和 Compose 文件为准。

## 一、当前 Linux 环境与本机适配

### 1. 主机环境

```text
OS: Ubuntu 24.04.4 LTS
Kernel: 6.17.0-1032-nvidia
Architecture: aarch64
Node.js: v20.20.2
npm: 10.8.2
Docker Engine: 29.2.1
Docker Compose: v5.0.2
Workspace: /home/ai/project/ZhiPath
```

### 2. 网络代理（仅属于本机环境）

```text
Proxy core: mihomo v1.19.30
Mixed port: 7897
HTTP_PROXY: http://127.0.0.1:7897
HTTPS_PROXY: http://127.0.0.1:7897
NO_PROXY: localhost,127.0.0.1,::1
Docker daemon: 已配置同一 HTTP/HTTPS 代理
```

安装依赖、拉取镜像和访问外部服务时使用该代理；本机数据库与前后端之间的请求通过 `NO_PROXY` 直连。

### 3. 当前启动的服务

```text
智途 ZhiPath 前端 frontend/:      0.0.0.0:5173
CodeNova 前端 codenovafrontend/:  0.0.0.0:5180
NestJS 后端 backend-ts/: 0.0.0.0:3000，API 前缀 /api
MySQL 8.0.36:            0.0.0.0:3307 -> container:3306
Redis 7.2:               0.0.0.0:6379
MongoDB 7:               0.0.0.0:27017
RabbitMQ 3.13:           0.0.0.0:5672，管理页 15672
```

访问地址：

- 智途 ZhiPath：`http://localhost:5173/`
- 智途 ZhiPath（局域网）：`http://192.168.30.133:5173/`
- CodeNova：`http://localhost:5180/`
- CodeNova（局域网）：`http://192.168.30.133:5180/`
- 后端存活检查：`http://localhost:3000/api/v1/health/live`
- 后端就绪检查：`http://localhost:3000/api/v1/health/ready`
- OpenAPI/Swagger：`http://localhost:3000/api/docs`

测试账号（两套客户端共用同一用户/租户数据，但登录令牌按客户端隔离）：

```text
demo_frontend_rag / 123456
demo_zero_ai      / 123456
```

### 4. 本机环境变量

后端实际文件为 `backend-ts/.env`，智途前端文件为 `frontend/.env`，两者都被 `.gitignore` 排除。CodeNova 前端使用相对路径 `/api` 和 Vite 代理，不需要单独的 `.env`。以下敏感项只描述用途，不在文档中复制实际值。

```env
# backend-ts/.env
APP_HOST=0.0.0.0
APP_PORT=3000
JWT_SECRET=<本机随机密钥，已配置>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_DAYS=30
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5180,http://127.0.0.1:5180

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

LLM_PROVIDER=ollama
LLM_KEY_ENCRYPT_SECRET=<本机开发密钥，已配置>
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b

SEARXNG_URL=http://127.0.0.1:8080
NEWS_SEARXNG_URL=http://127.0.0.1:8080
NEWS_SEARXNG_ENGINES=bing,baidu

AMAP_WEB_SERVICE_KEY=
CHROMA_URL=http://127.0.0.1:8001
CHROMA_COLLECTION=zhipath_user_evidence
CHROMA_TIMEOUT_MS=3000
EMBEDDING_PROVIDER=hash
EMBEDDING_DIMENSIONS=384
EMBEDDING_MODEL=nomic-embed-text
VIDEO_OUTPUT_DIR=/home/ai/project/ZhiPath/backend-ts/output/video

# frontend/.env（智途 ZhiPath）
VITE_AMAP_WEB_KEY=
VITE_AMAP_SECURITY_JS_CODE=

```

`LLM_KEY_ENCRYPT_SECRET` 当前仅供本机开发。生产环境必须替换为随机强密钥，并保持稳定，否则已经加密保存的用户 API Key 将无法解密。

### 5. 数据库初始化状态

MySQL 先使用根目录 `zhipath.sql` 作为历史基线，再由 TypeORM migrations 升级；不能再把 SQL 快照当作最终结构。

```text
数据库：zhipath
表数量：77（含 `legacy_orphan_archive` 与 `knowledge_assets`）
迁移数量：25，全部已执行
外键约束：134
客户端：2（zhipath-web、codenova-web）
租户成员：31
当前规范化数据：25 条路径、137 个学习活动、82 个能力状态、53 道题、63 次测评、18 条证据、102 个生成产物；知识资产目录由 `knowledge_assets` 维护，正文仍在 Mongo `knowledge_base`
历史快照重放：25 条路径、135 个学习活动、82 个能力状态、53 道题、63 次测评、18 条证据；技能快照孤儿已归档 1 条，当前孤儿为 0
```

客户端注册表是前端接入的配置入口。新增客户端后，后端会从
`client_apps.allowed_origins_json` 动态刷新 CORS 来源，无需再在核心业务代码中增加客户端判断；
`CORS_ALLOWED_ORIGINS` 仅保留为部署级静态补充白名单。

从历史快照重新初始化开发库时，必须清库、导入快照、再执行迁移。以下操作会永久覆盖开发库数据：

```bash
docker exec mysql mysql -uroot -proot123 -e "DROP DATABASE IF EXISTS zhipath; CREATE DATABASE zhipath CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
docker exec -i mysql mysql -uroot -proot123 --default-character-set=utf8mb4 < zhipath.sql
cd /home/ai/project/ZhiPath/backend-ts
npm run migration:run
# 若 Mongo 中已有历史知识正文，再执行一次元数据回填
npm run migrate:knowledge-assets
```

不要只在当前数据库上重复导入 `zhipath.sql`；那会令历史表与迁移表处于不同版本。

### 6. 本机 ARM 与安装适配

- 主机为 `aarch64`，已从 `deploy/docker-compose.yml` 移除 MySQL 的 `platform: linux/amd64`，避免 `exec format error`。
- 后端安装时使用 `PUPPETEER_SKIP_DOWNLOAD=1`，跳过当前启动流程不需要的浏览器二进制；`puppeteer` 包本身仍在项目依赖中。
- 网络下载和 Docker 拉取均经过 mihomo；代理配置不是仓库依赖。
- `frontend/` 是智途 ZhiPath，运行在 `5173`；`codenovafrontend/` 是 CodeNova，运行在 `5180`。两者是并列的定制客户端，不是新旧替代关系。
- Node 20 可以完成当前构建与运行，但 Puppeteer 25 和 camera-controls 3 的包声明要求 Node 22+；安装时会出现 `EBADENGINE` 警告。当前 Chromium 烟测使用系统 `/snap/bin/chromium`，生产/CI 建议统一升级到 Node 22 LTS。

### 7. 可复现的启动与停止命令

首次安装依赖（根 workspace 一次安装三端和共享包）：

```bash
cd /home/ai/project/ZhiPath
HTTP_PROXY=http://127.0.0.1:7897 \
HTTPS_PROXY=http://127.0.0.1:7897 \
NO_PROXY=localhost,127.0.0.1,::1 \
PUPPETEER_SKIP_DOWNLOAD=1 \
npm install
```

启动核心中间件：

```bash
cd /home/ai/project/ZhiPath
docker compose -f deploy/docker-compose.yml -p middleware --profile core up -d
```

启动后端：

```bash
cd /home/ai/project/ZhiPath/backend-ts
npm run build
npm run migration:run
HTTP_PROXY=http://127.0.0.1:7897 HTTPS_PROXY=http://127.0.0.1:7897 NO_PROXY=127.0.0.1,localhost npm run start:prod
```

启动 CodeNova（端口 5180）：

```bash
cd /home/ai/project/ZhiPath/codenovafrontend
HTTP_PROXY=http://127.0.0.1:7897 HTTPS_PROXY=http://127.0.0.1:7897 NO_PROXY=127.0.0.1,localhost npm run dev -- --host 0.0.0.0
```

另开终端启动智途 ZhiPath（端口 5173）：

```bash
cd /home/ai/project/ZhiPath/frontend
HTTP_PROXY=http://127.0.0.1:7897 HTTPS_PROXY=http://127.0.0.1:7897 NO_PROXY=127.0.0.1,localhost npm run dev -- --host 0.0.0.0
```

双客户端自动验收（要求后端和两个 Vite 服务已启动）：

```bash
cd /home/ai/project/ZhiPath
npm run test:api-client
npm run smoke:multi-frontend
```

也可以使用根 workspace 的明确入口（不会把两套前端混在一起）：

```bash
npm run dev:all      # 一键启动后端 + 两套前端
npm run dev:backend   # backend-ts，3000
npm run dev:zhipath   # frontend/，5173
npm run dev:codenova  # codenovafrontend/，5180
```

烟测默认使用种子账号 `demo_frontend_rag / 123456`，也可通过
`SMOKE_USERNAME`、`SMOKE_PASSWORD` 覆盖；系统 Chromium 路径可通过
`CHROMIUM_PATH` 覆盖。脚本不创建或删除业务数据。

停止中间件：

```bash
cd /home/ai/project/ZhiPath
docker compose -f deploy/docker-compose.yml -p middleware --profile core down
```

## 当前主机的 IP 部署方式

本机无线网卡地址为 `192.168.30.133`（Tailscale 地址为
`100.104.212.16`）。生产构建已由 Nginx 提供，两个定制前端保持独立端口，
并通过同一反向代理访问共享后端：

```text
智途 ZhiPath:  http://192.168.30.133:49173/
CodeNova:      http://192.168.30.133:49180/
共享 API:      由上述两个站点的 /api/ 代理到 127.0.0.1:3000
```

已额外配置不带端口的局域网别名（仅 hosts/DNS 映射，不是公网域名）：

```text
http://zhipath.lan/   → 192.168.30.133 → 智途 ZhiPath
http://codenova.lan/  → 192.168.30.133 → CodeNova
```

其他客户端需在 hosts 文件中加入：

```text
192.168.30.133 zhipath.lan codenova.lan
```

后端由 `zhipath-backend.service` 常驻管理，开机自动启动、异常自动重启，
并固定使用本机 Node.js 20。Nginx 和 systemd 模板分别位于
`deploy/nginx/zhipath.conf`、`deploy/systemd/zhipath-backend.service`。

常用运维命令：

```bash
sudo systemctl status zhipath-backend
sudo systemctl restart zhipath-backend
sudo journalctl -u zhipath-backend -f
sudo nginx -t && sudo systemctl reload nginx
```

数据库、缓存和消息队列端口已绑定到 `127.0.0.1`，不会随前端 IP 对外开放。
`192.168.30.133` 是局域网地址；若要从公网访问，还需要路由器端口转发、
固定公网地址或域名，以及 HTTPS 和防火墙策略，不能仅凭该地址直接暴露到互联网。

生产直连端口选择为 `49173`（智途）和 `49180`（CodeNova），部署时已检查未被
本机占用；端口冲突仍需在重启或新增服务时通过 `ss -lnt` 复核。5173/5180
仅保留给 Vite 开发服务器。

## 二、项目原有依赖（仓库定义）

以下内容来自仓库，不是这台 Linux 主机额外安装的系统软件。

### 1. 后端 `backend-ts/package.json`

- 框架：NestJS、TypeScript、RxJS。
- 数据层：TypeORM、MySQL2、Mongoose、ioredis、Neo4j Driver。
- 队列与调度：BullMQ、Nest Schedule。
- AI 与工作流：OpenAI SDK、LangChain Core、LangGraph、Zod。
- 鉴权与校验：JWT、Passport、bcryptjs、class-validator、class-transformer。
- 自动化与媒体：Playwright、Puppeteer。
- 测试与开发：Jest、ts-jest、ts-node、ESLint、Prettier、Supertest。

### 2. CodeNova 前端 `codenovafrontend/package.json`

- UI：React 19、React DOM、React Router。
- 3D 与可视化：Three.js、React Three Fiber、Drei、Postprocessing、React Spring。
- 编辑与内容：Mermaid、React Markdown（智途额外使用 CodeMirror、rehype-highlight）。
- 图标、状态与内容：Lucide React、Zustand。
- 构建：Vite、TypeScript。
- 智途 ZhiPath 的 `frontend/` 额外依赖包括 Axios、高德地图加载器、CodeMirror 和 Tailwind CSS。

### 3. 项目中间件 `deploy/docker-compose.yml`

- 核心 profile：MySQL、Redis、MongoDB、RabbitMQ。
- 可选 profile：MinIO、Neo4j、Chroma、SearXNG、RedisInsight。

### 4. 当前未启用的可选能力

- Ollama 未安装/未监听 `11434`，因此默认本地 LLM 调用暂不可用；可在个人设置中配置外部模型供应商，或另行安装 Ollama。
- Neo4j、Chroma、SearXNG、MinIO、RedisInsight 未启动。后端会对 Neo4j 图谱增强等能力降级，主站、登录、MySQL 数据和普通 API 不受影响。
- 高德地图 Key 未填写，地图相关页面不能加载完整在线地图能力。

## 三、验收结果

```text
git: 本地 2.0 与 origin/2.0 同步，HEAD=f4e7733
backend build: passed
backend unit tests: 39 suites / 136 tests passed
shared API client: contract tests passed
backend e2e: passed
智途 ZhiPath frontend build: passed（仅有现存的大 chunk 警告）
CodeNova frontend build: passed（仅有现存的大 chunk 警告）
TypeORM migrations: 20/20 passed；规范通知表已从 notifications_v3 回填并租户化（旧表保留为 notifications_v3_legacy），题库/考试/资讯目录及全部用户历史表已补 tenant_id
GET /api/health: HTTP 200，service=ZhiPath API，version=3.0.0
GET /api/health through CodeNova Vite proxy: HTTP 200
GET /api/health through 智途 Vite proxy: HTTP 200
zhipath-web 与 codenova-web 登录、JWT azp、租户 scopes、refresh rotation: passed
真实 Chromium 双客户端品牌、登录、bootstrap 与 SSE: passed（智途 `/user/home`，CodeNova `/today`）
access token 与 X-Client-App 绑定、跨客户端复用拒绝: passed
两套前端客户端身份自检: passed（5173 只接受 zhipath-web，5180 只接受 codenova-web）
GET /api/v1/experience/bootstrap: passed，两套客户端返回独立品牌与导航
GET /api/v1/learning-paths、/me/competencies、/assessments/attempts、/evidence: passed
POST learning goal/path node/path edge/activity/evidence、assessment start/submit: passed；submit 为 HTTP 200
POST /api/v1/jobs create/cancel/retry: passed；协作取消、终态 outbox → SSE、幂等重放 passed
AI usage ledger: HTTP 与统一队列任务的 tenant/user/client/request/run/provider/model/token/latency 归因已接入
client registry: 数据库动态校验、HTTP/HTTPS origin 校验、动态 CORS、事务/outbox/audit passed
legacy /api/user/* 与 /api/admin/auth/*: Deprecation、Sunset、Link 响应头 passed
MySQL / MongoDB / Redis connections: passed
```

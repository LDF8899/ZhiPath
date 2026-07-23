# ZhiPath Frontend

ZhiPath 前端是 React + Vite + TypeScript 应用，包含学生端、管理端、AI 浮窗、岗位地图、学习路径、智能体办公室等页面。

## 技术栈

- React 19
- Vite 8
- TypeScript 6
- React Router 7
- Zustand
- Tailwind CSS 4
- Three.js / React Three Fiber
- CodeMirror
- Mermaid
- Axios
- AMap JSAPI

## 安装

```powershell
cd frontend
npm install
```

如果启动时报错找不到 `@amap/amap-jsapi-loader`，说明依赖没有安装完整，重新执行 `npm install`。

## 环境变量

可在 `frontend/.env` 中配置：

```env
VITE_AMAP_WEB_KEY=your_amap_web_js_key
VITE_AMAP_SECURITY_JS_CODE=your_amap_security_js_code
```

地图 Key 缺失时，岗位详情会降级显示文字地点或后端静态地图，不保证交互地图可用。

## 启动

```powershell
npm run dev -- --host 0.0.0.0
```

默认端口为 `5173`。如果端口被占用，Vite 会自动切到 `5174` 等端口。

## 构建

```powershell
npm run build
```

预览生产构建：

```powershell
npm run preview
```

## 路由

公开页面：

- `/`
- `/login`
- `/register`
- `/avatar-preview`

学生端：

- `/onboarding`
- `/plan/create`
- `/user/plan-hub`
- `/user/home`
- `/user/chat`
- `/user/learning`
- `/user/learning/:pathId`
- `/user/knowledge/:skill`
- `/user/jobs`
- `/user/jobs/:id`
- `/user/exams`
- `/user/exams/:id/take`
- `/user/news`
- `/user/news/:id`
- `/user/graph`
- `/user/profile`
- `/user/projects`
- `/user/progress`
- `/user/resume`
- `/user/agent-office`
- `/user/quick-test`
- `/user/wrong-answers`

管理端：

- `/admin/dashboard`
- `/admin/users`
- `/admin/jobs`
- `/admin/applications`
- `/admin/enterprises`
- `/admin/news`
- `/admin/exams`
- `/admin/questions`
- `/admin/resumes`
- `/admin/settings`

## 目录说明

```text
src/
|-- api/             # Axios client 和接口封装
|-- components/      # 通用组件、AI 浮窗、地图、办公室组件
|-- layouts/         # 用户端/管理端布局
|-- pages/           # 页面
|   |-- user/        # 学生端页面
|   `-- admin/       # 管理端页面
|-- stores/          # Zustand 状态
`-- assets/          # 静态资源
```

## 开发注意事项

- 需要后端运行在 `http://localhost:3000`，API 默认通过 `/api` 前缀访问。
- 岗位页支持本地、混合、联网搜索，结果中的 `searchMeta` 用于展示来源和命中信息。
- 岗位详情地图依赖高德 Key；联网岗位也可能只有部分字段，需要做好降级展示。
- 智能体办公室的工位展示应以任务状态为准：只有待处理或运行中的 Agent 占用工位。
- 生成资源要从后端资源台账恢复，不应只依赖页面内存状态。

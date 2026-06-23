# 🎯 ZhiPath — AI 智能学习路径系统

> 基于多智能体架构的自适应学习平台，为每位学员生成个性化学习路径、智能出题、自动批改、教学视频生成，实现"学-练-考-评"闭环。

## ✨ 核心功能

| 模块 | 功能 | 技术 |
|------|------|------|
| 🗺️ 学习路径 | 根据目标岗位自动规划分阶段学习计划 | LangGraph + LLM |
| 📚 智能讲义 | 为每个技能生成结构化讲义 + 练习题 | MiMo Pro |
| 💻 代码实战 | 渐进式代码练习（填空→独立实现） | MiMo Pro |
| 📝 考试系统 | 技能考试 / 岗位考试 / 5 分钟速测 | 防作弊 + 错题分析 |
| 🎬 教学视频 | 自动生成带配音的教学短视频 | TTS + Remotion |
| 🤖 智能体办公室 | 可视化多智能体协作（讲师/出题/阅读/视频） | Agent Profile |
| 📊 匹配分析 | 技能差距分析 + 匹配度评估 | Skill Gap Agent |
| 📰 资讯推送 | AI 领域新闻自动抓取 + 摘要 | SearXNG + LLM |
| 🏢 管理后台 | 用户/岗位/企业/考试/简历全管理 | Admin Dashboard |

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│   React 19 + Vite + TypeScript                  │
│   手绘风格设计系统 (Hand-drawn Design)            │
│   Zustand + React Router + CodeMirror            │
└──────────────────────┬──────────────────────────┘
                       │ REST API + SSE
┌──────────────────────┴──────────────────────────┐
│                   Backend                        │
│   NestJS + TypeORM + LangGraph                   │
│   15+ 智能体 (Lecture/Code/Video/Exam/...)       │
│   JWT Auth + RBAC                                │
└───┬──────┬──────┬──────┬──────┬─────────────────┘
    │      │      │      │      │
   MySQL  Mongo  Redis  Neo4j  MiMo LLM/TTS
```

## 🚀 快速开始

### 环境要求

- Node.js ≥ 18
- MySQL 8.x
- MongoDB 6.x
- Redis 7.x
- FFmpeg（视频渲染需要）

### 1. 克隆项目

```bash
git clone https://github.com/LDF8899/ZhiPath.git
cd ZhiPath
```

### 2. 后端

```bash
cd backend-ts
cp .env.example .env          # 编辑 .env 配置数据库和 LLM API
npm install
npm run dev                    # 启动开发服务器 (http://localhost:3000)
```

### 3. 前端

```bash
cd frontend
npm install
npm run dev                    # 启动开发服务器 (http://localhost:5173)
```

### 4. 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |
| 学生 | zhangsan | 123456 |

## 📁 项目结构

```
ZhiPath/
├── backend-ts/                # NestJS 后端
│   ├── src/
│   │   ├── modules/           # 业务模块 (chat/exams/admin/...)
│   │   ├── services/          # 智能体服务 (15+ agents)
│   │   ├── entities/          # TypeORM 实体
│   │   └── common/            # 守卫/装饰器/工具
│   └── .env.example           # 环境变量模板
├── frontend/                  # React 前端
│   ├── src/
│   │   ├── pages/             # 页面 (user/admin)
│   │   ├── components/        # 组件 (chat/office/workspace)
│   │   ├── stores/            # Zustand 状态管理
│   │   └── styles/            # 手绘风格 CSS
│   └── vite.config.ts
├── video-renderer/            # Remotion 视频渲染器
├── agents/                    # 独立 Agent 脚本
└── MD/                        # 项目文档
```

## 🤖 多智能体架构

ZhiPath 采用 **15+ 专业智能体** 协同工作：

| 智能体 | 职责 | 模型 |
|--------|------|------|
| 🎓 LectureAgent | 生成结构化讲义 | MiMo Pro |
| 💻 CodeAgent | 生成渐进式代码练习 | MiMo Pro |
| 📖 ReadingAgent | 生成拓展阅读材料 | MiMo Pro |
| 📝 ExamAgent | 生成考试题目 | MiMo Pro |
| 🎬 VideoAgent | 生成教学短视频 | MiMo TTS + Remotion |
| 🗺️ PlannerAgent | 规划学习路径 | MiMo Flash |
| 📊 SkillGapAgent | 技能差距分析 | MiMo Flash |
| 🔍 ReviewerAgent | 错题分析 + 学习评估 | MiMo Pro |
| 📰 NewsAgent | 资讯抓取 + 摘要 | MiMo Flash |
| 🎭 OrchestratorAgent | 意图路由 + 调度 | MiMo Flash + Tool Calling |

### 意图路由（三层决策）

```
Phase B: 关键词匹配（0ms，覆盖 80% 常见意图）
    ↓ 未命中
Phase C: LLM Tool Calling（1-2s，处理模糊/复杂意图）
    ↓ 未命中
Agent Chat: 自由对话（上下文感知，直接回答）
```

## 🎨 设计系统

前端采用 **手绘风格（Hand-drawn Design）** 设计系统：

- 📝 手写体字体（Caveat + ZhiDao）
- 🎨 暖色纸质背景 + 铅笔线条
- 📌 便利贴卡片组件
- ✏️ 随意倾斜的 UI 元素
- 🌈 8 种粉彩色便签配色

## 📡 API 概览

### 用户端

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| GET | `/api/user/learning-paths` | 学习路径列表 |
| GET | `/api/user/learning-paths/knowledge/:skill` | 技能知识内容 |
| POST | `/api/user/exams/submit` | 提交考试 |
| GET | `/api/user/exams/wrong-answers` | 错题本 |
| POST | `/api/user/chat` | AI 对话（SSE 流式） |
| GET | `/api/user/events/stream` | 实时事件流 |

### 管理端

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/dashboard` | 管理看板 |
| CRUD | `/api/admin/users` | 用户管理 |
| CRUD | `/api/admin/jobs` | 岗位管理 |
| GET | `/api/admin/exams` | 考试记录 |
| CRUD | `/api/admin/news` | 资讯管理 |

## 📄 相关文档

- [产品文档](MD/ZhiPath_产品文档_v3.0.md)
- [API 文档](MD/ZhiPath_API文档_v3.0.md)
- [开发准则](MD/DEVELOPMENT_GUIDELINES.md)
- [业务规范](MD/CONSTITUTION.md)
- [启动指南](MD/STARTUP_GUIDE.md)

## 📊 技术栈

**前端**：React 19 · Vite · TypeScript · Zustand · React Router · CodeMirror · Recharts

**后端**：NestJS · TypeORM · LangGraph · JWT · Bull Queue · SSE

**数据库**：MySQL 8 · MongoDB 6 · Redis 7 · Neo4j

**AI/ML**：MiMo LLM（小米大模型）· MiMo TTS · Tool Calling

**视频**：Remotion · FFmpeg · MiMo TTS

**部署**：Docker · Nginx · PM2

---

<p align="center">
  <b>🎯 ZhiPath</b> — 让每个人都有专属的学习路径<br/>
  <sub>Built with ❤️ by <a href="https://github.com/LDF8899">LDF8899</a></sub>
</p>

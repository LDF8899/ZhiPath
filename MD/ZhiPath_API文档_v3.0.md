# 智途 ZhiPath API 文档 v3.0

> 后端：NestJS 11 + TypeORM + MongoDB + Redis + Neo4j
> 端口：`http://localhost:3000`（全局前缀 `/api`）
> 最后更新：2026-06-09

---

## 目录

- [一、基础设施](#一基础设施)
- [二、数据模型](#二数据模型)
- [三、用户端 API（/api/user）](#三用户端-api)
  - [3.1 认证](#31-认证)
  - [3.2 用户画像](#32-用户画像)
  - [3.3 首页仪表盘](#33-首页仪表盘)
  - [3.4 岗位](#34-岗位)
  - [3.5 学习路径](#35-学习路径)
  - [3.6 学习进度](#36-学习进度)
  - [3.7 考试](#37-考试)
  - [3.8 资讯](#38-资讯)
  - [3.9 知识图谱](#39-知识图谱)
  - [3.10 异步任务](#310-异步任务)
  - [3.11 AI 对话](#311-ai-对话)
  - [3.12 对话历史](#312-对话历史)
  - [3.13 项目经历](#313-项目经历)
- [四、管理端 API（/api/admin）](#四管理端-api)
- [五、AI 对话系统详解](#五ai-对话系统详解)
- [六、前端页面 × API 映射](#六前端页面--api-映射)

---

## 一、基础设施

### 响应格式

所有接口返回统一格式：

```typescript
// 成功
{ code: 200, message: "success", data: T }

// 分页成功
{ code: 200, message: "success", data: T[], total: number, page: number, pageSize: number }

// 错误
{ code: number, message: string, data: null }
```

### 鉴权方式

```
Authorization: Bearer <token>
```

- **Session 模式**：token 存在 MySQL `session` 表，非 JWT
- 登录时返回 token，前端存 localStorage
- 401 时前端应清除 token 并跳转登录页

### 分页参数

所有列表接口统一参数：

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `page` | number | 1 | 页码 |
| `pageSize` | number | 20 | 每页条数 |

---

## 二、数据模型

### 2.1 用户 User（MySQL `user` 表）

```typescript
{
  id: number
  username: string        // 唯一
  password: string        // MD5 加密
  realName: string
  phone: string
  email: string
  avatar: string
  groupId: number         // FK → group 表
  status: number          // 1=启用, 0=禁用
  createTime: number      // 毫秒时间戳
  updateTime: number
}
```

### 2.2 学生 Student（MySQL `sp_students` 表）

```typescript
{
  id: number
  userId: number          // FK → user 表
  name: string
  studentNo: string
  major: string           // 专业
  grade: string           // 年级
  phone: string
  email: string
  target_job_id: number   // 目标岗位 FK → job_descriptions
  skills: Array<{         // 技能列表
    name: string
    level: string         // "了解" | "熟悉" | "精通"
    source?: string
  }>
  projects: Array<{       // 项目经历
    name: string
    description: string
    role: string
    tech: string[]
    time: string
    github_url: string
    highlights: string[]
  }>
  onboarding_completed: number  // 0=未完成, 1=已完成
}
```

### 2.3 岗位 JobDescription（MySQL `job_descriptions` 表）

```typescript
{
  id: number
  title: string           // 岗位名称
  company: string         // 公司名称
  jd_text: string         // 原始 JD 文本
  required_skills: string[]   // 必须技能
  preferred_skills: string[]  // 加分技能
  salary_range: string    // 薪资范围
  location: string        // 工作地点
  status: number          // 0=下架, 1=上架
  source: string          // "manual" | "searxng" | "enterprise"
  createTime: number
}
```

### 2.4 学习路径 LearningPath（MySQL `learning_paths` 表）

```typescript
{
  id: number
  user_id: number
  target_job_id: number   // 目标岗位
  path_data: {            // 路径结构（核心）
    phases: Array<{
      name: string        // 阶段名称，如"基础阶段"
      skills: Array<{
        name: string      // 技能名称
        status: string    // "pending" | "done"
        duration: string  // 预计时长
        read_at?: number  // 阅读完成时间
        quiz_score?: number
        quiz_passed?: boolean
        completed_at?: number
      }>
      status?: string     // "done" 表示阶段完成
    }>
  }
  current_phase: number   // 当前阶段索引
  match_score: number     // 匹配度（百分比）
  estimated_date: string  // 预计达成日期
  status: number
  createTime: number
}
```

### 2.5 考试记录 ExamRecord（MySQL `exam_records` 表）

```typescript
{
  id: number
  user_id: number
  exam_type: number       // 1=通用技能, 2=岗位考试
  skill_name: string
  job_id: number
  score: number
  passed: number          // 0=未通过, 1=通过
  answers: {              // 完整题目数据
    skill: string
    questions: Array<{
      type: "choice" | "coding"
      question: string
      options?: string[]
      answer?: number
      explanation?: string
      template?: string
      hint?: string
    }>
    exam_id?: number
  }
  retry_count: number
  createTime: number
}
```

### 2.6 资讯 News（MySQL `news` 表）

```typescript
{
  id: number
  title: string
  content: string
  image: string
  type: string            // "industry" | "tech" | "recruit"
  source: string
  source_url: string
  status: number          // 0=下架, 1=上架
  publish_time: number
  createTime: number
}
```

### 2.7 用户画像（MongoDB `user_profiles` 集合）

```typescript
{
  user_id: string         // MySQL user.id 的字符串形式
  version: number         // 版本号，每次 merge +1
  created_at: number
  updated_at: number
  basic: {                // 从 MySQL 同步的基础信息
    school: string
    major: string
    grade: string
  }
  skills: Array<{
    name: string
    level: string
    source: string        // "manual" | "chat" | "exam"
    updated_at: number
  }>
  goals: {
    target_job_id: number
    target_job_title: string
    direction: string     // 意向方向
  }
  traits: {
    interests: string[]   // 兴趣
    strengths: string[]   // 强项
    weaknesses: string[]  // 薄弱点
  }
  chat_insights: Array<{
    content: string       // 从聊天中提取的洞察
    source: string
    extracted_at: number
  }>
  learning_history: Array<{
    timestamp: number
    // ... 学习行为记录
  }>
}
```

### 2.8 对话记录（MongoDB `chat_sessions` 集合）

```typescript
{
  user_id: string
  session_id: string      // 会话 ID
  page_context: string    // 发起对话的页面
  created_at: number
  updated_at: number
  messages: Array<{
    role: "user" | "assistant"
    content: string
    agent: string         // AI agent 名称
    timestamp: number
  }>
}
```

### 2.9 知识库（MongoDB `knowledge_base` 集合）

```typescript
{
  skill: string           // 技能名称
  content_type: "lecture" | "quiz" | "coding"
  content: {
    // lecture 类型
    markdown: string
    format: "markdown"

    // quiz 类型
    questions: Array<{
      question: string
      options: string[]
      answer: number      // 正确选项索引
      explanation: string
    }>
    total: number

    // coding 类型
    problems: Array<{
      title: string
      description: string
      template: string
      test_cases: Array<{ input: string; expected: string }>
      hint: string
      solution: string
    }>
    total: number
  }
  metadata: {
    difficulty: "beginner" | "intermediate" | "advanced"
    version: number
  }
  shared: boolean
  created_at: number
  updated_at: number
}
```

### 2.10 异步任务（Redis）

```
task:{taskId}    → JSON { task_id, task_type, user_id, status, created_at, result, error }
user_tasks:{userId} → LIST [taskId, ...]  最近 100 个任务 ID
active_users     → SET [userId, ...]      有待处理画像分析的用户
chat:{userId}:{sessionId} → JSON [message, ...]  最近 20 条消息热缓存
```

---

## 三、用户端 API

### 3.1 认证

#### 登录

```
POST /api/admin/auth/login
```

**无需鉴权**

请求：
```json
{ "username": "string", "password": "string" }
```

响应：
```json
{
  "code": 200,
  "data": {
    "token": "abc123...",
    "user": {
      "id": 1,
      "username": "student1",
      "realName": "张三",
      "role": "student",
      "onboardingCompleted": true
    }
  }
}
```

#### 注册

```
POST /api/admin/auth/register
```

**无需鉴权**

请求：
```json
{ "username": "string", "password": "string", "realName?: "string" }
```

#### 获取当前用户

```
GET /api/admin/auth/me?token=xxx
```

**无需鉴权**（token 通过 query 或 Header 传递）

---

### 3.2 用户画像

#### 获取画像

```
GET /api/user/profile
```

**需要鉴权**

响应：
```json
{
  "code": 200,
  "data": {
    "userId": 1,
    "name": "张三",
    "studentNo": "2023001",
    "major": "软件工程",
    "grade": "大三",
    "skills": [{ "name": "JavaScript", "level": "熟悉" }],
    "target_job_id": 5,
    "onboarding_completed": 1,
    "projects": [...],
    "profile_version": 3,
    "traits": { "interests": [...], "strengths": [...], "weaknesses": [...] },
    "chat_insights": [...],
    "goals": { "target_job_title": "前端开发", "direction": "前端" }
  }
}
```

#### 更新画像

```
PUT /api/user/profile
```

请求（任意字段）：
```json
{ "realName": "张三", "phone": "138xxx", "major": "软件工程" }
```

#### Onboarding

```
POST /api/user/onboarding
```

请求：
```json
{
  "name": "张三",
  "major": "软件工程",
  "grade": "大三",
  "skills": [{ "name": "JavaScript", "level": "熟悉" }]
}
```

#### Onboarding 状态

```
GET /api/user/onboarding/status
```

响应：
```json
{ "code": 200, "data": { "completed": true } }
```

---

### 3.3 首页仪表盘

```
GET /api/user/dashboard
```

响应：
```json
{
  "code": 200,
  "data": {
    "student": { "name": "张三", "major": "软件工程", ... },
    "target_job": { "id": 5, "title": "前端开发", "company": "xxx" },
    "learning_path": { "current_phase": 1, "match_score": 65, ... },
    "stats": {
      "total_skills": 20,
      "done_skills": 8,
      "exam_count": 3,
      "job_count": 5
    },
    "today_tasks": [...],
    "recent_news": [...]
  }
}
```

---

### 3.4 岗位

#### 岗位列表

```
GET /api/user/jobs?page=1&pageSize=20&keyword=前端&company=腾讯&location=重庆
```

响应（分页，按匹配度排序）：
```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "title": "前端开发工程师",
      "company": "腾讯",
      "location": "重庆",
      "salary_range": "15-25K",
      "required_skills": ["JavaScript", "React", "TypeScript"],
      "preferred_skills": ["Vue", "Node.js"],
      "match_score": 75
    }
  ],
  "total": 50,
  "page": 1,
  "pageSize": 20
}
```

#### 岗位详情

```
GET /api/user/jobs/:jobId
```

#### 岗位匹配分析

```
GET /api/user/jobs/:jobId/match
```

响应：
```json
{
  "code": 200,
  "data": {
    "job_id": 1,
    "required_skills": ["JavaScript", "React"],
    "preferred_skills": ["Vue"],
    "match_result": {
      "score": 75,
      "matched": ["JavaScript"],
      "missing": ["React"]
    }
  }
}
```

#### 申请岗位

```
POST /api/user/jobs/:jobId/apply
```

---

### 3.5 学习路径

#### 路径列表

```
GET /api/user/learning-paths?page=1&pageSize=20
```

#### 路径详情

```
GET /api/user/learning-paths/:pathId
```

响应（含完整 path_data）：
```json
{
  "code": 200,
  "data": {
    "id": 1,
    "user_id": 1,
    "target_job_id": 5,
    "current_phase": 0,
    "match_score": 65,
    "estimated_date": "2026-09",
    "path_data": {
      "phases": [
        {
          "name": "基础阶段",
          "skills": [
            { "name": "HTML/CSS", "status": "done", "duration": "2周" },
            { "name": "JavaScript", "status": "pending", "duration": "4周" }
          ]
        },
        {
          "name": "进阶阶段",
          "skills": [...]
        }
      ]
    }
  }
}
```

#### 创建路径

```
POST /api/user/learning-paths
```

请求：
```json
{ "target_job_id": 5 }
```

#### 知识库资源查询

```
GET /api/user/learning-paths/knowledge/:skill
```

响应：
```json
{
  "code": 200,
  "data": {
    "skill": "JavaScript",
    "lecture": "# JavaScript\n## 概念介绍\n...",
    "quiz": [{ "question": "...", "options": [...], "answer": 0 }],
    "coding": [{ "title": "...", "description": "...", "template": "..." }],
    "has_content": true
  }
}
```

---

### 3.6 学习进度

#### 阅读完成

```
POST /api/user/progress/read
```

请求：
```json
{ "skill": "JavaScript", "path_id": 1 }
```

#### 习题完成

```
POST /api/user/progress/quiz
```

请求：
```json
{ "skill": "JavaScript", "total": 10, "correct": 8, "path_id": 1 }
```

响应：
```json
{
  "code": 200,
  "data": {
    "skill": "JavaScript",
    "score": 80,
    "passed": true,
    "message": "习题通过！"
  }
}
```

#### 技能完成（手动标记）

```
POST /api/user/progress/complete
```

请求：
```json
{ "skill": "JavaScript", "path_id": 1 }
```

响应：
```json
{
  "code": 200,
  "data": {
    "skill": "JavaScript",
    "status": "done",
    "phase_completed": false,
    "message": "技能已掌握"
  }
}
```

#### 进度汇总

```
GET /api/user/progress/summary
```

响应：
```json
{
  "code": 200,
  "data": {
    "paths": [
      {
        "path_id": 1,
        "target_job_id": 5,
        "total_skills": 20,
        "done_skills": 8,
        "read_skills": 12,
        "quiz_passed": 6,
        "current_phase": 1,
        "match_score": 65,
        "estimated_date": "2026-09"
      }
    ]
  }
}
```

---

### 3.7 考试

#### 考试列表

```
GET /api/user/exams?page=1&pageSize=20&exam_type=1
```

#### 考试详情

```
GET /api/user/exams/:examId
```

#### 提交考试

```
POST /api/user/exams/submit
```

请求：
```json
{
  "exam_type": 1,
  "skill_name": "JavaScript",
  "answers": { "questions": [...], "user_answers": [0, 2, 1, ...] }
}
```

---

### 3.8 资讯

#### 资讯列表

```
GET /api/user/news?page=1&pageSize=20&type=tech
```

#### 资讯详情

```
GET /api/user/news/:newsId
```

#### 刷新资讯（占位）

```
POST /api/user/news/refresh
```

---

### 3.9 知识图谱

```
GET /api/user/graph?skill=JavaScript&job_id=5&limit=50
```

响应：Neo4j 图谱数据（节点 + 边）

---

### 3.10 异步任务

#### 任务列表

```
GET /api/user/tasks
```

#### 任务详情

```
GET /api/user/tasks/:taskId
```

响应：
```json
{
  "code": 200,
  "data": {
    "task_id": "abc123",
    "task_type": "generate_path",
    "status": "done",
    "result": { "learning_path": {...} }
  }
}
```

---

### 3.11 AI 对话

```
POST /api/user/chat
```

请求：
```json
{
  "message": "推荐一些前端岗位",
  "session_id": "可选，不传则新建会话",
  "page_context": "chat"
}
```

响应：
```json
{
  "code": 200,
  "data": {
    "reply": "我帮你看看有什么合适的前端岗位...",
    "session_id": "uuid-xxx",
    "agent": "chat",
    "profile_version": 3,
    "actions": [
      {
        "type": "jobs",
        "data": [
          {
            "id": 1,
            "title": "前端开发工程师",
            "company": "腾讯",
            "match_score": 75
          }
        ]
      }
    ]
  }
}
```

**AI 对话三层意图识别**：

| 层级 | 机制 | 延迟 | 覆盖场景 |
|------|------|------|---------|
| Phase B | 关键词匹配 | 0ms | "推荐岗位"、"学习计划"、"出题" 等 8 种意图 |
| Phase C | LLM Tool Calling | 1-2s | 模糊意图，6 个工具定义 |
| Fallback | 完整 LLM 对话 | 2-5s | 技术问答、闲聊、引导 |

**actions 字段结构**（前端渲染为卡片）：

```typescript
// 推荐岗位
{ type: "jobs", data: [{ id, title, company, location, salary_range, match_score }] }

// 设置目标岗位
{ type: "target_set", data: { job_id, job_title } }

// 学习路径生成中
{ type: "path_generating", data: { task_id, message } }

// 学习资源
{ type: "resources", data: [{ title, url, type }] }

// 考试
{ type: "exam", data: { skill, questions: [...], exam_id } }

// 学习进度
{ type: "progress", data: { total_skills, done_skills, phases: [...] } }

// 今日任务
{ type: "today_tasks", data: { phase_name, tasks: [...], total } }

// 错误
{ type: "error", message: "..." }
```

---

### 3.12 对话历史

#### 会话列表

```
GET /api/user/chat-sessions?page=1&pageSize=20
```

响应（MongoDB 数据）：
```json
{
  "code": 200,
  "data": [
    {
      "session_id": "uuid-xxx",
      "user_id": "1",
      "page_context": "chat",
      "created_at": 1717900000000,
      "updated_at": 1717900300000,
      "messages": [
        { "role": "user", "content": "推荐岗位", "timestamp": 1717900000000 },
        { "role": "assistant", "content": "...", "agent": "chat", "timestamp": 1717900001000 }
      ]
    }
  ],
  "total": 5,
  "page": 1,
  "pageSize": 20
}
```

#### 会话详情

```
GET /api/user/chat-sessions/:sessionId
```

#### 删除会话

```
DELETE /api/user/chat-sessions/:sessionId
```

---

### 3.13 项目经历

#### 保存项目

```
POST /api/user/projects/save
```

请求：
```json
{
  "name": "个人博客系统",
  "description": "基于 React + Node.js 的全栈博客",
  "role": "全栈开发",
  "tech": ["React", "Node.js", "MongoDB"],
  "time": "2025.09 - 2025.12",
  "github_url": "https://github.com/xxx/blog",
  "highlights": ["支持 Markdown 编辑", "SEO 优化"]
}
```

> 自动将 `tech` 中的新技能加入 `student.skills`

#### GitHub 仓库分析（占位）

```
POST /api/user/github/analyze
```

请求：`{ "repo_url": "https://github.com/xxx/repo" }`

---

## 四、管理端 API

> 所有管理端接口需要 `AuthGuard + AdminGuard`（group.name 含"管理"）

### 仪表盘

```
GET /api/admin/dashboard
```

### 用户管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/users` | 用户列表（keyword 搜索） |
| POST | `/api/admin/users` | 创建用户 |
| PUT | `/api/admin/users` | 更新用户（body 含 id） |
| DELETE | `/api/admin/users/:userId` | 删除用户 |
| GET | `/api/admin/users/students` | 学生列表 |
| GET | `/api/admin/users/groups` | 角色组列表 |

### 岗位管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/jobs` | 岗位列表（keyword/status 筛选） |
| POST | `/api/admin/jobs` | 创建岗位 |
| PUT | `/api/admin/jobs` | 更新岗位 |
| DELETE | `/api/admin/jobs/:jobId` | 删除岗位 |
| GET | `/api/admin/jobs/applications` | 申请列表（job_id/admin_decision 筛选） |
| POST | `/api/admin/jobs/applications/review` | 审核申请 `{ id, admin_decision, admin_comment }` |

### 企业管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/enterprises` | 企业列表 |
| POST | `/api/admin/enterprises` | 创建企业 |
| PUT | `/api/admin/enterprises` | 更新企业 |
| DELETE | `/api/admin/enterprises/:entId` | 删除企业 |

### 资讯管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/news` | 资讯列表（type/status 筛选） |
| POST | `/api/admin/news` | 创建资讯 |
| PUT | `/api/admin/news` | 更新资讯 |
| DELETE | `/api/admin/news/:newsId` | 删除资讯 |

### 考试 & 简历

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/exams` | 考试记录（user_id/exam_type/passed 筛选） |
| GET | `/api/admin/resumes` | 简历列表 |
| PUT | `/api/admin/resumes/review` | 审核简历 `{ id, status, review_comment }` |

### 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/settings` | 系统配置（待实现） |
| GET | `/api/admin/settings/health` | 健康检查 `{ status: "ok", version: "3.0.0" }` |

---

## 五、AI 对话系统详解

### 架构

```
用户消息
  ↓
┌─────────────────────────────────┐
│ Phase B: 关键词匹配（0ms）       │  8 种意图规则
│ → 命中 → 执行动作 → AI 总结     │
├─────────────────────────────────┤
│ Phase C: LLM Tool Calling（1-2s）│  6 个 OpenAI function
│ → 命中 → 执行动作 → AI 总结     │
├─────────────────────────────────┤
│ Fallback: 完整 LLM 对话（2-5s） │  带画像记忆的 system prompt
│ → 读取用户画像                  │
│ → 构建个性化 prompt             │
│ → LLM 生成回复                  │
│ → 解析内嵌 action 块            │
│ → 执行动作                      │
│ → 清理回复                      │
└─────────────────────────────────┘
  ↓
保存对话 → 异步更新画像
```

### 8 种意图

| 意图 | 触发关键词 | 动作类型 |
|------|-----------|---------|
| 学习路径生成 | "学习计划"、"学习路径"、"制定计划" | `generate_path` |
| 岗位推荐 | "推荐岗位"、"找工作"、"有什么岗位" | `recommend_jobs` |
| 设置目标岗位 | "设为目标"、"就这个"、"目标岗位" | `set_target_job` |
| 出题 | "出题"、"考试"、"测试我"、"练习题" | `generate_exam` |
| 查看进度 | "进度"、"学了多少"、"完成情况" | `show_progress` |
| 今日任务 | "今天学什么"、"今日任务" | `show_today_tasks` |
| 学习资源 | "学习资源"、"推荐教程"、"推荐课程" | `recommend_resources` |
| 匹配分析 | "匹配度"、"差距分析"、"还差什么" | `match_analysis` |

### 6 个 Tool Calling 工具

| 工具名 | 参数 | 说明 |
|--------|------|------|
| `generate_learning_path` | `target_job_id?`, `direction?`, `duration_months?` | 生成学习路径 |
| `recommend_jobs` | `keyword?`, `location?` | 推荐岗位 |
| `set_target_job` | `job_id` | 设置目标岗位 |
| `generate_exam` | `skill_name?`, `question_count?`, `question_type?` | 生成考试 |
| `show_progress` | 无 | 查看进度 |
| `recommend_resources` | `skills?` | 推荐资源 |

### 画像记忆机制

- 每次对话读取 MongoDB `user_profiles` + MySQL `student`
- 注入 system prompt：技能、目标、兴趣、强项、弱项、近期洞察
- 新用户引导流程：学校→专业→年级→方向→推荐岗位
- 老用户精准服务：基于画像推荐、主动建议
- 每 15 分钟定时任务：分析聊天记录 → 增量更新画像

---

## 六、前端页面 × API 映射

### 用户端页面

| 页面 | 路由 | 调用的 API |
|------|------|-----------|
| **登录** | `/login` | `POST /api/admin/auth/login` |
| **注册** | `/register` | `POST /api/admin/auth/register` |
| **Onboarding** | `/onboarding` | `GET /api/user/onboarding/status`, `POST /api/user/onboarding` |
| **首页** | `/user/dashboard` | `GET /api/user/dashboard` |
| **AI 对话** | `/user/chat` | `POST /api/user/chat`, `GET /api/user/chat-sessions` |
| **岗位列表** | `/user/jobs` | `GET /api/user/jobs` |
| **岗位详情** | `/user/jobs/:id` | `GET /api/user/jobs/:id`, `GET /api/user/jobs/:id/match`, `POST /api/user/jobs/:id/apply` |
| **学习路径** | `/user/learning-paths` | `GET /api/user/learning-paths`, `POST /api/user/learning-paths` |
| **路径详情** | `/user/learning-paths/:id` | `GET /api/user/learning-paths/:id` |
| **知识库** | `/user/knowledge/:skill` | `GET /api/user/learning-paths/knowledge/:skill` |
| **进度总览** | `/user/progress` | `GET /api/user/progress/summary` |
| **考试列表** | `/user/exams` | `GET /api/user/exams` |
| **考试详情** | `/user/exams/:id` | `GET /api/user/exams/:id` |
| **做题** | `/user/exams/:id/take` | `POST /api/user/exams/submit`, `POST /api/user/progress/quiz` |
| **资讯列表** | `/user/news` | `GET /api/user/news` |
| **资讯详情** | `/user/news/:id` | `GET /api/user/news/:id` |
| **知识图谱** | `/user/graph` | `GET /api/user/graph` |
| **个人中心** | `/user/profile` | `GET /api/user/profile`, `PUT /api/user/profile` |
| **项目经历** | `/user/projects` | `POST /api/user/projects/save` |

### 管理端页面

| 页面 | 路由 | 调用的 API |
|------|------|-----------|
| **管理首页** | `/admin/dashboard` | `GET /api/admin/dashboard` |
| **用户管理** | `/admin/users` | `GET/POST/PUT/DELETE /api/admin/users` |
| **岗位管理** | `/admin/jobs` | `GET/POST/PUT/DELETE /api/admin/jobs` |
| **申请审核** | `/admin/applications` | `GET /api/admin/jobs/applications`, `POST /api/admin/jobs/applications/review` |
| **企业管理** | `/admin/enterprises` | `GET/POST/PUT/DELETE /api/admin/enterprises` |
| **资讯管理** | `/admin/news` | `GET/POST/PUT/DELETE /api/admin/news` |
| **考试管理** | `/admin/exams` | `GET /api/admin/exams` |
| **简历管理** | `/admin/resumes` | `GET /api/admin/resumes`, `PUT /api/admin/resumes/review` |
| **系统设置** | `/admin/settings` | `GET /api/admin/settings` |

### AI 对话 actions 渲染建议

| action.type | 前端组件 | 展示内容 |
|-------------|---------|---------|
| `jobs` | 岗位卡片列表 | 公司、岗位名、匹配度进度条、薪资 |
| `target_set` | Toast 提示 | "已将 xxx 设为目标岗位" |
| `path_generating` | Loading + 轮询 | 轮询 `GET /api/user/tasks/:taskId` |
| `resources` | 资源链接列表 | 标题、类型标签、外链 |
| `exam` | 考试卡片 | 技能名、题数、开始按钮 |
| `progress` | 进度环 + 阶段列表 | 完成度、当前阶段 |
| `today_tasks` | 任务清单 | 技能名、时长、完成按钮 |

---

## 七、待接入的外部服务

| 服务 | 端点 | 状态 | 说明 |
|------|------|------|------|
| SearXNG | `POST /api/user/news/refresh` | 占位 | 资讯抓取 |
| GitHub API | `POST /api/user/github/analyze` | 占位 | 仓库分析 |
| Ollama | LLM Service | ✅ 已接入 | 对话/出题/画像分析 |
| Neo4j | Graph Service | ✅ 已接入 | 知识图谱查询 |

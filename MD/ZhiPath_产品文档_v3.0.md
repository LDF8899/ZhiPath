# 智途 ZhiPath 产品文档 v3.0

> 最后更新：2026年6月
> 状态：技术栈重构 — Python → TypeScript 全栈统一
> 基于：v1.0 产品逻辑 + v2.0 已实现功能 + 技术栈迁移

---

## 一、产品定位

```
面向学生群体的人岗匹配与学习路径系统
第一版目标用户：在校学生
核心价值：我现在在哪 → 我要去哪 → 怎么到达
商业闭环：学生用户增长 → 知识库完善 → 吸引企业入驻 → 反哺用户质量
```

---

## 二、用户角色

| 角色 | 说明 |
|------|------|
| 学生用户 | 求职者/学习者，第一版主体 |
| 管理员 | 平台运营方，负责内容审核和简历初筛 |
| 企业联络员 | 站外对接，通过邮件接收候选人简历 |

---

## 三、技术栈 v3.0

### 变更说明

```
v1.0/v2.0：Python + FastAPI + LangGraph + LangChain
v3.0：    TypeScript + NestJS 全栈统一

变更原因：
1. 前后端同语言，一套 TS 类型贯穿全栈
2. Agent 逻辑实际不复杂（关键词匹配 + Ollama Tool Calling），不需要 LangGraph 重量级框架
3. 减少 Python ↔ TypeScript 的类型定义重复
4. 统一包管理（pnpm）和构建工具链
```

### 前端

| 技术 | 用途 |
|------|------|
| React + TypeScript | 主框架 |
| React Router v6 | 路由管理 |
| Zustand | 状态管理 |
| Ant Design | UI组件库 |
| Tailwind CSS | 样式 |
| Axios | HTTP 请求 |
| React Flow | 知识图谱可视化 |
| Monaco Editor | 代码编辑器/编程题 |
| KaTeX | 数学公式渲染 |
| React Markdown | 讲义Markdown渲染 |
| ECharts / Recharts | 数据图表 |
| React PDF | PDF简历导出 |
| TipTap | 富文本习题展示 |

### 后端

| 技术 | 用途 |
|------|------|
| **TypeScript + Node.js** | 运行时 |
| **NestJS** | 后端框架（模块化、装饰器、DI） |
| **TypeORM** | MySQL ORM（泛型 CRUD 引擎） |
| **Mongoose** | MongoDB ODM（用户画像/对话历史） |
| **ioredis** | Redis 客户端（缓存/Session/任务队列） |
| **neo4j-driver** | Neo4j 图数据库驱动 |
| **ollama-js** / OpenAI SDK | LLM 调用（Ollama / OpenAI 兼容） |
| **Zod** | 请求/响应 Schema 校验 |
| **class-validator** | DTO 校验（NestJS 集成） |
| **BullMQ** | 异步任务队列（替代自研队列） |
| **@nestjs/schedule** | 定时任务（画像分析/资讯抓取） |
| **MinIO JS SDK** | 文件存储 |
| **Passport + JWT** | 认证 |

### 中间件（不变）

| 中间件 | 端口 | 用途 |
|--------|------|------|
| MySQL | 3307 | 用户/业务数据 |
| MongoDB | 27017 | 用户画像/LLM输出/知识库 |
| Redis | 6379 | 对话上下文/Session/任务缓存 |
| Neo4j | 7687 | 技能知识图谱 |
| Chroma | 8000 | 向量数据库/RAG |
| Ollama | 11434 | 本地LLM统一入口 |
| RabbitMQ | 5672 | 异步任务队列（可选，BullMQ 默认用 Redis） |
| MinIO | 9000 | 文件存储 |
| SearXNG | 8080 | 搜索增强/资讯抓取 |

---

## 四、系统架构

### 整体架构

```
┌─────────────────────────────────────────────────┐
│                   Frontend (React)               │
│         Vite + TypeScript + Ant Design           │
└──────────────────────┬──────────────────────────┘
                       │ HTTP / WebSocket
┌──────────────────────▼──────────────────────────┐
│              NestJS API Gateway                  │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │ Auth Guard  │  │  Module Router            │  │
│  │ JWT + Role  │  │  /api/user/* → UserModule │  │
│  │             │  │  /api/admin/* → AdminMod  │  │
│  └─────────────┘  └──────────────────────────┘  │
└───────┬──────────────────────┬──────────────────┘
        │                      │
┌───────▼───────┐    ┌────────▼─────────────────┐
│  CRUD Layer   │    │   Agent Engine            │
│  TypeORM      │    │   (纯 TS 编排)            │
│  Mongoose     │    │   ┌─────────────────┐    │
│  ioredis      │    │   │ IntentRouter    │    │
│               │    │   │ Phase B: 关键词  │    │
│               │    │   │ Phase C: LLM    │    │
│               │    │   └────────┬────────┘    │
│               │    │            │              │
│               │    │   ┌────────▼────────┐    │
│               │    │   │ ActionExecutor  │    │
│               │    │   │ 7个动作分发      │    │
│               │    │   └────────┬────────┘    │
│               │    │            │              │
│               │    │   ┌────────▼────────┐    │
│               │    │   │ Ollama / OpenAI │    │
│               │    │   │ Chat + Tools    │    │
│               │    │   └─────────────────┘    │
└───────────────┘    └─────────────────────────┘
        │                      │
┌───────▼──────────────────────▼──────────────────┐
│              Data Layer                          │
│  MySQL(3307)  MongoDB(27017)  Redis(6379)        │
│  Neo4j(7687)  Chroma(8000)   MinIO(9000)        │
│  Ollama(11434) SearXNG(8080) RabbitMQ(5672)     │
└─────────────────────────────────────────────────┘
```

### 路由分层

```
用户端接口 /api/user/*
├── 聊天相关 → AgentEngine（意图识别 → 动作执行 → LLM 回复）
├── 数据查询 → 直接 CRUD（学习路径/岗位/考试/进度）
└── 异步任务 → BullMQ（路径生成/资源生成/画像分析）

管理端接口 /api/admin/*
└── 直接操作数据库，不走 Agent
```

---

## 五、Agent 引擎设计（纯 TypeScript）

### 设计思路

```
v2.0（Python）：LangGraph StateGraph → Supervisor → Agent 节点路由
v3.0（TS）：    纯代码编排 → IntentRouter → ActionExecutor → Ollama

原因：实际 Agent 逻辑 = 关键词匹配 + Tool Calling + 动作分发
     不需要 LangGraph 的状态机图编排，代码 if/else 更直观
```

### 引擎架构

```typescript
// AgentEngine 核心流程
class AgentEngine {
  // 1. 意图识别（两阶段）
  async processMessage(userId: number, message: string, pageContext: string) {
    // Phase B: 关键词匹配（0ms，覆盖 80%）
    const intent = this.intentRouter.matchKeyword(message);

    // Phase C: LLM Tool Calling（1-2s，处理模糊意图）
    if (!intent) {
      const result = await this.llmService.toolCalling(message, pageContext);
      if (result?.toolCall) intent = result.toolCall;
    }

    // 2. 普通聊天（无意图）
    if (!intent) {
      return this.chatWithMemory(userId, message);
    }

    // 3. 执行动作
    return this.actionExecutor.execute(intent, userId);
  }
}
```

### 意图识别规则（Phase B）

| 用户说 | 匹配意图 | 执行动作 |
|--------|---------|----------|
| "帮我制定学习计划" | `generate_path` | PlannerAgent 生成路径 |
| "推荐适合我的岗位" | `recommend_jobs` | 查 MySQL 岗位表 |
| "设为目标" / "就这个" | `set_target_job` | 更新 MySQL + MongoDB |
| "出几道 React 题" | `generate_exam` | LLM 出题 → 存 MySQL |
| "我的学习进度" | `show_progress` | 查 learning_paths |
| "今天学什么" | `show_today_tasks` | 查当前阶段任务 |
| "学习资源" | `recommend_resources` | 返回静态资源库 |
| "匹配度" / "还差什么" | `match_analysis` | 计算匹配度和差距 |

### LLM Tool Calling 定义（Phase C）

```typescript
const AGENT_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'generate_learning_path',
      description: '为用户生成分阶段的学习路径',
      parameters: {
        type: 'object',
        properties: {
          target_job_id: { type: 'number', description: '目标岗位ID' },
          direction: { type: 'string', description: '学习方向' },
          duration_months: { type: 'number', description: '计划时长（月）' },
        },
      },
    },
  },
  // ... recommend_jobs, set_target_job, generate_exam,
  //     show_progress, recommend_resources
];
```

### 动作执行器

| 动作 | 实现 |
|------|------|
| `recommend_jobs` | 查 MySQL 岗位表 → 计算匹配度 → 返回岗位卡片 |
| `set_target_job` | 更新 MySQL student + MongoDB 画像 |
| `generate_path` | 异步 BullMQ → LLM 生成路径 → 存 MySQL |
| `recommend_resources` | 查静态资源库 → 返回链接列表 |
| `generate_exam` | LLM 出题 → 存 MySQL exam_records |
| `show_progress` | 查 learning_paths → 计算进度 |
| `show_today_tasks` | 查当前阶段未完成技能 |

### 智能聊天（带记忆）

```typescript
async chatWithMemory(userId: number, message: string): Promise<ChatReply> {
  // 1. 读取用户画像（MongoDB）
  const profile = await this.profileService.getProfile(userId);

  // 2. 读取学生信息（MySQL）
  const student = await this.studentRepo.findOne({ where: { userId } });

  // 3. 构建 system prompt（含画像记忆）
  const systemPrompt = this.tutorPrompt.build(profile, student);

  // 4. 调用 Ollama
  const reply = await this.llmService.chat([
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message },
  ]);

  // 5. 解析回复中的动作指令 ```action {...}```
  const actions = this.extractActions(reply);
  const actionResults = await this.actionExecutor.executeAll(actions, userId);

  // 6. 清理回复 + 返回
  return { content: this.cleanReply(reply), actions: actionResults };
}
```

### Agent 接入规范（同事开发用）

> 每个 Agent 独立开发，按此规范实现，最后汇总对接到 AgentEngine。

#### 职责边界

```
你（搭架构的人）负责：
  ✅ 数据库连接（MySQL / MongoDB / Redis / Neo4j）
  ✅ TypeORM 实体定义（所有表）
  ✅ BaseCrudService 泛型 CRUD 引擎
  ✅ 所有 Repository / Service（user、job、learning、profile 等）
  ✅ Auth / Guard / 统一响应格式
  ✅ LLM Service（Ollama / OpenAI 统一封装）
  ✅ IntentRouter + ActionExecutor 核心编排

同事（写 Agent 的人）只需要：
  ✅ 写一个 Action 类（实现 IAgentAction 接口）
  ✅ 注入已有的 Repository / Service（constructor 里声明就行）
  ✅ 写业务逻辑（调 LLM、查数据、返回结果）
  ✅ 注册意图（Phase B 关键词 + Phase C Tool，各加几行配置）
  ✅ 前端如需新卡片，写一个 React 组件

同事不需要碰：
  ❌ 数据库连接配置
  ❌ ORM 实体定义
  ❌ CRUD 基础方法
  ❌ Auth / Guard / 中间件
  ❌ 项目脚手架 / 构建配置
```

#### 可直接注入的服务（你搭好他们用）

| 服务 | 注入名 | 能力 |
|------|--------|------|
| `LlmService` | `llmService` | 调 Ollama / OpenAI，chat / toolCalling |
| `ProfileService` | `profileService` | MongoDB 用户画像读写 |
| `StudentService` | `studentService` | MySQL 学生信息 CRUD |
| `JobService` | `jobService` | MySQL 岗位查询 |
| `LearningPathService` | `learningPathService` | MySQL 学习路径 CRUD |
| `ExamService` | `examService` | MySQL 考试记录 CRUD |
| `ChatHistoryService` | `chatHistoryService` | MongoDB 对话历史 |
| `RedisService` | `redisService` | Redis 缓存/队列 |
| `Neo4jService` | `neo4jService` | Neo4j 图谱查询 |
| `TaskQueueService` | `taskQueueService` | BullMQ 异步任务入队 |

同事只需在 constructor 里声明需要的，NestJS 自动注入：

```typescript
constructor(
  private readonly llmService: LlmService,
  private readonly profileService: ProfileService,
  private readonly jobService: JobService,
) {}
```

#### 接口约定

```typescript
// agent/actions/action.interface.ts

/** 所有 Action 必须实现的接口 */
export interface IAgentAction {
  /** 动作唯一标识，如 "generate_path"、"recommend_jobs" */
  readonly name: string;

  /** 执行动作
   * @param params  意图路由器解析出的参数（Phase B 的 filters 或 Phase C 的 tool arguments）
   * @param userId  当前用户 ID
   * @returns 前端可渲染的结构化结果
   */
  execute(params: Record<string, any>, userId: number): Promise<ActionResult>;
}

/** 动作返回值统一结构 */
export interface ActionResult {
  /** 卡片类型，前端据此选择渲染组件 */
  type: string;  // 如 "jobs" | "exam" | "progress" | "today_tasks" | "resources" | "error"

  /** 卡片数据，前端直接消费 */
  data: any;

  /** 可选：执行后需要更新的用户画像字段（自动写入 MongoDB） */
  profileDelta?: {
    skills_to_add?: Array<{ name: string; level: string }>;
    interests_to_add?: string[];
    goals_to_update?: Record<string, any>;
    chat_insights_to_add?: string[];
  };
}
```

#### 新增 Action 步骤

以 `analyze_resume`（简历分析 Agent）为例：

**第 1 步：创建 Action 文件**

```typescript
// agent/actions/analyze-resume.action.ts

import { Injectable } from '@nestjs/common';
import { IAgentAction, ActionResult } from './action.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LlmService } from '../llm/llm.service';

@Injectable()
export class AnalyzeResumeAction implements IAgentAction {
  readonly name = 'analyze_resume';

  constructor(
    private readonly llmService: LlmService,
    // 注入需要的 Repository / Service
  ) {}

  async execute(params: Record<string, any>, userId: number): Promise<ActionResult> {
    const { resume_text, job_id } = params;

    // 你的业务逻辑
    const analysis = await this.llmService.chat([
      { role: 'system', content: '你是简历分析专家...' },
      { role: 'user', content: `分析以下简历：\n${resume_text}` },
    ]);

    return {
      type: 'resume_analysis',       // 前端卡片类型
      data: {
        score: 85,
        strengths: ['项目经验丰富', '技术栈匹配'],
        weaknesses: ['缺少算法经验'],
        suggestions: ['建议补充 LeetCode 刷题记录'],
      },
    };
  }
}
```

**第 2 步：注册意图（二选一或都注册）**

```typescript
// 方式 A：Phase B 关键词匹配（快速，0ms）
// 在 intent-router.ts 的 INTENT_RULES 数组中追加：

{
  name: 'analyze_resume',
  keywords: ['分析简历', '简历分析', '帮我看看简历', '简历怎么样'],
  description: '分析简历内容',
}


// 方式 B：Phase C Tool Calling（智能，1-2s）
// 在 tool-definitions.ts 的 AGENT_TOOLS 数组中追加：

{
  type: 'function',
  function: {
    name: 'analyze_resume',
    description: '分析用户简历，给出评分和改进建议。当用户提到简历分析、简历评分时调用。',
    parameters: {
      type: 'object',
      properties: {
        resume_text: { type: 'string', description: '简历文本内容' },
        job_id: { type: 'number', description: '目标岗位ID（可选，用于针对性分析）' },
      },
      required: ['resume_text'],
    },
  },
}
```

**第 3 步：注册到 ActionExecutor**

```typescript
// agent/agent.module.ts — 在 Module 中注册

@Module({
  providers: [
    AgentEngine,
    IntentRouter,
    ActionExecutor,
    // ... 其他 action
    AnalyzeResumeAction,  // ← 新增
  ],
})

// agent/action-executor.ts — 在构造函数中注册

@Injectable()
export class ActionExecutor {
  private actions = new Map<string, IAgentAction>();

  constructor(
    // ... 已有 actions
    analyzeResume: AnalyzeResumeAction,  // ← 新增
  ) {
    // 注册所有 action
    this.register(analyzeResume);        // ← 新增
    // this.register(recommendJobs);
    // this.register(setTargetJob);
    // ...
  }

  register(action: IAgentAction) {
    this.actions.set(action.name, action);
  }

  async execute(intent: { name: string; filters: Record<string, any> }, userId: number): Promise<ActionResult> {
    const action = this.actions.get(intent.name);
    if (!action) {
      return { type: 'error', data: { message: `未知动作: ${intent.name}` } };
    }
    return action.execute(intent.filters, userId);
  }
}
```

**第 4 步：前端适配新卡片类型（如需）**

```typescript
// frontend/src/components/chat/ChatCards.tsx

// 在 switch 中新增 case
case 'resume_analysis':
  return <ResumeAnalysisCard data={data} />;
```

#### 开发清单模板

同事拿到后按这个清单开发：

```
Agent 名称：_______________
负责模块：_______________
Action name：_______________

□ 1. 实现 IAgentAction 接口
     文件：agent/actions/xxx.action.ts
     依赖：□ MySQL  □ MongoDB  □ Redis  □ Neo4j  □ LLM  □ 外部API

□ 2. 注册意图识别（至少一种）
     □ Phase B 关键词（intent-router.ts）
     □ Phase C Tool Calling（tool-definitions.ts）

□ 3. 注册到 ActionExecutor（agent.module.ts + action-executor.ts）

□ 4. 定义返回结构
     type: ___________
     data 字段：_______________

□ 5. 前端卡片（如需新类型）
     文件：frontend/src/components/chat/ChatCards.tsx

□ 6. 单元测试
     文件：agent/actions/xxx.action.spec.ts

□ 7. 本地联调
     发送测试消息 → 验证意图识别 → 验证动作执行 → 验证前端渲染
```

#### 独立开发 & 汇总方式

```
各自开发：
├── fork / 新建分支：feature/agent-xxx
├── 按接口规范实现 Action
├── 本地独立测试（可 mock 其他模块）
└── 提交 PR

汇总对接：
├── 所有 Action 放到 agent/actions/ 目录
├── 在 agent.module.ts 注册 Provider
├── 在 action-executor.ts 注册 Action
├── 在 intent-router.ts / tool-definitions.ts 注册意图
├── 运行全量测试
└── 前端如有新卡片类型，在 ChatCards.tsx 追加渲染
```

#### 已有 Action 清单（对照用）

| Action name | 负责人 | 状态 | 文件 |
|-------------|--------|------|------|
| `recommend_jobs` | — | ✅ 已有 | `actions/recommend-jobs.action.ts` |
| `set_target_job` | — | ✅ 已有 | `actions/set-target-job.action.ts` |
| `generate_path` | — | ✅ 已有 | `actions/generate-path.action.ts` |
| `generate_exam` | — | ✅ 已有 | `actions/generate-exam.action.ts` |
| `show_progress` | — | ✅ 已有 | `actions/show-progress.action.ts` |
| `show_today_tasks` | — | ✅ 已有 | `actions/show-today-tasks.action.ts` |
| `recommend_resources` | — | ✅ 已有 | `actions/recommend-resources.action.ts` |
| `analyze_resume` | 待分配 | ❌ 待开发 | — |
| `match_analysis` | 待分配 | ❌ 待开发 | — |
| `grade_homework` | 待分配 | ❌ 待开发 | — |
| `generate_lecture` | 待分配 | ❌ 待开发 | — |
| `update_graph` | 待分配 | ❌ 待开发 | — |

#### 返回数据结构约定（前端渲染用）

```typescript
// 所有 type 对应的 data 结构

// type: "jobs"
interface JobsData {
  id: number;
  title: string;
  company: string;
  location: string;
  salary_range: string;
  required_skills: string[];
  preferred_skills: string[];
  match_score: number;  // 0-100
}

// type: "exam"
interface ExamData {
  exam_id: number;
  skill: string;
  questions: Array<{
    type: 'choice' | 'coding';
    question: string;
    options?: string[];    // 选择题
    template?: string;     // 编程题
    hint?: string;
  }>;
}

// type: "progress"
interface ProgressData {
  total_skills: number;
  done_skills: number;
  current_phase: number;
  match_score: number;
  estimated_date: string;
  phases: Array<{
    name: string;
    total: number;
    done: number;
    status: 'done' | 'current' | 'locked';
  }>;
}

// type: "today_tasks"
interface TodayTasksData {
  phase_name: string;
  tasks: Array<{
    title: string;
    phase: string;
    duration: string;
    status: string;
  }>;
  total: number;
}

// type: "resources"
interface ResourcesData {
  title: string;
  url: string;
  type: string;  // "文档" | "教程" | "视频"
}

// type: "target_set"
interface TargetSetData {
  job_id: number;
  job_title: string;
}

// type: "path_generating"
interface PathGeneratingData {
  task_id: string;
  message: string;
}

// type: "error"
interface ErrorData {
  message: string;
}
```

---

## 六、后端模块结构（NestJS）

### 目录结构

```
backend/
├── src/
│   ├── main.ts                          # NestJS 入口
│   ├── app.module.ts                    # 根模块
│   │
│   ├── common/                          # 公共模块
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   ├── guards/
│   │   │   ├── auth.guard.ts
│   │   │   └── admin.guard.ts
│   │   ├── interceptors/
│   │   │   └── transform.interceptor.ts    # 统一响应格式
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts    # 统一异常处理
│   │   ├── pipes/
│   │   │   └── zod-validation.pipe.ts      # Zod 校验管道
│   │   └── base/
│   │       ├── base-crud.service.ts        # 泛型 CRUD 引擎
│   │       └── base.entity.ts              # 实体基类（createTime/updateTime/state）
│   │
│   ├── config/                          # 配置
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   └── llm.config.ts
│   │
│   ├── database/                        # 数据库连接
│   │   ├── mysql/
│   │   │   └── mysql.module.ts             # TypeORM 模块
│   │   ├── mongodb/
│   │   │   └── mongodb.module.ts           # Mongoose 模块
│   │   ├── redis/
│   │   │   └── redis.module.ts             # ioredis 模块
│   │   └── neo4j/
│   │       └── neo4j.module.ts             # Neo4j 驱动模块
│   │
│   ├── entities/                        # TypeORM 实体（MySQL）
│   │   ├── user.entity.ts
│   │   ├── group.entity.ts
│   │   ├── menu.entity.ts
│   │   ├── session.entity.ts
│   │   ├── student.entity.ts
│   │   ├── job-description.entity.ts
│   │   ├── job-application.entity.ts
│   │   ├── learning-path.entity.ts
│   │   ├── exam-record.entity.ts
│   │   ├── news.entity.ts
│   │   ├── enterprise.entity.ts
│   │   └── resume.entity.ts
│   │
│   ├── schemas/                         # Mongoose Schema（MongoDB）
│   │   ├── user-profile.schema.ts
│   │   ├── chat-history.schema.ts
│   │   └── knowledge-base.schema.ts
│   │
│   ├── dto/                             # 请求/响应 DTO（Zod）
│   │   ├── auth.dto.ts
│   │   ├── user.dto.ts
│   │   ├── job.dto.ts
│   │   ├── learning.dto.ts
│   │   ├── exam.dto.ts
│   │   ├── chat.dto.ts
│   │   └── admin.dto.ts
│   │
│   ├── modules/                         # 业务模块
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── strategies/
│   │   │       └── jwt.strategy.ts
│   │   │
│   │   ├── user/
│   │   │   ├── user.module.ts
│   │   │   ├── user.controller.ts
│   │   │   └── user.service.ts
│   │   │
│   │   ├── student/
│   │   │   ├── student.module.ts
│   │   │   ├── student.controller.ts
│   │   │   └── student.service.ts
│   │   │
│   │   ├── jobs/
│   │   │   ├── jobs.module.ts
│   │   │   ├── jobs.controller.ts
│   │   │   └── jobs.service.ts
│   │   │
│   │   ├── learning-paths/
│   │   │   ├── learning-paths.module.ts
│   │   │   ├── learning-paths.controller.ts
│   │   │   └── learning-paths.service.ts
│   │   │
│   │   ├── exams/
│   │   │   ├── exams.module.ts
│   │   │   ├── exams.controller.ts
│   │   │   └── exams.service.ts
│   │   │
│   │   ├── chat/
│   │   │   ├── chat.module.ts
│   │   │   ├── chat.controller.ts
│   │   │   ├── chat.service.ts
│   │   │   └── chat.gateway.ts          # WebSocket（可选）
│   │   │
│   │   ├── profile/
│   │   │   ├── profile.module.ts
│   │   │   ├── profile.controller.ts
│   │   │   └── profile.service.ts
│   │   │
│   │   ├── news/
│   │   │   ├── news.module.ts
│   │   │   ├── news.controller.ts
│   │   │   └── news.service.ts
│   │   │
│   │   ├── github/
│   │   │   ├── github.module.ts
│   │   │   ├── github.controller.ts
│   │   │   └── github.service.ts
│   │   │
│   │   ├── resume/
│   │   │   ├── resume.module.ts
│   │   │   ├── resume.controller.ts
│   │   │   └── resume.service.ts
│   │   │
│   │   ├── dashboard/
│   │   │   ├── dashboard.module.ts
│   │   │   ├── dashboard.controller.ts
│   │   │   └── dashboard.service.ts
│   │   │
│   │   ├── graph/
│   │   │   ├── graph.module.ts
│   │   │   ├── graph.controller.ts
│   │   │   └── graph.service.ts
│   │   │
│   │   ├── tasks/                       # 异步任务查询
│   │   │   ├── tasks.module.ts
│   │   │   ├── tasks.controller.ts
│   │   │   └── tasks.service.ts
│   │   │
│   │   └── admin/                       # 管理端模块
│   │       ├── admin.module.ts
│   │       ├── admin.controller.ts
│   │       └── admin.service.ts
│   │
│   ├── agent/                           # Agent 引擎
│   │   ├── agent.module.ts
│   │   ├── agent-engine.ts              # 核心编排（替代 LangGraph）
│   │   ├── intent-router.ts             # 意图识别（Phase B + C）
│   │   ├── action-executor.ts           # 动作执行分发
│   │   ├── actions/
│   │   │   ├── recommend-jobs.action.ts
│   │   │   ├── set-target-job.action.ts
│   │   │   ├── generate-path.action.ts
│   │   │   ├── generate-exam.action.ts
│   │   │   ├── show-progress.action.ts
│   │   │   ├── show-today-tasks.action.ts
│   │   │   └── recommend-resources.action.ts
│   │   ├── prompts/
│   │   │   ├── tutor.prompt.ts           # AI 助教 system prompt
│   │   │   └── agent-prompts.ts          # 各 Agent 角色 prompt
│   │   └── llm/
│   │       ├── llm.service.ts            # Ollama / OpenAI 统一调用
│   │       └── tool-definitions.ts       # Tool Calling 定义
│   │
│   ├── services/                        # 跨模块服务
│   │   ├── profile-scheduler.service.ts  # 定时画像分析
│   │   ├── news-scheduler.service.ts     # 定时资讯抓取
│   │   ├── chat-archive.service.ts       # 对话归档（Redis → MongoDB）
│   │   └── knowledge-base.service.ts     # 知识库管理
│   │
│   └── queue/                           # 任务队列
│       ├── queue.module.ts
│       ├── agent.processor.ts            # BullMQ 处理器
│       └── resource.processor.ts         # 资源生成处理器
│
├── package.json
├── tsconfig.json
├── nest-cli.json
├── .env
├── .env.example
└── README.md
```

---

## 七、泛型 CRUD 引擎

### 设计（1:1 迁移 Python CRUDBase）

```typescript
// common/base/base-crud.service.ts
export abstract class BaseCrudService<T extends BaseEntity> {
  constructor(protected readonly repository: Repository<T>) {}

  // 单条查询（自动过滤 state=1）
  async findById(id: number): Promise<T | null> {
    return this.repository.findOne({
      where: { id, state: 1 } as any,
    });
  }

  // 分页列表 + 动态筛选
  async findMany(options: {
    skip?: number;
    limit?: number;
    filters?: Record<string, any>;
  }): Promise<T[]> {
    const { skip = 0, limit = 20, filters = {} } = options;
    const where: any = { state: 1 };
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined) {
        where[key] = value;
      }
    }
    return this.repository.find({ where, skip, take: limit });
  }

  // 计数
  async count(filters: Record<string, any> = {}): Promise<number> {
    const where: any = { state: 1, ...filters };
    return this.repository.count({ where });
  }

  // 创建（自动填充时间戳）
  async create(data: Partial<T>): Promise<T> {
    const now = Date.now();
    const entity = this.repository.create({
      ...data,
      createTime: data.createTime ?? now,
      updateTime: data.updateTime ?? now,
      state: data.state ?? 1,
    } as any);
    return this.repository.save(entity);
  }

  // 更新
  async update(id: number, data: Partial<T>): Promise<T | null> {
    const entity = await this.findById(id);
    if (!entity) return null;
    Object.assign(entity, data, { updateTime: Date.now() });
    return this.repository.save(entity);
  }

  // 软删除
  async delete(id: number): Promise<boolean> {
    const entity = await this.findById(id);
    if (!entity) return false;
    entity.state = 0;
    entity.updateTime = Date.now();
    await this.repository.save(entity);
    return true;
  }

  // 多字段模糊搜索
  async search(keyword: string, fields: string[], skip = 0, limit = 20): Promise<T[]> {
    if (!keyword || !fields.length) return this.findMany({ skip, limit });
    const qb = this.repository.createQueryBuilder('e')
      .where('e.state = :state', { state: 1 });
    const conditions = fields.map((f, i) => `e.${f} LIKE :kw${i}`);
    qb.andWhere(`(${conditions.join(' OR ')})`, 
      Object.fromEntries(fields.map((f, i) => [`kw${i}`, `%${keyword}%`]))
    );
    return qb.skip(skip).take(limit).getMany();
  }
}
```

### 实体基类

```typescript
// common/base/base.entity.ts
export abstract class BaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', comment: '创建时间戳ms' })
  createTime: number;

  @Column({ type: 'bigint', comment: '更新时间戳ms' })
  updateTime: number;

  @Column({ type: 'int', default: 1, comment: '1=正常 0=删除' })
  state: number;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '租户/单位ID' })
  unitId: string | null;
}
```

### 实体示例

```typescript
// entities/user.entity.ts
@Entity('user')
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  realName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar: string;

  @Column({ type: 'bigint', nullable: true })
  groupId: number;

  @Column({ type: 'int', default: 1, comment: '1=启用 0=禁用' })
  status: number;
}
```

---

## 八、API 接口清单

### 用户端 `/api/user/*`

| 方法 | 路径 | 说明 | 走Agent |
|------|------|------|---------|
| POST | `/api/user/chat` | 发送消息（AI 聊天 + 意图执行） | ✅ |
| GET | `/api/user/chat/sessions` | 获取对话历史列表 | ❌ |
| GET | `/api/user/chat/sessions/:id` | 获取单个对话详情 | ❌ |
| POST | `/api/user/onboarding` | 提交 Onboarding 信息 | ❌ |
| GET | `/api/user/dashboard` | 首页数据（任务/日程/统计） | ❌ |
| GET | `/api/user/learning-paths` | 获取学习路径 | ❌ |
| POST | `/api/user/learning-paths` | 创建学习路径 | ❌ |
| PUT | `/api/user/learning-paths/:id` | 更新学习路径 | ❌ |
| GET | `/api/user/jobs` | 岗位列表（按匹配度排序） | ❌ |
| GET | `/api/user/jobs/:id` | 岗位详情 | ❌ |
| POST | `/api/user/exams` | 创建考试（LLM 出题） | ✅ |
| GET | `/api/user/exams/:id` | 获取考试题目 | ❌ |
| POST | `/api/user/exams/:id/submit` | 提交考试答案 | ❌ |
| GET | `/api/user/profile` | 获取用户画像 | ❌ |
| PUT | `/api/user/profile` | 更新用户画像 | ❌ |
| POST | `/api/user/github/analyze` | GitHub 仓库解析 | ✅ |
| POST | `/api/user/projects/save` | 保存项目经历 | ❌ |
| GET | `/api/user/news` | 资讯列表 | ❌ |
| GET | `/api/user/progress/summary` | 学习进度汇总 | ❌ |
| POST | `/api/user/progress/read` | 记录阅读完成 | ❌ |
| POST | `/api/user/progress/quiz` | 记录习题完成 | ❌ |
| GET | `/api/user/graph` | 知识图谱数据 | ❌ |
| POST | `/api/user/resume/generate` | 生成简历 | ✅ |
| GET | `/api/user/tasks/:id` | 查询异步任务状态 | ❌ |

### 管理端 `/api/admin/*`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/auth/login` | 管理员登录 |
| GET | `/api/admin/dashboard` | 看板数据 |
| GET | `/api/admin/users` | 用户列表 |
| GET | `/api/admin/users/:id` | 用户详情 |
| PUT | `/api/admin/users/:id/status` | 启用/禁用用户 |
| GET | `/api/admin/jobs` | 岗位列表 |
| POST | `/api/admin/jobs` | 创建岗位 |
| PUT | `/api/admin/jobs/:id` | 更新岗位 |
| DELETE | `/api/admin/jobs/:id` | 下架岗位 |
| GET | `/api/admin/enterprise` | 企业列表 |
| POST | `/api/admin/enterprise` | 创建企业 |
| PUT | `/api/admin/enterprise/:id` | 审核企业 |
| GET | `/api/admin/resumes` | 简历投递列表 |
| PUT | `/api/admin/resumes/:id` | 审核简历 |
| GET | `/api/admin/exams` | 考试题库 |
| POST | `/api/admin/exams` | 创建考试题 |
| PUT | `/api/admin/exams/:id` | 编辑考试题 |
| GET | `/api/admin/graph` | 知识图谱管理 |
| GET | `/api/admin/news` | 资讯列表 |
| POST | `/api/admin/news` | 发布资讯 |
| PUT | `/api/admin/settings` | 系统配置 |

### 响应格式

```typescript
// 统一响应
interface ApiResponse<T> {
  code: number;       // 200=成功, 400=参数错误, 401=未登录, 403=无权限, 500=服务错误
  data: T;
  message: string;
}

// 分页响应
interface PaginatedResponse<T> {
  code: number;
  data: {
    list: T[];
    total: number;
    page: number;
    pageSize: number;
  };
  message: string;
}
```

---

## 九、数据库表设计（MySQL）

### 用户相关

```sql
-- 用户表（已有）
CREATE TABLE `user` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `realName` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(200) DEFAULT NULL,
  `avatar` varchar(500) DEFAULT NULL,
  `groupId` bigint DEFAULT NULL,
  `status` int DEFAULT 1,
  `createTime` bigint DEFAULT NULL,
  `updateTime` bigint DEFAULT NULL,
  `state` int DEFAULT 1,
  `unitId` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
);

-- 学生表（已有）
CREATE TABLE `sp_students` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `userId` bigint DEFAULT NULL COMMENT '关联user表',
  `name` varchar(100) DEFAULT NULL,
  `studentNo` varchar(50) DEFAULT NULL,
  `classId` bigint DEFAULT NULL,
  `collegeId` bigint DEFAULT NULL,
  `major` varchar(100) DEFAULT NULL,
  `grade` varchar(20) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(200) DEFAULT NULL,
  `target_job_id` bigint DEFAULT NULL COMMENT '目标岗位FK',
  `skills` json DEFAULT NULL COMMENT '技能列表 [{name,level,source}]',
  `projects` json DEFAULT NULL COMMENT '项目经历',
  `onboarding_completed` int DEFAULT 0,
  `createTime` bigint DEFAULT NULL,
  `updateTime` bigint DEFAULT NULL,
  `state` int DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_userId` (`userId`)
);

-- 会话表（已有）
CREATE TABLE `session` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `userId` bigint NOT NULL,
  `token` varchar(500) NOT NULL,
  `ip` varchar(50) DEFAULT NULL,
  `userAgent` varchar(500) DEFAULT NULL,
  `expireTime` bigint DEFAULT NULL,
  `createTime` bigint DEFAULT NULL,
  `updateTime` bigint DEFAULT NULL,
  `state` int DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_token` (`token`(191))
);
```

### 业务表

```sql
-- 岗位表（已有）
CREATE TABLE `job_descriptions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL COMMENT '岗位名称',
  `company` varchar(200) DEFAULT NULL,
  `jd_text` text COMMENT '原始JD文本',
  `required_skills` json DEFAULT NULL,
  `preferred_skills` json DEFAULT NULL,
  `salary_range` varchar(100) DEFAULT NULL,
  `location` varchar(200) DEFAULT NULL,
  `status` int DEFAULT 1 COMMENT '0=下架 1=上架',
  `source` varchar(50) DEFAULT 'manual',
  `neo4j_node_id` varchar(100) DEFAULT NULL,
  `createTime` bigint DEFAULT NULL,
  `updateTime` bigint DEFAULT NULL,
  `state` int DEFAULT 1,
  PRIMARY KEY (`id`)
);

-- 学习路径表（已有）
CREATE TABLE `learning_paths` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `target_job_id` bigint DEFAULT NULL,
  `path_data` json DEFAULT NULL COMMENT '路径结构：阶段→技能点→资源',
  `current_phase` int DEFAULT 0,
  `match_score` decimal(5,2) DEFAULT NULL,
  `estimated_date` varchar(50) DEFAULT NULL,
  `status` int DEFAULT 1,
  `createTime` bigint DEFAULT NULL,
  `updateTime` bigint DEFAULT NULL,
  `state` int DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`)
);

-- 考试记录表（已有）
CREATE TABLE `exam_records` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `exam_type` int DEFAULT 1 COMMENT '1=通用技能 2=岗位考试',
  `skill_name` varchar(100) DEFAULT NULL,
  `job_id` bigint DEFAULT NULL,
  `answers` json DEFAULT NULL COMMENT '完整题目数据',
  `score` decimal(5,2) DEFAULT NULL,
  `passed` int DEFAULT 0,
  `retry_count` int DEFAULT 0,
  `wrong_analysis` json DEFAULT NULL,
  `createTime` bigint DEFAULT NULL,
  `updateTime` bigint DEFAULT NULL,
  `state` int DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`)
);

-- 岗位申请表（已有）
CREATE TABLE `job_applications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `job_id` bigint NOT NULL,
  `resume_id` bigint DEFAULT NULL,
  `reviewer_agent_score` decimal(5,2) DEFAULT NULL,
  `reviewer_agent_comment` text,
  `admin_decision` int DEFAULT 0 COMMENT '0=待处理 1=通过 2=拒绝',
  `admin_comment` varchar(500) DEFAULT NULL,
  `enterprise_email` varchar(200) DEFAULT NULL,
  `createTime` bigint DEFAULT NULL,
  `updateTime` bigint DEFAULT NULL,
  `state` int DEFAULT 1,
  PRIMARY KEY (`id`)
);

-- 资讯表（已有）
CREATE TABLE `news` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(500) NOT NULL,
  `content` text,
  `url` varchar(1000) DEFAULT NULL,
  `category` varchar(50) DEFAULT NULL COMMENT 'industry/tech/recruit',
  `source` varchar(100) DEFAULT NULL,
  `status` int DEFAULT 1,
  `createTime` bigint DEFAULT NULL,
  `updateTime` bigint DEFAULT NULL,
  `state` int DEFAULT 1,
  PRIMARY KEY (`id`)
);

-- 企业表（已有）
CREATE TABLE `enterprise` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `contact_email` varchar(200) DEFAULT NULL,
  `contact_name` varchar(100) DEFAULT NULL,
  `status` int DEFAULT 0 COMMENT '0=待审核 1=已通过 2=已拒绝',
  `createTime` bigint DEFAULT NULL,
  `updateTime` bigint DEFAULT NULL,
  `state` int DEFAULT 1,
  PRIMARY KEY (`id`)
);

-- 简历表（已有）
CREATE TABLE `resumes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `job_id` bigint DEFAULT NULL,
  `content` json DEFAULT NULL COMMENT '简历结构化内容',
  `pdf_url` varchar(500) DEFAULT NULL,
  `status` int DEFAULT 1,
  `createTime` bigint DEFAULT NULL,
  `updateTime` bigint DEFAULT NULL,
  `state` int DEFAULT 1,
  PRIMARY KEY (`id`)
);
```

---

## 十、MongoDB 集合设计

### user_profiles（用户画像）

```json
{
  "_id": "ObjectId",
  "user_id": "123",
  "version": 5,
  "basic": {
    "school": "重庆电子工程职业学院",
    "major": "软件工程",
    "grade": "大三",
    "graduation_year": 2027
  },
  "skills": [
    { "name": "JavaScript", "level": "熟练", "source": "onboarding", "updated_at": 1717800000000 },
    { "name": "React", "level": "熟悉", "source": "chat", "updated_at": 1717800000000 }
  ],
  "goals": {
    "direction": "前端开发",
    "target_job_id": 5,
    "target_job_title": "前端开发工程师",
    "deadline": "2027-06"
  },
  "traits": {
    "interests": ["前端", "UI设计"],
    "strengths": ["学习能力强", "逻辑思维好"],
    "weaknesses": ["算法薄弱", "项目经验少"]
  },
  "projects": [
    {
      "name": "ZhiPath",
      "description": "人岗匹配系统",
      "tech_stack": ["React", "FastAPI", "Neo4j"],
      "role": "核心开发者",
      "github_url": "https://github.com/...",
      "highlights": ["多Agent架构", "知识图谱可视化"]
    }
  ],
  "chat_insights": [
    { "content": "用户提到最近在学 Docker", "source": "chat", "extracted_at": 1717800000000 }
  ],
  "learning_history": [
    { "action": "completed_skill", "skill": "React Hooks", "timestamp": 1717800000000 }
  ],
  "created_at": 1717800000000,
  "updated_at": 1717800000000
}
```

### chat_histories（对话历史）

```json
{
  "_id": "ObjectId",
  "user_id": "123",
  "page": "chat",
  "messages": [
    { "role": "user", "content": "推荐适合我的岗位", "timestamp": 1717800000000 },
    { "role": "assistant", "content": "根据你的画像...", "actions": [...], "timestamp": 1717800001000 }
  ],
  "created_at": 1717800000000,
  "updated_at": 1717800000000
}
```

### knowledge_base（知识库）

```json
{
  "_id": "ObjectId",
  "skill": "React Hooks",
  "content_type": "lecture",
  "content": "# React Hooks 讲义\n\n## useState...",
  "metadata": {
    "version": 2,
    "generated_by": "resource_agent",
    "reviewed": true
  },
  "created_at": 1717800000000,
  "updated_at": 1717800000000
}
```

---

## 十一、核心业务流程

### 新用户完整流程

```
注册 → 登录
  ↓
自动跳转 /user/chat（onboardingCompleted=false）
  ↓
左侧显示 5 步引导进度条
  ↓
AI 自动开场："你好！先聊聊你的情况吧"
  ↓
对话收集信息（AgentEngine 意图识别驱动）：
  "重电的，软件工程" → 画像提取
  "大三，会 JS 和 Python" → 技能入库
  "想做前端" → 触发 recommend_jobs
  ↓
AI 推荐岗位（JobCard 卡片）
  ↓
用户点击"设为目标"
  → 触发 set_target_job（MySQL + MongoDB）
  → 触发 generate_path（BullMQ 异步 → MySQL）
  ↓
AI 总结："已设为目标，正在规划学习路径..."
  ↓
用户去 /user/home → Dashboard 有数据
用户去 /user/learning → 看到完整路径
用户去 /user/exam-coding?id=xxx → 做题
```

### 老用户日常流程

```
登录 → /user/chat
  ↓
左侧快捷操作面板：
  [今天学什么] [推荐岗位] [学习路径]
  ↓
用户："今天学什么"
  → Phase B → show_today_tasks
  → 查 MySQL learning_paths 当前阶段
  → 返回 TodayTasksCard
  ↓
用户："出几道 React 题"
  → Phase B → generate_exam
  → LLM 出题 → 存 MySQL exam_records
  → 返回 ExamCard（预览 + "做题"按钮）
  ↓
用户点击"做题"
  → 跳转 /user/exam-coding?id={exam_id}
  → 从 API 加载真实题目
  → 答题 → 提交 → 批改
  → 结果存回 MySQL
```

### 知识库运作机制

```
LLM 生成讲义大纲
  ↓
存入 MongoDB knowledge_base（全平台复用）
  ↓
Agent 生成多模态资源：
  ├── 选择题 / 填空题 / 编程题 / 作文题
  └── 知识图谱数据（Neo4j → React Flow 渲染）
  ↓
质量审查过滤
  ↓
每周定期更新：
  SearXNG 搜索最新行业资料
  → 与知识库内容对比
  → 发现出入 → 标记待审查
  → 结合 LLM 判断是否更新
```

### 考试机制

```
【通用技能考试】
Agent 出题 → 管理员审核 → 上架题库
  ↓
用户完成该技能点学习后参加考试
  ↓
通过 → 知识点掌握 → 路径进度推进
未通过 → 错题分析 → 针对性学习计划 → 一周内限次重考

【岗位考试】
企业真题 + Agent 生成 → 管理员校准审核
  ↓
用户完成阶段学习后解锁
  ↓
通过 → 匹配度大幅提升 → 可投递简历
```

### 简历投递闭环

```
用户在岗位页生成针对性简历
  ↓
一键投递 → 提交到管理端
  ↓
ReviewerAgent 初步分析（建议性质，决策权在人）
  ↓
管理员查看建议 → 做最终决策
  ├── 通过 → 发送至企业联络员邮箱
  └── 不通过 → 通知用户原因
```

### GitHub 项目导入

```
用户粘贴 GitHub 仓库链接
  ↓
后端解析 URL → 提取 owner/repo
  ↓
并行调用 GitHub API：
  ├── GET /repos/{owner}/{repo}           → 元数据
  ├── GET /repos/.../contents/README.md   → 项目描述
  ├── GET /repos/.../contents/package.json → 技术栈
  └── GET /repos/.../git/trees/{sha}      → 目录结构
  ↓
Agent 分析 → 结构化结果
  ↓
用户编辑确认 → 保存到 MongoDB
  ├── 项目经历写入 profile.projects
  ├── 技能列表自动补充
  └── Neo4j 技能关系更新
  ↓
下游联动：匹配度重算 / 简历数据源更新 / 学习路径调整

缓存策略：同一仓库 24h Redis 缓存
频率控制：GitHub Token 5000次/小时
```

---

## 十二、前端页面路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/login` | 登录 | 账号密码，admin → /admin，student → /user |
| `/user/chat` | AI 聊天 | **默认首页**，Onboarding 引导 |
| `/user/home` | Dashboard | 目标岗位、今日任务、统计 |
| `/user/learning` | 学习路径 | 分阶段技能树 + 讲义 + 习题 |
| `/user/jobs` | 岗位浏览 | 匹配度排序 + 详情 + 投递 |
| `/user/exam-coding` | 考试 | 支持 `?id=xxx` 加载真实题目 |
| `/user/news` | 资讯 | 行业动态/技术趋势/招聘 |
| `/user/profile` | 个人信息 | 画像 + 项目经历 + GitHub 导入 |
| `/admin/dashboard` | 看板 | 数据卡片 + 中间件状态 |
| `/admin/users` | 用户管理 | 列表/详情/禁用 |
| `/admin/jobs` | 岗位管理 | 录入/JD解析/上下架 |
| `/admin/enterprise` | 企业管理 | 入驻审核 |
| `/admin/resumes` | 简历处理 | 投递列表/AI建议/决策 |
| `/admin/exams` | 题库管理 | 出题/审核/编辑 |
| `/admin/graph` | 图谱管理 | Neo4j 可视化/修正 |
| `/admin/news` | 资讯管理 | 发布/上下架 |
| `/admin/settings` | 系统配置 | 模型切换/Agent开关/Token限额 |

---

## 十三、全局组件

### AI 浮窗（右下角常驻）

```
形态：
├── 默认：右下角悬浮按钮
├── 点击展开：小浮窗（聊天气泡模式）
└── 点击放大：全屏对话模式（可缩回）

上下文感知（按页面独立 session）：
├── 主页面 → 今日任务助手
├── 学习路径页 → 学习进度助手
├── 岗位页 → 岗位分析助手
├── 个人信息页 → 画像完善助手
└── 资讯页 → 阅读理解助手（临时，不存库）

技术实现：
├── 用户画像 → MongoDB（全局共享）
├── 对话历史 → Redis（热）+ MongoDB（冷）
└── Session 隔离 → 按页面区分
```

### 头像浮窗（右上角）

```
点击头像弹出：
├── 个人信息 → /user/profile
├── 我的学习路径 → /user/learning
├── 目标职位（可重新匹配）→ /user/jobs
├── 设置
└── 退出登录

换目标岗位逻辑：
├── 已掌握技能点进度全部保留
├── AI 分析新旧岗位差异
├── 追加新技能到学习路径
├── 不再需要的技能归档到"已学技能"
└── 学习路径平滑更新，不推倒重来
```

---

## 十四、开发计划

### Phase 1：项目初始化 + CRUD 引擎（1天）

```
├── NestJS 项目脚手架
├── TypeORM + MySQL 连接
├── Mongoose + MongoDB 连接
├── ioredis + Redis 连接
├── 泛型 CRUD 引擎（BaseCrudService）
├── 实体定义（所有 MySQL 表）
├── Auth 模块（JWT + Guard）
└── 统一响应格式 + 异常过滤
```

### Phase 2：用户端 API 迁移（2天）

```
├── Auth 模块（登录/注册/鉴权）
├── User 模块
├── Student 模块（含 Onboarding）
├── Jobs 模块
├── Learning Paths 模块
├── Exams 模块
├── Profile 模块（MongoDB）
├── Dashboard 模块
├── News 模块
├── Progress 模块
└── Tasks 模块（异步任务查询）
```

### Phase 3：Agent 引擎迁移（2天）

```
├── IntentRouter（Phase B 关键词匹配）
├── LLM Service（Ollama / OpenAI 统一接口）
├── Tool Calling（Phase C）
├── ActionExecutor（7个动作迁移）
├── TutorPrompt（带画像记忆的 system prompt）
├── AgentEngine（核心编排）
└── BullMQ 任务队列（替代自研队列）
```

### Phase 4：管理端 + 定时任务（1天）

```
├── Admin 模块（所有管理端 CRUD）
├── ProfileScheduler（定时画像分析）
├── NewsScheduler（定时资讯抓取）
├── ChatArchive（对话归档 Redis → MongoDB）
└── KnowledgeBase 服务
```

### Phase 5：联调 + 前端适配（1天）

```
├── 前端 API 地址切换到 NestJS
├── 接口格式对齐（响应结构统一）
├── Auth 流程联调
├── 聊天流程联调
└── 全量页面测试
```

---

## 十五、中间件使用情况

| 中间件 | 端口 | 当前用途 | 计划用途 |
|--------|------|----------|----------|
| MySQL | 3307 | 用户/岗位/学习路径/考试 | + 知识库索引 |
| MongoDB | 27017 | 用户画像/对话历史 | + 知识库内容 |
| Redis | 6379 | 对话缓存/活跃标记 | + BullMQ 队列 |
| Neo4j | 7687 | 基础图谱数据 | + 学习路径联动 |
| Chroma | 8000 | 未使用 | + RAG 知识检索 |
| RabbitMQ | 5672 | 未使用 | 可选（BullMQ 默认用 Redis） |
| MinIO | 9000 | 未使用 | + 文件存储（简历PDF） |
| SearXNG | 8080 | 未使用 | + 资讯抓取 |
| Ollama | 11434 | LLM 调用 | 不变 |

---

## 十六、注意事项

```
1. 前端已完成的页面保持不变，只切换后端 API 地址
2. 数据库表结构不变，现有数据可直接使用
3. Agent 逻辑从 LangGraph 迁移到纯 TS 编排，行为保持一致
4. 认证方式从 Bearer Token 改为 JWT（兼容旧 token 过渡期）
5. 每个模块完成后立刻测试，逐模块替换
6. Python 后端保留为参考，不删除
7. 统一使用 pnpm 作为包管理器
8. 环境变量统一通过 .env 管理，提供 .env.example
```

---

*文档结束 — 智途 ZhiPath v3.0*

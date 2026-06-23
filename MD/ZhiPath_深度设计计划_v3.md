# 智途 ZhiPath — 深度设计计划 v3.0

> 基于 CONSTITUTION.md + 业务深度设计_v2 + 2026-06-13 审计结果
> 目标：补齐 CONSTITUTION 未覆盖的关键设计，形成可落地的完整蓝图
> 2026-06-13

---

## 目录

- [一、核心循环：日常微循环设计](#一核心循环日常微循环设计)
- [二、Skill Model — 技能生命周期深度设计](#二skill-model--技能生命周期深度设计)
- [三、MatchAgent — 匹配度计算深度设计](#三matchagent--匹配度计算深度设计)
- [四、PlannerAgent — 学习路径生成深度设计](#四planneragent--学习路径生成深度设计)
- [五、ReviewerAgent — 质量审查深度设计](#五revieweragent--质量审查深度设计)
- [六、冷启动问题 — 新用户策略](#六冷启动问题--新用户策略)
- [七、AI 浮窗 — 上下文感知深度设计](#七ai-浮窗--上下文感知深度设计)
- [八、考试机制深度设计](#八考试机制深度设计)
- [九、数据飞轮](#九数据飞轮)
- [十、边缘场景深度设计](#十边缘场景深度设计)
- [实施路线图与优先级](#实施路线图与优先级)

---

## 一、核心循环：日常微循环设计

### 1.1 当前设计的问题

CONSTITUTION 定义了完整闭环（Onboarding → 匹配 → 学习 → 考试 → 投递），但缺少**日常微循环**。学生不是每天都去投简历，那每天打开的理由是什么？

### 1.2 Daily Micro-Loop 设计

```
┌─────────────────────────────────────────────────────┐
│                  Daily Micro-Loop                    │
│                                                     │
│   打开 → 看今日任务 → 学1个技能点 → 做几道题        │
│    ↑                                        │       │
│    └──── 看到匹配度涨了 ← 进度推进 ←────────┘       │
│                                                     │
│   关键：匹配度增长是核心激励物                         │
│   每完成一个技能点 → 匹配度 +X% → 可视化反馈          │
└─────────────────────────────────────────────────────┘
```

### 1.3 匹配度实时反馈事件表

| 触发事件 | 匹配度变化 | 展示方式 | 实现位置 |
|----------|-----------|----------|----------|
| 完成技能点学习 | +1~2% | Toast: "匹配度从 62% → 64% 🎉" | `session.service.ts` → `match-agent.service.ts` |
| 通过技能考试 | +3~5% | 弹窗: "恭喜！React Hooks 掌握认证通过" | `exam.service.ts` → `match-agent.service.ts` |
| 通过阶段考试 | +10~15% | 全屏庆祝动画 | `exam.service.ts` → 前端 `MatchScoreToast.tsx` |
| 添加项目经历 | +5~8% | "简历更强了，匹配度提升" | `profile.service.ts` → `match-agent.service.ts` |
| 3天未学习 | -1% | 通知: "技能会生锈哦" | 定时任务 → `notification.service.ts` |

### 1.4 事件驱动的 MatchAgent 增量更新

**核心改变**：MatchAgent 从"一次性计算"变为"事件驱动的增量更新"。

```
当前架构（一次性）：
  用户请求 → calculateMatch() → 返回结果 → 结束

目标架构（事件驱动）：
  事件总线（BullMQ）
  ├── task_completed   → recalculateMatch(userId) → emitMatchUpdate()
  ├── exam_passed      → recalculateMatch(userId) → emitMatchUpdate()
  ├── skill_added      → recalculateMatch(userId) → emitMatchUpdate()
  ├── project_added    → recalculateMatch(userId) → emitMatchUpdate()
  └── inactivity_3d    → decayMatch(userId) → emitNotification()
```

**涉及文件改造**：

| 文件 | 改造内容 |
|------|----------|
| `backend-ts/src/services/match-agent.service.ts` | 新增 `recalculateOnEvent(userId, eventType)` 方法；新增 `decayMatch(userId)` 方法 |
| `backend-ts/src/services/session.service.ts` | `endSession()` 完成后触发 `match-agent.recalculateOnEvent()` |
| `backend-ts/src/services/exam.service.ts` | `submitExam()` 通过后触发 `match-agent.recalculateOnEvent()` |
| `backend-ts/src/services/skill.service.ts` | `addSkill()` / `updateMastery()` 后触发 `match-agent.recalculateOnEvent()` |
| `backend-ts/src/services/profile.service.ts` | 项目经历变更后触发 `match-agent.recalculateOnEvent()` |
| `backend-ts/src/services/notification.service.ts` | 匹配度变化时自动创建通知 |
| `backend-ts/src/modules/events/events.service.ts` | SSE 推送匹配度变化到前端 |
| `frontend/src/components/MatchScoreToast.tsx` | 接收 SSE 事件，展示匹配度变化 Toast |

### 1.5 Dashboard 今日任务流（前端改造）

```
当前 Dashboard：
  ├── 欢迎语
  ├── 今日任务列表（可能为空）
  └── 其他统计

目标 Dashboard（Daily Micro-Loop 入口）：
  ├── 匹配度卡片（大数字 + 趋势箭头 + 今日变化）
  ├── 今日任务卡片（最多3个，一键开始）
  ├── 学习进度条（当前阶段进度）
  ├── 连续学习天数（火焰图标 + 天数）
  └── 快捷入口（速测 / 岗位推荐 / 知识图谱）
```

**涉及文件**：`frontend/src/pages/user/Dashboard.tsx`（重写）

---

## 二、Skill Model — 技能生命周期深度设计

### 2.1 技能的四种来源与信任度

| 来源 | source 值 | trust_weight | 说明 |
|------|-----------|-------------|------|
| Onboarding 自报 | `self_report` | 0.3 | 用户可能高估自己 |
| 对话中提到 | `conversation` | 0.5 | AI 从聊天中提取 |
| GitHub 项目证明 | `github` | 0.7 | 有代码佐证 |
| 考试通过 | `exam` | 1.0 | 最高确认等级 |

**匹配度加权公式**：
```
effective_skill = mastery_pct × trust_weight
```

**现状检查**：`user_skills_v3` 表已有 `mastery_pct`、`trust_weight`、`source` 字段，`skill.service.ts` 已实现基础 CRUD。需要补充的是**信任度升级机制**。

### 2.2 信任度升级机制

```
升级路径：
  self_report(0.3) ──通过考试──→ exam(1.0)
  self_report(0.3) ──GitHub佐证──→ github(0.7)
  conversation(0.5) ──通过考试──→ exam(1.0)
  github(0.7) ──通过考试──→ exam(1.0)

触发时机：
  考试通过 → exam.service.ts 调用 skill.service.ts.upgradeTrust(userId, skillName, 'exam', 1.0)
  GitHub导入 → profile-agent.service.ts 调用 skill.service.ts.upgradeTrust(userId, skillName, 'github', 0.7)
```

**涉及文件改造**：

| 文件 | 改造内容 |
|------|----------|
| `backend-ts/src/services/skill.service.ts` | 新增 `upgradeTrust(userId, skillName, newSource, newWeight)` 方法 |
| `backend-ts/src/services/exam.service.ts` | `submitExam()` 通过后调用 `skill.upgradeTrust()` |
| `backend-ts/src/services/profile-agent.service.ts` | GitHub 导入后调用 `skill.upgradeTrust()` |

### 2.3 技能衰减模型

**目的**：防止"考完就忘"的技能充数。

```
衰减规则：
  考试通过后：确认状态，3个月内不衰减（grace_period = 90天）
  3个月后未使用：每过1个月 trust_weight -0.1（最低降到 0.3）
  重新做题/完成相关任务：恢复到原始 trust_weight

衰减检查频率：每天凌晨定时任务（@Cron）
```

**数据库变更**：

```sql
-- user_skills_v3 新增字段
ALTER TABLE user_skills_v3 ADD COLUMN last_activity_at DATETIME COMMENT '最后活跃时间（做题/学习/项目）';
ALTER TABLE user_skills_v3 ADD COLUMN confirmed_at DATETIME COMMENT '考试确认时间';
ALTER TABLE user_skills_v3 ADD COLUMN original_trust_weight DECIMAL(3,2) COMMENT '原始信任度（衰减恢复用）';
```

**涉及文件**：

| 文件 | 改造内容 |
|------|----------|
| `backend-ts/src/entities/user-skill.entity.ts` | 新增 `last_activity_at`、`confirmed_at`、`original_trust_weight` 字段 |
| `backend-ts/src/services/skill.service.ts` | 新增 `decayCheck()` 方法（定时调用）；新增 `refreshActivity(userId, skillName)` 方法 |
| `backend-ts/src/services/task-scheduler.service.ts` | 每日任务完成时调用 `skill.refreshActivity()` |
| `backend-ts/src/services/exam.service.ts` | 考试通过时设置 `confirmed_at` 和 `original_trust_weight` |
| `backend-ts/src/modules/scheduler/scheduler.module.ts` | 注册每日衰减检查定时任务 |

### 2.4 技能依赖图（Neo4j 深度利用）

**当前状态**：Neo4j 存技能-岗位关系（静态），`graph-enhanced.service.ts` 有基础 CRUD。

**扩展目标**：Neo4j 存技能-技能依赖关系（动态学习路径基础）。

```
依赖关系示例：
  React Hooks ──depends_on──→ JavaScript ES6+
  React Router ──depends_on──→ React Hooks
  Next.js ──depends_on──→ React Router + Node.js 基础
  TypeScript ──depends_on──→ JavaScript ES6+

用途：
  PlannerAgent 生成路径时按依赖拓扑排序
  → 先学基础，再学上层
  → 避免用户"看不懂"的挫败感
```

**Neo4j Cypher 模式**：
```cypher
// 创建依赖关系
MATCH (a:Skill {name: 'React Hooks'}), (b:Skill {name: 'JavaScript ES6+'})
CREATE (a)-[:DEPENDS_ON {weight: 1.0}]->(b)

// 查询某技能的所有前置依赖（递归）
MATCH (s:Skill {name: 'Next.js'})-[:DEPENDS_ON*]->(dep)
RETURN dep.name, dep.difficulty

// 拓扑排序（PlannerAgent 使用）
MATCH path = (target:Skill {name: 'Next.js'})-[:DEPENDS_ON*]->(leaf)
WHERE NOT (leaf)-[:DEPENDS_ON]->()
UNWIND nodes(path) AS n
RETURN DISTINCT n.name ORDER BY length(path) DESC
```

**涉及文件改造**：

| 文件 | 改造内容 |
|------|----------|
| `backend-ts/src/services/graph-enhanced.service.ts` | 新增 `addDependency(fromSkill, toSkill)`、`getDependencies(skillName)`、`topologicalSort(skillList)` 方法 |
| `backend-ts/src/services/planner-agent.service.ts` | 路径生成时调用 `graph.topologicalSort()` 排序技能 |
| `backend-ts/src/services/jd-parser-agent.service.ts` | 解析 JD 后自动创建技能节点 + 依赖关系 |

---

## 三、MatchAgent — 匹配度计算深度设计

### 3.1 当前公式的问题

CONSTITUTION §9.1 定义的权重是静态加权，不区分"刚毕业的校招"和"有经验的社招"。

**当前代码权重**（来自差距分析 B7）：
```
必须技能 35% / 加分技能 15% / 项目经历 20% / 考试成绩 15% / 学习进度 15%
```
与 CONSTITUTION 要求不一致，且缺少 `learning_velocity` 因子。

### 3.2 分场景权重设计

```typescript
const MATCH_WEIGHTS = {
  // 校招（v1 主体）：看重潜力和学习能力
  campus: {
    required_skills: 0.30,    // 降低：校招生不太可能全掌握
    preferred_skills: 0.15,
    project_relevance: 0.15,
    exam_scores: 0.20,        // 提高：考试证明学习能力
    learning_progress: 0.10,  // 提高：学习态度很重要
    learning_velocity: 0.10,  // 新增：学习速度（完成效率）
  },
  // 社招（v2）：看重经验和即战力
  experienced: {
    required_skills: 0.40,
    preferred_skills: 0.20,
    project_relevance: 0.25,
    exam_scores: 0.10,
    learning_progress: 0.05,
    learning_velocity: 0.00,
  },
};
```

**learning_velocity 计算公式**：
```
velocity = (实际完成技能数 / 预期完成技能数) × 100
  - 数据来源：learning_sessions_v3 的 session 时间戳对比
  - 范围：0~100，>100 表示超前
  - 衰减：只看最近 30 天的数据
```

**涉及文件改造**：

| 文件 | 改造内容 |
|------|----------|
| `backend-ts/src/services/match-agent.service.ts` | 权重改为分场景配置；新增 `learning_velocity` 因子计算；新增 `getScenario(studentType)` 方法 |
| `backend-ts/src/entities/student.entity.ts` | `students_v3` 或 MongoDB `user_profiles` 新增 `student_type` 字段（campus/experienced） |

### 3.3 匹配度可解释性 — 差距分析输出

**问题**：用户看到 65% 匹配度，但不知道怎么提高到 80%。

**MatchAgent 输出结构扩展**：

```typescript
interface MatchResult {
  score: number;                    // 总分 0-100
  scenario: 'campus' | 'experienced';
  breakdown: {
    required_skills: {
      score: number;                // 贡献分
      max: number;                  // 满分
      matched: string[];            // 已掌握的技能
      missing: string[];            // 缺少的技能
    };
    preferred_skills: {
      score: number;
      max: number;
      matched: string[];
      missing: string[];
    };
    project_relevance: {
      score: number;
      max: number;
      description: string;          // "有 React 项目经验"
    };
    exam_scores: {
      score: number;
      max: number;
      details: { skill: string; score: number }[];
    };
    learning_progress: {
      score: number;
      max: number;
      percentage: number;           // 当前路径完成百分比
    };
    learning_velocity: {
      score: number;
      max: number;
      status: 'ahead' | 'on_track' | 'behind';
    };
  };
  suggestions: {
    action: string;                 // "学习 TypeScript"
    estimated_gain: number;         // +8%
    priority: number;               // 1=最高
    skill_gap_id?: string;          // 关联的技能差距
  }[];
}
```

**前端展示**（MatchBreakdown.tsx 重写）：
```
当前匹配度：65%
├── 必须技能：4/7 掌握 (57%) → 贡献 17.1/30
│   └── 缺少：TypeScript, Node.js, 数据库设计
├── 加分技能：2/5 掌握 (40%) → 贡献 6.0/15
├── 项目经历：有 React 项目 → 贡献 12.0/15
├── 考试成绩：React 85分 → 贡献 14.0/20
└── 学习进度：30% → 贡献 3.0/10

提升建议（按贡献度排序）：
1. 学习 TypeScript (+8% 预估)
2. 学习 Node.js (+5% 预估)
3. 完成当前阶段学习 (+3% 预估)
```

**涉及文件**：

| 文件 | 改造内容 |
|------|----------|
| `backend-ts/src/services/match-agent.service.ts` | `calculateMatch()` 返回值改为 `MatchResult` 结构 |
| `frontend/src/components/MatchBreakdown.tsx` | 重写，展示差距分析 + 提升建议 |
| `frontend/src/pages/user/JobDetail.tsx` | 集成新的 MatchBreakdown 组件 |

---

## 四、PlannerAgent — 学习路径生成深度设计

### 4.1 路径生成的输入变量

```
PlannerAgent 需要综合考虑：

用户维度：
├── 当前技能水平（user_skills_v3，哪些已掌握，掌握到什么程度）
├── 每日可用学习时长（learning_plans_v3.daily_hours）
├── 目标 deadline（learning_plans_v3.deadline）
├── 学习偏好（MongoDB user_profiles.learning_preference: video/text/hands_on）
└── 学习速度（从 learning_sessions_v3 历史数据推算）

岗位维度：
├── 必须技能列表 + 依赖关系（job_positions_v3.required_skills + Neo4j DEPENDS_ON）
├── 技能难度（Neo4j Skill.difficulty: 1-5）
├── 市场需求热度（影响优先级，v2）
└── 考试通过率数据（exam_records_v3 统计）

知识库维度：
├── 每个技能点的讲义是否已有（knowledge_base_v3 查询）
├── 题库是否充足（exam_questions_v3 统计）
└── 资源质量评分（knowledge_base_v3.quality_score）
```

### 4.2 路径生成算法

```typescript
async function generatePath(userId: string, targetJobId: string): Promise<LearningPath> {
  // 1. 获取差距
  const gap = await skillGapAgent.analyzeGap(userId, targetJobId);

  // 2. 按依赖拓扑排序（Neo4j）
  const orderedSkills = await graph.topologicalSort(gap.missing_required);

  // 3. 获取用户约束
  const user = await studentService.getProfile(userId);
  const dailyHours = user.daily_hours || 2;
  const deadline = user.deadline;
  const velocity = await sessionService.calculateVelocity(userId);

  // 4. 按每日时长分配到阶段
  const phases: Phase[] = [];
  let currentPhase: Skill[] = [];
  let currentHours = 0;
  const phaseCapacity = dailyHours * PHASE_DURATION_DAYS; // 每阶段约14天

  for (const skill of orderedSkills) {
    const estimatedHours = skill.difficulty * DIFFICULTY_MULTIPLIER * (1 / velocity);

    if (currentHours + estimatedHours > phaseCapacity && currentPhase.length > 0) {
      phases.push({ skills: [...currentPhase], estimatedHours: currentHours });
      currentPhase = [];
      currentHours = 0;
    }

    currentPhase.push(skill);
    currentHours += estimatedHours;
  }

  if (currentPhase.length > 0) {
    phases.push({ skills: currentPhase, estimatedHours: currentHours });
  }

  // 5. 生成每日任务
  const tasks = generateDailyTasks(phases, dailyHours, deadline);

  // 6. 预估最终匹配度
  const estimatedMatch = await matchAgent.estimateFinalMatch(userId, targetJobId, gap.missing_required);

  // 7. 写入数据库
  await learningPlanRepo.save({ ... });
  await learningTaskRepo.save(tasks);

  return { phases, tasks, estimatedMatch, totalEstimatedDays: ... };
}
```

### 4.3 路径调整触发条件

| 触发场景 | 处理方式 | 涉及文件 |
|----------|----------|----------|
| 用户换目标岗位 | 增量调整，不推倒重来（保留共有技能） | `planner-agent.service.ts` |
| 用户学习速度明显偏快/偏慢 | 调整时间预估（velocity ±20% 触发） | `task-scheduler.service.ts` |
| 新岗位上线，匹配度更高 | 推荐："发现更适合你的岗位" | `match-agent.service.ts` → `notification.service.ts` |
| 考试多次未通过（≥3次） | 降低该技能优先级，先学前置知识 | `exam.service.ts` → `planner-agent.service.ts` |
| 用户连续3天未学习 | 发送提醒 + 调整难度（当日任务量减半） | 定时任务 → `notification.service.ts` + `task-scheduler.service.ts` |
| 用户连续7天未学习 | 发送召回通知 + 回归后推荐"温故知新"短任务 | 定时任务 → `notification.service.ts` |

### 4.4 换目标岗位的增量更新逻辑

```typescript
async function switchTargetJob(userId: string, newJobId: string): Promise<SwitchResult> {
  const oldPlan = await planService.getActivePlan(userId);
  const oldSkills = oldPlan.path_data.phases.flatMap(p => p.skills);
  const newGap = await skillGapAgent.analyzeGap(userId, newJobId);
  const newSkills = [...newGap.missing_required, ...newGap.missing_preferred];

  // 计算差异
  const kept = oldSkills.filter(s => newSkills.includes(s));      // 两边都有
  const archived = oldSkills.filter(s => !newSkills.includes(s)); // 旧有新无
  const added = newSkills.filter(s => !oldSkills.includes(s));    // 新有旧无

  // 归档旧技能到"已学技能库"
  for (const skill of archived) {
    await skillService.archiveSkill(userId, skill);
  }

  // 为新技能生成路径（复用已有生成逻辑）
  const newPhases = await generatePhasesForSkills(userId, added);

  // 合并：保留的 + 新增的
  const mergedPhases = mergePhases(oldPlan.path_data.phases, kept, newPhases);

  // 更新计划
  await planService.updatePath(oldPlan.id, { target_job_id: newJobId, path_data: { phases: mergedPhases } });

  return { kept: kept.length, archived: archived.length, added: added.length, estimatedExtraDays: ... };
}
```

**涉及文件**：

| 文件 | 改造内容 |
|------|----------|
| `backend-ts/src/services/planner-agent.service.ts` | 新增 `switchTargetJob()` 方法；`generatePath()` 接收 velocity 参数 |
| `backend-ts/src/services/task-scheduler.service.ts` | 新增 `adjustForSpeed()` 方法；新增 `halveTodayTasks()` 方法 |
| `backend-ts/src/services/skill.service.ts` | 新增 `archiveSkill()` 方法 |
| `backend-ts/src/modules/planner/planner.controller.ts` | 新增 `POST /api/user/plans/switch-job` 端点 |

---

## 五、ReviewerAgent — 质量审查深度设计

### 5.1 需要审查的产出物

| 产出物 | 审查维度 | 审查方式 |
|--------|----------|----------|
| LLM 生成的讲义 | 准确性、完整性、难度适配 | 自动 + 管理员抽检 |
| LLM 生成的题目 | 答案正确性、干扰项合理性 | 自动（LLM 自检） + 管理员审核 |
| LLM 生成的简历 | 真实性（不编造经历）、针对性 | 自动（与画像交叉验证） |
| LLM 的岗位匹配建议 | 匹配逻辑合理性 | 自动（规则校验） |
| 用户对话中的画像提取 | 准确性（不误读用户意图） | 自动（Confidence threshold） |

### 5.2 审查流程设计

```
LLM 生成内容
    ↓
ReviewerAgent 自动审查（第一道关）
├── 检查 1：事实准确性（与知识库交叉验证）
├── 检查 2：格式合规（JSON 结构是否正确）
├── 检查 3：安全性（不含有害内容）
└── 检查 4：难度适配（与用户水平匹配）
    ↓
通过 → 直接使用
部分通过 → 标记低置信度，加入人工审核队列
不通过 → 重新生成（最多 3 次）
    ↓
管理员审核队列（第二道关）
└── 只审核标记为"低置信度"的内容
```

### 5.3 自动审查 vs 人工审核的边界

```
完全自动（不需要人）：
├── 格式校验（JSON 结构）
├── 安全性过滤（敏感词/有害内容）
└── 重复检测（与已有内容去重）

自动 + 人工抽检（10% 抽样）：
├── 讲义内容准确性
├── 题目答案正确性
└── 匹配建议合理性

必须人工审核：
├── 简历发送给企业（最后一道关）
├── 新岗位上架（JD 解析结果确认）
└── 考试题目上架（题库审核）
```

### 5.4 审查结果数据结构

```typescript
interface ReviewResult {
  passed: boolean;
  confidence: number;          // 0.0 ~ 1.0
  checks: {
    name: string;              // 'format' | 'accuracy' | 'safety' | 'difficulty'
    passed: boolean;
    detail: string;            // 失败原因
  }[];
  needs_human_review: boolean; // confidence < 0.7
  retry_count: number;         // 已重试次数
  max_retries: number;         // 最大重试次数（3）
}
```

**涉及文件改造**：

| 文件 | 改造内容 |
|------|----------|
| `backend-ts/src/services/agents/reviewer-agent.service.ts` | 实现完整的 4 项自动检查逻辑；新增 `needsHumanReview()` 判定 |
| `backend-ts/src/services/reviewer-agent.service.ts` | 与 agents 目录下的统一，消除重复 |
| `backend-ts/src/entities/agent-task.entity.ts` | `agent_tasks_v3` 新增 `review_result` JSON 字段 |
| `backend-ts/src/modules/admin/admin.controller.ts` | 新增 `GET /api/admin/review-queue` 获取待审核队列 |

---

## 六、冷启动问题 — 新用户策略

### 6.1 分层用户策略

| 层级 | 定义 | 匹配策略 | 核心挑战 |
|------|------|----------|----------|
| 层1：有画像有简历 | 完成 Onboarding + 项目经历 | 精准匹配 | 无 |
| 层2：只有画像无简历 | 完成 Onboarding 无项目经历 | 宽泛匹配 | 引导添加项目 |
| 层3：小白 | 未完成 Onboarding | 潜力匹配 | 如何让小白感受到价值？ |

### 6.2 层3小白的特殊设计

```
策略：
a. 不展示"匹配度"（对小白不友好），改用"潜力评估"
   → 前端判断：如果 user_skills_v3 为空，隐藏匹配度卡片
   → 替换为："完成速测，发现你的潜力方向"

b. 推荐"入门级"岗位 + "零基础"学习路径
   → job_positions_v3 新增 difficulty_level 字段
   → PlannerAgent 对小白生成 zero-based 路径

c. 用 Onboarding 中的技能自评作为初始画像
   → source = 'self_report', trust_weight = 0.3

d. 第一个任务设计为"5分钟小测验"，快速建立技能确认
   → Onboarding 完成后自动跳转 /user/quick-test
```

### 6.3 "5分钟速测"功能（已有基础，需完善）

**现状**：`backend-ts/src/modules/quick-test/` 模块已存在，前端 `/user/quick-test` 路由已存在。

**需要补充**：

| 缺失项 | 说明 | 涉及文件 |
|--------|------|----------|
| 速测后技能写入 | 速测通过的技能应写入 `user_skills_v3`，source=exam, trust_weight=1.0 | `quick-test` 模块 → `skill.service.ts` |
| 速测后匹配度触发 | 技能写入后触发 MatchAgent 重算 | `skill.service.ts` → `match-agent.service.ts` |
| 速测入口引导 | Onboarding 完成后弹出速测入口 | `frontend/src/pages/Onboarding.tsx` |
| 速测结果展示 | 展示确认的技能 + 匹配度变化 | `frontend/src/pages/user/QuickTest.tsx` |

### 6.4 引导文案设计

```
层2 用户看到的引导：
┌─────────────────────────────────────────────┐
│  📈 提升匹配精准度                           │
│                                             │
│  你的当前匹配度：45%                         │
│  添加 GitHub 项目经历 → 预估提升至 65%       │
│                                             │
│  [导入 GitHub]  [手动添加项目]               │
└─────────────────────────────────────────────┘

层3 用户看到的引导：
┌─────────────────────────────────────────────┐
│  🚀 发现你的潜力                             │
│                                             │
│  完成 5 分钟速测，了解你适合哪个方向          │
│  已有 1,234 位同学完成测试                   │
│                                             │
│  [开始速测]                                  │
└─────────────────────────────────────────────┘
```

---

## 七、AI 浮窗 — 上下文感知深度设计

### 7.1 当前问题

CONSTITUTION §17 定义了 6 种页面级 AI 角色，但：
- 同一用户的跨页面记忆不共享
- AI 在 A 页面了解到的信息，B 页面用不了
- `AIFloatingChat.tsx` 不读路由，所有页面行为相同

### 7.2 三层记忆架构

```
┌─────────────────────────────────────────┐
│          Memory Layers                   │
│                                         │
│  Layer 1: Global Profile (MongoDB)       │
│  ├── 用户画像（所有页面共享）             │
│  ├── 技能列表                            │
│  └── 目标岗位                            │
│  → 所有页面可读写                        │
│                                         │
│  Layer 2: Page Session (Redis)           │
│  ├── 当前页面的对话上下文                │
│  ├── 页面特定状态                        │
│  └── 20条消息滑动窗口                    │
│  → 仅当前页面可读写                      │
│                                         │
│  Layer 3: Temporary (内存)               │
│  ├── 资讯页的临时对话                    │
│  └── 不持久化，关闭即消失                │
│  → 仅当前页面可用                        │
│                                         │
│  跨页面传递机制：                         │
│  AI 在学习页发现用户"对算法很感兴趣"      │
│  → 写入 Layer 1 (profile.chat_insights)  │
│  → 岗位页的 AI 可以读取并推荐算法岗       │
└─────────────────────────────────────────┘
```

### 7.3 各页面 AI 的 System Prompt 差异化

```typescript
const PAGE_PROMPTS = {
  home: `你是今日任务助手。
    优先引导用户开始今日任务。
    如果用户没有目标岗位，推荐他先去设置。
    语气：积极、鼓励、简洁。
    上下文：{today_tasks}, {current_phase}, {match_score}`,

  learning_job: `你是学习进度助手。
    感知用户当前学习阶段和技能点。
    可以解释知识点、推荐学习方法。
    不要直接给答案，引导思考。
    上下文：{current_skill}, {phase_progress}, {exam_history}`,

  learning_custom: `你是学习推荐助手。
    用户在自选学习区，想学额外内容。
    先澄清需求，再推荐方向和资源。
    上下文：{user_skills}, {target_job_skills}, {interests}`,

  jobs: `你是岗位分析助手。
    帮用户分析岗位匹配情况。
    指出差距，建议加入学习路径。
    不要过度推销，客观分析。
    上下文：{target_job}, {match_details}, {skill_gap}`,

  profile: `你是画像完善助手。
    提示用户完善未填写的字段。
    特别引导添加 GitHub 项目经历。
    语气：友好提醒，不强迫。
    上下文：{missing_fields}, {profile_completeness}`,

  news: `你是阅读理解助手。
    帮助用户理解文章中的专业术语。
    总结文章要点。
    注意：你的回答不影响用户画像。
    语气：专业、耐心。`,
};
```

### 7.4 实现方案

**路由感知**：`AIFloatingChat.tsx` 通过 `useLocation()` 获取当前路由，映射到页面类型。

**Session 隔离**：Redis key 设计：
```
chat:session:{userId}:{pageType}  → 20条消息滑动窗口
```

**跨页面传递**：AI 在对话中识别到有价值的信息（如"我对算法感兴趣"），通过 tool calling 写入 MongoDB `user_profiles.chat_insights` 字段。

**涉及文件改造**：

| 文件 | 改造内容 |
|------|----------|
| `frontend/src/components/AIFloatingChat.tsx` | 读取路由，切换 system prompt；区分 Layer 1/2/3 数据源 |
| `backend-ts/src/modules/chat/chat.service.ts` | 接收 `pageType` 参数，选择对应 prompt；Redis key 按页面隔离 |
| `backend-ts/src/modules/chat/tutor-prompt.service.ts` | 新增 `getSystemPrompt(pageType, context)` 方法 |
| `backend-ts/src/services/profile.service.ts` | 新增 `chat_insights` 字段的读写 |
| `backend-ts/src/services/chat-history.service.ts` | key 改为 `{userId}:{pageType}` 格式 |

---

## 八、考试机制深度设计

### 8.1 题目质量保障

```
LLM 出题的潜在问题：
├── 答案可能错误（LLM 幻觉）
├── 干扰选项可能不合理
├── 难度可能不稳定
└── 可能重复（同一知识点反复出类似题）

解决方案：

Step 1: LLM 生成 → 自动校验
├── 用另一个 LLM 调用验证答案（交叉验证）
├── 检查干扰选项的区分度
├── 检查与已有题目的相似度（去重）
└── 标记 confidence_score

Step 2: 高置信度 → 直接入题库
        低置信度 → 进入管理员审核队列

Step 3: 考试后反馈循环
├── 某题通过率 > 95% → 太简单，降低权重或替换
├── 某题通过率 < 20% → 太难 or 答案有误，人工审核
└── 某题被大量用户标记"答案有误" → 自动下架 + 告警
```

### 8.2 题目质量评分模型

```typescript
interface QuestionQuality {
  question_id: string;
  confidence_score: number;      // LLM 交叉验证的置信度
  difficulty_actual: number;     // 基于通过率的实际难度（0-100）
  discrimination: number;        // 区分度（高分组vs低分组的通过率差）
  usage_count: number;           // 使用次数
  report_count: number;          // 被举报次数
  status: 'active' | 'under_review' | 'retired';
}
```

**涉及文件改造**：

| 文件 | 改造内容 |
|------|----------|
| `backend-ts/src/services/agents/exam-agent.service.ts` | 生成后调用交叉验证；新增 `confidence_score` 计算 |
| `backend-ts/src/services/exam.service.ts` | `submitExam()` 后更新题目统计数据；新增题目质量反馈循环 |
| `backend-ts/src/entities/exam-question.entity.ts` | 新增 `confidence_score`、`difficulty_actual`、`discrimination`、`report_count` 字段 |
| `backend-ts/src/entities/exam-question.entity.ts` | 新增 `status` 枚举：active / under_review / retired |

### 8.3 防作弊设计

**v1 简化版**：
```
├── 题目池 > 考试题目数 → 随机抽题
├── 选项顺序随机（前端 shuffle）
├── 同一用户每次考试题目不同
├── 时间限制（防止开卷查资料）
└── 编程题用测试用例验证（不只看输出）
```

**v2 增强版**（后续）：
```
├── 题目难度自适应（答对 → 下一题更难）
├── 行为分析（答题时间异常 → 标记）
└── AI 监考（摄像头，争议较大，暂不实现）
```

**v1 涉及文件**：

| 文件 | 改造内容 |
|------|----------|
| `backend-ts/src/services/exam.service.ts` | `startExam()` 实现随机抽题 + 选项 shuffle |
| `frontend/src/pages/user/ExamTake.tsx` | 接收 shuffle 后的选项；实现倒计时 |

### 8.4 错题分析 → 针对性学习闭环

```
考试未通过
    ↓
ReviewerAgent 分析错题
├── 归类：哪些知识点错误
├── 归因：是概念不清？还是粗心？
└── 生成：针对性学习计划
    ↓
生成"补强计划"（不是重学整个路径）
├── 只包含错题涉及的知识点
├── 推荐相关讲义 + 练习题
└── 预计完成时间：1-3天
    ↓
完成补强计划 → 解锁重考
```

**补强计划数据结构**：
```typescript
interface RemedialPlan {
  id: string;
  exam_record_id: string;
  user_id: string;
  weak_skills: {
    skill_name: string;
    error_type: 'concept' | 'careless' | 'knowledge_gap';
    recommended_resources: {
      type: 'lecture' | 'quiz' | 'code';
      resource_id: string;
      title: string;
    }[];
  }[];
  estimated_days: number;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: Date;
}
```

**涉及文件改造**：

| 文件 | 改造内容 |
|------|----------|
| `backend-ts/src/services/exam.service.ts` | `submitExam()` 未通过时生成补强计划 |
| `backend-ts/src/services/agents/reviewer-agent.service.ts` | 新增 `analyzeWrongAnswers()` 方法 |
| `backend-ts/src/entities/` | 新增 `remedial_plans_v3` 表/实体 |
| `frontend/src/pages/user/ExamTake.tsx` | 考试结果页展示错题分析 + 补强计划入口 |

---

## 九、数据飞轮

### 9.1 飞轮模型

```
┌──────────────────────────────────────────────────────┐
│                   Data Flywheel                       │
│                                                      │
│  更多学生使用                                         │
│      ↓                                               │
│  更多技能数据 + 考试数据 + 学习行为数据               │
│      ↓                                               │
│  匹配算法更精准（训练数据更多）                        │
│  知识库质量更高（用户反馈 + 纠错）                     │
│  考试题目更合理（通过率数据分析）                      │
│      ↓                                               │
│  匹配更准 → 学生体验更好 → 更多推荐                   │
│      ↓                                               │
│  更多企业愿意入驻（候选人质量高）                      │
│      ↓                                               │
│  更多岗位 → 匹配机会更多 → 吸引更多学生               │
│      ↓                                               │
│  🔄 正循环                                           │
└──────────────────────────────────────────────────────┘
```

### 9.2 关键数据采集点

| 数据 | 采集时机 | 存储位置 | 用途 |
|------|----------|----------|------|
| 技能自评 vs 考试成绩 | 考试后 | `user_skills_v3` + `exam_records_v3` | 校准自评可信度（trust_weight） |
| 学习路径完成率 | 路径结束/放弃 | `learning_plans_v3.status` | 优化路径生成算法 |
| 每个知识点的学习时长 | 学习过程中 | `learning_sessions_v3.duration_ms` | 更准确的时间预估 |
| 考试通过率 by 题目 | 考试后 | `exam_questions_v3` 统计字段 | 题目质量评估 |
| 岗位投递 → 面试率 | 投递后 | `job_applications_v3.status` 变更 | 匹配有效性验证 |
| 用户流失节点 | 分析 session | `learning_sessions_v3` 时间间隔 | 优化体验 |
| 匹配度变化历史 | 每次重算 | 新增 `match_history_v3` 表 | 匹配趋势分析 |

### 9.3 数据采集实现

**新增表：`match_history_v3`**
```sql
CREATE TABLE match_history_v3 (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  job_id BIGINT NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  breakdown JSON COMMENT '各因子分数快照',
  trigger_event VARCHAR(50) COMMENT '触发事件：task_completed/exam_passed/skill_added/...',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_job (user_id, job_id),
  INDEX idx_created (created_at)
);
```

**涉及文件**：

| 文件 | 改造内容 |
|------|----------|
| `backend-ts/src/entities/` | 新增 `match-history.entity.ts` |
| `backend-ts/src/services/match-agent.service.ts` | 每次计算后写入 `match_history_v3` |
| `backend-ts/src/modules/admin/admin.controller.ts` | 新增数据统计端点（路径完成率、题目质量等） |

---

## 十、边缘场景深度设计

### 10.1 "换目标岗位"完整流程

```
用户点击"更换目标岗位"
    ↓
弹出确认框：
"你当前的学习进度将被保留，但路径会重新规划"
    ↓
PlannerAgent 执行增量更新：
├── 旧岗位有、新岗位也有 → 保留（不变）
├── 旧岗位有、新岗位没有 → 归档到"已学技能"
├── 旧岗位没有、新岗位有 → 追加到路径
└── 计算新路径的预估时间
    ↓
展示差异预览：
"保留 8 个技能 | 归档 2 个 | 新增 5 个
 预估额外学习时间：3 周"
    ↓
用户确认 → 更新 MySQL + MongoDB → 跳转学习路径页
```

**前端交互**：`frontend/src/pages/user/JobDetail.tsx` 或 `Dashboard.tsx` 新增"更换目标岗位"按钮，弹出确认弹窗展示差异预览。

### 10.2 "用户连续7天不学习"召回流程

```
触发条件：用户最后活跃时间 > 7天（定时任务每天检查）
    ↓
系统自动发送通知（站内通知 + 邮件）：
"你的 React 学习路径已经停滞 7 天了，
 匹配度可能下降。每天只需 30 分钟就能保持进度。"
    ↓
用户回来后：
├── AI 浮窗主动打招呼："欢迎回来！要不要复习一下之前学的？"
├── 今日任务量自动减少（50%），降低回归门槛
└── 推荐一个"温故知新"的短任务（10分钟）
```

**涉及文件**：

| 文件 | 改造内容 |
|------|----------|
| `backend-ts/src/services/task-scheduler.service.ts` | 新增 `handleInactiveUser(userId)` 方法（任务减半） |
| `backend-ts/src/modules/scheduler/scheduler.module.ts` | 新增每日检查不活跃用户的定时任务 |
| `backend-ts/src/services/notification.service.ts` | 新增 `sendRecallNotification(userId)` 方法 |
| `frontend/src/components/AIFloatingChat.tsx` | 回归时展示欢迎回来消息 |

### 10.3 "考试答案争议"处理

```
用户认为答案有误
    ↓
点击"我认为答案有误"
    ↓
弹出输入框："请说明你的理由"
    ↓
提交到管理员审核队列
├── 如果 3+ 用户质疑同一题 → 自动下架
├── 管理员审核 → 修正答案 → 重新上架
└── 已考用户成绩自动修正（如果答案确实有误）
```

**数据库变更**：
```sql
-- 新增表：question_reports_v3
CREATE TABLE question_reports_v3 (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  question_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending/reviewed/dismissed',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_question (question_id),
  INDEX idx_status (status)
);
```

**涉及文件**：

| 文件 | 改造内容 |
|------|----------|
| `backend-ts/src/entities/` | 新增 `question-report.entity.ts` |
| `backend-ts/src/services/exam.service.ts` | 新增 `reportQuestion()` 方法；3+ 举报自动下架逻辑 |
| `frontend/src/pages/user/ExamTake.tsx` | 考试结果页新增"认为答案有误"按钮 |
| `backend-ts/src/modules/admin/admin.controller.ts` | 新增举报审核端点 |

### 10.4 "同一岗位多人投递"管理

```
场景：前端开发岗位有 5 个学生投递
    ↓
管理端展示：
├── 按 ReviewerAgent 评分排序
├── 每人显示：匹配度 + 技能差距 + Agent 建议
└── 管理员可以对比查看
    ↓
管理员决策：
├── 全部通过 → 分别发送
├── 部分通过 → 拒绝的用户收到"暂时不匹配"通知
└── 建议拒绝时附带改进建议（来自 Agent）
```

**涉及文件**：

| 文件 | 改造内容 |
|------|----------|
| `backend-ts/src/modules/admin/admin.controller.ts` | 新增 `GET /api/admin/applications/compare?job_id=X` 对比端点 |
| `backend-ts/src/services/match-agent.service.ts` | 批量计算 + 排序 |
| `frontend/src/pages/admin/AdminApplications.tsx` | 新增对比视图 |

---

## 实施路线图与优先级

### Phase A：核心激励闭环（最高优先级）

> 目标：让用户每天有理由打开 ZhiPath

| 序号 | 任务 | 优先级 | 预估工时 | 依赖 |
|------|------|--------|----------|------|
| A1 | MatchAgent 事件驱动增量更新 | P0 | 1天 | 无 |
| A2 | 匹配度实时反馈（Toast + 通知） | P0 | 0.5天 | A1 |
| A3 | Dashboard 重写（Daily Micro-Loop 入口） | P0 | 1天 | A1, A2 |
| A4 | 匹配度可解释性（差距分析输出） | P0 | 1天 | A1 |
| A5 | 匹配度分场景权重（campus/experienced） | P1 | 0.5天 | A1 |
| A6 | 匹配度历史记录表 + 趋势图 | P1 | 0.5天 | A1 |

**Phase A 总工时：4.5 天**

### Phase B：技能生命周期（第二优先级）

> 目标：技能数据可信、可用、会衰减

| 序号 | 任务 | 优先级 | 预估工时 | 依赖 |
|------|------|--------|----------|------|
| B1 | 技能信任度升级机制 | P0 | 0.5天 | 无 |
| B2 | 技能衰减模型（定时任务 + 字段新增） | P1 | 1天 | B1 |
| B3 | Neo4j 技能依赖图扩展 | P1 | 1天 | 无 |
| B4 | PlannerAgent 集成拓扑排序 | P1 | 0.5天 | B3 |
| B5 | PlannerAgent 换目标岗位增量更新 | P1 | 1天 | B4 |
| B6 | PlannerAgent 学习速度自适应调整 | P2 | 0.5天 | B4 |

**Phase B 总工时：4.5 天**

### Phase C：质量保障与冷启动（第三优先级）

> 目标：LLM 产出可信，新用户有入口

| 序号 | 任务 | 优先级 | 预估工时 | 依赖 |
|------|------|--------|----------|------|
| C1 | ReviewerAgent 完整审查流程 | P1 | 1天 | 无 |
| C2 | 考试题目质量评分 + 反馈循环 | P1 | 1天 | C1 |
| C3 | 考试防作弊（随机抽题 + 选项 shuffle） | P1 | 0.5天 | 无 |
| C4 | 错题分析 → 补强计划闭环 | P1 | 1天 | C1 |
| C5 | 速测完善（技能写入 + 匹配度触发） | P1 | 0.5天 | B1 |
| C6 | 小白引导策略（潜力评估替代匹配度） | P2 | 0.5天 | C5 |
| C7 | 考试答案争议举报机制 | P2 | 0.5天 | C2 |

**Phase C 总工时：5 天**

### Phase D：AI 浮窗与数据飞轮（第四优先级）

> 目标：AI 有上下文感知，数据形成正循环

| 序号 | 任务 | 优先级 | 预估工时 | 依赖 |
|------|------|--------|----------|------|
| D1 | AI 浮窗路由感知 + 页面 Prompt 差异化 | P1 | 1天 | 无 |
| D2 | 三层记忆架构（Global/Page/Temporary） | P1 | 1.5天 | D1 |
| D3 | 跨页面信息传递（chat_insights） | P2 | 0.5天 | D2 |
| D4 | 数据采集点埋点（匹配度历史、学习时长等） | P2 | 1天 | A1 |
| D5 | 管理端数据统计面板 | P2 | 1天 | D4 |

**Phase D 总工时：5 天**

### Phase E：边缘场景与管理端（第五优先级）

> 目标：覆盖边界情况，管理端完整可用

| 序号 | 任务 | 优先级 | 预估工时 | 依赖 |
|------|------|--------|----------|------|
| E1 | 换目标岗位完整流程（前后端） | P1 | 1天 | B5 |
| E2 | 7天不学习召回机制 | P2 | 0.5天 | 无 |
| E3 | 同岗位多人投递对比视图 | P2 | 0.5天 | 无 |
| E4 | 管理端审核队列（题目/举报/简历） | P2 | 1天 | C1 |
| E5 | 考试答案举报前后端 | P2 | 0.5天 | C7 |

**Phase E 总工时：3.5 天**

---

### 总工时汇总

| Phase | 内容 | 工时 |
|-------|------|------|
| A | 核心激励闭环 | 4.5天 |
| B | 技能生命周期 | 4.5天 |
| C | 质量保障与冷启动 | 5天 |
| D | AI 浮窗与数据飞轮 | 5天 |
| E | 边缘场景与管理端 | 3.5天 |
| **总计** | | **22.5天** |

### 依赖关系图

```
Phase A (核心激励) ─────────────────────────────┐
  ├── A1 MatchAgent 事件驱动                      │
  ├── A2 匹配度反馈 ← A1                         │
  ├── A3 Dashboard ← A1, A2                      │
  ├── A4 差距分析 ← A1                           │
  ├── A5 分场景权重 ← A1                         │
  └── A6 历史记录 ← A1                           │
                                                 │
Phase B (技能生命周期) ──────────────────────────┤
  ├── B1 信任度升级                              │
  ├── B2 衰减模型 ← B1                           │
  ├── B3 Neo4j 依赖图                            │
  ├── B4 拓扑排序 ← B3                           │
  ├── B5 换岗位 ← B4 ──────────────────────────→ E1
  └── B6 速度自适应 ← B4                         │
                                                 │
Phase C (质量保障) ──────────────────────────────┤
  ├── C1 ReviewerAgent                           │
  ├── C2 题目质量 ← C1                           │
  ├── C3 防作弊                                  │
  ├── C4 错题分析 ← C1 ─────────────────────────→ E4
  ├── C5 速测完善 ← B1                           │
  ├── C6 小白引导 ← C5                           │
  └── C7 答案争议 ← C2 ─────────────────────────→ E5
                                                 │
Phase D (AI 浮窗) ───────────────────────────────┤
  ├── D1 路由感知                                │
  ├── D2 三层记忆 ← D1                           │
  ├── D3 跨页面传递 ← D2                         │
  ├── D4 数据埋点 ← A1                           │
  └── D5 统计面板 ← D4                           │
                                                 │
Phase E (边缘场景) ← A,B,C 依赖 ────────────────┘
```

---

### 与现有代码的对照表

| 深度设计项 | 涉及的现有文件 | 改造类型 |
|-----------|---------------|----------|
| MatchAgent 事件驱动 | `match-agent.service.ts`, `session.service.ts`, `exam.service.ts` | 重构 |
| 匹配度实时反馈 | `MatchScoreToast.tsx`, `events.service.ts` | 新增 |
| Dashboard 重写 | `Dashboard.tsx` | 重写 |
| 差距分析输出 | `match-agent.service.ts`, `MatchBreakdown.tsx` | 重构 |
| 信任度升级 | `skill.service.ts`, `exam.service.ts` | 新增方法 |
| 技能衰减 | `skill.service.ts`, `scheduler.module.ts` | 新增 |
| Neo4j 依赖图 | `graph-enhanced.service.ts` | 扩展 |
| 拓扑排序 | `planner-agent.service.ts`, `graph-enhanced.service.ts` | 新增方法 |
| 换目标岗位 | `planner-agent.service.ts`, `planner.controller.ts` | 新增 |
| ReviewerAgent 审查 | `reviewer-agent.service.ts` (×2) | 重构统一 |
| 题目质量反馈 | `exam.service.ts`, `exam-question.entity.ts` | 扩展 |
| 防作弊 | `exam.service.ts`, `ExamTake.tsx` | 新增 |
| 错题分析 | `exam.service.ts`, 新增 `remedial_plans_v3` | 新增 |
| 速测完善 | `quick-test` 模块, `QuickTest.tsx` | 扩展 |
| AI 浮窗感知 | `AIFloatingChat.tsx`, `chat.service.ts`, `tutor-prompt.service.ts` | 重构 |
| 三层记忆 | `chat-history.service.ts`, `profile.service.ts` | 重构 |
| 数据埋点 | `match-agent.service.ts`, 新增 `match_history_v3` | 新增 |
| 召回机制 | `scheduler.module.ts`, `notification.service.ts` | 新增 |
| 答案争议 | 新增 `question_reports_v3`, `exam.service.ts` | 新增 |

---

*文档结束 — 深度设计计划 v3.0*

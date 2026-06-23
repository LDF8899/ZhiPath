# Git 学习系统设计方案

> 基于 Git 思想的学习状态管理系统
> 版本：v1.0 | 日期：2026-06-19

---

## 一、核心理念

### 1.1 为什么用 Git 思想？

```
传统学习系统的问题：
├── 学了什么 → 只有进度条，没有细节记录
├── 学到哪了 → 只有当前状态，没有历史轨迹
├── 想回退 → 不可能，只能重新开始
├── 想分支 → 不支持，只能线性学习
└── 想看看过去 → 没有 log

Git 思想的优势：
├── 每次学习都是一次 commit，可追溯
├── 主线/支线天然分支模型
├── 随时 reset 到任意历史状态
├── diff 看到技能差距
└── tag 标记重要里程碑
```

### 1.2 概念映射表

| Git 概念 | 学习系统 | 说明 |
|----------|----------|------|
| `repository` | 学习计划 (LearningPlan) | 一个完整的学习目标 |
| `main branch` | 主线任务 | 目标岗位要求的核心技能 |
| `feature branch` | 支线任务 | 兴趣驱动 / 补充技能 |
| `commit` | 学习记录 (LearnCommit) | 完成一个技能点/阶段 |
| `commit message` | 学习备注 | 用户可添加学习心得 |
| `tag` | 里程碑 (Milestone) | 阶段完成、考试通过 |
| `diff` | 技能差距 | 当前 vs 目标的差距 |
| `log` | 学习日志 | 完整的学习历史 |
| `reset` | 回档 | 回退到某个学习状态 |
| `checkout` | 切换状态 | 查看某个时间点的进度 |
| `merge` | 汇入 | 支线技能并入主线 |
| `stash` | 暂存 | 暂停某条支线 |
| `branch` | 创建支线 | 开启新的学习方向 |
| `HEAD` | 当前进度 | 当前学习到的位置 |

---

## 二、数据模型

### 2.1 学习计划 (LearningPlan) — 对应 Repository

```typescript
interface LearningPlan {
  id: string;
  userId: string;
  name: string;                    // "前端开发学习计划"
  description: string;
  
  // ── 分支结构 ──
  mainBranch: MainBranch;          // 主线（唯一）
  sideBranches: SideBranch[];      // 支线（可多个）
  
  // ── 当前状态 ──
  head: HeadPointer;               // HEAD 指针
  currentBranch: 'main' | string;  // 当前所在分支
  
  // ── 元数据 ──
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'paused' | 'completed';
  
  // ── 目标关联 ──
  targetJob?: {
    jobId: string;
    title: string;
    requiredSkills: string[];      // 必须技能
    optionalSkills: string[];      // 加分技能
  };
}
```

### 2.2 主线分支 (MainBranch)

```typescript
interface MainBranch {
  name: 'main';
  phases: Phase[];                 // 阶段列表
  commits: LearnCommit[];          // 提交历史
  tags: Tag[];                     // 里程碑标签
}
```

### 2.3 支线分支 (SideBranch)

```typescript
interface SideBranch {
  id: string;
  name: string;                    // "Docker 补充" / "Python 兴趣"
  source: 'job-gap' | 'interest' | 'recommendation';
  sourceCommitId: string;          // 从哪个 commit 分出来的
  
  // ── 分支内容 ──
  skills: Skill[];                 // 该支线的技能列表
  commits: LearnCommit[];          // 该支线的提交历史
  
  // ── 状态 ──
  status: 'active' | 'paused' | 'merged' | 'abandoned';
  createdAt: number;
  mergedAt?: number;               // 如果已合并
  mergedInto?: string;             // 合并到哪个分支
}
```

### 2.4 学习提交 (LearnCommit) — 对应 Commit

```typescript
interface LearnCommit {
  id: string;                      // commit hash (短)
  branchId: string;                // 所属分支
  parentId: string | null;         // 父提交
  
  // ── 提交内容 ──
  type: 'skill-complete' | 'phase-complete' | 'quiz-pass' | 'code-done' | 'milestone';
  skillName?: string;              // 完成的技能
  phaseName?: string;              // 完成的阶段
  message: string;                 // 用户备注 / 系统生成
  
  // ── 学习数据 ──
  data: {
    duration?: number;             // 学习时长(分钟)
    score?: number;                // 考试分数
    mastery?: number;              // 掌握度(0-100)
    resources?: string[];          // 使用的资源ID
  };
  
  // ── 元数据 ──
  timestamp: number;
  isAuto: boolean;                 // 系统自动提交 vs 用户手动
}
```

### 2.5 标签 (Tag) — 对应 Git Tag

```typescript
interface Tag {
  name: string;                    // "v1.0-基础完成" / "React-掌握"
  commitId: string;                // 指向的提交
  type: 'phase' | 'skill' | 'exam' | 'custom';
  description?: string;
  createdAt: number;
}
```

### 2.6 HEAD 指针

```typescript
interface HeadPointer {
  branchId: string;                // 当前分支
  commitId: string;                // 当前提交
  isDetached: boolean;             // 是否处于游离状态（查看历史）
}
```

---

## 三、核心操作

### 3.1 Commit — 记录学习

```typescript
// 用户完成一个技能点
async function commitSkill(planId: string, skill: Skill, message?: string) {
  const plan = await getPlan(planId);
  const currentBranch = getCurrentBranch(plan);
  
  const commit: LearnCommit = {
    id: generateCommitHash(),
    branchId: currentBranch.id,
    parentId: currentBranch.latestCommitId,
    type: 'skill-complete',
    skillName: skill.name,
    message: message || `完成 ${skill.name}`,
    data: {
      duration: skill.learnedDuration,
      mastery: skill.mastery,
    },
    timestamp: Date.now(),
    isAuto: !message, // 有备注则为手动提交
  };
  
  // 添加到分支
  currentBranch.commits.push(commit);
  
  // 更新 HEAD
  plan.head.commitId = commit.id;
  
  // 检查是否触发里程碑
  checkMilestone(plan, commit);
  
  await savePlan(plan);
  return commit;
}
```

### 3.2 Log — 查看学习历史

```typescript
// 获取当前分支的提交历史
function getCommitLog(plan: LearningPlan, branchId?: string): LearnCommit[] {
  const branch = branchId 
    ? getBranch(plan, branchId)
    : getCurrentBranch(plan);
  
  return branch.commits.sort((a, b) => b.timestamp - a.timestamp);
}

// 获取完整历史（所有分支）
function getFullLog(plan: LearningPlan): BranchLog[] {
  const logs: BranchLog[] = [];
  
  // 主线日志
  logs.push({
    branch: 'main',
    commits: plan.mainBranch.commits,
    tags: plan.mainBranch.tags,
  });
  
  // 各支线日志
  for (const branch of plan.sideBranches) {
    logs.push({
      branch: branch.name,
      commits: branch.commits,
      tags: [],
    });
  }
  
  return logs;
}
```

### 3.3 Branch — 创建支线

```typescript
// 从当前进度创建支线
async function createBranch(
  planId: string, 
  branchName: string, 
  source: SideBranch['source'],
  skills: Skill[]
) {
  const plan = await getPlan(planId);
  
  const branch: SideBranch = {
    id: generateBranchId(),
    name: branchName,
    source,
    sourceCommitId: plan.head.commitId, // 从当前 commit 分出
    skills,
    commits: [],
    status: 'active',
    createdAt: Date.now(),
  };
  
  plan.sideBranches.push(branch);
  
  // 自动切换到新分支
  plan.currentBranch = branch.id;
  plan.head.branchId = branch.id;
  
  await savePlan(plan);
  return branch;
}
```

### 3.4 Checkout — 切换分支 / 查看历史

```typescript
// 切换到某个分支
async function checkoutBranch(planId: string, branchId: string) {
  const plan = await getPlan(planId);
  const branch = getBranch(plan, branchId);
  
  plan.currentBranch = branchId;
  plan.head = {
    branchId: branchId,
    commitId: branch.commits[branch.commits.length - 1]?.id || branch.sourceCommitId,
    isDetached: false,
  };
  
  await savePlan(plan);
}

// 查看某个历史 commit（游离状态）
async function checkoutCommit(planId: string, commitId: string) {
  const plan = await getPlan(planId);
  
  plan.head = {
    branchId: plan.head.branchId, // 保持原分支
    commitId,
    isDetached: true, // 游离状态
  };
  
  await savePlan(plan);
}
```

### 3.5 Reset — 回档学习状态

```typescript
// 回档到某个 commit
async function resetToCommit(
  planId: string, 
  commitId: string, 
  mode: 'soft' | 'hard'
) {
  const plan = await getPlan(planId);
  const branch = getCurrentBranch(plan);
  const targetIdx = branch.commits.findIndex(c => c.id === commitId);
  
  if (targetIdx === -1) throw new Error('Commit not found');
  
  if (mode === 'soft') {
    // soft reset: 保留技能完成状态，只回退进度指针
    plan.head.commitId = commitId;
  } else {
    // hard reset: 回退技能状态
    const removedCommits = branch.commits.splice(targetIdx + 1);
    
    // 回退技能状态
    for (const commit of removedCommits) {
      if (commit.skillName) {
        resetSkillStatus(plan, commit.skillName);
      }
    }
    
    plan.head.commitId = commitId;
  }
  
  await savePlan(plan);
}
```

### 3.6 Merge — 合并支线

```typescript
// 将支线合并回主线
async function mergeBranch(planId: string, branchId: string) {
  const plan = await getPlan(planId);
  const branch = getBranch(plan, branchId);
  
  if (branch.status !== 'active') {
    throw new Error('Branch is not active');
  }
  
  // 将支线技能添加到主线
  for (const skill of branch.skills) {
    const existing = findSkillInMain(plan, skill.name);
    if (existing) {
      // 技能已存在，更新掌握度（取较高值）
      existing.mastery = Math.max(existing.mastery, skill.mastery);
    } else {
      // 新技能，添加到当前阶段
      addSkillToCurrentPhase(plan, skill);
    }
  }
  
  // 创建合并提交
  const mergeCommit: LearnCommit = {
    id: generateCommitHash(),
    branchId: 'main',
    parentId: plan.head.commitId,
    type: 'skill-complete',
    message: `合并支线: ${branch.name}`,
    data: {},
    timestamp: Date.now(),
    isAuto: true,
  };
  
  plan.mainBranch.commits.push(mergeCommit);
  
  // 标记支线已合并
  branch.status = 'merged';
  branch.mergedAt = Date.now();
  branch.mergedInto = 'main';
  
  // 切换回主线
  plan.currentBranch = 'main';
  plan.head = {
    branchId: 'main',
    commitId: mergeCommit.id,
    isDetached: false,
  };
  
  await savePlan(plan);
}
```

### 3.7 Diff — 技能差距分析

```typescript
// 对比当前状态与目标
function getDiff(plan: LearningPlan): SkillDiff {
  const target = plan.targetJob;
  if (!target) return { required: [], optional: [], achieved: [] };
  
  const allSkills = getAllSkills(plan);
  
  return {
    required: target.requiredSkills.map(skill => ({
      name: skill,
      status: getSkillStatus(allSkills, skill),
      gap: calculateGap(allSkills, skill),
    })),
    optional: target.optionalSkills.map(skill => ({
      name: skill,
      status: getSkillStatus(allSkills, skill),
      gap: calculateGap(allSkills, skill),
    })),
    achieved: allSkills
      .filter(s => s.mastery >= 80)
      .map(s => ({ name: s.name, mastery: s.mastery })),
  };
}
```

---

## 四、UI 设计

### 4.1 学习路径页 — Git 风格布局

```
┌─────────────────────────────────────────────────────────────────────┐
│  📚 学习计划: 前端开发                           匹配度 72%  [+ 新支线] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📍 HEAD → main (commit: a3f2e1)                            │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐                                │   │
│  │  │ main │ │ Docker│ │ Python│   ← 分支切换 tabs              │   │
│  │  └──────┘ └──────┘ └──────┘                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🌿 main 分支                                    [查看日志]  │   │
│  │  ═══════════════════════════════════════════════════════════│   │
│  │                                                             │   │
│  │  ●──────●──────●──────◐──────○──────○   ← 进度时间线        │   │
│  │  │      │      │      │      │      │                      │   │
│  │  HTML   CSS    JS   React  TS    Node   ← 技能节点          │   │
│  │  ✓      ✓      ✓     ⏳     ○      ○   ← 状态              │   │
│  │                                                             │   │
│  │  [v1.0-基础完成]  [v2.0-CSS精通]   ← 标签                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📋 当前阶段: React + TypeScript                             │   │
│  │  ────────────────────────────────────────────────────────── │   │
│  │  □ React Hooks (进行中)          掌握度 65%   [继续学习 →]   │   │
│  │  □ React Router                  掌握度 0%    [开始学习 →]   │   │
│  │  □ TypeScript 基础               掌握度 0%    [开始学习 →]   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🌿 活跃支线 (2)                                             │   │
│  │  ────────────────────────────────────────────────────────── │   │
│  │  ├─ Docker 补充 [来自: 岗位差距]  进度 3/5   [切换 →]        │   │
│  │  └─ Python 兴趣 [来自: 个人兴趣]  进度 1/4   [切换 →]        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 学习日志页 — Git Log 风格

```
┌─────────────────────────────────────────────────────────────────────┐
│  📜 学习日志                                    [筛选] [导出]       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  main 分支                                                          │
│  ─────────────────────────────────────────────────────────────────  │
│  ● a3f2e1  2026-06-19 14:30  完成 React Hooks useState            │
│  │          掌握度: 65%  时长: 45min  [查看详情] [回档到此]          │
│  │                                                                  │
│  ● 8b2c4f  2026-06-18 20:15  完成 JavaScript 闭包                 │
│  │          掌握度: 80%  时长: 60min  [查看详情] [回档到此]          │
│  │                                                                  │
│  ● 5a1e3d  2026-06-17 16:45  🏷️ v1.0-基础完成                     │
│  │          HTML + CSS + JS 基础阶段完成                            │
│  │                                                                  │
│  ● 2f8a7b  2026-06-16 19:30  完成 CSS Grid 布局                   │
│  │          掌握度: 90%  时长: 55min  [查看详情] [回档到此]          │
│  │                                                                  │
│  ... 更多历史                                                       │
│                                                                     │
│  Docker 补充分支 (从 main:8b2c4f 分出)                              │
│  ─────────────────────────────────────────────────────────────────  │
│  ● d7e9f2  2026-06-19 10:20  完成 Docker 基础概念                  │
│  │          掌握度: 70%  时长: 30min                                │
│  │                                                                  │
│  ● c4b8a1  2026-06-18 15:10  开始 Docker 学习                     │
│             来源: 岗位差距分析                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 回档确认弹窗

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ 确认回档                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  你即将回档到:                                               │
│                                                             │
│  commit: 8b2c4f                                             │
│  时间: 2026-06-18 20:15                                     │
│  内容: 完成 JavaScript 闭包                                  │
│                                                             │
│  回档模式:                                                   │
│  ○ Soft — 保留学习记录，只回退进度指针                        │
│  ● Hard — 回退技能状态，将丢失后续 3 条记录                   │
│                                                             │
│  ⚠️ Hard 回档将影响:                                         │
│  • React Hooks useState 掌握度 65% → 0%                     │
│  • 总体进度 72% → 68%                                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  输入 "确认回档" 以继续                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [取消]                              [确认回档]              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 Diff 视图 — 技能差距

```
┌─────────────────────────────────────────────────────────────────────┐
│  📊 技能差距分析                                目标: 前端开发工程师 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  必须技能 (4/7 已掌握)                                              │
│  ─────────────────────────────────────────────────────────────────  │
│  ✅ HTML5              ████████████ 95%   已达标                    │
│  ✅ CSS3               ██████████░░ 85%   已达标                    │
│  ✅ JavaScript         █████████░░░ 78%   已达标                    │
│  ✅ React              ██████░░░░░░ 65%   已达标                    │
│  ❌ TypeScript         ░░░░░░░░░░░░  0%   +12% 预估匹配度          │
│  ❌ Node.js            ░░░░░░░░░░░░  0%   +8% 预估匹配度           │
│  ❌ 数据库设计          ░░░░░░░░░░░░  0%   +5% 预估匹配度           │
│                                                                     │
│  加分技能 (2/5 已掌握)                                              │
│  ─────────────────────────────────────────────────────────────────  │
│  ✅ Git                ████████████ 90%   已达标                    │
│  ✅ Docker             ████░░░░░░░░ 35%   进行中                    │
│  ❌ CI/CD              ░░░░░░░░░░░░  0%                            │
│  ❌ 性能优化            ░░░░░░░░░░░░  0%                            │
│  ❌ 测试               ░░░░░░░░░░░░  0%                            │
│                                                                     │
│  💡 建议:                                                           │
│  • 学习 TypeScript 可提升匹配度 12%                                 │
│  • 学习 Node.js 可提升匹配度 8%                                     │
│  • 完成当前 React 阶段可提升匹配度 3%                                │
│                                                                     │
│  [创建 TypeScript 支线]  [创建 Node.js 支线]                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 五、API 设计

### 5.1 学习计划 API

```typescript
// 获取学习计划（含分支信息）
GET /api/user/learning/plans/:planId

// 创建支线分支
POST /api/user/learning/plans/:planId/branches
Body: { name, source, skills }

// 切换分支
POST /api/user/learning/plans/:planId/checkout
Body: { branchId } | { commitId }

// 合并支线
POST /api/user/learning/plans/:planId/branches/:branchId/merge

// 回档
POST /api/user/learning/plans/:planId/reset
Body: { commitId, mode: 'soft' | 'hard' }
```

### 5.2 学习记录 API

```typescript
// 记录学习完成（commit）
POST /api/user/learning/plans/:planId/commit
Body: { skillName, message?, data? }

// 获取学习日志
GET /api/user/learning/plans/:planId/log?branchId=&limit=&offset=

// 获取标签列表
GET /api/user/learning/plans/:planId/tags
```

### 5.3 技能差距 API

```typescript
// 获取 diff
GET /api/user/learning/plans/:planId/diff

// 创建支线（基于差距）
POST /api/user/learning/plans/:planId/branches/from-gap
Body: { jobId } // 自动分析差距并创建支线
```

---

## 六、数据库 Schema

### 6.1 learning_plans 表

```sql
CREATE TABLE learning_plans (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  target_job_id VARCHAR(36),
  current_branch_id VARCHAR(36) DEFAULT 'main',
  head_commit_id VARCHAR(36),
  status ENUM('active', 'paused', 'completed') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id)
);
```

### 6.2 learning_branches 表

```sql
CREATE TABLE learning_branches (
  id VARCHAR(36) PRIMARY KEY,
  plan_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type ENUM('main', 'side') NOT NULL,
  source ENUM('job-gap', 'interest', 'recommendation'),
  source_commit_id VARCHAR(36),
  status ENUM('active', 'paused', 'merged', 'abandoned') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  merged_at TIMESTAMP NULL,
  INDEX idx_plan (plan_id),
  FOREIGN KEY (plan_id) REFERENCES learning_plans(id)
);
```

### 6.3 learning_commits 表

```sql
CREATE TABLE learning_commits (
  id VARCHAR(36) PRIMARY KEY,
  branch_id VARCHAR(36) NOT NULL,
  parent_id VARCHAR(36),
  plan_id VARCHAR(36) NOT NULL,
  type ENUM('skill-complete', 'phase-complete', 'quiz-pass', 'code-done', 'milestone'),
  skill_name VARCHAR(255),
  phase_name VARCHAR(255),
  message TEXT,
  duration INT,
  score INT,
  mastery INT,
  is_auto BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_branch (branch_id),
  INDEX idx_plan (plan_id),
  FOREIGN KEY (branch_id) REFERENCES learning_branches(id),
  FOREIGN KEY (plan_id) REFERENCES learning_plans(id)
);
```

### 6.4 learning_tags 表

```sql
CREATE TABLE learning_tags (
  id VARCHAR(36) PRIMARY KEY,
  plan_id VARCHAR(36) NOT NULL,
  commit_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type ENUM('phase', 'skill', 'exam', 'custom'),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_plan (plan_id),
  FOREIGN KEY (plan_id) REFERENCES learning_plans(id)
);
```

---

## 七、前端组件结构

```
frontend/src/
├── components/
│   └── learning/
│       ├── GitStyleLearning.tsx      # 主组件
│       ├── BranchTabs.tsx            # 分支切换 tabs
│       ├── CommitTimeline.tsx        # 提交时间线
│       ├── CommitCard.tsx            # 单个提交卡片
│       ├── TagBadge.tsx              # 标签徽章
│       ├── DiffView.tsx              # 差距分析视图
│       ├── ResetModal.tsx            # 回档确认弹窗
│       ├── CreateBranchModal.tsx     # 创建支线弹窗
│       ├── MergeModal.tsx            # 合并确认弹窗
│       └── LogView.tsx               # 学习日志页
├── stores/
│   └── learning-git.ts              # Git 风格学习状态管理
└── types/
    └── learning-git.ts              # 类型定义
```

---

## 八、使用场景示例

### 场景 1: 用户发现岗位需要 Docker

```
1. 用户浏览岗位 → 发现需要 Docker
2. 点击 "创建 Docker 支线"
3. 系统创建支线分支，从当前 commit 分出
4. 用户开始学习 Docker → 产生新 commits
5. 学完后点击 "合并回主线"
6. Docker 技能汇入主线，匹配度提升
```

### 场景 2: 用户想回顾学习历程

```
1. 用户点击 "学习日志"
2. 看到完整的 commit 历史
3. 发现上周学 React 时状态很好
4. 点击 "查看详情" 看当时的掌握度
5. 可选: 点击 "回档到此" 重新学习某个技能
```

### 场景 3: 用户想暂停支线

```
1. 用户在 Docker 支线学到一半
2. 主线有更重要的内容要学
3. 点击 "暂存支线"（stash）
4. 切换回主线继续学习
5. 之后随时可以恢复支线
```

### 场景 4: 用户想重学某个技能

```
1. 用户发现 React Hooks 掌握不牢
2. 找到对应的 commit
3. 点击 "回档到此"（hard reset）
4. React Hooks 状态重置为 0%
5. 重新学习，产生新的 commits
```

---

## 九、与现有系统集成

### 9.1 与 useSession 集成

```typescript
// 进入学习页面时
useEffect(() => {
  // 开始学习会话
  startSession(planId, currentBranchId);
  
  return () => {
    // 退出时保存会话
    endSession(planId);
  };
}, [planId, currentBranchId]);

// 完成技能时
const handleSkillComplete = async (skill) => {
  // 1. 记录 commit
  await commitSkill(planId, skill);
  
  // 2. 更新掌握度
  await updateMastery(skill.name, skill.mastery);
  
  // 3. 检查里程碑
  await checkMilestone(planId);
};
```

### 9.2 与匹配度联动

```typescript
// 每次 commit 后更新匹配度
async function onCommit(commit: LearnCommit) {
  if (commit.type === 'skill-complete') {
    // 重新计算匹配度
    const newScore = await calculateMatchScore(planId);
    
    // 更新 store
    workspaceStore.getState().setMatchScore(newScore);
    
    // 发射事件
    workspaceStore.getState().emit({
      type: 'match_updated',
      newScore,
    });
  }
}
```

---

## 十、技术实现要点

### 10.1 Commit Hash 生成

```typescript
function generateCommitHash(): string {
  // 使用时间戳 + 随机数生成短 hash
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${timestamp}${random}`.substring(0, 7);
}
```

### 10.2 分支可视化算法

```typescript
// 计算分支布局（类似 git log --graph）
function calculateBranchLayout(branches: Branch[]): BranchLayout {
  // 1. 主线在最左边
  // 2. 活跃支线依次向右排列
  // 3. 合并点用虚线连接
  // 4. 标签显示在对应 commit 上方
}
```

### 10.3 回档安全机制

```typescript
// 回档前检查
async function validateReset(planId: string, commitId: string): Promise<ResetValidation> {
  const plan = await getPlan(planId);
  const branch = getCurrentBranch(plan);
  const targetIdx = branch.commits.findIndex(c => c.id === commitId);
  const willLose = branch.commits.length - targetIdx - 1;
  
  return {
    canReset: true,
    willLoseCommits: willLose,
    affectedSkills: branch.commits
      .slice(targetIdx + 1)
      .filter(c => c.skillName)
      .map(c => c.skillName),
    impact: {
      scoreChange: calculateScoreImpact(plan, commitId),
      progressChange: calculateProgressImpact(plan, commitId),
    },
  };
}
```

---

## 十一、版本规划

### v1.0 — 基础 Git 功能
- [ ] 学习计划 + 主线分支
- [ ] Commit 记录
- [ ] Log 查看
- [ ] 基础 UI

### v1.5 — 分支功能
- [ ] 支线分支创建
- [ ] 分支切换
- [ ] 分支合并
- [ ] 暂存支线

### v2.0 — 高级功能
- [ ] 回档功能（soft/hard）
- [ ] Diff 差距分析
- [ ] 标签系统
- [ ] 分支可视化

### v2.5 — 智能功能
- [ ] AI 建议创建支线
- [ ] 自动标签
- [ ] 学习模式分析
- [ ] 智能回档建议

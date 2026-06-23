# Git 学习系统 × 画像雷达图 深度关联设计

> 能力可视化 + 学习轨迹 + 个人画像 三位一体
> 版本：v2.0 | 日期：2026-06-19

---

## 一、核心理念：Commit 改变画像

```
传统系统：学习 → 进度条变化 → 结束
Git 系统：学习 → commit → 画像快照 → 雷达图变化 → 能力可视化

每次 commit 不只是记录"学了什么"，而是：
├── 技能掌握度变化
├── 雷达图形状变化
├── 画像维度变化
└── 匹配度变化

用户看到的不是"进度"，而是"能力成长轨迹"
```

---

## 二、数据流：Commit → 画像 → 雷达图

```
用户完成学习
    ↓
commitSkill(planId, skill)
    ↓
┌─────────────────────────────────────────────────────────────┐
│  1. 创建 LearnCommit                                        │
│  2. 更新 skill.mastery (掌握度 0-100)                        │
│  3. 生成 SkillSnapshot (技能快照)                            │
│  4. 更新 UserProfile.skills[]                                │
│  5. 计算新的 RadarData (雷达图数据)                           │
│  6. 计算新的 MatchScore (匹配度)                             │
└─────────────────────────────────────────────────────────────┘
    ↓
前端实时更新
├── 雷达图动画：旧形状 → 新形状
├── 画像卡片：技能列表更新
├── 匹配度 pill：数字跳动
└── commit log：新增一条记录
```

---

## 三、核心数据结构

### 3.1 技能快照 (SkillSnapshot) — 画像的核心

```typescript
interface SkillSnapshot {
  timestamp: number;           // 快照时间
  commitId: string;            // 对应的 commit
  branchId: string;            // 所在分支
  
  // ── 技能维度 ──
  skills: SkillDimension[];
  
  // ── 聚合指标 ──
  totalMastery: number;        // 总掌握度 (加权平均)
  skillCount: number;          // 已学技能数
  depthScore: number;          // 深度分 (单技能最高掌握度)
  breadthScore: number;        // 广度分 (技能覆盖范围)
  balanceScore: number;        // 均衡分 (各技能差距)
}

interface SkillDimension {
  name: string;                // 技能名称
  category: string;            // 技能类别 (前端/后端/工具/...)
  mastery: number;             // 掌握度 0-100
  source: SkillSource;         // 来源 (自报/对话/GitHub/考试)
  trustWeight: number;         // 信任权重 0-1
  effectiveMastery: number;    // 有效掌握度 = mastery × trustWeight
  lastUpdated: number;         // 最后更新时间
  decayRate: number;           // 衰减速率
}
```

### 3.2 画像数据 (UserProfile) — 扩展

```typescript
interface UserProfile {
  // ── 基础信息 ──
  id: string;
  name: string;
  school: string;
  major: string;
  grade: string;
  
  // ── 技能画像 ──
  skills: SkillDimension[];
  
  // ── 雷达图维度 ──
  radarDimensions: RadarDimension[];
  
  // ── 能力指标 ──
  abilityMetrics: AbilityMetrics;
  
  // ── 学习历史 ──
  snapshots: SkillSnapshot[];  // 历史快照列表
  
  // ── 目标 ──
  targetJob?: TargetJob;
}

interface RadarDimension {
  name: string;                // 维度名称 ("前端基础", "React", "工程化", ...)
  category: string;            // 类别
  skills: string[];            // 包含的技能
  score: number;               // 维度得分 (0-100)
  trend: 'up' | 'down' | 'stable';  // 趋势
  lastCommitId?: string;       // 最近影响该维度的 commit
}

interface AbilityMetrics {
  overallScore: number;        // 综合能力分 (0-100)
  frontendScore: number;       // 前端能力分
  backendScore: number;        // 后端能力分
  toolingScore: number;        // 工具链能力分
  softSkillScore: number;      // 软技能分
  
  depth: number;               // 深度 (最擅长领域的掌握度)
  breadth: number;             // 广度 (已覆盖的技能类别数)
  balance: number;             // 均衡度 (各维度差距越小越均衡)
  
  learningSpeed: number;       // 学习速度 (commit/天)
  consistency: number;         // 学习一致性 (连续学习天数)
}
```

### 3.3 Commit 扩展 — 携带画像快照

```typescript
interface LearnCommit {
  id: string;
  branchId: string;
  parentId: string | null;
  
  // ── 提交内容 ──
  type: CommitType;
  skillName?: string;
  message: string;
  
  // ── 学习数据 ──
  data: CommitData;
  
  // ── 画像快照 (关键!) ──
  snapshot: SkillSnapshot;
  
  // ── 变化量 ──
  delta: CommitDelta;
  
  timestamp: number;
}

interface CommitDelta {
  // 技能变化
  skillChanges: Array<{
    name: string;
    before: number;
    after: number;
    delta: number;
  }>;
  
  // 指标变化
  metricsChange: {
    overallScore: number;      // 综合分变化
    matchScore: number;        // 匹配度变化
    depthScore: number;        // 深度分变化
    breadthScore: number;      // 广度分变化
  };
  
  // 雷达图变化
  radarChanges: Array<{
    dimension: string;
    before: number;
    after: number;
    delta: number;
  }>;
}
```

---

## 四、雷达图设计

### 4.1 多维度雷达图

```
传统雷达图：6-8 个技能点，简单展示掌握度
Git 雷达图：多维度、可对比、有历史

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                         前端框架                                 │
│                            ▲                                    │
│                           /|\                                   │
│                          / | \                                  │
│                         /  |  \                                 │
│           工程化 ◄──────/──●──\──────► 状态管理                  │
│                      \   /|\   /                                │
│                       \ / | \ /                                 │
│                        \  |  /                                  │
│                         \ | /                                   │
│                          \|/                                    │
│                           ▼                                     │
│                         CSS/布局                                 │
│                                                                 │
│   ● 当前能力   ○ 目标要求   ◌ 历史记录                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 雷达图维度定义

```typescript
// 雷达图维度配置
const RADAR_DIMENSIONS = [
  {
    name: '前端基础',
    category: 'frontend',
    skills: ['HTML', 'CSS', 'JavaScript', 'TypeScript'],
    weight: 0.25,
  },
  {
    name: '前端框架',
    category: 'framework',
    skills: ['React', 'Vue', 'Angular', 'Next.js'],
    weight: 0.20,
  },
  {
    name: '状态管理',
    category: 'state',
    skills: ['Redux', 'Zustand', 'MobX', 'Context API'],
    weight: 0.15,
  },
  {
    name: '工程化',
    category: 'tooling',
    skills: ['Webpack', 'Vite', 'Git', 'CI/CD', 'Docker'],
    weight: 0.15,
  },
  {
    name: 'CSS/布局',
    category: 'css',
    skills: ['Flexbox', 'Grid', 'Tailwind', 'Sass'],
    weight: 0.10,
  },
  {
    name: '后端基础',
    category: 'backend',
    skills: ['Node.js', 'Express', '数据库', 'API设计'],
    weight: 0.15,
  },
];
```

### 4.3 雷达图计算算法

```typescript
function calculateRadarData(
  skills: SkillDimension[],
  dimensions: RadarDimensionConfig[]
): RadarDimension[] {
  return dimensions.map(dim => {
    // 找到该维度包含的技能
    const dimSkills = skills.filter(s => 
      dim.skills.includes(s.name)
    );
    
    // 计算维度得分 (加权平均)
    const score = dimSkills.length > 0
      ? dimSkills.reduce((sum, s) => sum + s.effectiveMastery, 0) / dimSkills.length
      : 0;
    
    // 计算趋势 (对比上一个快照)
    const trend = calculateTrend(dim.name, score);
    
    return {
      name: dim.name,
      category: dim.category,
      skills: dim.skills,
      score: Math.round(score),
      trend,
    };
  });
}
```

### 4.4 雷达图对比模式

```typescript
// 对比两个时间点的雷达图
function compareRadarData(
  snapshotA: SkillSnapshot,
  snapshotB: SkillSnapshot
): RadarComparison {
  return {
    dimensions: snapshotA.skills.map((skillA, i) => {
      const skillB = snapshotB.skills[i];
      return {
        name: skillA.name,
        before: skillA.effectiveMastery,
        after: skillB.effectiveMastery,
        delta: skillB.effectiveMastery - skillA.effectiveMastery,
      };
    }),
    overallDelta: snapshotB.totalMastery - snapshotA.totalMastery,
  };
}
```

---

## 五、UI 组件设计

### 5.1 画像总览卡片

```
┌─────────────────────────────────────────────────────────────────┐
│  👤 个人画像                                    [编辑] [导出]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │     ┌───────────────────────────────────────────┐       │   │
│  │     │           ● 雷达图区域                      │       │   │
│  │     │          /|\                               │       │   │
│  │     │         / | \       前端框架 92%           │       │   │
│  │     │        /  |  \      状态管理 78%           │       │   │
│  │     │   工程化──●──●      工程化   65%           │       │   │
│  │     │        \  |  /      CSS/布局 88%           │       │   │
│  │     │         \ | /       后端基础 45%           │       │   │
│  │     │          \|/        前端基础 95%           │       │   │
│  │     │           ●                                 │       │   │
│  │     └───────────────────────────────────────────┘       │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  📊 能力指标                                             │   │
│  │  ─────────────────────────────────────────────────────── │   │
│  │  综合能力    ████████████████████░░░░  82 分             │   │
│  │  前端能力    ██████████████████████░░  92 分             │   │
│  │  后端能力    ██████████░░░░░░░░░░░░░░  45 分             │   │
│  │  工具链      █████████████░░░░░░░░░░░  65 分             │   │
│  │                                                         │   │
│  │  深度: 92 (最擅长: 前端框架)                             │   │
│  │  广度: 5/6 (覆盖 5 个维度)                               │   │
│  │  均衡: 78 (各维度差距较小)                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 学习轨迹时间线 + 雷达图联动

```
┌─────────────────────────────────────────────────────────────────┐
│  📈 学习轨迹                                    [周] [月] [年]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  雷达图时间滑块                                          │   │
│  │  ────────────────────────────────────────────────────── │   │
│  │  ◄──────●──────────────────────────────────────●──────► │   │
│  │      6月1日                                        今天  │   │
│  │         │                                             │   │
│  │         ▼                                             │   │
│  │  ┌─────────────────────────────────────────────────┐  │   │
│  │  │        雷达图 (显示该时间点的形状)                │  │   │
│  │  │                                                 │  │   │
│  │  │            前端框架                              │  │   │
│  │  │               ▲                                 │  │   │
│  │  │              /|\                                │  │   │
│  │  │             / | \                               │  │   │
│  │  │   工程化───/──●──\─── 状态管理                  │  │   │
│  │  │            \  |  /                              │  │   │
│  │  │             \ | /                               │  │   │
│  │  │              \|/                                │  │   │
│  │  │               ●                                 │  │   │
│  │  │            CSS/布局                              │  │   │
│  │  └─────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  该时间点的 Commits                                      │   │
│  │  ────────────────────────────────────────────────────── │   │
│  │  ● a3f2e1  6月15日  完成 React Hooks useState          │   │
│  │            前端框架: 65% → 72%  (+7%)                   │   │
│  │            综合能力: 78% → 80%  (+2%)                   │   │
│  │                                                         │   │
│  │  ● 8b2c4f  6月14日  完成 JavaScript 闭包               │   │
│  │            前端基础: 80% → 85%  (+5%)                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Commit 详情 + 画像变化

```
┌─────────────────────────────────────────────────────────────────┐
│  📝 Commit: a3f2e1                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  完成 React Hooks useState                                     │
│  2026-06-19 14:30 · main 分支 · 自动提交                       │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  技能变化                                                       │
│  ─────────────────────────────────────────────────────────────  │
│  React Hooks                                                    │
│  ████████████████████░░░░░░░░░░  65% → 85%  (+20%)            │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  雷达图变化                                                     │
│  ─────────────────────────────────────────────────────────────  │
│  前端框架                                                       │
│  ██████████████████████░░░░░░░░  72% → 78%  (+6%)             │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  画像指标变化                                                   │
│  ─────────────────────────────────────────────────────────────  │
│  综合能力    80% → 82%  (+2%)                                  │
│  匹配度      72% → 74%  (+2%)                                  │
│  深度分      85% → 85%  (不变)                                  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  学习备注                                                       │
│  ─────────────────────────────────────────────────────────────  │
│  "useState 的状态更新是异步的，这个坑踩了好久"                   │
│                                                                 │
│  [查看讲义]  [重新学习]  [回档到此]                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.4 分支对比雷达图

```
┌─────────────────────────────────────────────────────────────────┐
│  🌿 分支对比: main vs Docker 补充                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │            前端框架                                     │   │
│  │               ▲                                         │   │
│  │              /|\                                        │   │
│  │             / | \                                       │   │
│  │   工程化───/──●──\─── 状态管理                          │   │
│  │            \  |  /                                      │   │
│  │             \ | /                                       │   │
│  │              \|/                                        │   │
│  │               ●                                         │   │
│  │            CSS/布局                                      │   │
│  │                                                         │   │
│  │   ● main 分支 (当前)                                    │   │
│  │   ○ Docker 分支                                         │   │
│  │   ◌ 差异区域                                            │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  分支差异详情                                             │   │
│  │  ────────────────────────────────────────────────────── │   │
│  │  Docker 分支新增技能:                                    │   │
│  │  • Docker 基础: 0% → 70%                                │   │
│  │  • Docker Compose: 0% → 45%                             │   │
│  │                                                         │   │
│  │  合并后预期变化:                                          │   │
│  │  • 工程化维度: 65% → 78%  (+13%)                        │   │
│  │  • 综合能力: 82% → 85%  (+3%)                           │   │
│  │  • 匹配度: 74% → 79%  (+5%)                             │   │
│  │                                                         │   │
│  │  [合并到主线]  [暂存支线]  [继续学习]                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 六、API 设计

### 6.1 画像相关 API

```typescript
// 获取用户画像 (含雷达图数据)
GET /api/user/profile
Response: UserProfile

// 获取雷达图数据
GET /api/user/profile/radar
Response: RadarDimension[]

// 获取历史快照
GET /api/user/profile/snapshots?limit=30&branchId=
Response: SkillSnapshot[]

// 对比两个快照
GET /api/user/profile/snapshots/compare?snapshotA=&snapshotB=
Response: RadarComparison
```

### 6.2 Commit 相关 API

```typescript
// 提交学习完成 (返回画像变化)
POST /api/user/learning/plans/:planId/commit
Body: { skillName, message?, data? }
Response: {
  commit: LearnCommit,
  snapshot: SkillSnapshot,
  delta: CommitDelta
}

// 获取 commit 详情 (含画像变化)
GET /api/user/learning/commits/:commitId
Response: LearnCommit

// 获取 commit log (含画像快照)
GET /api/user/learning/plans/:planId/log
Response: Array<{
  commit: LearnCommit,
  snapshot: SkillSnapshot,
  delta: CommitDelta
}>
```

### 6.3 Diff 相关 API

```typescript
// 技能差距分析 (基于画像)
GET /api/user/learning/plans/:planId/diff
Response: {
  current: RadarDimension[],
  target: RadarDimension[],
  gaps: SkillGap[],
  suggestions: BranchSuggestion[]
}

// 创建支线 (基于差距)
POST /api/user/learning/plans/:planId/branches/from-gap
Body: { jobId }
Response: SideBranch
```

---

## 七、后端实现

### 7.1 Commit 时生成快照

```typescript
async function commitSkill(
  planId: string,
  skillName: string,
  message?: string
): Promise<CommitResult> {
  const plan = await getPlan(planId);
  const user = await getUser(plan.userId);
  const currentBranch = getCurrentBranch(plan);
  
  // 1. 更新技能掌握度
  const skill = findSkill(user.skills, skillName);
  const oldMastery = skill?.mastery || 0;
  const newMastery = calculateNewMastery(skill, learningData);
  
  // 2. 创建 commit
  const commit: LearnCommit = {
    id: generateCommitHash(),
    branchId: currentBranch.id,
    parentId: currentBranch.latestCommitId,
    type: 'skill-complete',
    skillName,
    message: message || `完成 ${skillName}`,
    data: { mastery: newMastery, duration: learningData.duration },
    timestamp: Date.now(),
    snapshot: null as any, // 后面填充
    delta: null as any,    // 后面填充
  };
  
  // 3. 更新用户技能
  await updateUserSkill(user.id, skillName, newMastery);
  
  // 4. 生成快照
  const snapshot = await generateSnapshot(user.id, commit.id);
  
  // 5. 计算变化量
  const previousSnapshot = await getLatestSnapshot(user.id);
  const delta = calculateDelta(previousSnapshot, snapshot);
  
  // 6. 填充 commit
  commit.snapshot = snapshot;
  commit.delta = delta;
  
  // 7. 保存
  await saveCommit(commit);
  await saveSnapshot(snapshot);
  
  // 8. 更新匹配度
  const newMatchScore = await calculateMatchScore(user.id, plan.targetJobId);
  await updateMatchScore(user.id, newMatchScore);
  
  return { commit, snapshot, delta, newMatchScore };
}
```

### 7.2 生成快照

```typescript
async function generateSnapshot(
  userId: string,
  commitId: string
): Promise<SkillSnapshot> {
  const user = await getUser(userId);
  const skills = user.skills || [];
  
  // 计算雷达图维度
  const radarDimensions = calculateRadarData(skills, RADAR_DIMENSIONS);
  
  // 计算聚合指标
  const totalMastery = skills.reduce((sum, s) => sum + s.effectiveMastery, 0) / skills.length;
  const depthScore = Math.max(...skills.map(s => s.effectiveMastery));
  const breadthScore = radarDimensions.filter(d => d.score > 0).length / radarDimensions.length;
  const balanceScore = 100 - (Math.max(...radarDimensions.map(d => d.score)) - Math.min(...radarDimensions.map(d => d.score)));
  
  return {
    timestamp: Date.now(),
    commitId,
    branchId: 'main', // 当前分支
    skills: skills.map(s => ({
      name: s.name,
      category: s.category,
      mastery: s.mastery,
      source: s.source,
      trustWeight: s.trustWeight,
      effectiveMastery: s.effectiveMastery,
      lastUpdated: s.lastUpdated,
      decayRate: s.decayRate,
    })),
    totalMastery: Math.round(totalMastery),
    skillCount: skills.length,
    depthScore: Math.round(depthScore),
    breadthScore: Math.round(breadthScore * 100),
    balanceScore: Math.round(balanceScore),
  };
}
```

### 7.3 计算变化量

```typescript
function calculateDelta(
  before: SkillSnapshot | null,
  after: SkillSnapshot
): CommitDelta {
  if (!before) {
    return {
      skillChanges: after.skills.map(s => ({
        name: s.name,
        before: 0,
        after: s.effectiveMastery,
        delta: s.effectiveMastery,
      })),
      metricsChange: {
        overallScore: after.totalMastery,
        matchScore: 0, // 需要单独计算
        depthScore: after.depthScore,
        breadthScore: after.breadthScore,
      },
      radarChanges: [],
    };
  }
  
  // 技能变化
  const skillChanges = after.skills.map(skillAfter => {
    const skillBefore = before.skills.find(s => s.name === skillAfter.name);
    return {
      name: skillAfter.name,
      before: skillBefore?.effectiveMastery || 0,
      after: skillAfter.effectiveMastery,
      delta: skillAfter.effectiveMastery - (skillBefore?.effectiveMastery || 0),
    };
  }).filter(c => c.delta !== 0);
  
  // 雷达图变化
  const radarBefore = calculateRadarData(before.skills, RADAR_DIMENSIONS);
  const radarAfter = calculateRadarData(after.skills, RADAR_DIMENSIONS);
  const radarChanges = radarAfter.map((dimAfter, i) => ({
    dimension: dimAfter.name,
    before: radarBefore[i]?.score || 0,
    after: dimAfter.score,
    delta: dimAfter.score - (radarBefore[i]?.score || 0),
  })).filter(c => c.delta !== 0);
  
  return {
    skillChanges,
    metricsChange: {
      overallScore: after.totalMastery - before.totalMastery,
      matchScore: 0, // 需要单独计算
      depthScore: after.depthScore - before.depthScore,
      breadthScore: after.breadthScore - before.breadthScore,
    },
    radarChanges,
  };
}
```

---

## 八、前端实现

### 8.1 RadarChart 组件增强

```typescript
// 新增 props
interface RadarChartProps {
  data: RadarDimension[];
  compareData?: RadarDimension[];  // 对比数据
  size?: number;
  color?: string;
  compareColor?: string;
  showTrend?: boolean;             // 显示趋势箭头
  showLabels?: boolean;
  animated?: boolean;              // 动画效果
  onDimensionClick?: (dim: RadarDimension) => void;
}
```

### 8.2 SkillSnapshot 存储

```typescript
// stores/profile.ts
interface ProfileStore {
  profile: UserProfile | null;
  snapshots: SkillSnapshot[];
  currentSnapshot: SkillSnapshot | null;
  
  // Actions
  fetchProfile: () => Promise<void>;
  fetchSnapshots: (limit?: number) => Promise<void>;
  setCurrentSnapshot: (snapshot: SkillSnapshot) => void;
  
  // 计算属性
  getRadarData: () => RadarDimension[];
  getAbilityMetrics: () => AbilityMetrics;
  getSkillTrend: (skillName: string) => TrendData;
}
```

### 8.3 Commit 动画效果

```typescript
// commit 完成后播放动画
function animateCommit(delta: CommitDelta) {
  // 1. 雷达图变形动画
  animateRadarTransition(delta.radarChanges);
  
  // 2. 技能条动画
  delta.skillChanges.forEach(change => {
    animateSkillBar(change.name, change.before, change.after);
  });
  
  // 3. 数字跳动动画
  animateNumberChange('overallScore', delta.metricsChange.overallScore);
  animateNumberChange('matchScore', delta.metricsChange.matchScore);
  
  // 4. 成就解锁动画 (如果有)
  if (delta.metricsChange.overallScore >= 10) {
    showAchievementUnlock('能力大幅提升');
  }
}
```

---

## 九、与现有系统集成

### 9.1 与 Progress.tsx 集成

```typescript
// Progress.tsx 增强
export default function ProgressPage() {
  // 新增状态
  const [snapshots, setSnapshots] = useState<SkillSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SkillSnapshot | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  
  // 获取快照历史
  useEffect(() => {
    getSnapshots(30).then(res => setSnapshots(res.data));
  }, []);
  
  return (
    <div>
      {/* 现有的 PathView, HistoryView, DiffView */}
      
      {/* 新增: 雷达图轨迹 */}
      <RadarTimeline
        snapshots={snapshots}
        selected={selectedSnapshot}
        onSelect={setSelectedSnapshot}
      />
      
      {/* 新增: 快照对比 */}
      {compareMode && (
        <RadarCompare
          snapshotA={snapshots[0]}
          snapshotB={selectedSnapshot}
        />
      )}
    </div>
  );
}
```

### 9.2 与 Profile.tsx 集成

```typescript
// Profile.tsx 增强
export default function Profile() {
  return (
    <div>
      {/* 现有内容 */}
      
      {/* 新增: 能力雷达图 */}
      <AbilityRadar
        data={profile.radarDimensions}
        target={profile.targetJob?.requiredSkills}
        showTrend={true}
      />
      
      {/* 新增: 能力指标 */}
      <AbilityMetrics
        metrics={profile.abilityMetrics}
      />
      
      {/* 新增: 学习轨迹 */}
      <LearningTrajectory
        snapshots={profile.snapshots}
      />
    </div>
  );
}
```

### 9.3 与 LearningPaths.tsx 集成

```typescript
// LearningPaths.tsx commit 后更新画像
const handleSkillComplete = async (skill: Skill) => {
  // 1. 提交学习完成
  const result = await commitSkill(planId, skill.name);
  
  // 2. 更新本地状态
  updateLocalState(result.commit);
  
  // 3. 触发画像更新
  profileStore.getState().fetchProfile();
  
  // 4. 播放动画
  animateCommit(result.delta);
  
  // 5. 显示变化提示
  showToast(`技能提升: ${skill.name} +${result.delta.skillChanges[0].delta}%`);
};
```

---

## 十、数据库 Schema 扩展

### 10.1 skill_snapshots 表

```sql
CREATE TABLE skill_snapshots (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  commit_id VARCHAR(36) NOT NULL,
  branch_id VARCHAR(36) NOT NULL,
  
  -- 快照数据 (JSON)
  skills_json JSON NOT NULL,
  radar_json JSON NOT NULL,
  
  -- 聚合指标
  total_mastery INT NOT NULL,
  skill_count INT NOT NULL,
  depth_score INT NOT NULL,
  breadth_score INT NOT NULL,
  balance_score INT NOT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user (user_id),
  INDEX idx_commit (commit_id),
  INDEX idx_created (created_at)
);
```

### 10.2 learning_commits 表扩展

```sql
ALTER TABLE learning_commits ADD COLUMN snapshot_id VARCHAR(36);
ALTER TABLE learning_commits ADD COLUMN delta_json JSON;
ALTER TABLE learning_commits ADD COLUMN match_score_change INT;
```

---

## 十一、使用场景

### 场景 1: 用户完成一个技能

```
1. 用户学习 React Hooks useState
2. 完成后点击"标记完成"
3. 系统 commit，生成快照
4. 雷达图"前端框架"维度提升
5. 综合能力分 +2%
6. 匹配度 +1%
7. 用户看到动画效果，获得成就感
```

### 场景 2: 用户想看自己的成长

```
1. 用户进入"学习轨迹"页面
2. 看到雷达图时间滑块
3. 拖动滑块，看到雷达图形状变化
4. 发现"工程化"维度一直没增长
5. 决定创建一个 Docker 支线
```

### 场景 3: 用户想对比分支

```
1. 用户在 Docker 支线学了一段时间
2. 点击"分支对比"
3. 看到 main 和 Docker 两个雷达图叠加
4. 发现 Docker 分支让"工程化"维度大幅提升
5. 决定合并回主线
```

### 场景 4: 用户想回档重学

```
1. 用户发现 React 掌握不牢
2. 在 commit log 中找到对应的提交
3. 点击"查看快照"，看到当时的雷达图
4. 点击"回档到此"
5. 雷达图回退到之前形状
6. 重新学习，产生新的 commit
```

---

## 十二、版本规划

### v1.0 — 基础画像
- [ ] 技能快照生成
- [ ] 基础雷达图展示
- [ ] Commit 携带快照

### v1.5 — 雷达图增强
- [ ] 多维度雷达图
- [ ] 雷达图动画
- [ ] 趋势显示

### v2.0 — 轨迹系统
- [ ] 雷达图时间滑块
- [ ] 快照对比
- [ ] 分支对比

### v2.5 — 智能分析
- [ ] 能力预测
- [ ] 学习建议
- [ ] 自动标签

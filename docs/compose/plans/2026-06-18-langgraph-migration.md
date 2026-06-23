# LangGraph 全量迁移计划

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/langgraph-migration.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将所有智能体从 ActionExecutorService 迁移到 LangGraph 状态图，实现独立节点化和并行执行

**Architecture:** 
- 每个 Agent 作为 LangGraph 独立节点
- 复合意图支持并行执行
- 保持向后兼容，通过环境变量切换引擎

**Tech Stack:** @langchain/langgraph, NestJS, TypeScript

---

## 当前智能体清单

| 智能体 | 功能 | 节点名称 | 依赖 |
|--------|------|----------|------|
| MatchAgent | 岗位匹配计算 | recommendJobs | 无 |
| PlannerAgent | 学习路径生成 | generatePath | 无 |
| MultimodalService | 动画/图解/数字人 | generateAnimation, generateDiagram, generateAvatar | 无 |
| VideoAgent | 视频生成 | generateVideo | 无 |
| ProfileService | 用户画像 | loadProfile | 无 |
| SkillService | 技能管理 | - | 无 |
| ExamAgent | 考试生成 | generateExam | 无 |
| SkillGapAgent | 技能差距分析 | analyzeSkillGap | MatchAgent |
| DailyTaskAgent | 每日任务 | getDailyTasks | PlannerAgent |
| NewsAgent | 资讯推荐 | getNews | 无 |
| ReviewerAgent | 内容审查 | reviewContent | 无 |
| ResumeAgent | 简历生成 | generateResume | ProfileAgent |
| JDParserAgent | 岗位解析 | parseJD | 无 |
| AssessAgent | 学习评估 | assessLearning | 无 |
| PathAgent | 学习路径 | generatePath | 无 |
| LectureAgent | 讲义生成 | generateLecture | 无 |
| ReadingAgent | 拓展阅读 | generateReading | 无 |
| CodeAgent | 代码案例 | generateCode | 无 |

---

## 迁移任务

### Task 1: 扩展 State 定义

**Files:**
- Modify: `backend-ts/src/modules/chat/langgraph-engine.service.ts`

- [ ] **Step 1: 扩展 ChatState 添加所有 Agent 需要的状态字段**

```typescript
const ChatState = Annotation.Root({
  // 输入
  userId: Annotation<number>,
  message: Annotation<string>,
  messages: Annotation<Array<{ role: string; content: string }>>,
  pageContext: Annotation<string>,

  // 中间状态
  intent: Annotation<{ name: string; filters: Record<string, any> } | null>,
  intentPhase: Annotation<string>,
  profile: Annotation<any>,
  student: Annotation<any>,
  userContext: Annotation<string>,

  // Agent 执行结果
  jobResults: Annotation<any[]>,
  pathResult: Annotation<any>,
  examResult: Annotation<any>,
  animationResult: Annotation<any>,
  diagramResult: Annotation<any>,
  videoResult: Annotation<any>,
  avatarResult: Annotation<any>,
  progressResult: Annotation<any>,
  dailyTasksResult: Annotation<any>,
  resourcesResult: Annotation<any[]>,
  skillGapResult: Annotation<any>,

  // 输出
  reply: Annotation<string>,
  actions: Annotation<any[]>,
  agent: Annotation<string>,
});
```

- [ ] **Step 2: 更新 execute 方法初始化新字段**

```typescript
async execute(...) {
  const state = await this.graph.invoke({
    // ... 原有字段
    jobResults: [],
    pathResult: null,
    examResult: null,
    animationResult: null,
    diagramResult: null,
    videoResult: null,
    avatarResult: null,
    progressResult: null,
    dailyTasksResult: null,
    resourcesResult: [],
    skillGapResult: null,
    // ...
  });
}
```

- [ ] **Step 3: 验证编译**

Run: `npm run build`
Expected: 成功编译

---

### Task 2: 添加单 Agent 节点 - 岗位相关

**Files:**
- Modify: `backend-ts/src/modules/chat/langgraph-engine.service.ts`

- [ ] **Step 1: 添加 recommendJobs 节点**

```typescript
/** 节点: 推荐岗位 */
private async recommendJobsNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
  const filters = state.intent?.filters || {};
  const keyword = filters.keyword || '';

  try {
    const qb = this.jobRepo.createQueryBuilder('j').where('j.status = 1');
    if (keyword) qb.andWhere('j.title LIKE :kw', { kw: `%${keyword}%` });
    const jobs = await qb.orderBy('j.createTime', 'DESC').limit(5).getMany();

    const jobCards: any[] = [];
    for (const j of jobs) {
      try {
        const matchResult = await this.matchAgent.calculateMatch(state.userId, j.id);
        jobCards.push({
          id: j.id,
          title: j.title || '',
          company: j.company || '',
          location: j.location || '',
          salaryRange: j.salaryRange || '面议',
          requiredSkills: j.requiredSkills || [],
          preferredSkills: j.preferredSkills || [],
          matchScore: matchResult.totalScore,
          canApply: matchResult.canApply,
          gapCount: matchResult.gapAnalysis.length,
        });
      } catch (e) {
        jobCards.push({
          id: j.id,
          title: j.title || '',
          company: j.company || '',
          matchScore: 0,
        });
      }
    }

    jobCards.sort((a, b) => b.matchScore - a.matchScore);
    return { jobResults: jobCards, actions: [{ type: 'jobs', data: jobCards }] };
  } catch (e) {
    console.error('[LangGraph] recommendJobs failed:', e.message);
    return { jobResults: [], actions: [] };
  }
}
```

- [ ] **Step 2: 添加 setTargetJob 节点**

```typescript
/** 节点: 设置目标岗位 */
private async setTargetJobNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
  const jobId = state.intent?.filters?.jobId;
  if (!jobId) return { actions: [] };

  try {
    const student = await this.studentRepo.findOne({ where: { userId: state.userId, status: 1 } });
    if (student) {
      student.targetJobId = jobId;
      await this.studentRepo.save(student);
    }

    const job = await this.jobRepo.findOne({ where: { id: jobId, status: 1 } });
    const jobTitle = job?.title || '';

    // 更新 MongoDB
    const collection = this.mongoConnection.db!.collection('user_profiles');
    await collection.updateOne(
      { user_id: String(state.userId) },
      { $set: { 'goals.target_job_id': jobId, 'goals.target_job_title': jobTitle, updated_at: Date.now() } },
      { upsert: true },
    );

    return { actions: [{ type: 'target_set', data: { jobId, jobTitle } }] };
  } catch (e) {
    console.error('[LangGraph] setTargetJob failed:', e.message);
    return { actions: [] };
  }
}
```

- [ ] **Step 3: 在 buildGraph 中注册节点**

```typescript
.addNode('recommendJobs', this.recommendJobsNode.bind(this))
.addNode('setTargetJob', this.setTargetJobNode.bind(this))
```

- [ ] **Step 4: 更新路由逻辑**

```typescript
private routeAfterIntent(state: ChatStateType): string {
  if (!state.intent) return 'chatFallback';
  
  const intentMap: Record<string, string> = {
    recommend_jobs: 'recommendJobs',
    set_target_job: 'setTargetJob',
    generate_path: 'generatePath',
    generate_exam: 'generateExam',
    generate_animation: 'generateAnimation',
    generate_diagram: 'generateDiagram',
    generate_video: 'generateVideo',
    generate_avatar: 'generateAvatar',
    show_progress: 'showProgress',
    show_today_tasks: 'showTodayTasks',
    recommend_resources: 'recommendResources',
    match_analysis: 'analyzeSkillGap',
  };
  
  return intentMap[state.intent.name] || 'chatFallback';
}
```

- [ ] **Step 5: 验证编译**

Run: `npm run build`
Expected: 成功编译

---

### Task 3: 添加学习相关节点

**Files:**
- Modify: `backend-ts/src/modules/chat/langgraph-engine.service.ts`

- [ ] **Step 1: 添加 generatePath 节点**

```typescript
/** 节点: 生成学习路径 */
private async generatePathNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
  const jobId = state.intent?.filters?.targetJobId || state.student?.targetJobId;
  
  try {
    const result = await this.plannerAgent.generatePath(state.userId, jobId || undefined);
    return {
      pathResult: result,
      actions: [{
        type: 'path_generated',
        data: {
          planId: result.plan.id,
          planName: result.plan.planName,
          totalSkills: result.gapSkills.length,
          estimatedDate: result.plan.estimatedDate,
        },
      }],
    };
  } catch (e) {
    console.error('[LangGraph] generatePath failed:', e.message);
    return { pathResult: null, actions: [] };
  }
}
```

- [ ] **Step 2: 添加 generateExam 节点**

```typescript
/** 节点: 生成考试 */
private async generateExamNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
  const skillName = state.intent?.filters?.skillName || 'JavaScript';
  const count = state.intent?.filters?.question_count || 5;
  const qType = state.intent?.filters?.question_type || 'mixed';

  const typeDesc = qType === 'mixed' ? '选择题和编程题混合' : qType === 'choice' ? '选择题' : '编程题';

  const prompt = `请为技能「${skillName}」生成 ${count} 道练习题。
题型要求：${typeDesc}

输出严格JSON格式：
{
  "skill": "${skillName}",
  "questions": [
    {"type": "choice", "question": "题目描述", "options": ["A", "B", "C", "D"], "answer": 0, "explanation": "解析"},
    {"type": "coding", "question": "编程题描述", "template": "代码模板", "hint": "提示"}
  ]
}
只输出JSON，不要其他文字。`;

  try {
    const result = await this.llmService.chatCompletion([
      { role: 'system', content: '你是出题专家，根据技能名称生成高质量练习题。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.5, tier: 'pro' });

    const examData = extractJson(result);
    
    // 存入 MySQL
    try {
      const exam = await this.examRepo.save({
        userId: state.userId,
        examType: 1,
        skillName,
        answers: examData,
        passed: 0,
        retryCount: 0,
        createTime: Date.now(),
        updateTime: Date.now(),
        status: 1,
      });
      examData.exam_id = exam.id;
    } catch (e) {
      console.warn('[LangGraph] Save exam failed:', e.message);
    }

    return { examResult: examData, actions: [{ type: 'exam', data: examData }] };
  } catch (e) {
    console.error('[LangGraph] generateExam failed:', e.message);
    return { examResult: null, actions: [] };
  }
}
```

- [ ] **Step 3: 添加 showProgress 节点**

```typescript
/** 节点: 查看学习进度 */
private async showProgressNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
  try {
    const paths = await this.pathRepo.find({
      where: { userId: state.userId, status: 1 },
      order: { createTime: 'DESC' },
      take: 1,
    });

    if (!paths.length) {
      return { progressResult: { message: '暂无学习路径', paths: [] }, actions: [{ type: 'progress', data: { message: '暂无学习路径' } }] };
    }

    const path = paths[0];
    const pathData = path.pathData || {};
    const phases = pathData.phases || [];

    let totalSkills = 0;
    let doneSkills = 0;
    const phaseProgress = phases.map((phase: any, i: number) => {
      const skills = phase.skills || [];
      const phaseDone = skills.filter((s: any) => s.status === 'done').length;
      totalSkills += skills.length;
      doneSkills += phaseDone;
      return {
        name: phase.name || `阶段${i + 1}`,
        total: skills.length,
        done: phaseDone,
        status: i < (path.currentPhase || 0) ? 'done' : i === (path.currentPhase || 0) ? 'current' : 'locked',
      };
    });

    const result = {
      total_skills: totalSkills,
      done_skills: doneSkills,
      currentPhase: path.currentPhase || 0,
      matchScore: Number(path.matchScore || 0),
      estimatedDate: path.estimatedDate || '',
      phases: phaseProgress,
    };

    return { progressResult: result, actions: [{ type: 'progress', data: result }] };
  } catch (e) {
    console.error('[LangGraph] showProgress failed:', e.message);
    return { progressResult: null, actions: [] };
  }
}
```

- [ ] **Step 4: 添加 showTodayTasks 节点**

```typescript
/** 节点: 查看今日任务 */
private async showTodayTasksNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
  try {
    const paths = await this.pathRepo.find({
      where: { userId: state.userId, status: 1 },
      order: { createTime: 'DESC' },
      take: 1,
    });

    if (!paths.length) {
      return { dailyTasksResult: { message: '暂无学习路径', tasks: [] }, actions: [{ type: 'today_tasks', data: { message: '暂无学习路径' } }] };
    }

    const path = paths[0];
    const pathData = path.pathData || {};
    const phases = pathData.phases || [];
    const currentPhase = path.currentPhase || 0;

    const tasks: any[] = [];
    if (currentPhase < phases.length) {
      const phase = phases[currentPhase];
      for (const skill of phase.skills || []) {
        if (skill.status !== 'done') {
          tasks.push({
            title: skill.name || '',
            phase: phase.name || '',
            duration: skill.duration || '30min',
            status: skill.status || 'pending',
          });
        }
      }
    }

    const result = {
      phase_name: currentPhase < phases.length ? phases[currentPhase].name || '' : '',
      tasks: tasks.slice(0, 6),
      total: tasks.length,
    };

    return { dailyTasksResult: result, actions: [{ type: 'today_tasks', data: result }] };
  } catch (e) {
    console.error('[LangGraph] showTodayTasks failed:', e.message);
    return { dailyTasksResult: null, actions: [] };
  }
}
```

- [ ] **Step 5: 在 buildGraph 中注册节点**

```typescript
.addNode('generatePath', this.generatePathNode.bind(this))
.addNode('generateExam', this.generateExamNode.bind(this))
.addNode('showProgress', this.showProgressNode.bind(this))
.addNode('showTodayTasks', this.showTodayTasksNode.bind(this))
```

- [ ] **Step 6: 验证编译**

Run: `npm run build`
Expected: 成功编译

---

### Task 4: 添加多模态节点

**Files:**
- Modify: `backend-ts/src/modules/chat/langgraph-engine.service.ts`

- [ ] **Step 1: 添加 generateAnimation 节点**

```typescript
/** 节点: 生成动画 */
private async generateAnimationNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
  const skillName = state.intent?.filters?.skillName;
  if (!skillName) return { actions: [] };

  try {
    const result = await this.multimodal.generateAnimation(skillName);
    return { animationResult: result, actions: [result] };
  } catch (e) {
    console.error('[LangGraph] generateAnimation failed:', e.message);
    return { animationResult: null, actions: [] };
  }
}
```

- [ ] **Step 2: 添加 generateDiagram 节点**

```typescript
/** 节点: 生成图解 */
private async generateDiagramNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
  const skillName = state.intent?.filters?.skillName;
  const diagramType = state.intent?.filters?.diagramType || 'flowchart';
  if (!skillName) return { actions: [] };

  try {
    const result = await this.multimodal.generateDiagram(skillName, diagramType);
    return { diagramResult: result, actions: [result] };
  } catch (e) {
    console.error('[LangGraph] generateDiagram failed:', e.message);
    return { diagramResult: null, actions: [] };
  }
}
```

- [ ] **Step 3: 添加 generateVideo 节点**

```typescript
/** 节点: 生成视频 */
private async generateVideoNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
  const skillName = state.intent?.filters?.skillName;
  const difficulty = state.intent?.filters?.difficulty || 'beginner';
  if (!skillName) return { actions: [] };

  const taskId = `langgraph_video_${Date.now()}`;

  try {
    // 注册任务
    ActionExecutorService.videoTasks.set(taskId, {
      status: 'pending',
      progress: 0,
      message: '正在准备生成视频...',
      startTime: Date.now(),
    });

    // 异步执行
    this.videoAgent.generate(
      {
        task_id: taskId,
        skill_name: skillName,
        knowledge_content: `# ${skillName}\n\n用户通过聊天请求生成教学视频。`,
        difficulty: difficulty as any,
      },
      (stage: string, progress: number, message: string) => {
        const task = ActionExecutorService.videoTasks.get(taskId);
        if (task) {
          task.status = stage as any;
          task.progress = Math.min(progress, 99);
          task.message = message;
        }
      },
    ).then((result) => {
      const task = ActionExecutorService.videoTasks.get(taskId);
      if (!task) return;

      if (result.status === 'completed' && result.result) {
        task.status = 'completed';
        task.progress = 100;
        task.message = '视频生成完成';
        task.result = result.result;
      } else {
        task.status = 'failed';
        task.error = result.error || '视频生成失败';
      }
    }).catch((e: any) => {
      const task = ActionExecutorService.videoTasks.get(taskId);
      if (task) {
        task.status = 'failed';
        task.error = e.message;
      }
    });

    // 10 分钟后清理
    setTimeout(() => ActionExecutorService.videoTasks.delete(taskId), 600000);

    return {
      videoResult: { taskId, skillName, difficulty },
      actions: [{ type: 'video_pending', data: { taskId, skillName, difficulty, message: `正在为你生成「${skillName}」的教学视频，预计需要 2-4 分钟...` } }],
    };
  } catch (e) {
    console.error('[LangGraph] generateVideo failed:', e.message);
    return { videoResult: null, actions: [] };
  }
}
```

- [ ] **Step 4: 添加 generateAvatar 节点**

```typescript
/** 节点: 生成数字人 */
private async generateAvatarNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
  const skillName = state.intent?.filters?.skillName;
  if (!skillName) return { actions: [] };

  try {
    const result = await this.multimodal.generateAvatar(skillName);
    return { avatarResult: result, actions: [result] };
  } catch (e) {
    console.error('[LangGraph] generateAvatar failed:', e.message);
    return { avatarResult: null, actions: [] };
  }
}
```

- [ ] **Step 5: 添加 recommendResources 节点**

```typescript
/** 节点: 推荐资源 */
private async recommendResourcesNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
  const skills: string[] = state.intent?.filters?.skills || [];

  const RESOURCE_DB: Record<string, Array<{ title: string; url: string; type: string }>> = {
    javascript: [
      { title: 'MDN JavaScript 指南', url: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript', type: '文档' },
      { title: 'JavaScript.info', url: 'https://javascript.info/', type: '教程' },
    ],
    react: [
      { title: 'React 官方文档', url: 'https://react.dev/', type: '文档' },
      { title: 'React 中文文档', url: 'https://react.dev/learn', type: '教程' },
    ],
    python: [
      { title: 'Python 官方教程', url: 'https://docs.python.org/zh-cn/3/tutorial/', type: '文档' },
      { title: '廖雪峰 Python 教程', url: 'https://liaoxuefeng.com/books/python/introduction/', type: '教程' },
    ],
  };

  const resources: any[] = [];
  for (const skill of skills) {
    const key = skill.toLowerCase().replace(/\s/g, '');
    if (RESOURCE_DB[key]) {
      resources.push(...RESOURCE_DB[key]);
    }
  }

  return { resourcesResult: resources, actions: [{ type: 'resources', data: resources }] };
}
```

- [ ] **Step 6: 在 buildGraph 中注册节点**

```typescript
.addNode('generateAnimation', this.generateAnimationNode.bind(this))
.addNode('generateDiagram', this.generateDiagramNode.bind(this))
.addNode('generateVideo', this.generateVideoNode.bind(this))
.addNode('generateAvatar', this.generateAvatarNode.bind(this))
.addNode('recommendResources', this.recommendResourcesNode.bind(this))
```

- [ ] **Step 7: 验证编译**

Run: `npm run build`
Expected: 成功编译

---

### Task 5: 添加依赖注入和复合意图支持

**Files:**
- Modify: `backend-ts/src/modules/chat/langgraph-engine.service.ts`

- [ ] **Step 1: 添加缺失的依赖注入**

```typescript
constructor(
  @InjectRepository(Student) private studentRepo: Repository<Student>,
  @InjectRepository(JobPosition) private jobRepo: Repository<JobPosition>,
  @InjectRepository(LearningPlan) private pathRepo: Repository<LearningPlan>,
  @InjectRepository(ExamRecord) private examRepo: Repository<ExamRecord>,
  @InjectConnection() private mongoConnection: Connection,
  private llmService: LlmService,
  private profileService: ProfileService,
  private chatHistory: ChatHistoryService,
  private tutorPromptService: TutorPromptService,
  private actionExecutor: ActionExecutorService,
  private intentRouter: IntentRouterService,
  private matchAgent: MatchAgentService,
  private plannerAgent: PlannerAgentService,
  private multimodal: MultimodalService,
  private videoAgent: VideoAgentService,
) {
  this.buildGraph();
}
```

- [ ] **Step 2: 添加复合意图并行节点**

```typescript
/** 节点: 面试准备（复合意图 - 并行执行） */
private async prepareInterviewNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
  // 并行执行：解析 JD + 分析技能差距 + 生成考试
  const [jdResult, gapResult, examResult] = await Promise.allSettled([
    this.parseJDForInterview(state),
    this.analyzeSkillGapForInterview(state),
    this.generateExamForInterview(state),
  ]);

  const actions: any[] = [];
  if (jdResult.status === 'fulfilled') actions.push(...jdResult.value);
  if (gapResult.status === 'fulfilled') actions.push(...gapResult.value);
  if (examResult.status === 'fulfilled') actions.push(...examResult.value);

  return { actions };
}

/** 节点: 开始学习（复合意图 - 串行执行） */
private async startLearningNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
  // 串行执行：生成路径 → 获取每日任务
  const pathResult = await this.generatePathNode(state);
  const tasksResult = await this.showTodayTasksNode(state);

  return {
    ...pathResult,
    ...tasksResult,
    actions: [...(pathResult.actions || []), ...(tasksResult.actions || [])],
  };
}

/** 节点: 检查匹配度（复合意图） */
private async checkMatchNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
  // 执行：推荐岗位 + 技能差距分析
  const jobsResult = await this.recommendJobsNode(state);
  const gapResult = await this.analyzeSkillGapNode(state);

  return {
    ...jobsResult,
    ...gapResult,
    actions: [...(jobsResult.actions || []), ...(gapResult.actions || [])],
  };
}
```

- [ ] **Step 3: 添加 analyzeSkillGap 节点**

```typescript
/** 节点: 分析技能差距 */
private async analyzeSkillGapNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
  try {
    // 获取用户技能
    const userSkills = state.profile?.skills || [];
    const targetJobId = state.student?.targetJobId;

    if (!targetJobId) {
      return { skillGapResult: { message: '请先设置目标岗位' }, actions: [] };
    }

    const job = await this.jobRepo.findOne({ where: { id: targetJobId, status: 1 } });
    if (!job) {
      return { skillGapResult: { message: '目标岗位不存在' }, actions: [] };
    }

    const requiredSkills = job.requiredSkills || [];
    const userSkillNames = userSkills.map((s: any) => s.name?.toLowerCase() || '');

    const matched = requiredSkills.filter((s: string) => userSkillNames.includes(s.toLowerCase()));
    const gap = requiredSkills.filter((s: string) => !userSkillNames.includes(s.toLowerCase()));

    const result = {
      jobTitle: job.title,
      totalRequired: requiredSkills.length,
      matched: matched.length,
      gap: gap.length,
      matchedSkills: matched,
      gapSkills: gap,
      matchScore: Math.round((matched.length / requiredSkills.length) * 100),
    };

    return { skillGapResult: result, actions: [{ type: 'skill_gap', data: result }] };
  } catch (e) {
    console.error('[LangGraph] analyzeSkillGap failed:', e.message);
    return { skillGapResult: null, actions: [] };
  }
}
```

- [ ] **Step 4: 注册复合意图节点并更新路由**

```typescript
.addNode('prepareInterview', this.prepareInterviewNode.bind(this))
.addNode('startLearning', this.startLearningNode.bind(this))
.addNode('checkMatch', this.checkMatchNode.bind(this))
.addNode('analyzeSkillGap', this.analyzeSkillGapNode.bind(this))
```

更新路由：
```typescript
const intentMap: Record<string, string> = {
  // ... 原有意图
  prepare_interview: 'prepareInterview',
  start_learning: 'startLearning',
  check_match: 'checkMatch',
  match_analysis: 'analyzeSkillGap',
};
```

- [ ] **Step 5: 验证编译**

Run: `npm run build`
Expected: 成功编译

---

### Task 6: 添加 OrchestratorAgent 节点

**Files:**
- Modify: `backend-ts/src/modules/chat/langgraph-engine.service.ts`

- [ ] **Step 1: 添加 orchestratorFallback 节点（当所有节点都不匹配时）**

```typescript
/** 节点: Orchestrator 兜底（使用原 OrchestratorAgent 逻辑） */
private async orchestratorFallbackNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
  // 使用 LLM 进行意图识别
  const system = `你是智途 AI 助教的中控智能体。根据用户消息，判断应该调用哪个子智能体。

可用的子智能体：
- generate_lecture: 生成讲义
- generate_reading: 拓展阅读
- generate_code: 代码案例
- generate_path: 学习路径
- assess_learning: 学习评估
- parse_jd: 解析岗位 JD
- review_content: 审查内容质量
- generate_resume: 生成简历
- analyze_profile: 分析用户画像
- generate_exam: 生成考试
- analyze_skill_gap: 分析技能差距
- get_daily_tasks: 获取每日任务
- get_news: 获取资讯

用户消息：${state.message}

输出JSON格式：
{
  "intent": "意图名称",
  "confidence": 0.9,
  "entities": {"skillName": "技能名"}
}

只输出JSON，不要其他文字。`;

  try {
    const result = await this.llmService.chatCompletion([
      { role: 'system', content: system },
      { role: 'user', content: state.message },
    ], { temperature: 0.1, maxTokens: 256 });

    const parsed = extractJson(result);
    const intent = parsed.intent;

    // 根据识别的意图调用相应节点
    const intentNodeMap: Record<string, string> = {
      generate_lecture: 'generateLecture',
      generate_reading: 'generateReading',
      generate_code: 'generateCode',
      generate_path: 'generatePath',
      assess_learning: 'assessLearning',
      parse_jd: 'parseJD',
      review_content: 'reviewContent',
      generate_resume: 'generateResume',
      analyze_profile: 'analyzeProfile',
      generate_exam: 'generateExam',
      analyze_skill_gap: 'analyzeSkillGap',
      get_daily_tasks: 'showTodayTasks',
      get_news: 'getNews',
    };

    const nodeName = intentNodeMap[intent];
    if (nodeName) {
      // 调用对应节点
      const nodeFn = (this as any)[`${this.toCamelCase(nodeName)}Node`];
      if (nodeFn) {
        return await nodeFn.call(this, state);
      }
    }

    // 如果没有匹配的意图，走普通聊天
    return await this.chatFallbackNode(state);
  } catch (e) {
    console.error('[LangGraph] orchestratorFallback failed:', e.message);
    return await this.chatFallbackNode(state);
  }
}

private toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}
```

- [ ] **Step 2: 更新路由，将 orchestratorFallback 作为最终兜底**

```typescript
private routeAfterIntent(state: ChatStateType): string {
  if (!state.intent) return 'orchestratorFallback';
  
  const intentMap: Record<string, string> = {
    // ... 所有意图映射
  };
  
  return intentMap[state.intent.name] || 'orchestratorFallback';
}
```

- [ ] **Step 3: 验证编译**

Run: `npm run build`
Expected: 成功编译

---

### Task 7: 测试和验证

- [ ] **Step 1: 运行完整构建**

Run: `cd D:\X\ZhiPath\backend-ts && npm run build`
Expected: 成功编译，无错误

- [ ] **Step 2: 启动服务并测试**

Run: `npm run start:dev`
Expected: 服务启动成功，日志显示 `Engine: LangGraph`

- [ ] **Step 3: 测试基本聊天**

发送消息 "你好"，验证返回正常回复

- [ ] **Step 4: 测试单 Agent 意图**

发送消息 "推荐岗位"，验证返回岗位推荐

- [ ] **Step 5: 测试复合意图**

发送消息 "帮我准备面试"，验证并行执行 JD 解析 + 技能差距 + 考试生成

---

## 完成检查

- [ ] 所有智能体已迁移为独立节点
- [ ] 复合意图支持并行执行
- [ ] 环境变量 `USE_LANGGRAPH=true` 可切换引擎
- [ ] 所有测试通过
- [ ] 文档已更新

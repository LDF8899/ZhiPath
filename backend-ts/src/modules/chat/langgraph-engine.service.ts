import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { Student } from '../../entities/student.entity';
import { JobPosition } from '../../entities/job.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { ExamRecord } from '../../entities/exam.entity';
import { LlmService } from '../../services/llm.service';
import { ProfileService } from '../../services/profile.service';
import { ChatHistoryService } from '../../services/chat-history.service';
import { TutorPromptService } from './tutor-prompt.service';
import { ActionExecutorService } from './action-executor.service';
import { IntentRouterService } from './intent-router.service';
import { MatchAgentService } from '../../services/match-agent.service';
import { PlannerAgentService } from '../../services/planner-agent.service';
import { MultimodalService } from '../../services/multimodal.service';
import { VideoAgentService } from '../../services/agents/video-agent.service';
import { EventsService } from '../events/events.service';
import { extractJson } from '../../common/json-repair';

// ── State 定义 ──────────────────────────────────

const ChatState = Annotation.Root({
  // 输入
  userId: Annotation<number>,
  message: Annotation<string>,
  messages: Annotation<Array<{ role: string; content: string }>>,
  pageContext: Annotation<string>,

  // 中间状态
  intent: Annotation<{ name: string; filters: Record<string, any> } | null>,
  intentPhase: Annotation<string>,  // 'B' | 'C' | 'none'
  profile: Annotation<any>,
  student: Annotation<any>,
  userContext: Annotation<string>,

  // 输出
  reply: Annotation<string>,
  actions: Annotation<any[]>,
  agent: Annotation<string>,

  // 业务结果
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
});

type ChatStateType = typeof ChatState.State;

// ── 节点函数 ──────────────────────────────────

@Injectable()
export class LangGraphEngineService {
  private graph: any;

  /** 节点 → 智能体映射（用于 SSE 事件） */
  private static readonly NODE_AGENT_MAP: Record<string, { agent: string; label: string }> = {
    loadProfile:       { agent: 'chat',      label: '加载用户画像' },
    intentRouter:      { agent: 'chat',      label: '识别意图' },
    executeAction:     { agent: 'chat',      label: '执行操作' },
    aiSummarize:       { agent: 'chat',      label: '生成总结' },
    chatFallback:      { agent: 'chat',      label: 'AI 对话' },
    recommendJobs:     { agent: 'jobs',       label: '岗位顾问分析中' },
    setTargetJob:      { agent: 'target',     label: '设置目标岗位' },
    generatePath:      { agent: 'path',       label: '路径规划师工作中' },
    generateExam:      { agent: 'exam',       label: '出题专家出题中' },
    showProgress:      { agent: 'progress',   label: '进度管理员查询中' },
    showTodayTasks:    { agent: 'tasks',       label: '任务调度员查询中' },
    generateAnimation: { agent: 'animation',  label: '动画设计师创作中' },
    generateDiagram:   { agent: 'diagram',    label: '动画设计师绘图中' },
    generateVideo:     { agent: 'video',      label: '视频制作人工作中' },
    generateAvatar:    { agent: 'avatar',     label: '数字人生成中' },
    recommendResources:{ agent: 'resources',  label: '资源推荐官检索中' },
    analyzeSkillGap:   { agent: 'gap',        label: '差距分析师分析中' },
    prepareInterview:  { agent: 'chat',       label: '面试准备中' },
    startLearning:     { agent: 'path',       label: '开始学习' },
    checkMatch:        { agent: 'gap',        label: '匹配度分析中' },
    orchestratorFallback: { agent: 'chat',    label: 'AI 思考中' },
  };

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
    private eventsService: EventsService,
  ) {
    this.buildGraph();
  }

  /** 构建 LangGraph 状态图 */
  private buildGraph() {
    const graph = new StateGraph(ChatState)
      // 添加节点
      .addNode('loadProfile', this.loadProfileNode.bind(this))
      .addNode('intentRouter', this.intentRouterNode.bind(this))
      .addNode('executeAction', this.executeActionNode.bind(this))
      .addNode('aiSummarize', this.aiSummarizeNode.bind(this))
      .addNode('chatFallback', this.chatFallbackNode.bind(this))
      .addNode('recommendJobs', this.recommendJobsNode.bind(this))
      .addNode('setTargetJob', this.setTargetJobNode.bind(this))
      .addNode('generatePath', this.generatePathNode.bind(this))
      .addNode('generateExam', this.generateExamNode.bind(this))
      .addNode('showProgress', this.showProgressNode.bind(this))
      .addNode('showTodayTasks', this.showTodayTasksNode.bind(this))
      .addNode('generateAnimation', this.generateAnimationNode.bind(this))
      .addNode('generateDiagram', this.generateDiagramNode.bind(this))
      .addNode('generateVideo', this.generateVideoNode.bind(this))
      .addNode('generateAvatar', this.generateAvatarNode.bind(this))
      .addNode('recommendResources', this.recommendResourcesNode.bind(this))
      .addNode('analyzeSkillGap', this.analyzeSkillGapNode.bind(this))
      .addNode('prepareInterview', this.prepareInterviewNode.bind(this))
      .addNode('startLearning', this.startLearningNode.bind(this))
      .addNode('checkMatch', this.checkMatchNode.bind(this))
      .addNode('orchestratorFallback', this.orchestratorFallbackNode.bind(this))

      // 定义边
      .addEdge(START, 'loadProfile')
      .addEdge('loadProfile', 'intentRouter')
      .addConditionalEdges('intentRouter', this.routeAfterIntent.bind(this), {
        'recommendJobs': 'recommendJobs',
        'setTargetJob': 'setTargetJob',
        'generatePath': 'generatePath',
        'generateExam': 'generateExam',
        'showProgress': 'showProgress',
        'showTodayTasks': 'showTodayTasks',
        'generateAnimation': 'generateAnimation',
        'generateDiagram': 'generateDiagram',
        'generateVideo': 'generateVideo',
        'generateAvatar': 'generateAvatar',
        'recommendResources': 'recommendResources',
        'analyzeSkillGap': 'analyzeSkillGap',
        'prepareInterview': 'prepareInterview',
        'startLearning': 'startLearning',
        'checkMatch': 'checkMatch',
        'executeAction': 'executeAction',
        'chatFallback': 'chatFallback',
        'orchestratorFallback': 'orchestratorFallback',
      })
      .addConditionalEdges('executeAction', this.routeAfterAction.bind(this), {
        'aiSummarize': 'aiSummarize',
        'chatFallback': 'chatFallback',
        'end': END,
      })
      .addEdge('aiSummarize', END)
      .addEdge('recommendJobs', 'aiSummarize')
      .addEdge('setTargetJob', 'aiSummarize')
      .addEdge('generatePath', 'aiSummarize')
      .addEdge('generateExam', 'aiSummarize')
      .addEdge('showProgress', 'aiSummarize')
      .addEdge('showTodayTasks', 'aiSummarize')
      .addEdge('generateAnimation', 'aiSummarize')
      .addEdge('generateDiagram', 'aiSummarize')
      .addEdge('generateVideo', 'aiSummarize')
      .addEdge('generateAvatar', 'aiSummarize')
      .addEdge('recommendResources', 'aiSummarize')
      .addEdge('analyzeSkillGap', 'aiSummarize')
      .addEdge('prepareInterview', 'aiSummarize')
      .addEdge('startLearning', 'aiSummarize')
      .addEdge('checkMatch', 'aiSummarize')
      .addEdge('orchestratorFallback', END)
      .addEdge('chatFallback', END);

    this.graph = graph.compile();
  }

  /** 主入口：执行 LangGraph */
  async execute(
    userId: number,
    messages: Array<{ role: string; content: string }>,
    pageContext: string = 'general',
  ): Promise<{ reply: string; actions: any[]; agent: string }> {
    const state = await this.graph.invoke({
      userId,
      message: messages[messages.length - 1]?.content || '',
      messages,
      pageContext,
      intent: null,
      intentPhase: 'none',
      profile: null,
      student: null,
      userContext: '',
      reply: '',
      actions: [],
      agent: 'chat',
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
    });

    return {
      reply: state.reply,
      actions: state.actions,
      agent: state.agent,
    };
  }

  /** 流式执行：每个节点完成后推送 SSE 事件 */
  async *streamExecute(
    userId: number,
    messages: Array<{ role: string; content: string }>,
    pageContext: string = 'general',
  ): AsyncGenerator<{ node: string; agent: string; label: string; state: Partial<ChatStateType> }> {
    const initialState = {
      userId,
      message: messages[messages.length - 1]?.content || '',
      messages,
      pageContext,
      intent: null as any,
      intentPhase: 'none',
      profile: null as any,
      student: null as any,
      userContext: '',
      reply: '',
      actions: [] as any[],
      agent: 'chat',
      jobResults: [] as any[],
      pathResult: null as any,
      examResult: null as any,
      animationResult: null as any,
      diagramResult: null as any,
      videoResult: null as any,
      avatarResult: null as any,
      progressResult: null as any,
      dailyTasksResult: null as any,
      resourcesResult: [] as any[],
      skillGapResult: null as any,
    };

    try {
      // graph.stream() 每完成一个节点就 yield 一次状态更新
      const stream = await this.graph.stream(initialState, { streamMode: 'updates' });

      for await (const chunk of stream) {
        // chunk 的格式: { nodeName: Partial<ChatStateType> }
        for (const [nodeName, nodeState] of Object.entries(chunk)) {
          const meta = LangGraphEngineService.NODE_AGENT_MAP[nodeName] || {
            agent: 'chat',
            label: nodeName,
          };

          // 推送 SSE 事件给前端
          this.eventsService.emit(userId, {
            type: 'graph_node',
            data: {
              node: nodeName,
              agent: meta.agent,
              label: meta.label,
              reply: (nodeState as any)?.reply || '',
              actions: (nodeState as any)?.actions || [],
            },
          });

          yield { node: nodeName, ...meta, state: nodeState as Partial<ChatStateType> };
        }
      }
    } catch (e) {
      console.error('[LangGraph] streamExecute error, falling back to invoke:', e.message);
      // 流式失败，回退到同步 invoke
      try {
        const state = await this.graph.invoke(initialState);
        const fallbackMeta = LangGraphEngineService.NODE_AGENT_MAP['chatFallback'] || {
          agent: 'chat',
          label: 'AI 对话',
        };
        this.eventsService.emit(userId, {
          type: 'graph_node',
          data: {
            node: 'error_fallback',
            agent: fallbackMeta.agent,
            label: '流式执行失败，已回退',
            reply: state.reply || '',
            actions: state.actions || [],
          },
        });
        yield { node: 'error_fallback', ...fallbackMeta, state };
      } catch (e2) {
        console.error('[LangGraph] invoke fallback also failed:', e2.message);
        yield {
          node: 'error',
          agent: 'chat',
          label: '执行失败',
          state: { reply: '抱歉，处理请求时出错，请稍后再试。', actions: [] },
        };
      }
    }
  }

  // ── 节点实现 ──────────────────────────────────

  /** 节点 1: 加载用户画像 */
  private async loadProfileNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
    let profile: any = null;
    let student: any = null;
    const parts: string[] = [];

    try {
      profile = await this.profileService.getProfile(state.userId);
      if (profile) {
        const skills = profile.skills || [];
        if (skills.length) {
          parts.push(`用户技能：${skills.slice(0, 8).map((s: any) => s.name || '').join(', ')}`);
        }
        const goals = profile.goals || {};
        if (goals.targetJobTitle) parts.push(`目标岗位：${goals.targetJobTitle}`);
        if (goals.direction) parts.push(`意向方向：${goals.direction}`);
      }
    } catch (e) {
      console.warn('[LangGraph] getProfile failed:', e.message);
    }

    try {
      student = await this.studentRepo.findOne({ where: { userId: state.userId, status: 1 } });
      if (student) {
        if (student.major) parts.push(`专业：${student.major}`);
        if (student.grade) parts.push(`年级：${student.grade}`);
        if (student.targetJobId) parts.push(`目标岗位ID：${student.targetJobId}`);
      }
    } catch (e) {
      console.warn('[LangGraph] getStudent failed:', e.message);
    }

    return {
      profile,
      student,
      userContext: parts.length ? `用户信息：\n${parts.join('\n')}` : '',
    };
  }

  /** 节点 2: 意图路由 */
  private async intentRouterNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
    // Phase B: 仅匹配高置信度关键词（出题/学习计划/进度等明确指令）
    // 多模态（视频/动画/图表/数字人）全部交给 LLM 判断，避免误匹配
    let intent = this.intentRouter.matchIntent(state.message);
    let phase = 'none';

    if (intent) {
      phase = 'B';
      console.log(`[LangGraph] Phase B match: ${intent.name}`);
    } else {
      // Phase C: LLM 统一决策（有上下文，能区分"做个视频"和"之前生成的视频"）
      intent = await this.intentRouter.llmDecideAction(state.messages, state.userContext);
      if (intent) {
        phase = 'C';
        console.log(`[LangGraph] Phase C match: ${intent.name}`);
      }
    }

    return { intent, intentPhase: phase };
  }

  /** 节点 3: 执行动作 */
  private async executeActionNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
    if (!state.intent) {
      return { actions: [], reply: '' };
    }

    console.log(`[LangGraph] Executing intent: ${state.intent.name}`);

    try {
      const executed = await this.executeIntent(state.intent, state.userId);
      return {
        actions: executed.actions,
        reply: executed.reply,
      };
    } catch (e) {
      console.error('[LangGraph] Action execution failed:', e.message);
      return { actions: [], reply: '' };
    }
  }

  /** 节点 4: AI 总结动作结果 */
  private async aiSummarizeNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
    if (!state.actions.length) {
      return {};
    }

    const resultDesc: string[] = [];
    for (const r of state.actions) {
      const rtype = r.type || '';
      if (rtype === 'jobs') {
        const jobs = r.data || [];
        resultDesc.push(`推荐了 ${jobs.length} 个岗位`);
      } else if (rtype === 'path_generated') {
        resultDesc.push(`学习路径已生成：${r.data?.planName || ''}`);
      } else if (rtype === 'video_pending') {
        resultDesc.push(`教学视频正在生成中`);
      } else if (rtype === 'video') {
        resultDesc.push(`教学视频已完成`);
      } else if (rtype === 'animation') {
        resultDesc.push(`已生成动画演示`);
      } else if (rtype === 'diagram') {
        resultDesc.push(`已生成图解`);
      } else if (rtype === 'exam') {
        const questions = r.data?.questions || [];
        resultDesc.push(`已生成 ${questions.length} 道练习题`);
      } else if (rtype === 'progress') {
        resultDesc.push(`已查询学习进度`);
      } else if (rtype === 'today_tasks') {
        resultDesc.push(`已获取今日学习任务`);
      } else if (rtype === 'resources') {
        resultDesc.push(`已推荐学习资源`);
      } else if (rtype === 'target_set') {
        resultDesc.push(`目标岗位已设置：${r.data?.jobTitle || ''}`);
      } else if (rtype === 'avatar') {
        resultDesc.push(`数字人形象已生成`);
      } else if (rtype === 'skill_gap') {
        resultDesc.push(`技能差距分析完成`);
      } else if (rtype === 'error') {
        resultDesc.push(`执行出错：${r.data?.message || ''}`);
      } else if (rtype) {
        resultDesc.push(`已完成 ${rtype} 操作`);
      }
    }

    if (!resultDesc.length) {
      return {};
    }

    const system = `你是智途 AI 助教。系统刚刚为用户执行了一个操作，请用自然、简洁的语言总结结果。
不要说"系统为你执行了"，直接说结果。语气温暖，可以加 1 个 emoji。`;

    const prompt = `用户说：${state.message}\n\n操作结果：${resultDesc.join('; ')}\n\n请用自然语言回复用户。`;

    try {
      const reply = await this.llmService.chatCompletion(
        [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.5, maxTokens: 512 },
      );
      return { reply, agent: state.intent?.name || 'chat' };
    } catch (e) {
      console.warn('[LangGraph] AI summarize failed:', e.message);
      return {};
    }
  }

  /** 节点 5: 普通聊天 Fallback */
  private async chatFallbackNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
    const systemPrompt = this.tutorPromptService.buildTutorPrompt(
      state.profile,
      state.student,
      state.pageContext,
    );

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...state.messages,
    ];

    try {
      const reply = await this.llmService.chatCompletion(chatMessages);
      console.log(`[LangGraph] Fallback reply length: ${reply.length}`);

      // 解析并执行内嵌动作
      const actionResults: any[] = [];
      try {
        const actions = this.actionExecutor.extractActions(reply);
        if (actions.length > 0) {
          const results = await this.actionExecutor.executeActions(actions, state.userId);
          actionResults.push(...results);
        }
      } catch (e) {
        console.warn('[LangGraph] Action extraction failed:', e.message);
      }

      const clean = this.actionExecutor.cleanReply(reply);
      return {
        reply: clean,
        actions: actionResults,
        agent: 'chat',
      };
    } catch (e) {
      console.error('[LangGraph] LLM call failed:', e.message);
      return {
        reply: '抱歉，AI服务暂时不可用，请稍后再试。',
        actions: [],
        agent: 'chat',
      };
    }
  }

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
          jobCards.push({ id: j.id, title: j.title || '', company: j.company || '', location: j.location || '', salaryRange: j.salaryRange || '面议', requiredSkills: j.requiredSkills || [], preferredSkills: j.preferredSkills || [], matchScore: matchResult.totalScore, canApply: matchResult.canApply, gapCount: matchResult.gapAnalysis.length });
        } catch (e) {
          jobCards.push({ id: j.id, title: j.title || '', company: j.company || '', matchScore: 0 });
        }
      }
      jobCards.sort((a, b) => b.matchScore - a.matchScore);
      return { jobResults: jobCards, actions: [{ type: 'jobs', data: jobCards }] };
    } catch (e) {
      console.error('[LangGraph] recommendJobs failed:', e.message);
      return { jobResults: [], actions: [] };
    }
  }

  /** 节点: 设置目标岗位 */
  private async setTargetJobNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
    const jobId = state.intent?.filters?.jobId;
    if (!jobId) return { actions: [] };
    try {
      const student = await this.studentRepo.findOne({ where: { userId: state.userId, status: 1 } });
      if (student) { student.targetJobId = jobId; await this.studentRepo.save(student); }
      const job = await this.jobRepo.findOne({ where: { id: jobId, status: 1 } });
      const jobTitle = job?.title || '';
      const collection = this.mongoConnection.db!.collection('user_profiles');
      await collection.updateOne({ user_id: String(state.userId) }, { $set: { 'goals.target_job_id': jobId, 'goals.target_job_title': jobTitle, updated_at: Date.now() } }, { upsert: true });
      return { actions: [{ type: 'target_set', data: { jobId, jobTitle } }] };
    } catch (e) {
      console.error('[LangGraph] setTargetJob failed:', e.message);
      return { actions: [] };
    }
  }

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

  /** 节点: 生成视频 */
  private async generateVideoNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
    const skillName = state.intent?.filters?.skillName;
    const difficulty = state.intent?.filters?.difficulty || 'beginner';
    if (!skillName) return { actions: [] };
    const taskId = `langgraph_video_${Date.now()}`;
    try {
      ActionExecutorService.videoTasks.set(taskId, { status: 'pending', progress: 0, message: '正在准备生成视频...', startTime: Date.now() });
      this.videoAgent.generate(
        { task_id: taskId, skill_name: skillName, knowledge_content: `# ${skillName}\n\n用户通过聊天请求生成教学视频。`, difficulty: difficulty as any },
        (stage: string, progress: number, message: string) => {
          const task = ActionExecutorService.videoTasks.get(taskId);
          if (task) { task.status = stage as any; task.progress = Math.min(progress, 99); task.message = message; }
        },
      ).then((result) => {
        const task = ActionExecutorService.videoTasks.get(taskId);
        if (!task) return;
        if (result.status === 'completed' && result.result) { task.status = 'completed'; task.progress = 100; task.message = '视频生成完成'; task.result = result.result; }
        else { task.status = 'failed'; task.error = result.error || '视频生成失败'; }
      }).catch((e: any) => { const task = ActionExecutorService.videoTasks.get(taskId); if (task) { task.status = 'failed'; task.error = e.message; } });
      setTimeout(() => ActionExecutorService.videoTasks.delete(taskId), 600000);
      return { videoResult: { taskId, skillName, difficulty }, actions: [{ type: 'video_pending', data: { taskId, skillName, difficulty, message: `正在为你生成「${skillName}」的教学视频，预计需要 2-4 分钟...` } }] };
    } catch (e) {
      console.error('[LangGraph] generateVideo failed:', e.message);
      return { videoResult: null, actions: [] };
    }
  }

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

  /** 节点: 推荐资源 */
  private async recommendResourcesNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
    const skills: string[] = state.intent?.filters?.skills || [];
    const RESOURCE_DB: Record<string, Array<{ title: string; url: string; type: string }>> = {
      javascript: [{ title: 'MDN JavaScript 指南', url: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript', type: '文档' }, { title: 'JavaScript.info', url: 'https://javascript.info/', type: '教程' }],
      react: [{ title: 'React 官方文档', url: 'https://react.dev/', type: '文档' }, { title: 'React 中文文档', url: 'https://react.dev/learn', type: '教程' }],
      python: [{ title: 'Python 官方教程', url: 'https://docs.python.org/zh-cn/3/tutorial/', type: '文档' }, { title: '廖雪峰 Python 教程', url: 'https://liaoxuefeng.com/books/python/introduction/', type: '教程' }],
    };
    const resources: any[] = [];
    for (const skill of skills) {
      const key = skill.toLowerCase().replace(/\s/g, '');
      if (RESOURCE_DB[key]) resources.push(...RESOURCE_DB[key]);
    }
    return { resourcesResult: resources, actions: [{ type: 'resources', data: resources }] };
  }

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

  /** 节点: 生成考试 */
  private async generateExamNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
    const skillName = state.intent?.filters?.skillName || 'JavaScript';
    const count = state.intent?.filters?.question_count || 5;
    const qType = state.intent?.filters?.question_type || 'mixed';
    const typeDesc = qType === 'mixed' ? '选择题和编程题混合' : qType === 'choice' ? '选择题' : '编程题';
    const prompt = `请为技能「${skillName}」生成 ${count} 道练习题。\n题型要求：${typeDesc}\n\n输出严格JSON格式：\n{\n  "skill": "${skillName}",\n  "questions": [\n    {"type": "choice", "question": "题目描述", "options": ["A", "B", "C", "D"], "answer": 0, "explanation": "解析"}\n  ]\n}\n只输出JSON，不要其他文字。`;
    try {
      const result = await this.llmService.chatCompletion([
        { role: 'system', content: '你是出题专家，根据技能名称生成高质量练习题。' },
        { role: 'user', content: prompt },
      ], { temperature: 0.5, tier: 'pro' });
      const examData = extractJson(result);
      try {
        const exam = await this.examRepo.save({ userId: state.userId, examType: 1, skillName, answers: examData, passed: 0, retryCount: 0, createTime: Date.now(), updateTime: Date.now(), status: 1 });
        examData.exam_id = exam.id;
      } catch (e) { console.warn('[LangGraph] Save exam failed:', e.message); }
      return { examResult: examData, actions: [{ type: 'exam', data: examData }] };
    } catch (e) {
      console.error('[LangGraph] generateExam failed:', e.message);
      return { examResult: null, actions: [] };
    }
  }

  /** 节点: 查看学习进度 */
  private async showProgressNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
    try {
      const paths = await this.pathRepo.find({ where: { userId: state.userId, status: 1 }, order: { createTime: 'DESC' }, take: 1 });
      if (!paths.length) {
        return { progressResult: { message: '暂无学习路径' }, actions: [{ type: 'progress', data: { message: '暂无学习路径' } }] };
      }
      const path = paths[0];
      const pathData = path.pathData || {};
      const phases = pathData.phases || [];
      let totalSkills = 0, doneSkills = 0;
      const phaseProgress = phases.map((phase: any, i: number) => {
        const skills = phase.skills || [];
        const phaseDone = skills.filter((s: any) => s.status === 'done').length;
        totalSkills += skills.length;
        doneSkills += phaseDone;
        return { name: phase.name || `阶段${i + 1}`, total: skills.length, done: phaseDone, status: i < (path.currentPhase || 0) ? 'done' : i === (path.currentPhase || 0) ? 'current' : 'locked' };
      });
      const result = { total_skills: totalSkills, done_skills: doneSkills, currentPhase: path.currentPhase || 0, matchScore: Number(path.matchScore || 0), estimatedDate: path.estimatedDate || '', phases: phaseProgress };
      return { progressResult: result, actions: [{ type: 'progress', data: result }] };
    } catch (e) {
      console.error('[LangGraph] showProgress failed:', e.message);
      return { progressResult: null, actions: [] };
    }
  }

  /** 节点: 查看今日任务 */
  private async showTodayTasksNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
    try {
      const paths = await this.pathRepo.find({ where: { userId: state.userId, status: 1 }, order: { createTime: 'DESC' }, take: 1 });
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
            tasks.push({ title: skill.name || '', phase: phase.name || '', duration: skill.duration || '30min', status: skill.status || 'pending' });
          }
        }
      }
      const result = { phase_name: currentPhase < phases.length ? phases[currentPhase].name || '' : '', tasks: tasks.slice(0, 6), total: tasks.length };
      return { dailyTasksResult: result, actions: [{ type: 'today_tasks', data: result }] };
    } catch (e) {
      console.error('[LangGraph] showTodayTasks failed:', e.message);
      return { dailyTasksResult: null, actions: [] };
    }
  }

  // ── 复合意图节点 & Orchestrator 兜底 ──────────────────────────────────

  /** 节点: 分析技能差距 */
  private async analyzeSkillGapNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
    try {
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
      const matched = requiredSkills.filter((s: any) => userSkillNames.includes((s.name || s).toLowerCase()));
      const gap = requiredSkills.filter((s: any) => !userSkillNames.includes((s.name || s).toLowerCase()));
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

  /** 节点: 面试准备（复合意图 - 并行执行） */
  private async prepareInterviewNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
    const [jobsResult, gapResult, examResult] = await Promise.allSettled([
      this.recommendJobsNode(state),
      this.analyzeSkillGapNode(state),
      this.generateExamNode(state),
    ]);
    const actions: any[] = [];
    if (jobsResult.status === 'fulfilled') actions.push(...(jobsResult.value.actions || []));
    if (gapResult.status === 'fulfilled') actions.push(...(gapResult.value.actions || []));
    if (examResult.status === 'fulfilled') actions.push(...(examResult.value.actions || []));
    return { actions };
  }

  /** 节点: 开始学习（复合意图 - 串行执行） */
  private async startLearningNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
    const pathResult = await this.generatePathNode(state);
    const tasksResult = await this.showTodayTasksNode(state);
    return {
      pathResult: pathResult.pathResult,
      dailyTasksResult: tasksResult.dailyTasksResult,
      actions: [...(pathResult.actions || []), ...(tasksResult.actions || [])],
    };
  }

  /** 节点: 检查匹配度（复合意图） */
  private async checkMatchNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
    const jobsResult = await this.recommendJobsNode(state);
    const gapResult = await this.analyzeSkillGapNode(state);
    return {
      jobResults: jobsResult.jobResults,
      skillGapResult: gapResult.skillGapResult,
      actions: [...(jobsResult.actions || []), ...(gapResult.actions || [])],
    };
  }

  /** 节点: Orchestrator 兜底 */
  private async orchestratorFallbackNode(state: ChatStateType): Promise<Partial<ChatStateType>> {
    const system = `你是智途 AI 助教的中控智能体。根据用户消息，判断应该调用哪个子智能体。\n\n可用的子智能体：\n- generate_lecture: 生成讲义\n- generate_reading: 拓展阅读\n- generate_code: 代码案例\n- generate_path: 学习路径\n- assess_learning: 学习评估\n- parse_jd: 解析岗位 JD\n- review_content: 审查内容质量\n- generate_resume: 生成简历\n- analyze_profile: 分析用户画像\n- generate_exam: 生成考试\n- analyze_skill_gap: 分析技能差距\n- get_daily_tasks: 获取每日任务\n- get_news: 获取资讯\n\n用户消息：${state.message}\n\n输出JSON格式：\n{\n  "intent": "意图名称",\n  "confidence": 0.9,\n  "entities": {"skillName": "技能名"}\n}\n\n只输出JSON，不要其他文字。`;
    try {
      const result = await this.llmService.chatCompletion([
        { role: 'system', content: system },
        { role: 'user', content: state.message },
      ], { temperature: 0.1, maxTokens: 256 });
      let parsed: any;
      try {
        parsed = extractJson(result);
      } catch {
        // LLM 输出不是标准 JSON，尝试正则提取 intent
        const intentMatch = result.match(/"intent"\s*:\s*"([^"]+)"/);
        if (intentMatch) {
          parsed = { intent: intentMatch[1] };
        } else {
          console.warn('[LangGraph] orchestratorFallback: 无法解析 intent，走 chatFallback');
          return await this.chatFallbackNode(state);
        }
      }
      const intent = parsed.intent;
      const intentNodeMap: Record<string, () => Promise<Partial<ChatStateType>>> = {
        generate_path: () => this.generatePathNode(state),
        generate_exam: () => this.generateExamNode(state),
        analyze_skill_gap: () => this.analyzeSkillGapNode(state),
        get_daily_tasks: () => this.showTodayTasksNode(state),
        recommend_jobs: () => this.recommendJobsNode(state),
        set_target_job: () => this.setTargetJobNode(state),
        generate_animation: () => this.generateAnimationNode(state),
        generate_diagram: () => this.generateDiagramNode(state),
        generate_video: () => this.generateVideoNode(state),
        generate_avatar: () => this.generateAvatarNode(state),
        show_progress: () => this.showProgressNode(state),
        recommend_resources: () => this.recommendResourcesNode(state),
        prepare_interview: () => this.prepareInterviewNode(state),
        start_learning: () => this.startLearningNode(state),
        check_match: () => this.checkMatchNode(state),
      };
      const nodeFn = intentNodeMap[intent];
      if (nodeFn) return await nodeFn();
      return await this.chatFallbackNode(state);
    } catch (e) {
      console.error('[LangGraph] orchestratorFallback failed:', e.message);
      return await this.chatFallbackNode(state);
    }
  }

  // ── 条件路由 ──────────────────────────────────

  /** 意图路由后的分支 */
  private routeAfterIntent(state: ChatStateType): string {
    if (!state.intent) return 'orchestratorFallback';
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
      prepare_interview: 'prepareInterview',
      start_learning: 'startLearning',
      check_match: 'checkMatch',
    };
    return intentMap[state.intent.name] || 'orchestratorFallback';
  }

  /** 动作执行后的分支 */
  private routeAfterAction(state: ChatStateType): string {
    if (state.actions.length > 0) {
      return 'aiSummarize';
    }
    if (!state.reply) {
      return 'chatFallback';
    }
    return 'end';
  }

  // ── 动作执行（复用 ActionExecutor） ──────────────────────────────────

  private async executeIntent(
    intent: { name: string; filters: Record<string, any> },
    userId: number,
  ): Promise<{ actions: any[]; reply: string }> {
    const { name, filters } = intent;

    // 统一命名：支持 skill_name 和 skillName 两种格式
    const skillName = filters.skillName || filters.skill_name || '';
    const diagramType = filters.diagramType || filters.diagram_type || 'flowchart';

    const actionMap: Record<string, any> = {
      generate_path: { type: 'generate_path', targetJobId: filters.targetJobId || 0 },
      recommend_jobs: { type: 'recommend_jobs', filters },
      set_target_job: { type: 'set_target_job', jobId: filters.jobId || 0 },
      generate_exam: { type: 'generate_exam', skillName, question_count: 5, question_type: 'mixed' },
      show_progress: { type: 'show_progress' },
      show_today_tasks: { type: 'show_today_tasks' },
      recommend_resources: { type: 'recommend_resources', skills: filters.skills || [] },
      match_analysis: { type: 'recommend_jobs', filters },
      generate_animation: { type: 'generate_animation', skillName },
      generate_diagram: { type: 'generate_diagram', skillName, diagramType },
      generate_video: { type: 'generate_video', skillName, difficulty: filters.difficulty || 'beginner' },
      generate_avatar: { type: 'generate_avatar', skillName },
    };

    const action = actionMap[name];
    if (!action) return { actions: [], reply: '' };

    // 多模态意图需要技能名
    const multimodalIntents = ['generate_animation', 'generate_diagram', 'generate_video', 'generate_avatar'];
    if (multimodalIntents.includes(name) && !action.skillName) {
      // 返回提示，让用户指定主题
      const prompts: Record<string, string> = {
        generate_animation: '你想看哪个技术概念的动画演示？比如「快速排序」「事件循环」「React 渲染」',
        generate_diagram: '你想画什么内容的图表？比如「系统架构」「流程图」「思维导图」',
        generate_video: '你想生成哪个主题的教学视频？比如「Python 入门」「React Hooks」「Docker 基础」',
        generate_avatar: '你想让数字人讲解哪个技术概念？',
      };
      return { actions: [], reply: prompts[name] || '请告诉我你想做什么' };
    }

    // 对于需要 job_id 但没提供的
    if (name === 'set_target_job' && !filters.jobId) {
      return { actions: [], reply: '' };
    }

    // 对于 generate_path，如果没有 targetJobId，从用户画像取
    if (name === 'generate_path' && !filters.targetJobId) {
      const student = await this.studentRepo.findOne({ where: { userId, status: 1 } });
      if (student?.targetJobId) {
        action.targetJobId = student.targetJobId;
      } else {
        return { actions: [], reply: '' };
      }
    }

    try {
      const results = await this.actionExecutor.executeActions([action], userId);
      return { actions: results, reply: '' };
    } catch (e) {
      console.error('[LangGraph] Action execution failed:', e.message);
      return { actions: [], reply: '' };
    }
  }
}

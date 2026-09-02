import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../database/redis.module';
import { JobPosition } from '../../entities/job.entity';
import { Student } from '../../entities/student.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { ExamRecord } from '../../entities/exam.entity';
import { LlmService } from '../../services/llm.service';
import { MatchAgentService } from '../../services/match-agent.service';
import { PlannerAgentService } from '../../services/planner-agent.service';
import { MultimodalService } from '../../services/multimodal.service';
import { VideoAgentService } from '../../services/agents/video-agent.service';
import { AgentOfficeBridgeService } from '../../services/agent-office-bridge.service';
import { QuestionGenerationService } from '../question-generation/question-generation.service';
import { normalizeGenerationConfig } from '../question-generation/question-generation.contracts';
import { GEOGEBRA_FIGURE_GUIDE } from '../question-generation/question-generation.prompts';
import { RemediationService } from '../remediation/remediation.service';
import { extractJson } from '../../common/json-repair';
import { LearningDomainRegistry } from '../../domains/learning-domain.registry';
import type { LearningGoalType } from '../../domains/learning-domain.types';

/**
 * 动作执行系统 — 对齐 Python agents/actions.py
 *
 * 解析 AI 回复中的 ```action ... ``` 块并执行
 * 7 个动作：recommend_jobs, set_target_job, generate_path,
 *          recommend_resources, generate_exam, show_progress, show_today_tasks
 */

// ── 静态资源库 ──────────────────────────────────

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
  typescript: [
    { title: 'TypeScript 官方手册', url: 'https://www.typescriptlang.org/docs/', type: '文档' },
    { title: 'TypeScript 入门教程', url: 'https://ts.xcatliu.com/', type: '教程' },
  ],
  vue: [
    { title: 'Vue 3 官方文档', url: 'https://vuejs.org/guide/', type: '文档' },
    { title: 'Vue 中文文档', url: 'https://cn.vuejs.org/guide/', type: '教程' },
  ],
  'node.js': [
    { title: 'Node.js 官方文档', url: 'https://nodejs.org/docs/', type: '文档' },
  ],
  docker: [
    { title: 'Docker 官方教程', url: 'https://docs.docker.com/get-started/', type: '教程' },
  ],
  git: [
    { title: 'Git 官方教程', url: 'https://git-scm.com/book/zh/v2', type: '教程' },
  ],
};

/** 视频生成任务进度 */
interface ActionExecutionContext {
  source?: string;
  chatSessionId?: string;
  userMessage?: string;
  recentMessages?: Array<{ role: string; content: string }>;
  pageContext?: string;
  userContext?: string;
}

interface VideoTaskProgress {
  status: 'pending' | 'script' | 'tts' | 'render' | 'compose' | 'completed' | 'failed';
  progress: number;   // 0-100
  message: string;
  result?: any;
  error?: string;
  startTime: number;
}

@Injectable()
export class ActionExecutorService {
  /** 内存中的视频任务进度表（Redis 做持久化兜底） */
  static videoTasks = new Map<string, VideoTaskProgress>();
  private static readonly VIDEO_TASK_TTL = 600;
  private static readonly VIDEO_TASK_PREFIX = 'video_task:';

  /** 获取视频任务进度（供 controller 调用，内存优先 → Redis 兜底） */
  static async getVideoTaskStatic(redis: Redis, taskId: string): Promise<VideoTaskProgress | undefined> {
    const mem = ActionExecutorService.videoTasks.get(taskId);
    if (mem) return mem;
    try {
      const raw = await redis.get(ActionExecutorService.VIDEO_TASK_PREFIX + taskId);
      return raw ? JSON.parse(raw) : undefined;
    } catch { return undefined; }
  }

  /** 保存视频任务到内存 + Redis */
  private async saveVideoTask(taskId: string, task: VideoTaskProgress) {
    ActionExecutorService.videoTasks.set(taskId, task);
    try {
      await this.redis.setex(
        ActionExecutorService.VIDEO_TASK_PREFIX + taskId,
        ActionExecutorService.VIDEO_TASK_TTL,
        JSON.stringify(task),
      );
    } catch (e: any) {
      console.warn('[ActionExecutor] Redis saveVideoTask failed:', e.message);
    }
  }

  /** 同步内存任务状态到 Redis（进度回调时调用） */
  private async syncVideoTask(taskId: string) {
    const task = ActionExecutorService.videoTasks.get(taskId);
    if (!task) return;
    try {
      await this.redis.setex(
        ActionExecutorService.VIDEO_TASK_PREFIX + taskId,
        ActionExecutorService.VIDEO_TASK_TTL,
        JSON.stringify(task),
      );
    } catch {}
  }
  constructor(
    @InjectRepository(JobPosition) private jobRepo: Repository<JobPosition>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(LearningPlan) private pathRepo: Repository<LearningPlan>,
    @InjectRepository(ExamRecord) private examRepo: Repository<ExamRecord>,
    @Inject(REDIS_CLIENT) private redis: Redis,
    @InjectConnection() private mongoConnection: Connection,
    private config: ConfigService,
    private llmService: LlmService,
    private matchAgent: MatchAgentService,
    private plannerAgent: PlannerAgentService,
    private multimodal: MultimodalService,
    private videoAgent: VideoAgentService,
    private officeBridge: AgentOfficeBridgeService,
    private domainRegistry: LearningDomainRegistry,
    private questionGeneration: QuestionGenerationService,
    private remediation: RemediationService,
  ) {}

  /** 从 AI 回复中提取所有 ```action ... ``` 块 — 对齐 Python extract_actions() */
  extractActions(reply: string): any[] {
    const pattern = /```action\s*\n([\s\S]*?)\n```/g;
    const actions: any[] = [];
    let match;
    while ((match = pattern.exec(reply)) !== null) {
      try {
        actions.push(JSON.parse(match[1].trim()));
      } catch (e) {
        console.warn('[ActionExecutor] JSON parse failed:', e.message, 'raw:', match[1].substring(0, 200));
      }
    }
    return actions;
  }

  /** 移除回复中的 action 代码块 — 对齐 Python clean_reply() */
  cleanReply(reply: string): string {
    return reply.replace(/```action\s*\n[\s\S]*?\n```/g, '').trim();
  }

  /** 执行所有动作 — 对齐 Python execute_actions() */
  async executeActions(actions: any[], userId: number, context: ActionExecutionContext = {}): Promise<any[]> {
    const results: any[] = [];
    for (const rawAction of actions) {
      try {
        const action = this.withExecutionContext(rawAction, context);
        const result = await this.executeSingle(action, userId);
        if (result) results.push(result);
      } catch (e) {
        console.error('[ActionExecutor] Execution failed:', e.message, 'action:', rawAction);
      }
    }
    return results;
  }

  private withExecutionContext(action: any, context: ActionExecutionContext): any {
    if (!context.source && !context.chatSessionId && !context.userMessage && !context.recentMessages && !context.pageContext && !context.userContext) return action;
    return {
      ...action,
      _source: action?._source || context.source,
      _chatSessionId: action?._chatSessionId || context.chatSessionId,
      _userMessage: action?._userMessage || context.userMessage,
      _recentMessages: action?._recentMessages || context.recentMessages,
      _pageContext: action?._pageContext || context.pageContext,
      _userContext: action?._userContext || context.userContext,
    };
  }

  private compactContextText(value: any, maxLen = 1200): string {
    if (value === undefined || value === null) return '';
    const text = String(value).replace(/\s+/g, ' ').trim();
    return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
  }

  private buildRecentChatContext(messages: any[], maxMessages = 8): string {
    if (!Array.isArray(messages) || messages.length === 0) return '';
    return messages
      .slice(-maxMessages)
      .map((message) => {
        const role = message?.role === 'assistant' ? 'assistant' : message?.role === 'system' ? 'system' : 'user';
        const content = this.compactContextText(message?.content, 700);
        return content ? `${role}: ${content}` : '';
      })
      .filter(Boolean)
      .join('\n');
  }

  private buildVideoKnowledgeContent(action: any, skillName: string): string {
    const providedContent = action.knowledgeContent || action.knowledge_content || action.content || action.prompt || '';
    const userMessage = this.compactContextText(action._userMessage || action.userMessage || action.message, 1200);
    const pageContext = this.compactContextText(action._pageContext || action.pageContext, 500);
    const userContext = this.compactContextText(action._userContext || action.userContext, 1200);
    const recentChat = this.buildRecentChatContext(action._recentMessages || action.recentMessages);

    const sections = [`# ${skillName || 'Video topic'}`];
    if (userMessage) sections.push(`## Current user request\n${userMessage}`);
    if (recentChat) sections.push(`## Recent chat context\n${recentChat}`);
    if (pageContext) sections.push(`## Page context\n${pageContext}`);
    if (userContext) sections.push(`## User profile context\n${userContext}`);
    if (providedContent) sections.push(`## Reference content\n${this.compactContextText(providedContent, 2500)}`);

    if (sections.length === 1) {
      sections.push('## Generation objective\nCreate a teaching video aligned to the user request. No richer chat context was provided.');
    }

    return sections.join('\n\n').slice(0, 6000);
  }

  /** 执行单个动作 — 对齐 Python execute_single() */
  private async executeSingle(action: any, userId: number): Promise<any | null> {
    if (action.type === 'generate_video') {
      return this.generateVideo(action, userId);
    }

    return this.officeBridge.runTrackedAction(userId, action, () =>
      this.executeSingleUntracked(action, userId),
    );
  }

  /** 执行单个动作，不处理办公室任务追踪。 */
  private async executeSingleUntracked(action: any, userId: number): Promise<any | null> {
    const type = action.type;

    switch (type) {
      case 'recommend_jobs':
        return this.recommendJobs(action, userId);
      case 'set_target_job':
        return this.setTargetJob(action, userId);
      case 'generate_path':
        return this.generatePath(action, userId);
      case 'recommend_resources':
        return this.recommendResources(action, userId);
      case 'generate_exam':
        return this.generateExam(action, userId);
      case 'question_config':
        return this.questionConfig(action);
      case 'show_progress':
        return this.showProgress(userId);
      case 'show_today_tasks':
        return this.showTodayTasks(userId);
      case 'generate_animation':
        return this.multimodal.generateAnimation(action.skillName || action.skill_name);
      case 'generate_diagram':
        return this.multimodal.generateDiagram(action.skillName || action.skill_name, action.diagramType || action.diagram_type || 'flowchart');
      case 'generate_geogebra':
        return this.generateGeogebra(action);
      case 'generate_avatar':
        return this.multimodal.generateAvatar(action.skillName || action.skill_name);
      default:
        console.warn('[ActionExecutor] Unknown action type:', type);
        return null;
    }
  }

  // ── 具体动作实现 ──────────────────────────────────────

  /** 1. 推荐岗位 — 使用 MatchAgent 计算匹配度 */
  private async recommendJobs(action: any, userId: number): Promise<any> {
    const filters = action.filters || {};
    const keyword = filters.keyword || '';

    // 搜索岗位
    const qb = this.jobRepo.createQueryBuilder('j')
      .where('j.status = 1');
    if (keyword) qb.andWhere('j.title LIKE :kw', { kw: `%${keyword}%` });

    const jobs = await qb.orderBy('j.createTime', 'DESC').limit(5).getMany();

    // 使用 MatchAgent 计算匹配度
    const jobCards: any[] = [];
    for (const j of jobs) {
      try {
        const matchResult = await this.matchAgent.calculateMatch(userId, j.id);
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
        // fallback 到简单匹配
        jobCards.push({
          id: j.id,
          title: j.title || '',
          company: j.company || '',
          location: j.location || '',
          salaryRange: j.salaryRange || '面议',
          requiredSkills: j.requiredSkills || [],
          preferredSkills: j.preferredSkills || [],
          matchScore: 0,
        });
      }
    }

    jobCards.sort((a, b) => b.matchScore - a.matchScore);
    return { type: 'jobs', data: jobCards };
  }

  /** 2. 设置目标岗位 — 对齐 Python _set_target_job() */
  private async setTargetJob(action: any, userId: number): Promise<any> {
    const jobId = action.jobId || action.job_id;
    if (!jobId) return { type: 'error', message: '缺少 jobId' };

    // 更新 MySQL
    const student = await this.studentRepo.findOne({ where: { userId, status: 1 } });
    if (student) {
      student.targetJobId = jobId;
      await this.studentRepo.save(student);
    }

    const job = await this.jobRepo.findOne({ where: { id: jobId, status: 1 } });
    const jobTitle = job?.title || '';

    // 更新 MongoDB
    const collection = this.mongoConnection.db!.collection('user_profiles');
    await collection.updateOne(
      { user_id: String(userId) },
      {
        $set: {
          'goals.target_job_id': jobId,
          'goals.target_job_title': jobTitle,
          updated_at: Date.now(),
        },
        $setOnInsert: { created_at: Date.now(), version: 1 },
      },
      { upsert: true },
    );

    return { type: 'target_set', data: { jobId: jobId, jobTitle: jobTitle } };
  }

  /** 3. 生成学习路径（同步） — 对齐 Python _generate_path() */
  private async generatePath(action: any, userId: number): Promise<any> {
    const jobId = action.targetJobId || action.target_job_id;
    const customSkills: string[] | undefined = action.skills;
    const customPlanName: string | undefined = action.plan_name;
    const domainId = action.domainId || action.domain_id;
    const goalType = (action.goalType || action.goal_type) as LearningGoalType | undefined;
    const starterPathId = action.starterPathId || action.starter_path_id;
    const goalTitle = action.goalTitle || action.goal_title || customPlanName;

    try {
      const result = domainId && goalType && starterPathId
        ? await this.generateDomainPath(userId, domainId, goalType, starterPathId, goalTitle, action)
        : await this.plannerAgent.generatePath(
            userId,
            jobId || undefined,
            action.dailyHours || action.daily_hours,
            customSkills,
            customPlanName,
          );
      return {
        type: 'path_generated',
        data: {
          planId: result.plan.id,
          planName: result.plan.planName,
          totalSkills: result.gapSkills.length,
          estimatedDate: result.plan.estimatedDate,
          message: `学习路径已生成：${result.plan.planName}，共 ${result.gapSkills.length} 个能力项`,
        },
      };
    } catch (e: any) {
      console.error('[ActionExecutor] generatePath failed:', e.message);
      return { type: 'error', message: `路径生成失败：${e.message}` };
    }
  }

  private async generateDomainPath(
    userId: number,
    domainId: string,
    goalType: LearningGoalType,
    starterPathId: string,
    goalTitle: string | undefined,
    action: any,
  ) {
    const { domain, starterPath } = this.domainRegistry.resolvePath(domainId, goalType, starterPathId);
    return this.plannerAgent.generateDomainPath(
      userId,
      domain,
      starterPath,
      goalType,
      goalTitle || starterPath.title,
      Number(action.dailyHours || action.daily_hours || 2),
      action.planType === 'side' || action.plan_type === 'side' ? 'side' : 'main',
    );
  }

  /** 4. 推荐学习资源 — 对齐 Python _recommend_resources() */
  private recommendResources(action: any, userId?: number): any {
    const skills: string[] = action.skills || [];
    const resources: any[] = [];

    for (const skill of skills) {
      const key = skill.toLowerCase().replace(/\s/g, '');
      if (RESOURCE_DB[key]) {
        resources.push(...RESOURCE_DB[key]);
      }
    }

    // 异步持久化到 MongoDB knowledge_base（fire-and-forget）
    if (resources.length > 0 && userId) {
      this.persistResources(resources, skills, userId).catch((e) =>
        console.warn('[ActionExecutor] persistResources failed:', e.message),
      );
    }

    return { type: 'resources', data: resources };
  }

  /** 将推荐的资源持久化到 knowledge_base 集合 */
  private async persistResources(resources: any[], skills: string[], userId: number): Promise<void> {
    const collection = this.mongoConnection.db!.collection('knowledge_base');
    const now = Date.now();
    for (const res of resources) {
      await collection.updateOne(
        { skill: { $in: skills }, content_type: 'resource', 'content.url': res.url },
        {
          $setOnInsert: {
            skill: skills.join(','),
            content_type: 'resource',
            content: { title: res.title, url: res.url, type: res.type },
            metadata: { source: 'chat_recommend', userId },
            shared: true,
            created_at: now,
          },
          $set: { updated_at: now },
        },
        { upsert: true },
      );
    }
  }

  /** 5. 生成练习题 — 与出题器共享高质量提示词（逆向构建/难度阶梯/干扰项），并复用现有反馈链路 */
  private async generateExam(action: any, userId: number): Promise<any> {
    const skillName = action.skillName || action.skill_name || '';
    if (!skillName) {
      return { type: 'error', data: { message: '请告诉我你想练习哪个技能？比如「出5道React题」' } };
    }
    const count = Number(action.question_count ?? action.questionCount ?? 5);
    const qType = action.question_type || 'mixed';
    const questionTypes = qType === 'mixed' ? ['choice', 'coding'] : qType === 'choice' ? ['choice'] : qType === 'coding' ? ['coding'] : [qType];
    const difficulty = Number(action.difficulty ?? action.difficulty_level ?? 5);

    try {
      // 补弱模式：读取弱项知识点，作为出题考点的「由浅入深」补弱练习
      let weakTopics: Array<{ label: string }> = [];
      let instructions = String(action.instructions || '');
      if (action.remediation) {
        const weakPoints = await this.remediation.weakPoints(userId);
        weakTopics = weakPoints.map((w) => ({ label: w.label }));
        instructions = `${instructions} 这是针对薄弱点的补弱练习，请由浅入深（先基础巩固，再进阶应用，最后综合/判断），并参考题库避免与已掌握/已出题目重复。`.trim();
      }

      const examData = await this.questionGeneration.generateForChat(userId, {
        subject: skillName,
        count,
        questionTypes,
        difficulty,
        topics: weakTopics.length ? weakTopics : undefined,
        instructions,
        referenceLibrary: true,
      });

      // 写入 exam_records_v3，后续答题经 ExamsService.submitExam 回灌掌握度/画像
      try {
        const exam = await this.examRepo.save({
          userId: userId,
          examType: 1,
          skillName: skillName,
          answers: examData,
          passed: 0,
          retryCount: 0,
          createTime: Date.now(),
          updateTime: Date.now(),
          status: 1,
        });
        examData.exam_id = exam.id;
      } catch (e) {
        console.warn('[ActionExecutor] Save exam failed:', e.message);
      }

      return { type: 'exam', data: examData };
    } catch (e) {
      console.error('[ActionExecutor] Generate exam failed:', e.message);
      return { type: 'error', message: '出题失败，请稍后再试' };
    }
  }

  /** 6. 查看学习进度 — 对齐 Python _show_progress() */
  private async showProgress(userId: number): Promise<any> {
    const paths = await this.pathRepo.find({
      where: { userId: userId, status: 1 },
      order: { createTime: 'DESC' },
      take: 1,
    });

    if (!paths.length) {
      return { type: 'progress', data: { message: '暂无学习路径', paths: [] } };
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

    return {
      type: 'progress',
      data: {
        total_skills: totalSkills,
        done_skills: doneSkills,
        currentPhase: path.currentPhase || 0,
        matchScore: Number(path.matchScore || 0),
        estimatedDate: path.estimatedDate || '',
        phases: phaseProgress,
      },
    };
  }

  /** 7. 查看今日任务 — 对齐 Python _show_today_tasks() */
  private async showTodayTasks(userId: number): Promise<any> {
    const paths = await this.pathRepo.find({
      where: { userId: userId, status: 1 },
      order: { createTime: 'DESC' },
      take: 1,
    });

    if (!paths.length) {
      return { type: 'today_tasks', data: { message: '暂无学习路径，请先选择目标岗位', tasks: [] } };
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

    return {
      type: 'today_tasks',
      data: {
        phase_name: currentPhase < phases.length ? phases[currentPhase].name || '' : '',
        tasks: tasks.slice(0, 6),
        total: tasks.length,
      },
    };
  }

  /** 生成教学视频 — 异步执行，立即返回 taskId */
  private async generateVideo(action: any, userId?: number): Promise<any> {
    // 素材展示模式：提供了素材文件夹时，走 vibing 素材展示管线
    const assets = action.assets || action.materialFolder || action.material_folder || '';
    if (assets) {
      return this.generateShowcaseVideo(action, userId);
    }

    const skillName = action.skillName || action.skill_name || '';
    const difficulty = action.difficulty || 'beginner';
    const taskId = `chat_video_${Date.now()}`;
    const knowledgeContent = this.buildVideoKnowledgeContent(action, skillName);
    const contextSummary = this.compactContextText(action._userMessage || action.userMessage || action.message || skillName, 160);
    const officeTask = userId
      ? await this.officeBridge.startActionTask(
        userId,
        { ...action, type: 'generate_video', skillName, contextSummary },
        {
          externalId: taskId,
          title: skillName ? `生成教学视频: ${skillName}` : '生成教学视频',
          description: '来自对话触发的视频生成任务',
        },
      )
      : null;

    // 注册任务（内存 + Redis），立即返回
    await this.saveVideoTask(taskId, {
      status: 'pending',
      progress: 0,
      message: '正在准备生成视频...',
      startTime: Date.now(),
    });

    // 异步执行，不阻塞 HTTP 响应
    this.videoAgent.generate(
      {
        task_id: taskId,
        skill_name: skillName,
        knowledge_content: knowledgeContent,
        difficulty: difficulty as any,
      },
      // 进度回调：更新内存 + 同步 Redis
      async (stage: string, progress: number, message: string) => {
        const task = ActionExecutorService.videoTasks.get(taskId);
        if (task) {
          task.status = stage as any;
          task.progress = Math.min(progress, 99);
          task.message = message;
          await this.syncVideoTask(taskId);
        }
        if (userId && officeTask) {
          await this.officeBridge.reportProgress(
            userId,
            officeTask.id,
            officeTask.agentType,
            Math.min(progress, 99),
            message,
          ).catch(() => {});
        }
      },
    ).then(async (result) => {
      const task = ActionExecutorService.videoTasks.get(taskId);
      if (!task) return;

      if (result.status === 'completed' && result.result) {
        task.status = 'completed';
        task.progress = 100;
        task.message = '视频生成完成';
        task.result = {
          video_file_path: result.result.video_file_path,
          audio_file_path: result.result.audio_file_path,
          duration_sec: result.result.duration_sec,
          segments_count: result.result.segments_count,
          tts_status: result.result.tts_status,
          skill_name: skillName,
          context_summary: contextSummary,
        };
        if (userId && officeTask) {
          await this.officeBridge.completeTask(userId, officeTask.id, officeTask.agentType, task.result)
            .catch(() => {});
        }
      } else {
        task.status = 'failed';
        task.error = result.error || '视频生成失败';
        task.message = result.error || '视频生成失败';
        if (userId && officeTask) {
          await this.officeBridge.failTask(userId, officeTask.id, officeTask.agentType, task.error)
            .catch(() => {});
        }
      }
      await this.syncVideoTask(taskId);
    }).catch(async (e: any) => {
      const task = ActionExecutorService.videoTasks.get(taskId);
      if (task) {
        task.status = 'failed';
        task.error = e.message;
        task.message = `视频生成失败：${e.message}`;
        await this.syncVideoTask(taskId);
      }
      if (userId && officeTask) {
        await this.officeBridge.failTask(userId, officeTask.id, officeTask.agentType, e.message)
          .catch(() => {});
      }
    });

    // 30 分钟后自动清理（视频生成含 TTS + 渲染，可能需要 15+ 分钟）
    setTimeout(() => ActionExecutorService.videoTasks.delete(taskId), 1800000);

    return {
      type: 'video_pending',
      data: {
        taskId,
        skillName,
        difficulty,
        contextSummary,
        message: `正在为你生成「${skillName}」的教学视频，预计需要 2-4 分钟...`,
      },
    };
  }

  /** 生成素材展示视频 — 异步执行 vibing 管线，立即返回 taskId */
  private async generateShowcaseVideo(action: any, userId: number | undefined): Promise<any> {
    const assets = (action.assets || action.materialFolder || action.material_folder || '').toString();
    const projectName = action.projectName || action.project_name || action.skillName || action.skill_name || 'ZhiPath 项目视频';
    const prompt = action.prompt || action._userMessage || action.userMessage || action.message || projectName;
    const taskId = `chat_showcase_${Date.now()}`;
    const contextSummary = this.compactContextText(prompt, 160);

    const officeTask = userId
      ? await this.officeBridge.startActionTask(
        userId,
        { ...action, type: 'generate_video', showcase: true, contextSummary },
        { externalId: taskId, title: `生成素材视频: ${projectName}`, description: '来自对话触发的素材展示视频任务' },
      )
      : null;

    await this.saveVideoTask(taskId, { status: 'script', progress: 0, message: '正在准备生成素材视频...', startTime: Date.now() });

    const rendererDir = path.resolve(process.cwd(), this.config.get('VIDEO_RENDERER_DIR', '../video-renderer'));
    const outputDir = this.config.get('VIDEO_OUTPUT_DIR', '/tmp/zhipath/video');
    const scheduleCleanup = () => setTimeout(() => ActionExecutorService.videoTasks.delete(taskId), 1800000);

    const fail = async (message: string, error?: string) => {
      const task = ActionExecutorService.videoTasks.get(taskId);
      if (task) {
        task.status = 'failed';
        task.error = error || message;
        task.message = message;
        await this.syncVideoTask(taskId);
      }
      if (userId && officeTask) {
        await this.officeBridge.failTask(userId, officeTask.id, officeTask.agentType, error || message).catch(() => {});
      }
      scheduleCleanup();
    };

    if (!fs.existsSync(rendererDir)) {
      await fail(`video-renderer 目录不存在: ${rendererDir}`, 'video-renderer missing');
      return { type: 'video_pending', data: { taskId, message: `素材视频生成失败：渲染器未安装（${rendererDir}）` } };
    }

    try { fs.mkdirSync(outputDir, { recursive: true }); } catch {}

    const outputPath = path.join(outputDir, `${taskId}.mp4`);

    const args: string[] = [
      'tsx', 'src/vibing.ts',
      '--prompt', prompt,
      '--duration', String(action.targetDurationSec || action.duration || 300),
      '--output', outputPath,
      '--project-name', projectName,
      '--visual-style', action.visualStyle || action.visual_style || 'auto',
      '--voice', action.voice || 'zh-CN-YunyangNeural',
      '--rate', action.rate || '+0%',
      '--llm-provider', action.llmProvider || action.llm_provider || 'auto',
      '--job-id', taskId,
    ];
    if (assets) args.push('--assets', path.resolve(assets));
    if (action.llmInputPrice != null) args.push('--llm-input-price', String(action.llmInputPrice));
    if (action.llmOutputPrice != null) args.push('--llm-output-price', String(action.llmOutputPrice));
    if (action.motionStyle || action.motion_style) args.push('--motion-style', action.motionStyle || action.motion_style);
    if (action.llmModel) args.push('--llm-model', String(action.llmModel));

    const env: NodeJS.ProcessEnv = { ...process.env };
    const deepseekKey = this.config.get('DEEPSEEK_API_KEY', '');
    if (deepseekKey) {
      env.DEEPSEEK_API_KEY = deepseekKey;
      env.DEEPSEEK_BASE_URL = this.config.get('DEEPSEEK_BASE_URL', 'https://api.deepseek.com');
      env.DEEPSEEK_MODEL = this.config.get('DEEPSEEK_FLASH_MODEL', 'deepseek-chat') || 'deepseek-chat';
    }

    const apply = async (patch: Partial<VideoTaskProgress>) => {
      const task = ActionExecutorService.videoTasks.get(taskId);
      if (!task) return;
      Object.assign(task, patch);
      await this.syncVideoTask(taskId);
      if (userId && officeTask) {
        await this.officeBridge.reportProgress(userId, officeTask.id, officeTask.agentType, Math.min(task.progress, 99), task.message).catch(() => {});
      }
    };

    const meta = { sceneCount: 0, durationSec: 0, outputPath: '' };
    const handle = (chunk: Buffer | string) => {
      for (const line of chunk.toString().split(/\r?\n/)) {
        this.applyShowcaseLine(line, apply, meta);
      }
    };

    let child: ChildProcess;
    try {
      child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { cwd: rendererDir, env, windowsHide: true });
    } catch (e: any) {
      await fail(`素材视频启动失败: ${e.message}`, e.message);
      return { type: 'video_pending', data: { taskId, message: `素材视频启动失败: ${e.message}` } };
    }

    child.stdout?.on('data', handle);
    child.stderr?.on('data', handle);
    child.on('error', (e: any) => { void fail(`素材视频进程错误: ${e.message}`, e.message); });
    child.on('close', async (code) => {
      const task = ActionExecutorService.videoTasks.get(taskId);
      if (!task) { scheduleCleanup(); return; }
      if (code === 0) {
        task.status = 'completed';
        task.progress = 100;
        task.message = '素材视频生成完成';
        task.result = {
          video_file_path: meta.outputPath || outputPath,
          audio_file_path: '',
          duration_sec: meta.durationSec,
          segments_count: meta.sceneCount,
          skill_name: projectName,
          context_summary: contextSummary,
          showcase: true,
        };
        if (userId && officeTask) {
          await this.officeBridge.completeTask(userId, officeTask.id, officeTask.agentType, task.result).catch(() => {});
        }
      } else {
        task.status = 'failed';
        task.error = `素材视频渲染失败: ${code}`;
        task.message = `素材视频渲染失败 (exit ${code})`;
        if (userId && officeTask) {
          await this.officeBridge.failTask(userId, officeTask.id, officeTask.agentType, task.error).catch(() => {});
        }
      }
      await this.syncVideoTask(taskId);
      scheduleCleanup();
    });

    await apply({ status: 'script', progress: 2, message: '素材视频任务已启动...' });

    return {
      type: 'video_pending',
      data: {
        taskId,
        projectName,
        assets,
        showcase: true,
        contextSummary,
        message: `正在为你生成「${projectName}」的素材展示视频（${action.targetDurationSec || action.duration || 300} 秒），预计需要 3-6 分钟...`,
      },
    };
  }

  /** 解析 vibing 子进程输出行，更新任务进度 / 阶段 / 成本 / 元信息 */
  private async applyShowcaseLine(
    line: string,
    apply: (patch: Partial<VideoTaskProgress>) => Promise<void>,
    meta: { sceneCount: number; durationSec: number; outputPath: string },
  ) {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('[heartbeat]')) {
      try {
        const packet = JSON.parse(trimmed.slice('[heartbeat]'.length).trim());
        const stage = String(packet.stage || '');
        let status: VideoTaskProgress['status'];
        if (stage === 'tts') status = 'tts';
        else if (stage === 'render') status = 'render';
        else if (stage === 'completed') status = 'compose';
        else status = 'script';
        const patch: Partial<VideoTaskProgress> = { status, message: this.showcaseStageMessage(stage) };
        if (typeof packet.progress === 'number') patch.progress = Math.max(0, Math.min(99, packet.progress));
        await apply(patch);
      } catch { /* 忽略畸形心跳 */ }
      return;
    }

    if (trimmed.startsWith('[cost]')) {
      try {
        const cost = JSON.parse(trimmed.slice('[cost]'.length).trim());
        await apply({ message: `LLM 成本估算：$${Number(cost.estimatedTotalCost || 0).toFixed(4)}（${cost.inputTokens ?? 0}/${cost.outputTokens ?? 0} tokens）` });
      } catch { /* 忽略 */ }
      return;
    }

    if (trimmed.startsWith('[scenes]')) {
      const n = parseInt(trimmed.slice('[scenes]'.length).trim(), 10);
      if (!isNaN(n)) meta.sceneCount = n;
      return;
    }
    if (trimmed.startsWith('[duration]')) {
      const m = parseFloat(trimmed.slice('[duration]'.length).trim());
      if (!isNaN(m)) meta.durationSec = Math.round(m * 60);
      return;
    }
    if (trimmed.startsWith('[done]')) {
      meta.outputPath = trimmed.slice('[done]'.length).trim();
      return;
    }
  }

  private showcaseStageMessage(stage: string): string {
    switch (stage) {
      case 'assets': return '正在扫描素材文件夹...';
      case 'storyboard': return '正在生成分镜脚本...';
      case 'tts': return '正在合成配音...';
      case 'render': return '正在渲染视频（Remotion）...';
      case 'completed': return '渲染完成，正在收尾...';
      default: return '素材视频生成中...';
    }
  }

  /** 解析用户出题需求为配置（不生成），供前端把配置注入出题器。 */
  private questionConfig(action: any): any {
    const config = normalizeGenerationConfig({
      subject: action.subject || action.skillName || action.skill_name || '',
      count: action.count ?? action.question_count ?? 5,
      difficulty: action.difficulty ?? action.difficulty_level ?? 5,
      questionTypes: action.questionTypes || action.question_types || ['choice'],
      topics: action.topics || [],
      instructions: action.instructions || '',
      referenceLibrary: action.referenceLibrary ?? action.reference_library ?? false,
    });
    const summary = `主题「${config.subject}」；${config.count} 题；难度 ${config.difficulty}/10${config.topics?.length ? `；考点：${config.topics.map((t: any) => t.label || t.id).join('、')}` : ''}`;
    return { type: 'question_config', data: { config, summary } };
  }

  /** 生成 GeoGebra 作图（几何/函数/数形结合）— 供聊天智能体按需出图。 */
  private async generateGeogebra(action: any): Promise<any> {
    const topic = action.skillName || action.skill_name || action.topic || action.subject || '';
    if (!topic) return { type: 'error', data: { message: '请告诉我要画什么几何/函数图' } };
    try {
      const prompt = `你是 GeoGebra 作图专家。请为「${topic}」生成可渲染的 GeoGebra 作图。\n${GEOGEBRA_FIGURE_GUIDE}\n只输出严格 JSON：{"type":"geogebra","commands":["Circle((0,0),3)","Segment(A,B)","f(x)=x^2"],"view":[-5,8,8,-5],"axes":true,"grid":false}`;
      const raw = await this.llmService.chatCompletion([
        { role: 'system', content: '你是 GeoGebra 作图专家。' },
        { role: 'user', content: prompt },
      ], { temperature: 0.3, maxTokens: 4096, tier: 'gen', thinking: 'off', jsonObject: true });
      const data = extractJson(raw);
      return { type: 'geogebra', data: { ...(typeof data === 'object' ? data : {}), subject: topic } };
    } catch (e) {
      console.error('[ActionExecutor] generateGeogebra failed:', e.message);
      return { type: 'error', data: { message: '生成 GeoGebra 图失败，请稍后再试' } };
    }
  }

  /** 直接触发视频生成（供 controller 调用，跳过 IntentRouter） */
  async generateVideoDirect(skillName: string, difficulty = 'beginner', userId?: number) {
    const result = await this.generateVideo({ skillName, difficulty }, userId);
    return result.data;
  }

  /** 直接触发视频生成 — 完整 action，支持素材展示（assets）/ 教学视频，返回完整 result（含 taskId） */
  async generateVideoFromAction(action: any, userId?: number): Promise<any> {
    return this.generateVideo(action, userId);
  }
}

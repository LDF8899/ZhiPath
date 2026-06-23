import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
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
import { extractJson } from '../../common/json-repair';

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
    private llmService: LlmService,
    private matchAgent: MatchAgentService,
    private plannerAgent: PlannerAgentService,
    private multimodal: MultimodalService,
    private videoAgent: VideoAgentService,
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
  async executeActions(actions: any[], userId: number): Promise<any[]> {
    const results: any[] = [];
    for (const action of actions) {
      try {
        const result = await this.executeSingle(action, userId);
        if (result) results.push(result);
      } catch (e) {
        console.error('[ActionExecutor] Execution failed:', e.message, 'action:', action);
      }
    }
    return results;
  }

  /** 执行单个动作 — 对齐 Python execute_single() */
  private async executeSingle(action: any, userId: number): Promise<any | null> {
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
      case 'show_progress':
        return this.showProgress(userId);
      case 'show_today_tasks':
        return this.showTodayTasks(userId);
      case 'generate_animation':
        return this.multimodal.generateAnimation(action.skillName || action.skill_name);
      case 'generate_diagram':
        return this.multimodal.generateDiagram(action.skillName || action.skill_name, action.diagramType || action.diagram_type || 'flowchart');
      case 'generate_video':
        return this.generateVideo(action);
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

    try {
      const result = await this.plannerAgent.generatePath(userId, jobId || undefined);
      return {
        type: 'path_generated',
        data: {
          planId: result.plan.id,
          planName: result.plan.planName,
          totalSkills: result.gapSkills.length,
          estimatedDate: result.plan.estimatedDate,
          message: `学习路径已生成：${result.plan.planName}，共 ${result.gapSkills.length} 个技能点`,
        },
      };
    } catch (e: any) {
      console.error('[ActionExecutor] generatePath failed:', e.message);
      return { type: 'error', message: `路径生成失败：${e.message}` };
    }
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

  /** 5. 生成练习题 — 对齐 Python _generate_exam() */
  private async generateExam(action: any, userId: number): Promise<any> {
    const skillName = action.skillName || action.skill_name || 'JavaScript';
    const count = action.question_count || 5;
    const qType = action.question_type || 'mixed';

    const typeDesc = qType === 'mixed' ? '选择题和编程题混合' : qType === 'choice' ? '选择题' : '编程题';

    const prompt = `请为技能「${skillName}」生成 ${count} 道练习题。

题型要求：${typeDesc}

输出严格JSON格式：
{
  "skill": "${skillName}",
  "questions": [
    {
      "type": "choice",
      "question": "题目描述",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "answer": 0,
      "explanation": "解析"
    },
    {
      "type": "coding",
      "question": "编程题描述",
      "template": "代码模板",
      "hint": "提示"
    }
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
  private async generateVideo(action: any): Promise<any> {
    const skillName = action.skillName || action.skill_name || '';
    const difficulty = action.difficulty || 'beginner';
    const taskId = `chat_video_${Date.now()}`;

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
        knowledge_content: `# ${skillName}\n\n用户通过聊天请求生成教学视频。`,
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
          skill_name: skillName,
        };
      } else {
        task.status = 'failed';
        task.error = result.error || '视频生成失败';
        task.message = result.error || '视频生成失败';
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
    });

    // 30 分钟后自动清理（视频生成含 TTS + 渲染，可能需要 15+ 分钟）
    setTimeout(() => ActionExecutorService.videoTasks.delete(taskId), 1800000);

    return {
      type: 'video_pending',
      data: {
        taskId,
        skillName,
        difficulty,
        message: `正在为你生成「${skillName}」的教学视频，预计需要 2-4 分钟...`,
      },
    };
  }

  /** 直接触发视频生成（供 controller 调用，跳过 IntentRouter） */
  async generateVideoDirect(skillName: string, difficulty = 'beginner') {
    const result = await this.generateVideo({ skillName, difficulty });
    return result.data;
  }
}

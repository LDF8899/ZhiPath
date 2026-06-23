import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AgentTaskService } from '../../services/agent-task.service';
import { AgentProfileService } from '../../services/agent-profile.service';
import { KnowledgeBaseService } from '../../services/knowledge-base.service';
import { EventsService } from '../events/events.service';
import {
  LectureAgentService,
  ReadingAgentService,
  CodeAgentService,
  PathAgentService,
  AssessAgentService,
  ExamAgentService,
  SkillGapAgentService,
  ResumeAgentService,
  ProfileAgentService,
  NewsAgentService,
} from '../../services/agents';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success, error } from '../../common/api-response';

/** 可招聘的 Agent 类型及其默认角色 */
const AGENT_TYPE_MAP: Record<string, { label: string; defaultRole: string }> = {
  lecture:  { label: '讲义生成', defaultRole: '讲义专家' },
  reading:  { label: '拓展阅读', defaultRole: '阅读向导' },
  code:     { label: '代码案例', defaultRole: '代码大师' },
  path:     { label: '学习路径', defaultRole: '路径规划' },
  assess:   { label: '学习评估', defaultRole: '评估官' },
  exam:     { label: '考试出题', defaultRole: '出题官' },
  skillgap: { label: '技能差距', defaultRole: '差距分析师' },
  resume:   { label: '简历生成', defaultRole: '简历顾问' },
  profile:  { label: '画像分析', defaultRole: '画像分析师' },
  news:     { label: '资讯推荐', defaultRole: '资讯编辑' },
};

@Controller('user/agent-office')
@UseGuards(AuthGuard)
export class AgentOfficeController {
  constructor(
    private readonly taskService: AgentTaskService,
    private readonly profileService: AgentProfileService,
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly eventsService: EventsService,
    private readonly lectureAgent: LectureAgentService,
    private readonly readingAgent: ReadingAgentService,
    private readonly codeAgent: CodeAgentService,
    private readonly pathAgent: PathAgentService,
    private readonly assessAgent: AssessAgentService,
    private readonly examAgent: ExamAgentService,
    private readonly skillGapAgent: SkillGapAgentService,
    private readonly resumeAgent: ResumeAgentService,
    private readonly profileAgent: ProfileAgentService,
    private readonly newsAgent: NewsAgentService,
  ) {}

  /** 获取统计信息 */
  @Get('stats')
  async getStats(@CurrentUser() user: any) {
    const stats = await this.taskService.getStats(user.sub);
    return success(stats);
  }

  /** 获取可用 Agent 类型列表 */
  @Get('agent-types')
  async getAgentTypes() {
    return success(AGENT_TYPE_MAP);
  }

  // ── Agent 员工端点 ──────────────────────────────

  /** 获取所有员工配置 */
  @Get('profiles')
  async getProfiles(@CurrentUser() user: any) {
    const profiles = await this.profileService.getProfiles(user.sub);
    return success(profiles);
  }

  /** 招聘新员工 */
  @Post('profiles')
  async hireAgent(
    @CurrentUser() user: any,
    @Body() body: { agentType: string; animalType: string; color: string; nickname: string; displayRole: string },
  ) {
    if (!body.agentType || !AGENT_TYPE_MAP[body.agentType]) {
      return error(400, `无效的 Agent 类型，可选：${Object.keys(AGENT_TYPE_MAP).join(', ')}`);
    }
    if (!body.nickname?.trim()) {
      return error(400, '昵称不能为空');
    }

    const profile = await this.profileService.hireAgent(
      user.sub,
      body.agentType,
      body.animalType || 'cat',
      body.color || '#f9d27c',
      body.nickname.trim(),
      body.displayRole || AGENT_TYPE_MAP[body.agentType].defaultRole,
    );
    return success(profile);
  }

  /** 更新员工配置 */
  @Put('profiles/:profileId')
  async updateProfile(
    @CurrentUser() user: any,
    @Param('profileId') profileId: string,
    @Body() body: { animalType?: string; color?: string; nickname?: string; displayRole?: string },
  ) {
    const profile = await this.profileService.getProfile(user.sub, parseInt(profileId, 10));
    if (!profile) return error(404, '员工不存在');

    const updated = await this.profileService.updateProfile(user.sub, profile.agentType, body);
    return success(updated);
  }

  /** 解雇员工（软删除） */
  @Delete('profiles/:profileId')
  async fireAgent(
    @CurrentUser() user: any,
    @Param('profileId') profileId: string,
  ) {
    const profile = await this.profileService.getProfile(user.sub, parseInt(profileId, 10));
    if (!profile) return error(404, '员工不存在');

    // 取消该员工的待处理任务
    const tasks = await this.taskService.getTasks(user.sub);
    for (const task of tasks) {
      if (task.agentType === profile.agentType && task.taskStatus === 'pending') {
        await this.taskService.cancelTask(task.id, user.sub).catch(() => {});
      }
    }

    // 软删除
    await this.profileService.softDelete(user.sub, profile.id);

    return success({ message: `${profile.nickname} 已离职` });
  }

  /** 分配/移除工位 */
  @Post('profiles/:profileId/station')
  async assignStation(
    @CurrentUser() user: any,
    @Param('profileId') profileId: string,
    @Body() body: { stationId: number | null },
  ) {
    const profile = await this.profileService.getProfile(user.sub, parseInt(profileId, 10));
    if (!profile) return error(404, '员工不存在');

    const updated = await this.profileService.assignStation(user.sub, profile.agentType, body.stationId);
    return success(updated);
  }

  // ── 直接使用 Agent ──────────────────────────────

  /** 直接使用某个员工执行任务 */
  @Post('profiles/:profileId/use')
  async directUse(
    @CurrentUser() user: any,
    @Param('profileId') profileId: string,
    @Body() body: { prompt: string; params?: Record<string, any> },
  ) {
    if (!body.prompt?.trim()) {
      return error(400, '请输入指令');
    }

    const profile = await this.profileService.getProfile(user.sub, parseInt(profileId, 10));
    if (!profile) return error(404, '员工不存在');
    if (profile.agentStatus === 'busy') {
      return error(409, `${profile.nickname} 正在忙碌中，请稍后再试`);
    }

    // 创建任务
    const task = await this.taskService.createTask(
      user.sub,
      profile.agentType as any,
      body.prompt.trim().slice(0, 100),
      { ...body.params, directPrompt: body.prompt.trim() },
      `${profile.nickname} 直接执行`,
    );

    // 更新状态
    await this.profileService.updateStatus(user.sub, profile.agentType as any, 'busy').catch(() => {});

    // 异步执行
    this.executeDirectTask(task.id, user.sub, profile.agentType, body.prompt.trim(), body.params || {}).catch((e) =>
      console.error('[AgentOffice] Direct task failed:', e.message),
    );

    return success(task);
  }

  // ── 任务端点 ──────────────────────────────

  /** 获取任务队列 */
  @Get('tasks')
  async getTasks(@CurrentUser() user: any, @Query('status') status?: string) {
    const tasks = await this.taskService.getTasks(user.sub, status as any);
    return success(tasks);
  }

  /** 获取任务详情 */
  @Get('tasks/:taskId')
  async getTask(@Param('taskId') taskId: string, @CurrentUser() user: any) {
    const task = await this.taskService.getTask(parseInt(taskId, 10), user.sub);
    return success(task);
  }

  /** 创建任务（派发模式） */
  @Post('tasks')
  async createTask(
    @CurrentUser() user: any,
    @Body() body: { agentType: string; title: string; params?: Record<string, any>; description?: string },
  ) {
    if (!body.agentType || !AGENT_TYPE_MAP[body.agentType]) {
      return error(400, '无效的 Agent 类型');
    }

    const task = await this.taskService.createTask(
      user.sub,
      body.agentType as any,
      body.title,
      body.params,
      body.description,
    );

    await this.profileService.updateStatus(user.sub, body.agentType as any, 'busy').catch(() => {});

    this.executeTask(task.id, user.sub, body.agentType, body.params || {}).catch((e) =>
      console.error('[AgentOffice] Task execution failed:', e.message),
    );

    return success(task);
  }

  /** 标记紧急 */
  @Post('tasks/:taskId/urgent')
  async markUrgent(@Param('taskId') taskId: string, @CurrentUser() user: any) {
    const task = await this.taskService.markUrgent(parseInt(taskId, 10), user.sub);
    return success(task);
  }

  /** 跳过任务 */
  @Post('tasks/:taskId/skip')
  async skipTask(@Param('taskId') taskId: string, @CurrentUser() user: any) {
    const task = await this.taskService.skipTask(parseInt(taskId, 10), user.sub);
    return success(task);
  }

  /** 批量重排任务顺序 */
  @Post('tasks/reorder')
  async reorderTasks(@CurrentUser() user: any, @Body() body: { taskIds: number[] }) {
    if (!Array.isArray(body.taskIds) || body.taskIds.length === 0) {
      return error(400, 'taskIds 不能为空');
    }
    await this.taskService.reorderTasks(user.sub, body.taskIds);
    return success({ message: '排序已更新' });
  }

  /** 取消任务 */
  @Post('tasks/:taskId/cancel')
  async cancelTask(@Param('taskId') taskId: string, @CurrentUser() user: any) {
    const task = await this.taskService.cancelTask(parseInt(taskId, 10), user.sub);
    return success(task);
  }

  /** 删除任务 */
  @Post('tasks/:taskId/delete')
  async deleteTask(@Param('taskId') taskId: string, @CurrentUser() user: any) {
    const result = await this.taskService.deleteTask(parseInt(taskId, 10), user.sub);
    return success({ success: result });
  }

  /** 获取最近完成的任务 */
  @Get('history')
  async getHistory(@CurrentUser() user: any, @Query('limit') limit?: string) {
    const tasks = await this.taskService.getRecentCompleted(user.sub, limit ? parseInt(limit, 10) : 10);
    return success(tasks);
  }

  // ── 内部方法 ──────────────────────────────────

  /** 执行任务（派发模式，异步） */
  private async executeTask(taskId: number, userId: number, agentType: string, params: Record<string, any>) {
    try {
      // SSE：任务开始
      this.eventsService.emitAgentStatus(userId, agentType, 'working', `开始执行任务 #${taskId}`);
      this.eventsService.emitAgentProgress(userId, agentType, String(taskId), 0, '任务排队中');

      await this.taskService.updateStatus(taskId, 'running');
      await this.taskService.updateProgress(taskId, 30);
      this.eventsService.emitAgentProgress(userId, agentType, String(taskId), 30, 'Agent 生成中...');

      const result = await this.runAgent(agentType, params);

      await this.taskService.updateProgress(taskId, 90);
      this.eventsService.emitAgentProgress(userId, agentType, String(taskId), 90, '保存结果中');

      await this.taskService.updateStatus(taskId, 'success', result);
      await this.profileService.updateStatus(userId, agentType as any, 'idle').catch(() => {});

      // SSE：任务完成
      this.eventsService.emitAgentStatus(userId, agentType, 'idle');
      this.eventsService.emitAgentProgress(userId, agentType, String(taskId), 100, '完成');

      // 如果有技能相关结果，推送资源就绪事件
      const skillName = params.skillName || result?.skill;
      if (skillName) {
        this.eventsService.emitResourceReady(userId, skillName, agentType);
      }

      // 自动持久化到知识库
      await this.saveToKnowledgeBase(agentType, params, result).catch((e) =>
        console.error('[AgentOffice] saveToKnowledgeBase failed:', e.message),
      );
    } catch (e: any) {
      // SSE：任务失败
      this.eventsService.emitAgentStatus(userId, agentType, 'error', e.message);
      this.eventsService.emitAgentProgress(userId, agentType, String(taskId), -1, `失败: ${e.message}`);

      await this.taskService.updateStatus(taskId, 'failed', undefined, e.message);
      await this.profileService.updateStatus(userId, agentType as any, 'idle').catch(() => {});
    }
  }

  /** 执行直接使用任务（异步） */
  private async executeDirectTask(taskId: number, userId: number, agentType: string, prompt: string, params: Record<string, any>) {
    try {
      // SSE：任务开始
      this.eventsService.emitAgentStatus(userId, agentType, 'working', `直接执行: ${prompt.slice(0, 50)}`);
      this.eventsService.emitAgentProgress(userId, agentType, String(taskId), 0, '任务排队中');

      await this.taskService.updateStatus(taskId, 'running');
      await this.taskService.updateProgress(taskId, 30);
      this.eventsService.emitAgentProgress(userId, agentType, String(taskId), 30, 'Agent 生成中...');

      // 直接使用模式：把 prompt 传给 agent
      const result = await this.runAgent(agentType, { ...params, directPrompt: prompt, skillName: prompt });

      await this.taskService.updateProgress(taskId, 90);
      this.eventsService.emitAgentProgress(userId, agentType, String(taskId), 90, '保存结果中');

      await this.taskService.updateStatus(taskId, 'success', result);
      await this.profileService.updateStatus(userId, agentType as any, 'idle').catch(() => {});

      // SSE：任务完成
      this.eventsService.emitAgentStatus(userId, agentType, 'idle');
      this.eventsService.emitAgentProgress(userId, agentType, String(taskId), 100, '完成');

      // 如果有技能相关结果，推送资源就绪事件
      const skillName = params.skillName || result?.skill || prompt;
      if (skillName) {
        this.eventsService.emitResourceReady(userId, skillName, agentType);
      }

      // 自动持久化到知识库
      await this.saveToKnowledgeBase(agentType, params, result).catch((e) =>
        console.error('[AgentOffice] saveToKnowledgeBase failed:', e.message),
      );
    } catch (e: any) {
      // SSE：任务失败
      this.eventsService.emitAgentStatus(userId, agentType, 'error', e.message);
      this.eventsService.emitAgentProgress(userId, agentType, String(taskId), -1, `失败: ${e.message}`);

      await this.taskService.updateStatus(taskId, 'failed', undefined, e.message);
      await this.profileService.updateStatus(userId, agentType as any, 'idle').catch(() => {});
    }
  }

  /** 将 Agent 任务结果持久化到 MongoDB 知识库 */
  private async saveToKnowledgeBase(agentType: string, params: Record<string, any>, result: any): Promise<void> {
    if (!result) return;
    const skill = params.skillName || result.skill;
    if (!skill) return;

    switch (agentType) {
      case 'lecture':
        // 保存讲义
        if (result.content) {
          await this.knowledgeBase.saveLecture(skill, result.content, params.level || 'beginner');
          console.log(`[AgentOffice→KB] Lecture saved: ${skill}`);
        }
        // 保存练习题
        if (result.exercises?.length) {
          const questions = result.exercises
            .filter((ex: any) => ex.type === 'choice' && ex.options?.length)
            .map((ex: any) => ({
              question: ex.question || '',
              options: ex.options || [],
              answer: ex.options.indexOf(ex.answer) >= 0 ? ex.options.indexOf(ex.answer) : 0,
              explanation: ex.explanation || '',
            }));
          if (questions.length > 0) {
            await this.knowledgeBase.saveQuiz(skill, questions, params.level || 'beginner');
            console.log(`[AgentOffice→KB] Quiz saved: ${skill} (${questions.length}q)`);
          }
        }
        break;

      case 'code':
        if (result.examples?.length) {
          await this.knowledgeBase.saveCoding(skill, result.examples, 'beginner');
          console.log(`[AgentOffice→KB] Coding saved: ${skill} (${result.examples.length} examples)`);
        }
        break;

      case 'reading':
        if (result.items?.length) {
          await this.knowledgeBase.saveContent(skill, 'reading', {
            items: result.items,
            studyAdvice: result.studyAdvice,
            total: result.items.length,
          }, 'beginner');
          console.log(`[AgentOffice→KB] Reading saved: ${skill} (${result.items.length} items)`);
        }
        break;

      case 'assess':
        if (result) {
          await this.knowledgeBase.saveContent(skill, 'assess', result, 'beginner');
          console.log(`[AgentOffice→KB] Assess saved: ${skill}`);
        }
        break;

      // path, exam 等不需要写入知识库
      default:
        break;
    }
  }

  /** 统一 Agent 调度 */
  private async runAgent(agentType: string, params: Record<string, any>): Promise<any> {
    switch (agentType) {
      case 'lecture':
        return this.lectureAgent.generate(params.skillName || '未知技能', params.level || 'beginner', params.extra);
      case 'reading':
        return this.readingAgent.generate(params.skillName || '未知技能', params.count || 5, params.focus);
      case 'code':
        return this.codeAgent.generate(params.skillName || '未知技能', params.language || 'JavaScript', params.count || 3);
      case 'path':
        return this.pathAgent.generate(params.goal || '学习目标', params.currentLevel || '零基础', params.availableTime || '每天2小时', params.preferences);
      case 'assess':
        return this.assessAgent.assess(params.learningData || '', params.goal || '掌握技术栈', params.currentProgress || '学习中');
      case 'exam':
        return this.examAgent.generateExam({
          skillName: params.skillName || '未知技能',
          questionCount: params.count || 5,
          difficulty: params.difficulty || 'mixed',
          questionTypes: ['choice', 'fill'],
        });
      case 'skillgap':
        return this.skillGapAgent.analyze({
          userSkills: params.userSkills || [],
          targetJob: params.targetJob || { title: '目标岗位', company: '', level: 'junior', requiredSkills: [] },
        });
      case 'resume':
        return this.resumeAgent.generate(params.profile || {}, params.targetJob || {});
      case 'profile':
        return this.profileAgent.generateReport(params.learningData || { userId: params.userId, recentActivity: '' });
      case 'news':
        return this.newsAgent.generateTrendAnalysis(params.topic || '前端技术趋势', params.skills || []);
      default:
        throw new Error(`不支持的 Agent 类型: ${agentType}`);
    }
  }
}

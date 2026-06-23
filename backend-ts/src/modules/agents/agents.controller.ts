import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import {
  LectureAgentService,
  ReadingAgentService,
  CodeAgentService,
  PathAgentService,
  AssessAgentService,
} from '../../services/agents';
import { KnowledgeBaseService } from '../../services/knowledge-base.service';
import { AgentTaskService } from '../../services/agent-task.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success, error } from '../../common/api-response';

/**
 * Agents 控制器 — 5 个 Agent 的 API 端点
 *
 * 直接生成也同步注册到智能体办公室（status='success'），保证办公室有完整任务历史。
 */
@Controller('user/agents')
@UseGuards(AuthGuard)
export class AgentsController {
  constructor(
    private readonly lectureAgent: LectureAgentService,
    private readonly readingAgent: ReadingAgentService,
    private readonly codeAgent: CodeAgentService,
    private readonly pathAgent: PathAgentService,
    private readonly assessAgent: AssessAgentService,
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly taskService: AgentTaskService,
  ) {}

  /** 异步注册任务到办公室（不阻塞响应） */
  private registerOfficeTask(userId: number, agentType: string, title: string, result: any, params?: Record<string, any>) {
    this.taskService.createTask(userId, agentType as any, title, params)
      .then(task => this.taskService.updateStatus(task.id, 'success', result))
      .catch(() => {});
  }

  /**
   * 1. 生成讲义
   * POST /api/user/agents/lecture
   */
  @Post('lecture')
  async generateLecture(
    @CurrentUser('sub') userId: number,
    @Body() body: { skillName: string; level?: 'beginner' | 'intermediate' | 'advanced'; extra?: string },
  ) {
    if (!body.skillName?.trim()) {
      return error(400, '请提供技能名称');
    }

    try {
      const result = await this.lectureAgent.generate(
        body.skillName.trim(),
        body.level || 'beginner',
        body.extra,
      );
      // 保存到知识库
      await this.knowledgeBase.saveLecture(
        body.skillName.trim(),
        result.content,
        body.level || 'beginner',
      );
      this.registerOfficeTask(userId, 'lecture', `讲义: ${body.skillName.trim()}`, result, { skillName: body.skillName.trim() });
      return success(result);
    } catch (e: any) {
      return error(500, `讲义生成失败：${e.message}`);
    }
  }

  /**
   * 2. 生成拓展阅读
   * POST /api/user/agents/reading
   */
  @Post('reading')
  async generateReading(
    @CurrentUser('sub') userId: number,
    @Body() body: { skillName: string; count?: number; focus?: string },
  ) {
    if (!body.skillName?.trim()) {
      return error(400, '请提供技能名称');
    }

    try {
      const result = await this.readingAgent.generate(
        body.skillName.trim(),
        body.count || 5,
        body.focus,
      );
      this.registerOfficeTask(userId, 'reading', `拓展阅读: ${body.skillName.trim()}`, result, { skillName: body.skillName.trim() });
      return success(result);
    } catch (e: any) {
      return error(500, `拓展阅读生成失败：${e.message}`);
    }
  }

  /**
   * 3. 生成代码案例
   * POST /api/user/agents/code
   */
  @Post('code')
  async generateCode(
    @CurrentUser('sub') userId: number,
    @Body() body: { skillName: string; language?: string; count?: number },
  ) {
    if (!body.skillName?.trim()) {
      return error(400, '请提供技能名称');
    }

    try {
      const result = await this.codeAgent.generate(
        body.skillName.trim(),
        body.language || 'JavaScript',
        body.count || 3,
      );
      this.registerOfficeTask(userId, 'code', `代码案例: ${body.skillName.trim()}`, result, { skillName: body.skillName.trim() });
      return success(result);
    } catch (e: any) {
      return error(500, `代码案例生成失败：${e.message}`);
    }
  }

  /**
   * 4. 生成学习路径
   * POST /api/user/agents/path
   */
  @Post('path')
  async generatePath(
    @CurrentUser('sub') userId: number,
    @Body() body: { goal: string; currentLevel?: string; availableTime?: string; preferences?: string },
  ) {
    if (!body.goal?.trim()) {
      return error(400, '请提供学习目标');
    }

    try {
      const result = await this.pathAgent.generate(
        body.goal.trim(),
        body.currentLevel || '零基础',
        body.availableTime || '每天2小时',
        body.preferences,
      );
      this.registerOfficeTask(userId, 'path', `学习路径: ${body.goal.trim()}`, result);
      return success(result);
    } catch (e: any) {
      return error(500, `学习路径生成失败：${e.message}`);
    }
  }

  /**
   * 5. 评估学习效果
   * POST /api/user/agents/assess
   */
  @Post('assess')
  async assessLearning(
    @CurrentUser('sub') userId: number,
    @Body() body: { learningData: string; goal?: string; currentProgress?: string },
  ) {
    if (!body.learningData?.trim()) {
      return error(400, '请提供学习数据');
    }

    try {
      const result = await this.assessAgent.assess(
        body.learningData.trim(),
        body.goal || '掌握技术栈',
        body.currentProgress || '学习中',
      );
      this.registerOfficeTask(userId, 'assess', `学习评估`, result);
      return success(result);
    } catch (e: any) {
      return error(500, `学习评估失败：${e.message}`);
    }
  }
}

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
import { GeneratedResourceService } from '../../services/generated-resource.service';
import { EvaluationService } from '../../services/evaluation.service';
import { LearningCommitService } from '../../services/learning-commit.service';
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
    private readonly generatedResources: GeneratedResourceService,
    private readonly evaluationService: EvaluationService,
    private readonly learningCommitService: LearningCommitService,
  ) {}

  /** 异步注册任务到办公室（不阻塞响应） */
  private registerOfficeTask(userId: number, agentType: string, title: string, result: any, params?: Record<string, any>) {
    this.taskService.createTask(userId, agentType as any, title, params)
      .then(async (task) => {
        await this.generatedResources.upsertFromTask(userId, task).catch(() => {});
        const completedTask = await this.taskService.updateStatus(task.id, 'success', result);
        if (completedTask) {
          await this.generatedResources.upsertFromTask(userId, completedTask, result).catch(() => {});
        }
      })
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
    @Body() body: { learningData: string; goal?: string; currentProgress?: string; skillName?: string },
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
      const skillName = body.skillName?.trim() || this.extractSkillName(body.learningData);
      const git = await this.learningCommitService.commitSkill(userId, undefined, {
        type: 'manual',
        skillName,
        delta: 0,
        source: 'conversation',
        trustWeight: 0.5,
        message: skillName ? `assessment: ${skillName}` : 'assessment',
        payload: {
          source: 'ai_assessment',
          goal: body.goal,
          currentProgress: body.currentProgress,
          overallScore: result.overallScore,
        },
      });
      const evaluation = await this.evaluationService.record({
        userId,
        attemptType: 'ai_assessment',
        sourceType: 'agent_assess',
        sourceId: git.commit.id,
        skillName,
        goal: body.goal || null,
        score: result.overallScore || 0,
        passed: result.overallScore >= 70,
        confidence: 0.62,
        evaluatorType: 'llm',
        evaluatorName: 'AssessAgentService',
        level: result.level,
        summary: result.summary || null,
        feedback: {
          weakPoints: result.weakPoints,
          improvements: result.improvements,
          planAdjustment: result.planAdjustment,
          encouragement: result.encouragement,
        },
        rawResult: result as any,
        evidence: {
          learningData: body.learningData,
          goal: body.goal,
          currentProgress: body.currentProgress,
        },
        commitOutcome: git,
        dimensions: (result.dimensions || []).map((dimension: any) => ({
          name: dimension.dimension,
          score: dimension.score,
          maxScore: dimension.maxScore || 100,
          trend: dimension.trend || 'stable',
          detail: dimension.detail,
        })),
        nextActions: (result.improvements || []).slice(0, 3).map((item: any) => ({
          type: 'improvement',
          label: item.action || item.area,
          priority: item.priority,
          skillName: item.area || skillName,
        })),
      });
      const enriched = {
        ...result,
        commit: git.commit,
        snapshot: git.snapshot,
        gitDelta: git.delta,
        branch: git.branch,
        matchSummary: git.matchSummary,
        evaluation,
      };
      this.registerOfficeTask(userId, 'assess', `学习评估`, enriched);
      return success(enriched);
    } catch (e: any) {
      return error(500, `学习评估失败：${e.message}`);
    }
  }

  private extractSkillName(learningData: string): string | undefined {
    const match = String(learningData || '').match(/技能[:：]\s*([^,，\n]+)/);
    return match?.[1]?.trim() || undefined;
  }
}

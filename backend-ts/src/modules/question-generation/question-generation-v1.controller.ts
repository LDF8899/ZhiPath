import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { getRequestContext } from '../../platform/request-context/request-context.types';
import { PlatformJobsService } from '../../domains/platform-jobs/platform-jobs.service';
import { QuestionGenerationService } from './question-generation.service';

/** 题目生成编辑契约；内部服务仍兼容历史 BIGINT task id。 */
@Controller('v1/question-generation')
@UseGuards(AuthGuard, ScopesGuard)
export class QuestionGenerationV1Controller {
  constructor(private readonly service: QuestionGenerationService, private readonly jobs: PlatformJobsService) {}
  @Get('tasks') @RequireScopes('learning:read') async list(@Req() req: PlatformRequest, @Query('limit') limit?: string) { return apiV1Success(req, await this.service.listTasks(this.userId(req), Number(limit) || 20, this.tenantId(req))); }
  @Post('tasks') @HttpCode(HttpStatus.ACCEPTED) @RequireScopes('learning:write') async create(@Req() req: PlatformRequest, @Headers('idempotency-key') key: string, @Body() body: any) {
    if (!key) throw new BadRequestException('Idempotency-Key 必填');
    const task = await this.service.createTask(this.userId(req), body, this.tenantId(req), key);
    const context = getRequestContext(req);
    const job = await this.jobs.create({ tenantId: this.tenantId(req), userId: this.userId(req), clientApp: context.clientApp, requestId: context.requestId, idempotencyKey: key, ipAddress: req.ip }, { jobType: 'question.generate', payload: { ...body, questionTaskId: task.taskId, idempotencyKey: key }, priority: 5, delayMs: 0 });
    await this.service.bindPlatformJob(this.userId(req), task.taskId, job.id, this.tenantId(req));
    return apiV1Success(req, { ...task, platformJobId: job.id, jobId: job.id, taskStatus: 'pending' });
  }
  @Post('tasks/:id/start') @RequireScopes('learning:write') async start(@Req() req: PlatformRequest, @Param('id') id: string) {
    const task = await this.service.getTask(this.userId(req), Number(id), this.tenantId(req));
    if (task.platformJobId) return apiV1Success(req, await this.jobs.get(this.tenantId(req), this.userId(req), task.platformJobId));
    return apiV1Success(req, await this.service.startTask(this.userId(req), Number(id), this.tenantId(req)));
  }
  @Get('tasks/:id/snapshot') @RequireScopes('learning:read') async snapshot(@Req() req: PlatformRequest, @Param('id') id: string) { return apiV1Success(req, await this.service.getSnapshot(this.userId(req), Number(id), this.tenantId(req))); }
  @Put('tasks/:id/snapshot') @RequireScopes('learning:write') async saveSnapshot(@Req() req: PlatformRequest, @Param('id') id: string, @Body() body: any) { return apiV1Success(req, await this.service.saveSnapshot(this.userId(req), Number(id), body.questions || [], body.config, body.reviewStatuses, this.tenantId(req))); }
  @Post('tasks/:id/questions/batch') @RequireScopes('learning:write') async persist(@Req() req: PlatformRequest, @Param('id') id: string, @Body() body: any) { return apiV1Success(req, await this.service.persistDrafts(this.userId(req), Number(id), body.questions || [], this.tenantId(req))); }
  @Patch('tasks/:id/questions/approve') @RequireScopes('learning:write') async approve(@Req() req: PlatformRequest, @Param('id') id: string, @Body() body: any) { return apiV1Success(req, await this.service.approve(this.userId(req), Number(id), body.questionIds || [], body.questionsMap || {}, this.tenantId(req))); }
  @Patch('tasks/:id/questions/:questionId') @RequireScopes('learning:write') async update(@Req() req: PlatformRequest, @Param('id') id: string, @Param('questionId') questionId: string, @Body() body: any) { return apiV1Success(req, await this.service.updateDraft(this.userId(req), Number(id), Number(questionId), body.question, this.tenantId(req))); }
  @Delete('tasks/:id') @RequireScopes('learning:write') async remove(@Req() req: PlatformRequest, @Param('id') id: string) { return apiV1Success(req, await this.service.deleteTask(this.userId(req), Number(id), this.tenantId(req))); }
  private userId(req: PlatformRequest) { return Number(req.user?.sub || req.user?.id); }
  private tenantId(req: PlatformRequest) { const id = Number(req.user?.tenantId); if (!id) throw new BadRequestException('访问令牌缺少有效租户上下文'); return id; }
}

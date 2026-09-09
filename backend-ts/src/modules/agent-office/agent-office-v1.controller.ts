import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Headers, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { getRequestContext } from '../../platform/request-context/request-context.types';
import { PlatformJobsService } from '../../domains/platform-jobs/platform-jobs.service';
import { AgentProfileService } from '../../services/agent-profile.service';

const TYPES = ['lecture','reading','code','path','assess','exam','skillgap','resume','profile','news'] as const;
const TYPE_META = Object.fromEntries(TYPES.map((type) => [type, { label: type, defaultRole: type }]));

/** Agent Office 统一契约：任务走 durable jobs，员工配置按 tenant + user 隔离。 */
@Controller('v1/agent-office')
@UseGuards(AuthGuard, ScopesGuard)
export class AgentOfficeV1Controller {
  constructor(private readonly jobs: PlatformJobsService, private readonly profiles: AgentProfileService) {}

  @Get('agent-types')
  @RequireScopes('learning:read')
  async agentTypes(@Req() req: PlatformRequest) { return apiV1Success(req, TYPE_META); }

  @Get('profiles')
  @RequireScopes('learning:read')
  async listProfiles(@Req() req: PlatformRequest) {
    return apiV1Success(req, await this.profiles.getProfiles(this.userId(req), this.tenantId(req)));
  }

  @Post('profiles')
  @RequireScopes('learning:write')
  async hire(@Req() req: PlatformRequest, @Body() body: any) {
    if (!TYPES.includes(body?.agentType)) throw new BadRequestException('无效的 Agent 类型');
    if (!String(body?.nickname || '').trim()) throw new BadRequestException('昵称不能为空');
    return apiV1Success(req, await this.profiles.hireAgent(this.userId(req), body.agentType, body.animalType || 'cat', body.color || '#f9d27c', String(body.nickname).trim(), body.displayRole || body.agentType, this.tenantId(req)));
  }

  @Put('profiles/:id')
  @RequireScopes('learning:write')
  async update(@Req() req: PlatformRequest, @Param('id') id: string, @Body() body: any) {
    const profile = await this.profiles.getProfile(this.userId(req), Number(id), this.tenantId(req));
    if (!profile) throw new BadRequestException('员工不存在');
    return apiV1Success(req, await this.profiles.updateProfile(this.userId(req), profile.agentType as any, body, this.tenantId(req)));
  }

  @Delete('profiles/:id')
  @RequireScopes('learning:write')
  async removeProfile(@Req() req: PlatformRequest, @Param('id') id: string) {
    const profile = await this.profiles.getProfile(this.userId(req), Number(id), this.tenantId(req));
    if (!profile) throw new BadRequestException('员工不存在');
    await this.profiles.softDelete(this.userId(req), Number(id), this.tenantId(req));
    return apiV1Success(req, { deleted: true });
  }

  @Post('profiles/:id/use')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireScopes('learning:write')
  async use(@Req() req: PlatformRequest, @Param('id') id: string, @Headers('idempotency-key') key: string, @Body() body: any) {
    if (!key) throw new BadRequestException('Idempotency-Key 必填');
    const prompt = String(body?.prompt || '').trim();
    if (!prompt) throw new BadRequestException('请输入指令');
    const profile = await this.profiles.getProfile(this.userId(req), Number(id), this.tenantId(req));
    if (!profile) throw new BadRequestException('员工不存在');
    const context = getRequestContext(req);
    const result = await this.jobs.create(
      { tenantId: this.tenantId(req), userId: this.userId(req), clientApp: context.clientApp, requestId: context.requestId, idempotencyKey: key, ipAddress: req.ip },
      {
        jobType: `agent.${profile.agentType}`,
        payload: { ...(body?.params || {}), directPrompt: prompt, skillName: body?.skillName || prompt.slice(0, 120), title: `${profile.nickname} 直接执行` },
        priority: 5,
        delayMs: 0,
      },
    );
    return apiV1Success(req, { ...result, agentType: profile.agentType, profileId: profile.id });
  }

  @Post('profiles/:id/station')
  @RequireScopes('learning:write')
  async station(@Req() req: PlatformRequest, @Param('id') id: string, @Body() body: { stationId: number | null }) {
    const profile = await this.profiles.getProfile(this.userId(req), Number(id), this.tenantId(req));
    if (!profile) throw new BadRequestException('员工不存在');
    return apiV1Success(req, await this.profiles.assignStation(this.userId(req), profile.agentType as any, body?.stationId ?? null, this.tenantId(req)));
  }

  @Get('tasks')
  @RequireScopes('learning:read')
  async listTasks(@Req() req: PlatformRequest, @Query('status') status?: string) {
    return apiV1Success(req, await this.jobs.list(this.tenantId(req), this.userId(req), 1, 100, status));
  }

  @Get('history')
  @RequireScopes('learning:read')
  async history(@Req() req: PlatformRequest, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return apiV1Success(req, await this.jobs.list(this.tenantId(req), this.userId(req), Number(page) || 1, Number(pageSize) || 20, 'completed'));
  }

  @Get('tasks/:id')
  @RequireScopes('learning:read')
  async getTask(@Req() req: PlatformRequest, @Param('id') id: string) {
    return apiV1Success(req, await this.jobs.get(this.tenantId(req), this.userId(req), id));
  }

  @Post('tasks/:id/urgent')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('learning:write')
  async urgent(@Req() req: PlatformRequest, @Param('id') id: string, @Headers('idempotency-key') key: string) {
    if (!key) throw new BadRequestException('Idempotency-Key 必填');
    return apiV1Success(req, await this.jobs.urgent(this.commandContext(req, key), id));
  }

  @Post('tasks/:id/skip')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('learning:write')
  async skip(@Req() req: PlatformRequest, @Param('id') id: string, @Headers('idempotency-key') key: string) {
    if (!key) throw new BadRequestException('Idempotency-Key 必填');
    return apiV1Success(req, await this.jobs.skip(this.commandContext(req, key), id));
  }

  @Post('tasks/reorder')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('learning:write')
  async reorder(@Req() req: PlatformRequest, @Headers('idempotency-key') key: string, @Body() body: { jobIds?: string[]; taskIds?: string[] }) {
    if (!key) throw new BadRequestException('Idempotency-Key 必填');
    const ids = body?.jobIds || body?.taskIds || [];
    if (!Array.isArray(ids)) throw new BadRequestException('jobIds 必须是数组');
    return apiV1Success(req, await this.jobs.reorder(this.commandContext(req, key), ids));
  }

  @Delete('tasks/:id')
  @RequireScopes('learning:write')
  async remove(@Req() req: PlatformRequest, @Param('id') id: string, @Headers('idempotency-key') key: string) {
    if (!key) throw new BadRequestException('Idempotency-Key 必填');
    return apiV1Success(req, await this.jobs.remove(this.commandContext(req, key), id));
  }

  @Post('tasks')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireScopes('learning:write')
  async createTask(@Req() req: PlatformRequest, @Headers('idempotency-key') key: string, @Body() body: any) {
    if (!key) throw new BadRequestException('Idempotency-Key 必填');
    const agentType = String(body?.agentType || '').replace(/^agent\./, '');
    if (!TYPES.includes(agentType as any)) throw new BadRequestException('无效的 Agent 类型');
    const result = await this.jobs.create({ tenantId: this.tenantId(req), userId: this.userId(req), clientApp: req.requestContext?.clientApp || 'unknown', requestId: req.requestContext?.requestId || 'untracked', idempotencyKey: key, ipAddress: req.ip }, { jobType: `agent.${agentType}`, payload: { ...(body.params || {}), title: body.title, description: body.description }, priority: body.priority, delayMs: body.delayMs } as any);
    return apiV1Success(req, result);
  }

  @Post('tasks/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('learning:write')
  async cancel(@Req() req: PlatformRequest, @Param('id') id: string, @Headers('idempotency-key') key: string) {
    if (!key) throw new BadRequestException('Idempotency-Key 必填');
    return apiV1Success(req, await this.jobs.cancel({ tenantId: this.tenantId(req), userId: this.userId(req), clientApp: req.requestContext?.clientApp || 'unknown', requestId: req.requestContext?.requestId || 'untracked', idempotencyKey: key, ipAddress: req.ip }, id));
  }

  @Post('tasks/:id/retry')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('learning:write')
  async retry(@Req() req: PlatformRequest, @Param('id') id: string, @Headers('idempotency-key') key: string) {
    if (!key) throw new BadRequestException('Idempotency-Key 必填');
    return apiV1Success(req, await this.jobs.retry({ tenantId: this.tenantId(req), userId: this.userId(req), clientApp: req.requestContext?.clientApp || 'unknown', requestId: req.requestContext?.requestId || 'untracked', idempotencyKey: key, ipAddress: req.ip }, id));
  }

  private commandContext(req: PlatformRequest, key: string) {
    return {
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      clientApp: req.requestContext?.clientApp || 'unknown',
      requestId: req.requestContext?.requestId || 'untracked',
      idempotencyKey: key,
      ipAddress: req.ip,
    };
  }

  private userId(req: PlatformRequest) { return Number(req.user?.sub || req.user?.id); }
  private tenantId(req: PlatformRequest) { const id = Number(req.user?.tenantId); if (!id) throw new BadRequestException('访问令牌缺少有效租户上下文'); return id; }
}

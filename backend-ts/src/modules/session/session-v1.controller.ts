import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { SessionService } from '../../services/session.service';

@Controller('v1/sessions')
@UseGuards(AuthGuard, ScopesGuard)
export class SessionV1Controller {
  constructor(private readonly service: SessionService) {}
  @Post('start') @RequireScopes('learning:write') async start(@Req() req: PlatformRequest, @Body() body: { planId?: number }) { return apiV1Success(req, await this.service.startSession(this.userId(req), body?.planId, this.tenantId(req))); }
  @Post(':id/end') @RequireScopes('learning:write') async end(@Req() req: PlatformRequest, @Param('id') id: string) { return apiV1Success(req, await this.service.endSession(Number(id), this.tenantId(req))); }
  @Post(':id/progress') @RequireScopes('learning:write') async progress(@Req() req: PlatformRequest, @Param('id') id: string, @Body() body: any) { await this.service.recordProgress(Number(id), body.taskId, body.skillName, body.masteryBefore, body.masteryAfter, this.tenantId(req)); return apiV1Success(req, { recorded: true }); }
  @Get('history') @RequireScopes('learning:read') async history(@Req() req: PlatformRequest, @Query('page') page?: string, @Query('pageSize') pageSize?: string) { return apiV1Success(req, await this.service.getHistory(this.userId(req), Number(page) || 1, Number(pageSize) || 20, this.tenantId(req))); }
  @Get('stats') @RequireScopes('learning:read') async stats(@Req() req: PlatformRequest) { return apiV1Success(req, await this.service.getStats(this.userId(req), this.tenantId(req))); }
  @Get('diff') @RequireScopes('learning:read') async diff(@Req() req: PlatformRequest, @Query('dateA') dateA: string, @Query('dateB') dateB: string) { return apiV1Success(req, await this.service.diff(this.userId(req), dateA, dateB, this.tenantId(req))); }
  @Post('rollback') @RequireScopes('learning:write') async rollback(@Req() req: PlatformRequest, @Body() body: { targetDate: string }) { return apiV1Success(req, await this.service.rollback(this.userId(req), body.targetDate, this.tenantId(req))); }
  private userId(req: PlatformRequest) { return Number(req.user?.sub || req.user?.id); }
  private tenantId(req: PlatformRequest) { const id = Number(req.user?.tenantId); if (!id) throw new BadRequestException('访问令牌缺少有效租户上下文'); return id; }
}

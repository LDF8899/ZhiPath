import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { MatchAgentService } from '../../services/match-agent.service';

@Controller('v1/match')
@UseGuards(AuthGuard, ScopesGuard)
export class MatchV1Controller {
  constructor(private readonly service: MatchAgentService) {}
  @Get('best') @RequireScopes('learning:read') async best(@Req() req: PlatformRequest) { return apiV1Success(req, await this.service.getBestMatch(this.userId(req), this.tenantId(req))); }
  @Get('all') @RequireScopes('learning:read') async all(@Req() req: PlatformRequest) { return apiV1Success(req, await this.service.calculateForAllJobs(this.userId(req), undefined, this.tenantId(req))); }
  @Post('recalculate') @RequireScopes('learning:write') async recalculate(@Req() req: PlatformRequest) { await this.service.recalculateOnSkillChange(this.userId(req), this.tenantId(req)); return apiV1Success(req, { message: '重新计算中' }); }
  @Get(':jobId') @RequireScopes('learning:read') async detail(@Req() req: PlatformRequest, @Param('jobId') jobId: string) { return apiV1Success(req, await this.service.calculateMatch(this.userId(req), Number(jobId), undefined, this.tenantId(req))); }
  @Get(':jobId/trend') @RequireScopes('learning:read') async trend(@Req() req: PlatformRequest, @Param('jobId') jobId: string, @Query('days') days?: string) { return apiV1Success(req, await this.service.getMatchTrend(this.userId(req), Number(jobId), Number(days) || 30, this.tenantId(req))); }
  private userId(req: PlatformRequest) { return Number(req.user?.sub || req.user?.id); }
  private tenantId(req: PlatformRequest) { const id = Number(req.user?.tenantId); if (!id) throw new Error('访问令牌缺少有效租户上下文'); return id; }
}

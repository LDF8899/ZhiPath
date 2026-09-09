import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { JobsService } from './jobs.service';

/** 岗位目录与用户岗位动作的统一契约；/v1/jobs 专用于异步作业。 */
@Controller('v1/job-postings')
@UseGuards(AuthGuard, ScopesGuard)
export class JobsV1Controller {
  constructor(private readonly service: JobsService) {}
  @Get() @RequireScopes('learning:read') async list(@Req() req: PlatformRequest, @Query() query: any) {
    const result = await this.service.searchJobs(this.userId(req), {
      page: Number(query.page) || 1, pageSize: Number(query.pageSize) || 20,
      keyword: query.keyword, company: query.company, location: query.location,
      level: query.level, searchMode: query.searchMode, includeOnline: query.includeOnline === '1' || query.includeOnline === 'true', tenantId: this.tenantId(req),
    });
    return apiV1Success(req, { items: result.list, pageInfo: { page: result.page, pageSize: result.pageSize, total: result.total, hasNextPage: result.page * result.pageSize < result.total }, meta: result.meta });
  }
  @Get(':id') @RequireScopes('learning:read') async detail(@Req() req: PlatformRequest, @Param('id') id: string) { return apiV1Success(req, await this.service.getJob(Number(id))); }
  @Get(':id/company-context') @RequireScopes('learning:read') async company(@Req() req: PlatformRequest, @Param('id') id: string) { return apiV1Success(req, await this.service.getCompanyContext(Number(id))); }
  @Get(':id/match') @RequireScopes('learning:read') async match(@Req() req: PlatformRequest, @Param('id') id: string) { return apiV1Success(req, await this.service.getJobMatch(this.userId(req), Number(id), this.tenantId(req))); }
  @Get(':id/gap-card') @RequireScopes('learning:read') async gap(@Req() req: PlatformRequest, @Param('id') id: string) { return apiV1Success(req, await this.service.getGapCard(this.userId(req), Number(id), this.tenantId(req))); }
  @Post(':id/apply') @RequireScopes('learning:write') async apply(@Req() req: PlatformRequest, @Param('id') id: string) { return apiV1Success(req, await this.service.applyJob(this.userId(req), Number(id), this.tenantId(req))); }
  @Post(':id/import-skills') @RequireScopes('learning:write') async importSkills(@Req() req: PlatformRequest, @Param('id') id: string, @Body() body: any) { return apiV1Success(req, await this.service.importSkills(this.userId(req), Number(id), body?.target, this.tenantId(req))); }
  private userId(req: PlatformRequest) { return Number(req.user?.sub || req.user?.id); }
  private tenantId(req: PlatformRequest) { const id = Number(req.user?.tenantId); if (!id) throw new Error('访问令牌缺少有效租户上下文'); return id; }
}

import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { EvaluationService } from '../../services/evaluation.service';

@Controller('v1/evaluations')
@UseGuards(AuthGuard, ScopesGuard)
export class EvaluationV1Controller {
  constructor(private readonly service: EvaluationService) {}
  @Get() @RequireScopes('assessment:take') async list(@Req() req: PlatformRequest, @Query('limit') limit?: string) { return apiV1Success(req, await this.service.listRecent(this.userId(req), Number(limit) || 20, this.tenantId(req))); }
  @Get(':id') @RequireScopes('assessment:take') async detail(@Req() req: PlatformRequest, @Param('id') id: string) { return apiV1Success(req, await this.service.getDetail(this.userId(req), Number(id), this.tenantId(req))); }
  private userId(req: PlatformRequest) { return Number(req.user?.sub || req.user?.id); }
  private tenantId(req: PlatformRequest) {
    const tenantId = Number(req.user?.tenantId);
    if (!tenantId) throw new BadRequestException('访问令牌缺少有效租户上下文');
    return tenantId;
  }
}

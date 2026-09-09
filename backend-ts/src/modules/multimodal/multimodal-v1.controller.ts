import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { MultimodalService } from '../../services/multimodal.service';

@Controller('v1/multimodal')
@UseGuards(AuthGuard, ScopesGuard)
export class MultimodalV1Controller {
  constructor(private readonly service: MultimodalService) {}
  @Get(':skill') @RequireScopes('learning:read') async get(@Req() req: PlatformRequest, @Param('skill') skill: string) { return apiV1Success(req, await this.service.getMultimodal(decodeURIComponent(skill), Number(req.user?.tenantId || 1))); }
}

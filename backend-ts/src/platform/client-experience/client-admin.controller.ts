import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { apiV1Success } from '../api-v1/api-v1-response';
import { RequireScopes } from '../access-control/require-scopes.decorator';
import { ScopesGuard } from '../access-control/scopes.guard';
import { getRequestContext, PlatformRequest } from '../request-context/request-context.types';
import { ClientExperienceService } from './client-experience.service';
import { CreateClientAppDto } from './dto/create-client-app.dto';
import { UpdateClientFeatureDto } from './dto/update-client-feature.dto';
import { LegacyRouteUsageService } from '../request-context/legacy-route-usage.service';

@ApiTags('v1 client administration')
@ApiBearerAuth()
@Controller('v1/admin/client-apps')
@UseGuards(AuthGuard, ScopesGuard)
@RequireScopes('platform:*')
export class ClientAdminController {
  constructor(
    private readonly service: ClientExperienceService,
    private readonly legacyRoutes: LegacyRouteUsageService,
  ) {}

  @Get()
  @ApiOperation({ summary: '列出全部定制客户端与功能配置' })
  async list(@Req() request: PlatformRequest) {
    return apiV1Success(request, await this.service.listClients());
  }

  @Get('legacy-route-usage')
  @ApiOperation({ summary: '查询兼容路由真实调用量，作为下线门禁依据' })
  async legacyRouteUsage(
    @Req() request: PlatformRequest,
    @Query('days') days?: string,
    @Query('clientApp') clientApp?: string,
  ) {
    return apiV1Success(request, await this.legacyRoutes.list(Number(days) || 30, clientApp));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '注册新的定制客户端，无需修改核心领域代码' })
  async create(@Req() request: PlatformRequest, @Body() dto: CreateClientAppDto) {
    const context = getRequestContext(request);
    return apiV1Success(
      request,
      await this.service.createClient(dto, {
        tenantId: Number(request.user?.tenantId),
        actorUserId: Number(request.user?.sub || request.user?.id),
        actorClientKey: context.clientApp,
        requestId: context.requestId,
        ipAddress: request.ip,
      }),
    );
  }

  @Post(':clientKey/features/:featureKey')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '创建或更新客户端功能开关与导航元数据' })
  async updateFeature(
    @Req() request: PlatformRequest,
    @Param('clientKey') clientKey: string,
    @Param('featureKey') featureKey: string,
    @Body() dto: UpdateClientFeatureDto,
  ) {
    const context = getRequestContext(request);
    return apiV1Success(
      request,
      await this.service.updateFeature(clientKey, featureKey, dto, {
        tenantId: Number(request.user?.tenantId),
        actorUserId: Number(request.user?.sub || request.user?.id),
        actorClientKey: context.clientApp,
        requestId: context.requestId,
        ipAddress: request.ip,
      }),
    );
  }
}

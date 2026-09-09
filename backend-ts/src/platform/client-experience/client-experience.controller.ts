import { BadRequestException, Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { apiV1Success } from '../api-v1/api-v1-response';
import { getRequestContext, PlatformRequest } from '../request-context/request-context.types';
import { ClientExperienceService } from './client-experience.service';
import { RequireScopes } from '../access-control/require-scopes.decorator';
import { ScopesGuard } from '../access-control/scopes.guard';

@ApiTags('v1 client experience')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Client-App', required: true })
@Controller('v1/experience')
@UseGuards(AuthGuard, ScopesGuard)
@RequireScopes('learning:read')
export class ClientExperienceController {
  constructor(private readonly experienceService: ClientExperienceService) {}

  @Get('bootstrap')
  @ApiOperation({ summary: '获取当前客户端的启动配置、用户与功能开关' })
  async bootstrap(@Req() request: PlatformRequest) {
    const context = getRequestContext(request);
    const userId = Number(request.user?.sub || request.user?.id);
    const tenantId = Number(request.user?.tenantId);
    if (!tenantId) throw new BadRequestException('访问令牌缺少有效租户上下文');
    const data = await this.experienceService.bootstrap(context.clientApp, userId, tenantId);
    return apiV1Success(request, data);
  }

  @Get('navigation')
  @ApiOperation({ summary: '获取当前客户端的可用导航' })
  async navigation(@Req() request: PlatformRequest) {
    const context = getRequestContext(request);
    const userId = Number(request.user?.sub || request.user?.id);
    const tenantId = Number(request.user?.tenantId);
    if (!tenantId) throw new BadRequestException('访问令牌缺少有效租户上下文');
    const data = await this.experienceService.bootstrap(context.clientApp, userId, tenantId);
    return apiV1Success(request, data.navigation);
  }

  @Get('home')
  @ApiOperation({ summary: '按客户端功能清单组合首页只读模型' })
  async home(@Req() request: PlatformRequest) {
    const context = getRequestContext(request);
    const userId = Number(request.user?.sub || request.user?.id);
    const tenantId = Number(request.user?.tenantId);
    if (!tenantId) throw new BadRequestException('访问令牌缺少有效租户上下文');
    const data = await this.experienceService.home(context.clientApp, tenantId, userId);
    return apiV1Success(request, data);
  }
}

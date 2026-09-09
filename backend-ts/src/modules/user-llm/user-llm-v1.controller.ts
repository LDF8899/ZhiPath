import { BadRequestException, Body, Controller, Delete, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { UserLlmService } from './user-llm.service';

@ApiTags('v1 user llm')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Client-App', required: true })
@Controller('v1/user-llm')
@UseGuards(AuthGuard, ScopesGuard)
export class UserLlmV1Controller {
  constructor(private readonly service: UserLlmService) {}

  @Get('providers')
  @RequireScopes('learning:read')
  providers(@Req() request: PlatformRequest) {
    return apiV1Success(request, this.service.listProviders());
  }

  @Get('config')
  @RequireScopes('learning:read')
  async config(@Req() request: PlatformRequest) {
    return apiV1Success(request, await this.service.getConfig(this.userId(request), this.tenantId(request)));
  }

  @Post('config')
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async save(@Req() request: PlatformRequest, @Headers('idempotency-key') key: string, @Body() body: { provider?: string; apiKey?: string; baseUrl?: string }) {
    this.requireKey(key);
    const result = await this.service.saveConfig(this.userId(request), body, this.tenantId(request));
    return apiV1Success(request, result);
  }

  @Delete('config')
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async clear(@Req() request: PlatformRequest, @Headers('idempotency-key') key: string) {
    this.requireKey(key);
    await this.service.clearConfig(this.userId(request), this.tenantId(request));
    return apiV1Success(request, { ok: true });
  }

  private userId(request: PlatformRequest) { return Number(request.user?.sub || request.user?.id); }
  private tenantId(request: PlatformRequest) {
    const id = Number(request.user?.tenantId);
    if (!id) throw new BadRequestException('访问令牌缺少有效租户上下文');
    return id;
  }
  private requireKey(key: string) { if (!key || key.length > 200) throw new BadRequestException('Idempotency-Key 必填且不得超过 200 字符'); }
}

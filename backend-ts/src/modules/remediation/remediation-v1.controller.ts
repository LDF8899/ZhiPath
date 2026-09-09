import { BadRequestException, Body, Controller, Get, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { getRequestContext } from '../../platform/request-context/request-context.types';
import { TransactionalCommandService } from '../../platform/transactional-command/transactional-command.service';
import { RemediationService } from './remediation.service';

/**
 * 补弱统一入口。补弱属于评测应用层的一个场景，输出保持稳定的 v1 信封；
 * 旧 /api/user/remediation/* 在迁移期继续保留给未升级页面。
 */
@ApiTags('v1 remediation')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Client-App', required: true })
@Controller('v1/remediation')
@UseGuards(AuthGuard, ScopesGuard)
export class RemediationV1Controller {
  constructor(
    private readonly service: RemediationService,
    private readonly commands: TransactionalCommandService,
  ) {}

  @Get('weak-points')
  @RequireScopes('learning:read')
  @ApiOperation({ summary: '读取当前用户薄弱能力' })
  async weakPoints(@Req() request: PlatformRequest) {
    return apiV1Success(request, await this.service.weakPoints(this.userId(request), this.tenantId(request)));
  }

  @Get('history')
  @RequireScopes('learning:read')
  async history(@Req() request: PlatformRequest, @Query('limit') limit?: string) {
    const parsed = limit === undefined ? 10 : Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 30) throw new BadRequestException('limit 参数无效');
    return apiV1Success(request, await this.service.history(this.userId(request), parsed, this.tenantId(request)));
  }

  @Post('prepare')
  @RequireScopes('learning:write')
  async prepare(@Req() request: PlatformRequest, @Body() body: Record<string, unknown>) {
    return apiV1Success(request, await this.service.prepare(this.userId(request), body || {}, this.tenantId(request)));
  }

  @Post('generate')
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async generate(@Req() request: PlatformRequest, @Headers('idempotency-key') key: string, @Body() body: Record<string, unknown>) {
    if (!key || key.length > 200) throw new BadRequestException('Idempotency-Key 必填且不得超过 200 字符');
    const context = getRequestContext(request);
    const result = await this.commands.execute(
      {
        tenantId: this.tenantId(request),
        userId: this.userId(request),
        clientApp: context.clientApp,
        requestId: context.requestId,
        idempotencyKey: key,
        ipAddress: request.ip,
      },
      '/api/v1/remediation/generate',
      body || {},
      200,
      async () => this.service.generate(this.userId(request), body || {}, this.tenantId(request)),
    );
    return apiV1Success(request, result);
  }

  private userId(request: PlatformRequest) { return Number(request.user?.sub || request.user?.id); }
  private tenantId(request: PlatformRequest) {
    const tenantId = Number(request.user?.tenantId);
    if (!tenantId) throw new BadRequestException('访问令牌缺少有效租户上下文');
    return tenantId;
  }
}

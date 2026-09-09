import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { ProgressController } from './progress.controller';
import { TransactionalCommandService } from '../../platform/transactional-command/transactional-command.service';
import { getRequestContext } from '../../platform/request-context/request-context.types';

/** 学习闭环旧实现的 v1 契约适配器；业务逻辑仍由同一 ProgressController 执行。 */
@ApiTags('v1 learning progress')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Client-App', required: true })
@Controller('v1/progress')
@UseGuards(AuthGuard, ScopesGuard)
export class ProgressV1Controller {
  constructor(
    private readonly legacy: ProgressController,
    private readonly commands: TransactionalCommandService,
  ) {}

  @Post('read')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('learning:write')
  async read(@Req() request: PlatformRequest, @Headers('idempotency-key') key: string, @Body() body: any) {
    return this.executeWrite(request, key, '/api/v1/progress/read', body, () => this.legacy.markReadComplete(this.userId(request), body, this.tenantId(request)));
  }

  @Post('quiz')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('learning:write')
  async quiz(@Req() request: PlatformRequest, @Headers('idempotency-key') key: string, @Body() body: any) {
    return this.executeWrite(request, key, '/api/v1/progress/quiz', body, () => this.legacy.markQuizComplete(this.userId(request), body, this.tenantId(request)));
  }

  @Post('code')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('learning:write')
  async code(@Req() request: PlatformRequest, @Headers('idempotency-key') key: string, @Body() body: any) {
    return this.executeWrite(request, key, '/api/v1/progress/code', body, () => this.legacy.markCodeComplete(this.userId(request), body, this.tenantId(request)));
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('learning:write')
  async complete(@Req() request: PlatformRequest, @Headers('idempotency-key') key: string, @Body() body: any) {
    return this.executeWrite(request, key, '/api/v1/progress/complete', body, () => this.legacy.markSkillComplete(this.userId(request), body, this.tenantId(request)));
  }

  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('learning:write')
  async heartbeat(@Req() request: PlatformRequest, @Headers('idempotency-key') key: string, @Body() body: any) {
    return this.executeWrite(request, key, '/api/v1/progress/heartbeat', body, () => this.legacy.heartbeat(this.userId(request), body, this.tenantId(request)));
  }

  @Get('restore')
  @RequireScopes('learning:read')
  async restore(@Req() request: PlatformRequest, @Query('planId') planId?: string) {
    return this.wrap(request, this.legacy.restore(this.userId(request), planId, this.tenantId(request)));
  }

  @Get('summary')
  @RequireScopes('learning:read')
  async summary(@Req() request: PlatformRequest) {
    return this.wrap(request, this.legacy.getProgressSummary(this.userId(request), this.tenantId(request)));
  }

  @Get('mastery/:skill')
  @RequireScopes('learning:read')
  async mastery(@Req() request: PlatformRequest, @Param('skill') skill: string) {
    return this.wrap(request, this.legacy.getMasteryBreakdown(this.userId(request), skill, this.tenantId(request)));
  }

  private async wrap(request: PlatformRequest, result: Promise<any>) {
    const legacy = await result;
    return apiV1Success(request, legacy && Object.prototype.hasOwnProperty.call(legacy, 'data') ? legacy.data : legacy);
  }

  private async executeWrite(request: PlatformRequest, key: string, route: string, body: unknown, handler: () => Promise<any>) {
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
      route,
      body || {},
      200,
      async () => {
        const legacy = await handler();
        return (legacy && Object.prototype.hasOwnProperty.call(legacy, 'data') ? legacy.data : legacy) as Record<string, unknown>;
      },
    );
    return apiV1Success(request, result);
  }

  private userId(request: PlatformRequest) { return Number(request.user?.sub || request.user?.id); }
  private tenantId(request: PlatformRequest) {
    const id = Number(request.user?.tenantId);
    if (!id) throw new Error('访问令牌缺少有效租户上下文');
    return id;
  }
}

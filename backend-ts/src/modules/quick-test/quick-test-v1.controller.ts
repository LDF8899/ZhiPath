import { Body, Controller, Get, Headers, Post, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { getRequestContext } from '../../platform/request-context/request-context.types';
import { TransactionalCommandService } from '../../platform/transactional-command/transactional-command.service';
import { QuickTestService } from './quick-test.service';

@ApiTags('v1 assessments')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Client-App', required: true })
@Controller('v1/assessments')
@UseGuards(AuthGuard, ScopesGuard)
export class QuickTestV1Controller {
  constructor(
    private readonly service: QuickTestService,
    private readonly commands: TransactionalCommandService,
  ) {}

  @Get('quick-test')
  @RequireScopes('assessment:take')
  @ApiOperation({ summary: '读取速测题目（兼容旧题库与动态生成）' })
  async questions(@Req() request: PlatformRequest, @Query('direction') direction?: string) {
    return apiV1Success(request, await this.service.getQuestions(this.userId(request), direction, this.tenantId(request)));
  }

  @Post('quick-test/submit')
  @RequireScopes('assessment:take')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: '提交速测答案（统一 v1 入口，兼容历史评测记录）' })
  async submit(
    @Req() request: PlatformRequest,
    @Headers('idempotency-key') key: string,
    @Body() body: { skillName: string; answers: Record<string, unknown>; questions: any[] },
  ) {
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
      '/api/v1/assessments/quick-test/submit',
      body || {},
      200,
      async () => this.service.submitAnswers(
        this.userId(request),
        String(body?.skillName || '综合能力'),
        body?.answers || {},
        Array.isArray(body?.questions) ? body.questions : [],
        this.tenantId(request),
      ),
    );
    return apiV1Success(request, result);
  }

  private userId(request: PlatformRequest) {
    return Number(request.user?.sub || request.user?.id);
  }

  private tenantId(request: PlatformRequest) {
    const tenantId = Number(request.user?.tenantId);
    if (!tenantId) throw new BadRequestException('访问令牌缺少有效租户上下文');
    return tenantId;
  }
}

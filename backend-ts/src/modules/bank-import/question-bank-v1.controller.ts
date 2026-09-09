import { BadRequestException, Body, Controller, Get, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { QuestionBankService } from './question-bank.service';

@ApiTags('v1 question bank')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Client-App', required: true })
@Controller('v1/question-bank')
@UseGuards(AuthGuard, ScopesGuard)
export class QuestionBankV1Controller {
  constructor(private readonly bank: QuestionBankService) {}

  @Get('questions')
  @RequireScopes('learning:read')
  async list(@Req() request: PlatformRequest, @Query('skillName') skillName?: string, @Query('questionType') questionType?: string, @Query('difficulty') difficulty?: string, @Query('source') source?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const p = this.positive(page, 1, 100000);
    const ps = this.positive(pageSize, 20, 100);
    const result = await this.bank.listQuestions(this.userId(request), { skillName, questionType, difficulty, source, page: p, pageSize: ps, tenantId: this.tenantId(request) });
    return apiV1Success(request, { items: result.list, pageInfo: { page: result.page, pageSize: result.pageSize, total: result.total, hasNextPage: result.page * result.pageSize < result.total } });
  }

  @Post('assemble')
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async assemble(@Req() request: PlatformRequest, @Headers('idempotency-key') key: string, @Body() body: { questionIds: number[] }) {
    if (!key || key.length > 200) throw new BadRequestException('Idempotency-Key 必填且不得超过 200 字符');
    if (!Array.isArray(body?.questionIds) || body.questionIds.length === 0) throw new BadRequestException('questionIds 不能为空');
    const result = await this.bank.assemble(this.userId(request), body.questionIds, this.tenantId(request));
    return apiV1Success(request, result);
  }

  private userId(request: PlatformRequest) { return Number(request.user?.sub || request.user?.id); }
  private tenantId(request: PlatformRequest) { return Number(request.user?.tenantId || 1); }
  private positive(value: string | undefined, fallback: number, max: number) {
    if (value === undefined || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) throw new BadRequestException('分页参数无效');
    return parsed;
  }
}

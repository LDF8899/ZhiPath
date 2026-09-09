import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { getRequestContext, PlatformRequest } from '../../platform/request-context/request-context.types';
import { PageQueryDto } from '../platform-learning/dto/page-query.dto';
import { CreateAsyncJobDto } from './dto/create-async-job.dto';
import { PlatformJobsService } from './platform-jobs.service';

@ApiTags('v1 asynchronous jobs')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Client-App', required: true })
@Controller('v1/jobs')
@UseGuards(AuthGuard, ScopesGuard)
export class PlatformJobsController {
  constructor(private readonly service: PlatformJobsService) {}

  @Get()
  @RequireScopes('learning:read')
  async list(@Req() request: PlatformRequest, @Query() query: PageQueryDto) {
    return apiV1Success(
      request,
      await this.service.list(this.tenantId(request), this.userId(request), query.page, query.pageSize),
    );
  }

  @Get(':id')
  @RequireScopes('learning:read')
  async get(@Req() request: PlatformRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return apiV1Success(request, await this.service.get(this.tenantId(request), this.userId(request), id));
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: '持久化异步作业，由 outbox 可靠投递到统一队列' })
  async create(
    @Req() request: PlatformRequest,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreateAsyncJobDto,
  ) {
    this.validateKey(idempotencyKey);
    return apiV1Success(request, await this.service.create(this.context(request, idempotencyKey), dto));
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async cancel(
    @Req() request: PlatformRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    this.validateKey(idempotencyKey);
    return apiV1Success(request, await this.service.cancel(this.context(request, idempotencyKey), id));
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async retry(
    @Req() request: PlatformRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    this.validateKey(idempotencyKey);
    return apiV1Success(request, await this.service.retry(this.context(request, idempotencyKey), id));
  }

  private context(request: PlatformRequest, idempotencyKey: string) {
    const context = getRequestContext(request);
    return {
      tenantId: this.tenantId(request),
      userId: this.userId(request),
      clientApp: context.clientApp,
      requestId: context.requestId,
      idempotencyKey,
      ipAddress: request.ip,
    };
  }

  private userId(request: PlatformRequest) { return Number(request.user?.sub || request.user?.id); }
  private tenantId(request: PlatformRequest) {
    const tenantId = Number(request.user?.tenantId);
    if (!tenantId) throw new BadRequestException('访问令牌缺少有效租户上下文');
    return tenantId;
  }
  private validateKey(key: string) {
    if (!key || key.length > 200) throw new BadRequestException('Idempotency-Key 必填且不得超过 200 字符');
  }
}

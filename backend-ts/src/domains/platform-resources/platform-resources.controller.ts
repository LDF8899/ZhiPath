import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Post,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { getRequestContext, PlatformRequest } from '../../platform/request-context/request-context.types';
import { PlatformResourcesService } from './platform-resources.service';
import { ResourceFeedbackDto } from './dto/resource-feedback.dto';

@ApiTags('v1 resources')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Client-App', required: true })
@Controller('v1/resources')
@UseGuards(AuthGuard, ScopesGuard)
export class PlatformResourcesController {
  constructor(private readonly service: PlatformResourcesService) {}

  @Get()
  @RequireScopes('learning:read')
  @ApiOperation({ summary: '读取当前用户的规范化生成产物台账' })
  async list(@Req() request: PlatformRequest, @Query('page') page?: string, @Query('pageSize') pageSize?: string,
    @Query('type') type?: string, @Query('search') search?: string) {
    const parsedPage = this.parsePositiveInt(page, 1, 10000);
    const parsedPageSize = this.parsePositiveInt(pageSize, 20, 100);
    return apiV1Success(
      request,
      await this.service.list(this.tenantId(request), this.userId(request), parsedPage, parsedPageSize, type, search),
    );
  }

  @Get('search')
  @RequireScopes('learning:read')
  @ApiOperation({ summary: '按关键词检索当前用户的规范资源台账' })
  async search(@Req() request: PlatformRequest, @Query('q') q?: string, @Query('limit') limit?: string) {
    const parsedLimit = this.parsePositiveInt(limit, 20, 100);
    return apiV1Success(
      request,
      await this.service.search(this.tenantId(request), this.userId(request), q || '', parsedLimit),
    );
  }

  @Get(':id')
  @RequireScopes('learning:read')
  @ApiOperation({ summary: '读取单个规范化生成产物' })
  async detail(@Req() request: PlatformRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return apiV1Success(request, await this.service.detail(this.tenantId(request), this.userId(request), id));
  }

  @Post(':id/feedback')
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: '记录生成产物是否有用' })
  async feedback(
    @Req() request: PlatformRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: ResourceFeedbackDto,
  ) {
    if (!idempotencyKey || idempotencyKey.length > 200) throw new BadRequestException('Idempotency-Key 必填且不得超过 200 字符');
    return apiV1Success(request, await this.service.feedback(this.tenantId(request), this.userId(request), id, dto.useful));
  }

  private userId(request: PlatformRequest) {
    return Number(request.user?.sub || request.user?.id);
  }

  private tenantId(request: PlatformRequest) {
    const tenantId = Number(request.user?.tenantId);
    if (!tenantId) throw new BadRequestException('访问令牌缺少有效租户上下文');
    return tenantId;
  }

  private parsePositiveInt(raw: string | undefined, fallback: number, max: number) {
    if (raw === undefined || raw === '') return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > max) {
      throw new BadRequestException('分页参数无效');
    }
    return value;
  }
}

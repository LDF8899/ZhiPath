import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { KnowledgeIngestionService } from '../../services/knowledge-ingestion.service';

@ApiTags('v1 knowledge ingestion')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Client-App', required: true })
@Controller('v1/knowledge-ingestion')
@UseGuards(AuthGuard, ScopesGuard)
export class KnowledgeIngestionV1Controller {
  constructor(private readonly ingestion: KnowledgeIngestionService) {}

  @Post('upload-text')
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async uploadText(@Req() request: PlatformRequest, @Headers('idempotency-key') key: string, @Body() body: any) {
    this.validateKey(key);
    const task = await this.ingestion.createUploadTask(this.userId(request), {
      title: body?.title,
      content: body?.content || body?.text || '',
      sourceName: body?.sourceName || body?.source_name,
      sourceUrl: body?.sourceUrl || body?.source_url,
      skillTags: body?.skillTags || body?.skill_tags || [],
    }, this.tenantId(request));
    return apiV1Success(request, task);
  }

  @Post('url')
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async ingestUrl(@Req() request: PlatformRequest, @Headers('idempotency-key') key: string, @Body() body: any) {
    this.validateKey(key);
    const task = await this.ingestion.createUrlTask(this.userId(request), {
      url: body?.url || '',
      title: body?.title,
      skillTags: body?.skillTags || body?.skill_tags || [],
    }, this.tenantId(request));
    return apiV1Success(request, task);
  }

  @Post('news-refresh')
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async refreshNews(@Req() request: PlatformRequest, @Headers('idempotency-key') key: string, @Body() body: any) {
    this.validateKey(key);
    const keywords = Array.isArray(body?.keywords)
      ? body.keywords
      : typeof body?.keywords === 'string'
        ? body.keywords.split(/[，,]/).map((s: string) => s.trim()).filter(Boolean)
        : undefined;
    const result = await this.ingestion.refreshNews(this.userId(request), {
      keywords,
      limit: body?.limit ? Number(body.limit) : undefined,
    }, this.tenantId(request));
    return apiV1Success(request, result);
  }

  @Get('tasks')
  @RequireScopes('learning:read')
  async listTasks(@Req() request: PlatformRequest, @Query('status') status?: string, @Query('limit') limit?: string) {
    const parsedLimit = limit === undefined ? undefined : Number(limit);
    if (parsedLimit !== undefined && (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100)) {
      throw new BadRequestException('limit 参数无效');
    }
    const tasks = await this.ingestion.listTasks(this.userId(request), { status, limit: parsedLimit }, this.tenantId(request));
    return apiV1Success(request, { total: tasks.length, items: tasks });
  }

  @Get('tasks/:taskId')
  @RequireScopes('learning:read')
  async getTask(@Req() request: PlatformRequest, @Param('taskId') taskId: string) {
    return apiV1Success(request, await this.ingestion.getTask(this.userId(request), taskId, this.tenantId(request)));
  }

  @Post('tasks/:taskId/retry')
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async retry(@Req() request: PlatformRequest, @Headers('idempotency-key') key: string, @Param('taskId') taskId: string) {
    this.validateKey(key);
    return apiV1Success(request, await this.ingestion.processTask(taskId, this.userId(request), this.tenantId(request)));
  }

  private userId(request: PlatformRequest) { return Number(request.user?.sub || request.user?.id); }
  private tenantId(request: PlatformRequest) { const id = Number(request.user?.tenantId); if (!id) throw new BadRequestException('访问令牌缺少有效租户上下文'); return id; }
  private validateKey(key: string) { if (!key || key.length > 200) throw new BadRequestException('Idempotency-Key 必填且不得超过 200 字符'); }
}

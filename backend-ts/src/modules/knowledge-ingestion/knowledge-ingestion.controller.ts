import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success } from '../../common/api-response';
import { KnowledgeIngestionService } from '../../services/knowledge-ingestion.service';

@Controller('user/knowledge-ingestion')
@UseGuards(AuthGuard)
export class KnowledgeIngestionController {
  constructor(private readonly ingestion: KnowledgeIngestionService) {}

  @Post('upload-text')
  async uploadText(@CurrentUser() user: any, @Body() body: any) {
    const task = await this.ingestion.createUploadTask(user.sub, {
      title: body?.title,
      content: body?.content || body?.text || '',
      sourceName: body?.sourceName || body?.source_name,
      sourceUrl: body?.sourceUrl || body?.source_url,
      skillTags: body?.skillTags || body?.skill_tags || [],
    });
    return success(task);
  }

  @Post('url')
  async ingestUrl(@CurrentUser() user: any, @Body() body: any) {
    const task = await this.ingestion.createUrlTask(user.sub, {
      url: body?.url || '',
      title: body?.title,
      skillTags: body?.skillTags || body?.skill_tags || [],
    });
    return success(task);
  }

  @Post('news-refresh')
  async refreshNews(@CurrentUser() user: any, @Body() body: any) {
    const keywords = Array.isArray(body?.keywords)
      ? body.keywords
      : typeof body?.keywords === 'string'
        ? body.keywords.split(/[，,]/).map((s: string) => s.trim()).filter(Boolean)
        : undefined;
    const result = await this.ingestion.refreshNews(user.sub, {
      keywords,
      limit: body?.limit ? Number(body.limit) : undefined,
    });
    return success(result);
  }

  @Get('tasks')
  async listTasks(@CurrentUser() user: any, @Query('status') status?: string, @Query('limit') limit?: string) {
    const tasks = await this.ingestion.listTasks(user.sub, { status, limit: limit ? Number(limit) : undefined });
    return success({ total: tasks.length, items: tasks });
  }

  @Get('tasks/:taskId')
  async getTask(@CurrentUser() user: any, @Param('taskId') taskId: string) {
    const task = await this.ingestion.getTask(user.sub, taskId);
    return success(task);
  }

  @Post('tasks/:taskId/retry')
  async retry(@CurrentUser() user: any, @Param('taskId') taskId: string) {
    const task = await this.ingestion.processTask(taskId, user.sub);
    return success(task);
  }
}

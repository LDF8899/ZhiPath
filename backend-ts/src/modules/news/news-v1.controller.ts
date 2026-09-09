import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { NewsService } from './news.service';

@ApiTags('v1 news')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Client-App', required: true })
@Controller('v1/news')
@UseGuards(AuthGuard, ScopesGuard)
@RequireScopes('learning:read')
export class NewsV1Controller {
  constructor(private readonly news: NewsService) {}

  @Get()
  async list(@Req() request: PlatformRequest, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('type') type?: string) {
    const p = this.positive(page, 1, 100000);
    const ps = this.positive(pageSize, 20, 100);
    const result = await this.news.getNews(p, ps, type, this.tenantId(request));
    return apiV1Success(request, {
      items: result.list,
      pageInfo: { page: p, pageSize: ps, total: result.total, hasNextPage: p * ps < result.total },
    });
  }

  @Get(':id')
  async detail(@Req() request: PlatformRequest, @Param('id') id: string) {
    const newsId = this.positive(id, 0, Number.MAX_SAFE_INTEGER);
    if (!newsId) throw new BadRequestException('资讯 ID 无效');
    return apiV1Success(request, await this.news.getNewsDetail(newsId, this.tenantId(request)));
  }

  private tenantId(request: PlatformRequest) { return Number(request.user?.tenantId || 1); }
  private positive(value: string | undefined, fallback: number, max: number) {
    if (value === undefined || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) throw new BadRequestException('分页参数无效');
    return parsed;
  }
}

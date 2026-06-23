import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { NewsService } from './news.service';
import { NewsEnhancedService } from '../../services/news-enhanced.service';
import { NewsCrawlService } from '../../services/news-crawl.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success, pageSuccess } from '../../common/api-response';

@Controller('user')
@UseGuards(AuthGuard)
export class NewsController {
  constructor(
    private readonly newsService: NewsService,
    private readonly newsEnhanced: NewsEnhancedService,
    private readonly newsCrawl: NewsCrawlService,
  ) {}

  /** 获取资讯列表 */
  @Get('news')
  async getNews(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('type') type?: string) {
    const result = await this.newsService.getNews(page ? Number(page) : 1, pageSize ? Number(pageSize) : 20, type);
    return pageSuccess(result.list, result.total, result.page, result.pageSize);
  }

  /** 个性化推荐资讯（静态路由须在 :newsId 之前） */
  @Get('news/recommend')
  async recommend(@CurrentUser() user: any, @Query('limit') limit?: string) {
    const items = await this.newsEnhanced.recommend(user.sub, limit ? Number(limit) : 10);
    return success(items);
  }

  /** 生成技术趋势（静态路由须在 :newsId 之前） */
  @Get('news/trends')
  async getTechTrends(@Query('direction') direction?: string) {
    const result = await this.newsEnhanced.generateTechTrends(direction || '前端开发');
    return success(result);
  }

  /** POST /api/user/news/refresh — 通过 SearXNG 抓取最新资讯（§20.2） */
  @Post('news/refresh')
  async refreshNews(@Query('keywords') keywords?: string) {
    const kw = keywords ? keywords.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    const stats = await this.newsCrawl.crawl(kw);
    return success({
      refreshed: stats.inserted,
      ...stats,
      message: `已采集 ${stats.inserted} 条资讯（去重跳过 ${stats.skipped}）`,
    });
  }

  /** 获取资讯详情（参数路由放最后） */
  @Get('news/:newsId')
  async getNewsDetail(@Param('newsId') newsId: string) {
    const result = await this.newsService.getNewsDetail(Number(newsId));
    return success(result);
  }
}

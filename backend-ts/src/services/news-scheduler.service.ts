import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NewsCrawlService } from './news-crawl.service';

/**
 * 资讯采集调度器 — 业务深度设计 §20.1
 *
 * 行业动态每天 2 次（早 8 点、晚 8 点）通过 SearXNG 抓取。
 * 错开整点分钟，避免与其他定时任务挤在同一时刻。
 */
@Injectable()
export class NewsSchedulerService {
  constructor(private newsCrawl: NewsCrawlService) {}

  /** 每天 08:07 与 20:07 各采集一次（§20.1 每天 2 次） */
  @Cron('0 7 8,20 * * *')
  async scheduledCrawl() {
    console.log('[NewsScheduler] 定时资讯采集开始');
    try {
      const stats = await this.newsCrawl.crawl();
      console.log('[NewsScheduler] 采集完成:', JSON.stringify(stats));
    } catch (e: any) {
      console.warn('[NewsScheduler] 采集失败:', e.message);
    }
  }
}

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ProfileSchedulerService } from '../../services/profile-scheduler.service';
import { ProfileService } from '../../services/profile.service';
import { ChatArchiveService } from '../../services/chat-archive.service';
import { LlmService } from '../../services/llm.service';
import { NewsSchedulerService } from '../../services/news-scheduler.service';
import { NewsModule } from '../news/news.module';

/**
 * 定时任务模块 — Phase 8 + §20 资讯采集
 *
 * 包含：
 *   - 画像分析调度器（每 15 分钟）
 *   - 资讯采集调度器（每天 8:07 / 20:07，§20.1）
 * 使用 @nestjs/schedule 的 Cron 装饰器
 */
@Module({
  imports: [ScheduleModule.forRoot(), NewsModule],
  providers: [
    ProfileService,
    ChatArchiveService,
    LlmService,
    ProfileSchedulerService,
    NewsSchedulerService,
  ],
})
export class SchedulerModule {}

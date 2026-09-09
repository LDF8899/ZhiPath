import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { NewsEnhancedService } from '../../services/news-enhanced.service';
import { NewsCrawlService } from '../../services/news-crawl.service';
import { News } from '../../entities/news.entity';
import { Student } from '../../entities/student.entity';
import { LlmService } from '../../services/llm.service';
import { NewsV1Controller } from './news-v1.controller';

@Module({
  imports: [TypeOrmModule.forFeature([News, Student])],
  controllers: [NewsController, NewsV1Controller],
  providers: [NewsService, NewsEnhancedService, NewsCrawlService, LlmService],
  exports: [NewsEnhancedService, NewsCrawlService],
})
export class NewsModule {}

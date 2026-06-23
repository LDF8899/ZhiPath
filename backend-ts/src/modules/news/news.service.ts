import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { News } from '../../entities/news.entity';

@Injectable()
export class NewsService {
  constructor(@InjectRepository(News) private newsRepo: Repository<News>) {}

  async getNews(page = 1, pageSize = 20, type?: string) {
    const skip = (page - 1) * pageSize;
    const where: any = { status: 1 };
    if (type) where.type = type;
    const [items, total] = await this.newsRepo.findAndCount({
      where, order: { publishTime: 'DESC' }, skip, take: pageSize,
    });
    return { list: items, total, page, pageSize };
  }

  async getNewsDetail(newsId: number) {
    return this.newsRepo.findOne({ where: { id: newsId, status: 1 } });
  }
}

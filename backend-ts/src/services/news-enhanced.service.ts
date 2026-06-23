import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { News } from '../entities/news.entity';
import { Student } from '../entities/student.entity';
import { LlmService } from './llm.service';
import { extractJson } from '../common/json-repair';

/**
 * 增强版资讯服务
 *
 * 功能：
 *   - 获取资讯列表（分页 + 类型筛选）
 *   - 个性化推荐（根据用户方向）
 *   - 标记已读
 *   - 生成技术趋势（LLM）
 */
@Injectable()
export class NewsEnhancedService {
  constructor(
    @InjectRepository(News) private newsRepo: Repository<News>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    private llmService: LlmService,
  ) {}

  /**
   * 获取资讯列表
   */
  async getNews(page = 1, pageSize = 20, type?: string) {
    const skip = (page - 1) * pageSize;
    const where: any = { status: 1 };
    if (type) where.type = type;
    const [items, total] = await this.newsRepo.findAndCount({
      where,
      order: { publishTime: 'DESC' },
      skip,
      take: pageSize,
    });
    return { list: items, total, page, pageSize };
  }

  /**
   * 获取资讯详情
   */
  async getNewsDetail(newsId: number) {
    return this.newsRepo.findOne({ where: { id: newsId, status: 1 } });
  }

  /**
   * 个性化推荐（根据用户方向）
   */
  async recommend(userId: number, limit: number = 10): Promise<News[]> {
    // 获取用户方向
    const student = await this.studentRepo.findOne({ where: { userId, status: 1 } });
    const direction = student?.interests?.[0] || '';

    // 根据方向筛选资讯
    const where: any = { status: 1 };
    if (direction) {
      // 优先推荐与用户方向相关的资讯
      const items = await this.newsRepo.find({
        where,
        order: { publishTime: 'DESC' },
        take: limit * 2, // 多取一些用于筛选
      });

      // 简单的关键词匹配推荐
      const directionKeywords = this.getDirectionKeywords(direction);
      const scored = items.map((item) => {
        let score = 0;
        const title = (item.title || '').toLowerCase();
        const content = (item.content || '').toLowerCase();
        for (const keyword of directionKeywords) {
          if (title.includes(keyword) || content.includes(keyword)) {
            score += 1;
          }
        }
        return { item, score };
      });

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, limit).map((s) => s.item);
    }

    // 没有方向时返回最新资讯
    return this.newsRepo.find({
      where,
      order: { publishTime: 'DESC' },
      take: limit,
    });
  }

  /**
   * 生成技术趋势（LLM）
   */
  async generateTechTrends(direction: string): Promise<{
    trends: Array<{ title: string; summary: string; impact: string }>;
    advice: string;
  }> {
    const prompt = `请分析当前${direction || '前端开发'}领域的技术趋势。

输出JSON格式：
{
  "trends": [
    {"title": "趋势名称", "summary": "简要说明", "impact": "影响程度：高/中/低"}
  ],
  "advice": "学习建议"
}

要求：
1. 列出 3-5 个当前热门趋势
2. 每个趋势的 summary 在 50 字以内
3. advice 在 100 字以内

只输出JSON，不要其他文字。`;

    try {
      const result = await this.llmService.chatCompletion([
        { role: 'system', content: '你是技术趋势分析师。只输出JSON，不要任何解释。' },
        { role: 'user', content: prompt },
      ], { temperature: 0.3, maxTokens: 2000 });

      return extractJson(result);
    } catch (e: any) {
      console.warn('[NewsEnhanced] Generate trends failed:', e.message);
      return {
        trends: [],
        advice: '暂无法生成技术趋势，请稍后再试',
      };
    }
  }

  // ── 内部方法 ──────────────────────────────────

  /**
   * 获取方向关键词
   */
  private getDirectionKeywords(direction: string): string[] {
    const keywordMap: Record<string, string[]> = {
      frontend: ['前端', 'react', 'vue', 'javascript', 'typescript', 'css', 'html', 'webpack', 'vite'],
      backend: ['后端', 'java', 'spring', 'node', 'python', 'go', '数据库', 'redis', '微服务'],
      fullstack: ['全栈', '前端', '后端', 'javascript', 'typescript', 'node', 'react'],
      mobile: ['移动', 'android', 'ios', 'react native', 'flutter', '小程序'],
      ai: ['ai', '人工智能', '机器学习', '深度学习', 'llm', '大模型', 'python'],
      data: ['数据', '分析', 'python', 'sql', 'pandas', '可视化'],
      devops: ['运维', 'devops', 'docker', 'kubernetes', 'ci/cd', 'linux'],
      design: ['设计', 'ui', 'ux', 'figma', '交互'],
    };

    return keywordMap[direction] || keywordMap.frontend;
  }
}

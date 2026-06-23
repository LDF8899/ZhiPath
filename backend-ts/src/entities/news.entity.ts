import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * 资讯表 v3.0 — news_v3
 * 含 AI 摘要 + 技能标签 §20
 */
@Entity('news_v3')
export class News extends BaseEntity {
  @Column({ type: 'varchar', length: 500, name: 'title' })
  title: string;

  @Column({ type: 'text', nullable: true, name: 'content' })
  content: string;

  @Column({ type: 'varchar', length: 1000, nullable: true, name: 'summary', comment: 'AI生成摘要' })
  summary: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'image' })
  image: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'type', comment: 'industry/tech/recruit' })
  type: string;

  @Column({ type: 'json', nullable: true, name: 'tags', comment: '技能标签 ["React","AI"]' })
  tags: string[] | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'source' })
  source: string;

  @Column({ type: 'varchar', length: 1000, nullable: true, name: 'source_url' })
  sourceUrl: string;

  @Column({ type: 'bigint', nullable: true, name: 'publish_time' })
  publishTime: number;
}

import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * 知识库表 v3.0 — knowledge_base_v3
 * 平台级复用资产：讲义、多模态资源、知识图谱数据
 */
@Entity('knowledge_base_v3')
export class KnowledgeBase extends BaseEntity {
  @Column({ type: 'varchar', length: 500, name: 'title' })
  title: string;

  @Column({ type: 'varchar', length: 100, name: 'skill_name', comment: '所属技能' })
  skillName: string;

  @Column({
    type: 'enum',
    enum: ['lecture', 'choice', 'fill', 'coding', 'essay', 'graph'],
    name: 'resource_type',
  })
  resourceType: 'lecture' | 'choice' | 'fill' | 'coding' | 'essay' | 'graph';

  @Column({ type: 'json', name: 'content', comment: 'Markdown讲义/题目/图谱数据' })
  content: Record<string, any>;

  @Column({ type: 'int', default: 1, name: 'version', comment: '版本号' })
  version: number;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'source', comment: '来源' })
  source: string;

  @Column({ type: 'bigint', nullable: true, name: 'reviewed_by' })
  reviewedBy: number;

  @Column({ type: 'tinyint', default: 1, name: 'status', comment: '1=正常 0=待审查 2=已过期' })
  status: number;
}

import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * 个人证据索引 — evidence_chunks（Evidence RAG P0）
 *
 * 对齐《ZhiPath_Evidence_RAG_可落地评测方案》§5.2：
 *   - MySQL 作为可审计索引（原文、标签、状态）
 *   - Chroma 只做向量检索，向量状态由 vectorStatus 跟踪
 *
 * 来源：project / file_qa / evaluation / learning_commit / agent_output / resume
 */
@Entity('evidence_chunks')
@Index(['userId', 'sourceType', 'sourceId'])
@Index(['userId', 'createTime'])
export class EvidenceChunk extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({
    type: 'varchar',
    length: 30,
    name: 'source_type',
    comment: '证据来源：project/file_qa/evaluation/learning_commit/agent_output/resume',
  })
  sourceType: string;

  @Column({ type: 'varchar', length: 120, name: 'source_id', comment: '来源唯一ID，如 project:45 / file_qa:1:1720000000' })
  sourceId: string;

  @Column({ type: 'int', default: 0, name: 'chunk_index', comment: '第几个分块' })
  chunkIndex: number;

  @Column({ type: 'varchar', length: 200, name: 'title', comment: '证据标题' })
  title: string;

  @Column({ type: 'text', name: 'content', comment: '原文片段' })
  content: string;

  @Column({ type: 'varchar', length: 64, name: 'content_hash', comment: '内容哈希，用于去重' })
  contentHash: string;

  @Column({ type: 'json', nullable: true, name: 'skill_tags', comment: '技能标签' })
  skillTags: string[] | null;

  @Column({ type: 'bigint', nullable: true, name: 'job_target_id', comment: '关联目标岗位' })
  jobTargetId: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0.7, name: 'confidence', comment: '证据可信度' })
  confidence: number;

  @Column({ type: 'varchar', length: 20, default: 'private', name: 'visibility', comment: 'private=仅本人 school_aggregate=可聚合' })
  visibility: string;

  @Column({ type: 'varchar', length: 20, default: 'pending', name: 'vector_status', comment: 'pending/indexed/failed' })
  vectorStatus: string;
}

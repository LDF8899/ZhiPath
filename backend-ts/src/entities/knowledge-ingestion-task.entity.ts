import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type KnowledgeIngestionSourceKind = 'upload_text' | 'upload_file' | 'url' | 'news_auto' | 'news_manual';
export type KnowledgeIngestionStatus = 'pending' | 'cleaning' | 'inspecting' | 'approved' | 'rejected' | 'ingested' | 'failed';

/**
 * 知识库入库任务 — knowledge_ingestion_tasks
 *
 * 上传资料和资讯先进入暂存任务，清洗与质检通过后才写入 Evidence RAG。
 */
@Entity('knowledge_ingestion_tasks')
@Index(['userId', 'createTime'])
@Index(['taskId'], { unique: true })
export class KnowledgeIngestionTask extends BaseEntity {
  @Column({ type: 'varchar', length: 64, name: 'task_id', comment: '任务唯一ID' })
  taskId: string;

  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', length: 30, name: 'source_kind', comment: 'upload_text/upload_file/url/news_auto/news_manual' })
  sourceKind: KnowledgeIngestionSourceKind;

  @Column({ type: 'varchar', length: 30, default: 'pending', name: 'ingestion_status', comment: '入库任务状态' })
  ingestionStatus: KnowledgeIngestionStatus;

  @Column({ type: 'varchar', length: 220, name: 'title', comment: '资料标题' })
  title: string;

  @Column({ type: 'varchar', length: 1000, nullable: true, name: 'source_url', comment: '来源 URL' })
  sourceUrl: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true, name: 'source_name', comment: '来源名称' })
  sourceName: string | null;

  @Column({ type: 'mediumtext', nullable: true, name: 'raw_text', comment: '原始文本' })
  rawText: string | null;

  @Column({ type: 'mediumtext', nullable: true, name: 'cleaned_text', comment: '清洗后文本' })
  cleanedText: string | null;

  @Column({ type: 'text', nullable: true, name: 'summary', comment: '摘要' })
  summary: string | null;

  @Column({ type: 'json', nullable: true, name: 'skill_tags', comment: '知识标签' })
  skillTags: string[] | null;

  @Column({ type: 'json', nullable: true, name: 'chunk_preview', comment: '候选切片预览' })
  chunkPreview: Array<{ title?: string; content: string; chunkType?: string; tags?: string[] }> | null;

  @Column({ type: 'json', nullable: true, name: 'curator_result', comment: '知识库智能体清洗结果' })
  curatorResult: Record<string, any> | null;

  @Column({ type: 'json', nullable: true, name: 'inspection_result', comment: '质检员智能体审核结果' })
  inspectionResult: Record<string, any> | null;

  @Column({ type: 'json', nullable: true, name: 'ingested_chunk_ids', comment: '已入库证据切片 ID' })
  ingestedChunkIds: number[] | null;

  @Column({ type: 'text', nullable: true, name: 'failure_reason', comment: '失败或拒绝原因' })
  failureReason: string | null;
}

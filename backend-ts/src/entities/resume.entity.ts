import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * 简历表 v3.0 — resumes_v3
 * 多版本 Git 模型 §10.1
 */
@Entity('resumes_v3')
export class Resume extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'bigint', nullable: true, name: 'target_job_id' })
  targetJobId: number;

  @Column({ type: 'int', default: 1, name: 'version', comment: '版本号' })
  version: number;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'version_name', comment: '如 v1-前端开发工程师' })
  versionName: string;

  @Column({ type: 'tinyint', default: 0, name: 'is_base', comment: '是否基础简历' })
  isBase: number;

  @Column({ type: 'json', nullable: true, name: 'content', comment: '简历结构化内容' })
  content: Record<string, any> | null;

  @Column({ type: 'text', nullable: true, name: 'html_content', comment: '简历HTML(编辑/导出用)' })
  htmlContent: string;

  @Column({ type: 'bigint', nullable: true, name: 'pdf_file_id' })
  pdfFileId: number;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'review_comment' })
  reviewComment: string;
}

import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/** 题库导入批次 — 一份上传文件对应一个批次（OCR识别 → 候选 → 审核入库）。 */
@Entity('question_bank_imports')
@Index('idx_question_bank_import_user_time', ['userId', 'createTime'])
@Index('idx_question_bank_import_status', ['status'])
export class QuestionBankImport extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', length: 512 })
  filename: string;

  @Column({ type: 'varchar', length: 20, name: 'file_type' })
  fileType: string;

  @Column({ type: 'varchar', length: 32, default: 'processing', name: 'import_status' })
  importStatus: string;

  @Column({ type: 'int', default: 0, name: 'total_questions' })
  totalQuestions: number;

  @Column({ type: 'int', default: 0, name: 'imported_count' })
  importedCount: number;

  @Column({ type: 'json', nullable: true, name: 'parse_result' })
  parseResult: any[] | null;

  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ type: 'int', default: 0, name: 'pages_total' })
  pagesTotal: number;

  @Column({ type: 'int', default: 0, name: 'pages_done' })
  pagesDone: number;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true, name: 'storage_key' })
  storageKey: string | null;

  @Column({ type: 'int', nullable: true, name: 'file_size' })
  fileSize: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'file_hash' })
  fileHash: string | null;
}

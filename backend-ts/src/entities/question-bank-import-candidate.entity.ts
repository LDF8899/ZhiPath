import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/** 题库导入候选题 — 一份上传文件的每题候选，确认后写入 exam_questions_v3。 */
@Entity('question_bank_import_candidates')
@Index('idx_qbi_candidate_import', ['importId', 'sourceOrder'])
@Index('idx_qbi_candidate_user', ['userId'])
export class QuestionBankImportCandidate extends BaseEntity {
  @Column({ type: 'bigint', name: 'import_id' })
  importId: number;

  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'int', name: 'source_order' })
  sourceOrder: number;

  @Column({ type: 'varchar', length: 32, name: 'question_type', default: 'choice' })
  questionType: string;

  @Column({ type: 'text' })
  stem: string;

  @Column({ type: 'json', nullable: true })
  options: string[] | null;

  @Column({ type: 'json', nullable: true })
  answer: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  explanation: string | null;

  @Column({ type: 'tinyint', default: 3 })
  difficulty: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  confidence: number | null;

  @Column({ type: 'json', nullable: true, name: 'topic_suggestions' })
  topicSuggestions: string[] | null;

  @Column({ type: 'tinyint', default: 0, name: 'needs_review' })
  needsReview: number;

  @Column({ type: 'tinyint', default: 0 })
  imported: number;

  @Column({ type: 'bigint', nullable: true, name: 'question_id' })
  questionId: number | null;
}

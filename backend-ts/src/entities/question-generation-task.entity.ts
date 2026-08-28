import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type QuestionGenerationTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Provider-neutral generation task. Questions live in the snapshot until review. */
@Entity('question_generation_tasks')
@Index('idx_question_generation_user_status', ['userId', 'taskStatus'])
@Index('idx_question_generation_user_time', ['userId', 'createTime'])
export class QuestionGenerationTask extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', length: 120, default: '' })
  subject: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  curriculum: string;

  @Column({ type: 'varchar', length: 20, default: 'zh-CN' })
  locale: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  grade: string;

  @Column({ type: 'json', name: 'question_types' })
  questionTypes: string[];

  @Column({ type: 'tinyint', name: 'question_count' })
  questionCount: number;

  @Column({ type: 'tinyint', default: 5 })
  difficulty: number;

  @Column({ type: 'json', name: 'difficulty_mix', nullable: true })
  difficultyMix: Record<string, number> | null;

  @Column({ type: 'json', nullable: true })
  topics: any[] | null;

  @Column({ type: 'text', default: '' })
  instructions: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'tinyint', default: 0, name: 'reference_library' })
  referenceLibrary: number;

  @Column({ type: 'enum', enum: ['pending', 'running', 'completed', 'failed', 'cancelled'], default: 'pending', name: 'task_status' })
  taskStatus: QuestionGenerationTaskStatus;

  @Column({ type: 'json', nullable: true })
  progress: { current: number; total: number; failed: number; message: string } | null;

  @Column({ type: 'int', default: 0, name: 'result_count' })
  resultCount: number;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @Column({ type: 'bigint', nullable: true, name: 'started_at' })
  startedAt: number | null;

  @Column({ type: 'bigint', nullable: true, name: 'completed_at' })
  completedAt: number | null;
}

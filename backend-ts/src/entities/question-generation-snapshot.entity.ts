import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/** Latest resumable review snapshot for a generation task. */
@Entity('question_generation_snapshots')
@Index('uq_question_generation_snapshot_task', ['taskId'], { unique: true })
export class QuestionGenerationSnapshot extends BaseEntity {
  @Column({ type: 'bigint', name: 'task_id' })
  taskId: number;

  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'json' })
  questions: any[];

  @Column({ type: 'json', nullable: true })
  config: Record<string, any> | null;

  @Column({ type: 'json', name: 'review_statuses', nullable: true })
  reviewStatuses: string[] | null;

  @Column({ type: 'int', default: 1 })
  version: number;
}

import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type EvaluationAttemptType =
  | 'progress_read'
  | 'progress_quiz'
  | 'progress_code'
  | 'skill_complete'
  | 'quick_test'
  | 'exam'
  | 'ai_assessment'
  | 'chat_resource'
  | 'manual';

export type EvaluationAttemptStatus = 'started' | 'graded' | 'committed' | 'failed';

@Entity('evaluation_attempts_v3')
@Index(['userId', 'attemptType'])
@Index(['userId', 'skillName'])
@Index(['sourceType', 'sourceId'])
export class EvaluationAttempt extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({
    type: 'enum',
    enum: ['progress_read', 'progress_quiz', 'progress_code', 'skill_complete', 'quick_test', 'exam', 'ai_assessment', 'chat_resource', 'manual'],
    default: 'manual',
    name: 'attempt_type',
  })
  attemptType: EvaluationAttemptType;

  @Column({ type: 'varchar', length: 80, nullable: true, name: 'source_type' })
  sourceType: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true, name: 'source_id' })
  sourceId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'skill_name' })
  skillName: string | null;

  @Column({ type: 'varchar', length: 240, nullable: true, name: 'goal' })
  goal: string | null;

  @Column({
    type: 'enum',
    enum: ['started', 'graded', 'committed', 'failed'],
    default: 'started',
    name: 'attempt_status',
  })
  attemptStatus: EvaluationAttemptStatus;

  @Column({ type: 'varchar', length: 120, default: 'default_skill_v1', name: 'rubric_key' })
  rubricKey: string;

  @Column({ type: 'varchar', length: 40, default: '1.0.0', name: 'rubric_version' })
  rubricVersion: string;

  @Column({ type: 'bigint', nullable: true, name: 'started_at' })
  startedAt: number | null;

  @Column({ type: 'bigint', nullable: true, name: 'completed_at' })
  completedAt: number | null;

  @Column({ type: 'json', nullable: true, name: 'metadata_json' })
  metadataJson: Record<string, any> | null;
}

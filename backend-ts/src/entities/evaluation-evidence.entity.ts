import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type EvaluationEvidenceType =
  | 'learning_action'
  | 'quiz_answer'
  | 'exam_answer'
  | 'code'
  | 'conversation'
  | 'resource'
  | 'project'
  | 'system';

@Entity('evaluation_evidence_v3')
@Index(['userId', 'attemptId'])
@Index(['sourceType', 'sourceId'])
export class EvaluationEvidence extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'bigint', name: 'attempt_id' })
  attemptId: number;

  @Column({
    type: 'enum',
    enum: ['learning_action', 'quiz_answer', 'exam_answer', 'code', 'conversation', 'resource', 'project', 'system'],
    default: 'system',
    name: 'evidence_type',
  })
  evidenceType: EvaluationEvidenceType;

  @Column({ type: 'varchar', length: 80, nullable: true, name: 'source_type' })
  sourceType: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true, name: 'source_id' })
  sourceId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'skill_name' })
  skillName: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'summary' })
  summary: string | null;

  @Column({ type: 'json', nullable: true, name: 'payload_json' })
  payloadJson: Record<string, any> | null;
}

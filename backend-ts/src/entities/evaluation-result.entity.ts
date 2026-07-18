import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type EvaluationEvaluatorType = 'objective' | 'llm' | 'hybrid' | 'system';

@Entity('evaluation_results_v3')
@Index(['userId', 'attemptId'])
@Index(['userId', 'skillName'])
export class EvaluationResult extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'bigint', name: 'attempt_id' })
  attemptId: number;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'skill_name' })
  skillName: string | null;

  @Column({
    type: 'enum',
    enum: ['objective', 'llm', 'hybrid', 'system'],
    default: 'system',
    name: 'evaluator_type',
  })
  evaluatorType: EvaluationEvaluatorType;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'evaluator_name' })
  evaluatorName: string | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0, name: 'score' })
  score: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 100, name: 'max_score' })
  maxScore: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0, name: 'normalized_score' })
  normalizedScore: number;

  @Column({ type: 'varchar', length: 40, nullable: true, name: 'level' })
  level: string | null;

  @Column({ type: 'tinyint', nullable: true, name: 'passed' })
  passed: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0.7, name: 'confidence' })
  confidence: number;

  @Column({ type: 'varchar', length: 600, nullable: true, name: 'summary' })
  summary: string | null;

  @Column({ type: 'json', nullable: true, name: 'feedback_json' })
  feedbackJson: Record<string, any> | null;

  @Column({ type: 'json', nullable: true, name: 'raw_result_json' })
  rawResultJson: Record<string, any> | null;

  @Column({ type: 'varchar', length: 120, default: 'default_skill_v1', name: 'rubric_key' })
  rubricKey: string;

  @Column({ type: 'varchar', length: 40, default: '1.0.0', name: 'rubric_version' })
  rubricVersion: string;
}

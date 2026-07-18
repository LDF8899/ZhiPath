import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('evaluation_dimension_scores_v3')
@Index(['userId', 'attemptId'])
@Index(['resultId'])
export class EvaluationDimensionScore extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'bigint', name: 'attempt_id' })
  attemptId: number;

  @Column({ type: 'bigint', name: 'result_id' })
  resultId: number;

  @Column({ type: 'varchar', length: 120, name: 'dimension_key' })
  dimensionKey: string;

  @Column({ type: 'varchar', length: 120, name: 'dimension_name' })
  dimensionName: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0, name: 'score' })
  score: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 100, name: 'max_score' })
  maxScore: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0, name: 'normalized_score' })
  normalizedScore: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 1, name: 'weight' })
  weight: number;

  @Column({ type: 'varchar', length: 20, default: 'stable', name: 'trend' })
  trend: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'detail' })
  detail: string | null;

  @Column({ type: 'json', nullable: true, name: 'evidence_refs_json' })
  evidenceRefsJson: any[] | null;
}

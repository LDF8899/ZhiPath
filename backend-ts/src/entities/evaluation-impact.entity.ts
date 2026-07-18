import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('evaluation_impacts_v3')
@Index(['userId', 'attemptId'])
@Index(['commitId'])
export class EvaluationImpact extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'bigint', name: 'attempt_id' })
  attemptId: number;

  @Column({ type: 'bigint', nullable: true, name: 'result_id' })
  resultId: number | null;

  @Column({ type: 'bigint', nullable: true, name: 'commit_id' })
  commitId: number | null;

  @Column({ type: 'bigint', nullable: true, name: 'snapshot_id' })
  snapshotId: number | null;

  @Column({ type: 'bigint', nullable: true, name: 'branch_id' })
  branchId: number | null;

  @Column({ type: 'json', nullable: true, name: 'skill_changes_json' })
  skillChangesJson: any[] | null;

  @Column({ type: 'json', nullable: true, name: 'radar_changes_json' })
  radarChangesJson: any[] | null;

  @Column({ type: 'json', nullable: true, name: 'metrics_change_json' })
  metricsChangeJson: Record<string, any> | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0, name: 'match_score_delta' })
  matchScoreDelta: number;

  @Column({ type: 'json', nullable: true, name: 'next_actions_json' })
  nextActionsJson: any[] | null;
}

import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('skill_snapshots_v3')
@Index(['userId', 'branchId'])
@Index(['commitId'])
export class SkillSnapshotV3 extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'bigint', name: 'branch_id' })
  branchId: number;

  @Column({ type: 'bigint', name: 'commit_id' })
  commitId: number;

  @Column({ type: 'json', name: 'skills_json' })
  skillsJson: any[];

  @Column({ type: 'json', name: 'radar_json' })
  radarJson: any[];

  @Column({ type: 'json', nullable: true, name: 'ability_metrics_json' })
  abilityMetricsJson: Record<string, any> | null;

  @Column({ type: 'json', nullable: true, name: 'match_summary_json' })
  matchSummaryJson: Record<string, any> | null;

  @Column({ type: 'int', default: 0, name: 'total_mastery' })
  totalMastery: number;

  @Column({ type: 'int', default: 0, name: 'skill_count' })
  skillCount: number;

  @Column({ type: 'int', default: 0, name: 'depth_score' })
  depthScore: number;

  @Column({ type: 'int', default: 0, name: 'breadth_score' })
  breadthScore: number;

  @Column({ type: 'int', default: 0, name: 'balance_score' })
  balanceScore: number;
}

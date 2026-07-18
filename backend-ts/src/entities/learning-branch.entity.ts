import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type LearningBranchType = 'main' | 'side' | 'experiment';

@Entity('learning_branches_v3')
@Index(['userId', 'status'])
@Index(['userId', 'branchType'])
export class LearningBranch extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', length: 120, name: 'branch_name' })
  branchName: string;

  @Column({
    type: 'enum',
    enum: ['main', 'side', 'experiment'],
    default: 'main',
    name: 'branch_type',
  })
  branchType: LearningBranchType;

  @Column({ type: 'bigint', nullable: true, name: 'base_commit_id' })
  baseCommitId: number | null;

  @Column({ type: 'bigint', nullable: true, name: 'head_commit_id' })
  headCommitId: number | null;

  @Column({ type: 'bigint', nullable: true, name: 'source_branch_id' })
  sourceBranchId: number | null;

  @Column({ type: 'bigint', nullable: true, name: 'merged_at' })
  mergedAt: number | null;
}

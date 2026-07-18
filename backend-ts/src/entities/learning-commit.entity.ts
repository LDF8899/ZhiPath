import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type LearningCommitType =
  | 'baseline'
  | 'lecture_read'
  | 'quiz_passed'
  | 'quiz_failed'
  | 'code_done'
  | 'skill_complete'
  | 'task_done'
  | 'manual'
  | 'merge'
  | 'rollback';

@Entity('learning_commits_v3')
@Index(['userId', 'branchId'])
@Index(['branchId', 'parentCommitId'])
export class LearningCommit extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'bigint', name: 'branch_id' })
  branchId: number;

  @Column({ type: 'bigint', nullable: true, name: 'parent_commit_id' })
  parentCommitId: number | null;

  @Column({ type: 'bigint', nullable: true, name: 'merge_source_commit_id' })
  mergeSourceCommitId: number | null;

  @Column({
    type: 'enum',
    enum: ['baseline', 'lecture_read', 'quiz_passed', 'quiz_failed', 'code_done', 'skill_complete', 'task_done', 'manual', 'merge', 'rollback'],
    default: 'manual',
    name: 'commit_type',
  })
  commitType: LearningCommitType;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'skill_name' })
  skillName: string | null;

  @Column({ type: 'varchar', length: 240, name: 'message' })
  message: string;

  @Column({ type: 'json', nullable: true, name: 'payload_json' })
  payloadJson: Record<string, any> | null;

  @Column({ type: 'bigint', nullable: true, name: 'snapshot_id' })
  snapshotId: number | null;

  @Column({ type: 'json', nullable: true, name: 'delta_json' })
  deltaJson: Record<string, any> | null;
}

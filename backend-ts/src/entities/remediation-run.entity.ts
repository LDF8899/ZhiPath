import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/** 补强出题记录 — 记录一次补强时的"补强前"掌握度，答完/当前掌握度对照得出补强效果。 */
@Entity('remediation_runs')
@Index('idx_remediation_run_user_time', ['userId', 'createTime'])
export class RemediationRun extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'json', nullable: true })
  topics: Array<{ label: string; beforeMastery: number }> | null;

  @Column({ type: 'bigint', nullable: true, name: 'task_id' })
  taskId: number | null;

  @Column({ type: 'varchar', length: 20, default: 'pending', name: 'run_status' })
  runStatus: string;
}

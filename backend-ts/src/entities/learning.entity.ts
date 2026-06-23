import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * 学习计划表 v3.0 — learning_plans_v3
 * 多计划 + Git 分支模型 §2.1-2.3
 */
@Entity('learning_plans_v3')
export class LearningPlan extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', length: 100, default: 'Default Plan', name: 'plan_name', comment: '计划名称' })
  planName: string;

  @Column({ type: 'enum', enum: ['main', 'side'], default: 'main', name: 'plan_type', comment: '主线/支线 §4.3' })
  planType: 'main' | 'side';

  @Column({ type: 'bigint', nullable: true, name: 'target_job_id', comment: '目标岗位' })
  targetJobId: number;

  @Column({ type: 'json', nullable: true, name: 'path_data', comment: '阶段→技能点→资源' })
  pathData: Record<string, any> | null;

  @Column({ type: 'int', default: 0, name: 'current_phase', comment: '当前阶段索引' })
  currentPhase: number;

  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true, name: 'daily_hours', comment: '本计划每日时长' })
  dailyHours: number;

  @Column({ type: 'tinyint', default: 80, name: 'main_ratio', comment: '主线占比 %' })
  mainRatio: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'match_score', comment: '当前匹配度' })
  matchScore: number;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'estimated_date', comment: '预计达成日期' })
  estimatedDate: string;

  @Column({ type: 'bigint', nullable: true, name: 'branch_from', comment: '分支来源计划ID Git模型 §2.3' })
  branchFrom: number;
}

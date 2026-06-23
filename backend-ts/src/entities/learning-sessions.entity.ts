import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * 学习会话记录表 v3.0 — learning_sessions_v3
 * Git commit 模型 §11 + 持久化 §17.1
 */
@Entity('learning_sessions_v3')
export class LearningSession extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'bigint', nullable: true, name: 'plan_id', comment: '关联计划' })
  planId: number;

  @Column({ type: 'varchar', length: 20, name: 'session_date', comment: '日期 YYYY-MM-DD' })
  sessionDate: string;

  @Column({ type: 'bigint', nullable: true, name: 'started_at', comment: '会话开始时间戳' })
  startedAt: number;

  @Column({ type: 'bigint', nullable: true, name: 'ended_at', comment: '会话结束时间戳' })
  endedAt: number;

  @Column({ type: 'bigint', default: 0, name: 'total_duration_ms', comment: '总学习时长ms' })
  totalDurationMs: number;

  @Column({ type: 'json', nullable: true, name: 'tasks_snapshot', comment: '当日任务完成快照 §11.1' })
  tasksSnapshot: Record<string, any> | null;

  @Column({ type: 'json', nullable: true, name: 'skill_changes', comment: '技能变化 [{name,before,after}]' })
  skillChanges: Array<{ name: string; before: number; after: number }> | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'match_score_before' })
  matchScoreBefore: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'match_score_after' })
  matchScoreAfter: number;
}

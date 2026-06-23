import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * 每日学习任务表 v3.0 — learning_tasks_v3
 * 任务状态机 §16.3 + 拖拽排序 §9.3
 */
@Entity('learning_tasks_v3')
export class LearningTask extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'bigint', name: 'plan_id', comment: '关联 learning_plans_v3' })
  planId: number;

  @Column({ type: 'varchar', length: 100, name: 'skill_name', comment: '技能名称' })
  skillName: string;

  @Column({ type: 'enum', enum: ['main', 'side'], default: 'main', name: 'task_type', comment: '主线/支线' })
  taskType: 'main' | 'side';

  @Column({
    type: 'enum',
    enum: ['pending', 'in_progress', 'lecture_done', 'practice_done', 'code_done', 'exam_done', 'skipped', 'done'],
    default: 'pending',
    name: 'task_status',
    comment: '状态机 §16.3',
  })
  taskStatus: 'pending' | 'in_progress' | 'lecture_done' | 'practice_done' | 'code_done' | 'exam_done' | 'skipped' | 'done';

  @Column({ type: 'int', nullable: true, name: 'estimated_min', comment: '预估时长(分钟)' })
  estimatedMin: number;

  @Column({ type: 'int', nullable: true, name: 'actual_min', comment: '实际时长(分钟)' })
  actualMin: number;

  @Column({ type: 'int', default: 0, name: 'sort_order', comment: '排序(支持拖拽)' })
  sortOrder: number;

  @Column({ type: 'tinyint', default: 5, name: 'priority', comment: '优先级1-10' })
  priority: number;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'plan_date', comment: '安排日期 YYYY-MM-DD' })
  planDate: string;

  @Column({ type: 'bigint', nullable: true, name: 'start_time', comment: '开始时间戳' })
  startTime: number;

  @Column({ type: 'bigint', nullable: true, name: 'complete_time', comment: '完成时间戳' })
  completeTime: number;

  @Column({ type: 'tinyint', default: 1, name: 'is_active', comment: '1=有效 0=删除' })
  isActive: number;
}

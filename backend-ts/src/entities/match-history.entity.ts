import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('match_history_v3')
@Index(['userId', 'jobId'])
@Index(['createdAt'])
export class MatchHistory {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'int', comment: '用户ID' })
  userId: number;

  @Column({ type: 'int', comment: '岗位ID' })
  jobId: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, comment: '匹配度分数' })
  score: number;

  @Column({ type: 'json', nullable: true, comment: '各因子分数快照' })
  breakdown: any;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '触发事件：task_completed/exam_passed/skill_added/...' })
  triggerEvent: string;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;
}

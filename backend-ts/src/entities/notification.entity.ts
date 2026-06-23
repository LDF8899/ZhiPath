import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * 通知表 v3.0 — notifications_v3
 * §25 通知系统：学习提醒/进度/岗位/考试/系统
 */
@Entity('notifications_v3')
export class Notification extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({
    type: 'enum',
    enum: ['learning', 'progress', 'job', 'exam', 'system'],
    name: 'type',
  })
  type: 'learning' | 'progress' | 'job' | 'exam' | 'system';

  @Column({ type: 'varchar', length: 200, name: 'title' })
  title: string;

  @Column({ type: 'text', nullable: true, name: 'content' })
  content: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'link', comment: '点击跳转路径' })
  link: string;

  @Column({ type: 'tinyint', default: 0, name: 'is_read', comment: '0=未读 1=已读' })
  isRead: number;
}

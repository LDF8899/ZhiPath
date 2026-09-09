import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * 规范通知表 — notifications
 * §25 通知系统：学习提醒/进度/岗位/考试/系统
 */
@Entity('notifications')
export class Notification extends BaseEntity {
  /** 业务租户隔离键。所有 v1 查询必须带上该字段。 */
  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  /** 产生通知的前端客户端；后台任务产生时允许为空。 */
  @Column({ type: 'bigint', nullable: true, name: 'client_app_id' })
  clientAppId: number | null;

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

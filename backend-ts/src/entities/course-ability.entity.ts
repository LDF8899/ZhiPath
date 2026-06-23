import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('course_abilities_v3')
export class CourseAbility {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ name: 'plan_id', type: 'bigint' })
  planId: number;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'tinyint', default: 1 })
  status: number;

  @Column({ name: 'create_time', type: 'bigint', nullable: true })
  createTime: number;

  @Column({ name: 'update_time', type: 'bigint', nullable: true })
  updateTime: number;
}

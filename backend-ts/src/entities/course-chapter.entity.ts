import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('course_chapters_v3')
export class CourseChapter {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ name: 'plan_id', type: 'bigint' })
  planId: number;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'tinyint', default: 0 })
  level: number;  // 0=根, 1=章, 2=节

  @Column({ name: 'parent_id', type: 'bigint', nullable: true })
  parentId: number | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'skill_name', type: 'varchar', length: 100, nullable: true })
  skillName: string | null;

  @Column({ name: 'ability_id', type: 'bigint', nullable: true })
  abilityId: number | null;

  @Column({ type: 'tinyint', default: 1 })
  status: number;

  @Column({ name: 'create_time', type: 'bigint', nullable: true })
  createTime: number;

  @Column({ name: 'update_time', type: 'bigint', nullable: true })
  updateTime: number;
}

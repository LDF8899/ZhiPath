import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * 用户表 v3.0 — 统一 users_v3
 * bcrypt 密码 + role 字段替代 group 体系
 */
@Entity('users_v3')
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 100, name: 'username' })
  username: string;

  @Column({ type: 'varchar', length: 255, name: 'password', comment: 'bcrypt hash' })
  password: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'real_name' })
  realName: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'phone' })
  phone: string;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'email' })
  email: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'avatar' })
  avatar: string;

  @Column({ type: 'enum', enum: ['admin', 'student'], default: 'student', name: 'role' })
  role: 'admin' | 'student';

  @Column({ type: 'tinyint', default: 1, name: 'status', comment: '1=正常 0=禁用' })
  status: number;
}

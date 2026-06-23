import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 系统配置表 v3.0 — system_config_v3
 * 不继承 BaseEntity（无 status 列）
 */
@Entity('system_config_v3')
export class SystemConfig {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 200, name: 'config_key' })
  configKey: string;

  @Column({ type: 'text', nullable: true, name: 'config_value' })
  configValue: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'description' })
  description: string;

  @Column({ type: 'bigint', nullable: true, name: 'create_time' })
  createTime: number;

  @Column({ type: 'bigint', nullable: true, name: 'update_time' })
  updateTime: number;
}

/**
 * 操作日志表 v3.0 — operation_logs_v3
 */
@Entity('operation_logs_v3')
export class OperationLog {
  @Column({ type: 'bigint', primary: true, generated: true })
  id: number;

  @Column({ type: 'bigint', nullable: true, name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'action' })
  action: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'module' })
  module: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'ip' })
  ip: string;

  @Column({ type: 'text', nullable: true, name: 'detail' })
  detail: string;

  @Column({ type: 'bigint', nullable: true, name: 'create_time' })
  createTime: number;
}

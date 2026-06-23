import { PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * 实体基类 — v3.0 简化版
 * 提供 id + create_time + update_time（snake_case 列名）
 * 移除 state / unitId（不再使用软删除和租户字段）
 */
export abstract class BaseEntity {
  @Column({ type: 'tinyint', default: 1, name: 'status', comment: '1=正常 0=删除' })
  status: number;
  @PrimaryGeneratedColumn({ type: 'bigint', comment: '主键ID' })
  id: number;

  @Column({ type: 'bigint', nullable: true, name: 'create_time', comment: '创建时间戳ms' })
  createTime: number;

  @Column({ type: 'bigint', nullable: true, name: 'update_time', comment: '更新时间戳ms' })
  updateTime: number;
}

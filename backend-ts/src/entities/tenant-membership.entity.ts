import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tenant_memberships')
@Index('uq_tenant_memberships_tenant_user', ['tenantId', 'userId'], { unique: true })
export class TenantMembership {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', length: 64, name: 'role_key' })
  roleKey: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ type: 'datetime', precision: 3, name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'datetime', precision: 3, name: 'updated_at' })
  updatedAt: Date;
}

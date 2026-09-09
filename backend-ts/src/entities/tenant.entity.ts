import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 64, unique: true, name: 'tenant_key' })
  tenantKey: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 32, name: 'tenant_type' })
  tenantType: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ type: 'varchar', length: 64, default: 'free', name: 'plan_code' })
  planCode: string;

  @Column({ type: 'json', name: 'quota_config_json' })
  quotaConfig: Record<string, unknown>;

  @Column({ type: 'datetime', precision: 3, name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'datetime', precision: 3, name: 'updated_at' })
  updatedAt: Date;
}

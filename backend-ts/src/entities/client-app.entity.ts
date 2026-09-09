import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('client_apps')
export class ClientApp {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 64, unique: true, name: 'client_key' })
  clientKey: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: 'active' | 'disabled';

  @Column({ type: 'bigint', nullable: true, name: 'default_tenant_id' })
  defaultTenantId: number | null;

  @Column({ type: 'int', default: 1, name: 'config_version' })
  configVersion: number;

  @Column({ type: 'json', name: 'allowed_origins_json' })
  allowedOrigins: string[];

  @Column({ type: 'json', name: 'theme_config_json' })
  themeConfig: Record<string, unknown>;

  @Column({ type: 'datetime', precision: 3, name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'datetime', precision: 3, name: 'updated_at' })
  updatedAt: Date;
}

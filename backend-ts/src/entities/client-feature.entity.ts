import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('client_features')
@Index('uq_client_features_app_key', ['clientAppId', 'featureKey'], {
  unique: true,
})
export class ClientFeature {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', name: 'client_app_id' })
  clientAppId: number;

  @Column({ type: 'varchar', length: 100, name: 'feature_key' })
  featureKey: string;

  @Column({ type: 'tinyint', default: 1 })
  enabled: number;

  @Column({ type: 'json', nullable: true, name: 'config_json' })
  config: Record<string, unknown> | null;

  @Column({ type: 'tinyint', unsigned: true, default: 100, name: 'rollout_percent' })
  rolloutPercent: number;

  @Column({ type: 'datetime', precision: 3, name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'datetime', precision: 3, name: 'updated_at' })
  updatedAt: Date;
}

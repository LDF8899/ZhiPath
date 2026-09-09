import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('user_client_preferences')
@Index('uq_user_client_preferences_scope', ['userId', 'clientAppId', 'tenantId'], {
  unique: true,
})
export class UserClientPreference {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'bigint', name: 'client_app_id' })
  clientAppId: number;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'varchar', length: 32, default: 'pending', name: 'onboarding_state' })
  onboardingState: string;

  @Column({ type: 'varchar', length: 16, default: 'zh-CN' })
  locale: string;

  @Column({ type: 'json', name: 'preference_json' })
  preference: Record<string, unknown>;

  @Column({ type: 'datetime', precision: 3, name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'datetime', precision: 3, name: 'updated_at' })
  updatedAt: Date;
}

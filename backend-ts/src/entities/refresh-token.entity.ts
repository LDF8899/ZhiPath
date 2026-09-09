import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'char', length: 64, unique: true, name: 'token_hash' })
  tokenHash: string;

  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'bigint', name: 'client_app_id' })
  clientAppId: number;

  @Column({ type: 'datetime', precision: 3, name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'datetime', precision: 3, nullable: true, name: 'revoked_at' })
  revokedAt: Date | null;

  @Column({ type: 'datetime', precision: 3, name: 'created_at' })
  createdAt: Date;
}

import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('roles')
export class PlatformRole {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 64, unique: true, name: 'role_key' })
  roleKey: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20, default: 'tenant' })
  scope: string;
}

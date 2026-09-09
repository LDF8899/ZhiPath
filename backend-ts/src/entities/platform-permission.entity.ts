import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('permissions')
export class PlatformPermission {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true, name: 'permission_key' })
  permissionKey: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;
}

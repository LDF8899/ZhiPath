import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('role_permissions')
export class RolePermission {
  @PrimaryColumn({ type: 'bigint', name: 'role_id' })
  roleId: number;

  @PrimaryColumn({ type: 'bigint', name: 'permission_id' })
  permissionId: number;
}

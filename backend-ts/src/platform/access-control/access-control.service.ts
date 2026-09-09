import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { TenantMembership } from '../../entities/tenant-membership.entity';

export interface IdentityAccessContext {
  tenant: { id: number; key: string; name: string; type: string } | null;
  membershipId: number | null;
  roles: string[];
  scopes: string[];
}

@Injectable()
export class AccessControlService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(TenantMembership)
    private readonly membershipRepo: Repository<TenantMembership>,
    private readonly dataSource: DataSource,
  ) {}

  async getIdentityContext(userId: number, tenantId?: number): Promise<IdentityAccessContext> {
    const where: Record<string, unknown> = { userId, status: 'active' };
    if (tenantId) where.tenantId = tenantId;
    const membership = await this.membershipRepo.findOne({
      where,
      order: { id: 'ASC' },
    });
    if (!membership) {
      return { tenant: null, membershipId: null, roles: [], scopes: [] };
    }

    const [tenant, permissionRows] = await Promise.all([
      this.tenantRepo.findOne({ where: { id: membership.tenantId, status: 'active' } }),
      this.dataSource.query(
        `SELECT p.permission_key AS permissionKey
           FROM roles r
           JOIN role_permissions rp ON rp.role_id = r.id
           JOIN permissions p ON p.id = rp.permission_id
          WHERE r.role_key = ?
          ORDER BY p.permission_key`,
        [membership.roleKey],
      ),
    ]);

    return {
      tenant: tenant
        ? { id: Number(tenant.id), key: tenant.tenantKey, name: tenant.name, type: tenant.tenantType }
        : null,
      membershipId: Number(membership.id),
      roles: [membership.roleKey],
      scopes: permissionRows.map((row: { permissionKey: string }) => row.permissionKey),
    };
  }

  async addDefaultMembership(userId: number, roleKey = 'student'): Promise<void> {
    const tenant = await this.tenantRepo.findOne({
      where: { tenantKey: 'platform-default', status: 'active' },
    });
    if (!tenant) return;
    const existing = await this.membershipRepo.findOne({
      where: { tenantId: tenant.id, userId },
    });
    if (existing) return;
    const now = new Date();
    await this.membershipRepo.save({
      tenantId: tenant.id,
      userId,
      roleKey,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }
}

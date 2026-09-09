import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { TenantMembership } from '../../entities/tenant-membership.entity';
import { AccessControlService } from './access-control.service';
import { ScopesGuard } from './scopes.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Tenant, TenantMembership])],
  providers: [AccessControlService, ScopesGuard],
  exports: [AccessControlService, ScopesGuard],
})
export class AccessControlModule {}

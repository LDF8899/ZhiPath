import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientApp } from '../../entities/client-app.entity';
import { ClientFeature } from '../../entities/client-feature.entity';
import { UserClientPreference } from '../../entities/user-client-preference.entity';
import { ClientAdminController } from './client-admin.controller';
import { ClientExperienceController } from './client-experience.controller';
import { ClientExperienceService } from './client-experience.service';
import { ClientOriginPolicyService } from './client-origin-policy.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClientApp, ClientFeature, UserClientPreference])],
  controllers: [ClientExperienceController, ClientAdminController],
  providers: [ClientExperienceService, ClientOriginPolicyService],
  exports: [ClientExperienceService, ClientOriginPolicyService],
})
export class ClientExperienceModule {}

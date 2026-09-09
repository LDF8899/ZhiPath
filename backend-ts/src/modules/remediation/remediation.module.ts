import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillModule } from '../skill/skill.module';
import { QuestionGenerationModule } from '../question-generation/question-generation.module';
import { RemediationRun } from '../../entities/remediation-run.entity';
import { RemediationController } from './remediation.controller';
import { RemediationV1Controller } from './remediation-v1.controller';
import { RemediationService } from './remediation.service';
import { TransactionalCommandService } from '../../platform/transactional-command/transactional-command.service';

@Module({
  imports: [SkillModule, QuestionGenerationModule, TypeOrmModule.forFeature([RemediationRun])],
  controllers: [RemediationController, RemediationV1Controller],
  providers: [RemediationService, TransactionalCommandService],
  exports: [RemediationService],
})
export class RemediationModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillModule } from '../skill/skill.module';
import { QuestionGenerationModule } from '../question-generation/question-generation.module';
import { RemediationRun } from '../../entities/remediation-run.entity';
import { RemediationController } from './remediation.controller';
import { RemediationService } from './remediation.service';

@Module({
  imports: [SkillModule, QuestionGenerationModule, TypeOrmModule.forFeature([RemediationRun])],
  controllers: [RemediationController],
  providers: [RemediationService],
  exports: [RemediationService],
})
export class RemediationModule {}

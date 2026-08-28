import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningPlan } from '../entities/learning.entity';
import { LearningAssessmentContextService } from './learning-assessment-context.service';
import { LearningDomainRegistry } from './learning-domain.registry';

@Module({
  imports: [TypeOrmModule.forFeature([LearningPlan])],
  providers: [LearningDomainRegistry, LearningAssessmentContextService],
  exports: [LearningDomainRegistry, LearningAssessmentContextService],
})
export class LearningDomainModule {}

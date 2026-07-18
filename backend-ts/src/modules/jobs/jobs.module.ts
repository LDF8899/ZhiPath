import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobPosition, JobApplication } from '../../entities/job.entity';
import { Student } from '../../entities/student.entity';
import { Enterprise } from '../../entities/enterprise.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { MatchModule } from '../match/match.module';
import { SkillModule } from '../skill/skill.module';
import { JobSearchService } from '../../services/job-search.service';
import { LlmService } from '../../services/llm.service';

@Module({
  imports: [TypeOrmModule.forFeature([JobPosition, JobApplication, Student, Enterprise, LearningPlan]), MatchModule, SkillModule],
  controllers: [JobsController],
  providers: [JobsService, JobSearchService, LlmService],
  exports: [JobsService],
})
export class JobsModule {}

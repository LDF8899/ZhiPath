import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobPosition, JobApplication } from '../../entities/job.entity';
import { Student } from '../../entities/student.entity';
import { Enterprise } from '../../entities/enterprise.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { MatchModule } from '../match/match.module';

@Module({
  imports: [TypeOrmModule.forFeature([JobPosition, JobApplication, Student, Enterprise, LearningPlan]), MatchModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}

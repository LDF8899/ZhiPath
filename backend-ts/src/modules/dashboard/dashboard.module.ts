import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Student } from '../../entities/student.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { LearningTask } from '../../entities/learning-tasks.entity';
import { JobPosition, JobApplication } from '../../entities/job.entity';
import { News } from '../../entities/news.entity';
import { ExamRecord } from '../../entities/exam.entity';
import { TaskSchedulerModule } from '../task-scheduler/task-scheduler.module';
import { MatchModule } from '../match/match.module';

@Module({
  imports: [TypeOrmModule.forFeature([Student, LearningPlan, LearningTask, JobPosition, News, ExamRecord, JobApplication]), TaskSchedulerModule, MatchModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

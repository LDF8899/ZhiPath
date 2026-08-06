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
import { GeneratedResource } from '../../entities/generated-resource.entity';
import { Resume } from '../../entities/resume.entity';
import { EvaluationResult } from '../../entities/evaluation-result.entity';
import { LearningCommit } from '../../entities/learning-commit.entity';
import { TaskSchedulerModule } from '../task-scheduler/task-scheduler.module';
import { MatchModule } from '../match/match.module';
import { SkillModule } from '../skill/skill.module';
import { EvidenceModule } from '../evidence/evidence.module';

@Module({
  imports: [TypeOrmModule.forFeature([Student, LearningPlan, LearningTask, JobPosition, News, ExamRecord, JobApplication, GeneratedResource, Resume, EvaluationResult, LearningCommit]), TaskSchedulerModule, MatchModule, SkillModule, EvidenceModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

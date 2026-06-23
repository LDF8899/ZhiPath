import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningPlan } from '../../entities/learning.entity';
import { LearningTask } from '../../entities/learning-tasks.entity';
import { Student } from '../../entities/student.entity';
import { TaskSchedulerService } from '../../services/task-scheduler.service';
import { SkillModule } from '../skill/skill.module';

/**
 * TaskScheduler 模块 — 学习任务调度
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([LearningPlan, LearningTask, Student]),
    SkillModule,
  ],
  providers: [TaskSchedulerService],
  exports: [TaskSchedulerService],
})
export class TaskSchedulerModule {}

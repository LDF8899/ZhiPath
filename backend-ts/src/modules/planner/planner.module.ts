import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobPosition } from '../../entities/job.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { LearningTask } from '../../entities/learning-tasks.entity';
import { Student } from '../../entities/student.entity';
import { PlannerAgentService } from '../../services/planner-agent.service';
import { SkillModule } from '../skill/skill.module';
import { QueueModule } from '../queue/queue.module';

/**
 * PlannerAgent 模块 — 学习路径 LLM 生成
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([JobPosition, LearningPlan, LearningTask, Student]),
    SkillModule,
    QueueModule,
  ],
  providers: [PlannerAgentService],
  exports: [PlannerAgentService],
})
export class PlannerModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { Student } from '../../entities/student.entity';
import { UserSkill } from '../../entities/user-skills.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { LearningTask } from '../../entities/learning-tasks.entity';
import { JobPosition } from '../../entities/job.entity';
import { ProfileService } from '../../services/profile.service';
import { SkillModule } from '../skill/skill.module';
import { PlannerModule } from '../planner/planner.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [TypeOrmModule.forFeature([Student, UserSkill, LearningPlan, LearningTask, JobPosition]), SkillModule, PlannerModule, QueueModule],
  controllers: [StudentController],
  providers: [StudentService, ProfileService],
  exports: [StudentService],
})
export class StudentModule {}

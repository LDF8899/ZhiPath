import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { Student } from '../../entities/student.entity';
import { UserSkill } from '../../entities/user-skills.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { JobPosition } from '../../entities/job.entity';
import { ProfileService } from '../../services/profile.service';
import { SkillModule } from '../skill/skill.module';
import { PlannerModule } from '../planner/planner.module';
import { GitLearningModule } from '../git-learning/git-learning.module';
import { LearningDomainModule } from '../../domains/learning-domain.module';

@Module({
  imports: [TypeOrmModule.forFeature([Student, UserSkill, LearningPlan, JobPosition]), SkillModule, PlannerModule, GitLearningModule, LearningDomainModule],
  controllers: [StudentController],
  providers: [StudentService, ProfileService],
  exports: [StudentService],
})
export class StudentModule {}

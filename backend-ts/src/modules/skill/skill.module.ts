import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSkill } from '../../entities/user-skills.entity';
import { Student } from '../../entities/student.entity';
import { LearningCommit } from '../../entities/learning-commit.entity';
import { EvaluationResult } from '../../entities/evaluation-result.entity';
import { Resume } from '../../entities/resume.entity';
import { JobPosition } from '../../entities/job.entity';
import { SkillService } from '../../services/skill.service';
import { SkillController } from './skill.controller';
import { EvidenceModule } from '../evidence/evidence.module';

/**
 * 技能模块 — 管理 user_skills_v3
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserSkill, Student, LearningCommit, EvaluationResult, Resume, JobPosition]), EvidenceModule],
  controllers: [SkillController],
  providers: [SkillService],
  exports: [SkillService],
})
export class SkillModule {}

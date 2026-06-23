import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSkill } from '../../entities/user-skills.entity';
import { Student } from '../../entities/student.entity';
import { SkillService } from '../../services/skill.service';
import { SkillController } from './skill.controller';

/**
 * 技能模块 — 管理 user_skills_v3
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserSkill, Student])],
  controllers: [SkillController],
  providers: [SkillService],
  exports: [SkillService],
})
export class SkillModule {}

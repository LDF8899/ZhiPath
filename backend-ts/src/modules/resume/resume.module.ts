import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resume } from '../../entities/resume.entity';
import { Student } from '../../entities/student.entity';
import { JobPosition } from '../../entities/job.entity';
import { ResumeAgentService } from '../../services/resume-agent.service';
import { PdfService } from '../../services/pdf.service';
import { ResumeController } from './resume.controller';
import { SkillModule } from '../skill/skill.module';
import { LlmService } from '../../services/llm.service';

/**
 * 简历模块 — 简历生成与管理
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Resume, Student, JobPosition]),
    SkillModule,
  ],
  controllers: [ResumeController],
  providers: [ResumeAgentService, LlmService, PdfService],
  exports: [ResumeAgentService],
})
export class ResumeModule {}

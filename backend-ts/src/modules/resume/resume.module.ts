import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resume } from '../../entities/resume.entity';
import { Student } from '../../entities/student.entity';
import { JobPosition } from '../../entities/job.entity';
import { ResumeAgentService } from '../../services/resume-agent.service';
import { PdfService } from '../../services/pdf.service';
import { ResumeController } from './resume.controller';
import { SkillModule } from '../skill/skill.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { LlmService } from '../../services/llm.service';
import { ResumeV1Controller } from './resume-v1.controller';

/**
 * 简历模块 — 简历生成与管理
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Resume, Student, JobPosition]),
    SkillModule,
    EvidenceModule,
  ],
  controllers: [ResumeController, ResumeV1Controller],
  providers: [ResumeAgentService, LlmService, PdfService],
  exports: [ResumeAgentService],
})
export class ResumeModule {}

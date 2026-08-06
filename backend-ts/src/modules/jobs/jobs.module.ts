import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobPosition, JobApplication } from '../../entities/job.entity';
import { Student } from '../../entities/student.entity';
import { Enterprise } from '../../entities/enterprise.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { LearningBranch } from '../../entities/learning-branch.entity';
import { LearningCommit } from '../../entities/learning-commit.entity';
import { SkillSnapshotV3 } from '../../entities/skill-snapshot-v3.entity';
import { MatchModule } from '../match/match.module';
import { SkillModule } from '../skill/skill.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { JobSearchService } from '../../services/job-search.service';
import { SearchStackService } from '../../services/search-stack.service';
import { LlmService } from '../../services/llm.service';

@Module({
  imports: [TypeOrmModule.forFeature([JobPosition, JobApplication, Student, Enterprise, LearningPlan, LearningBranch, LearningCommit, SkillSnapshotV3]), MatchModule, SkillModule, EvidenceModule],
  controllers: [JobsController],
  providers: [JobsService, JobSearchService, SearchStackService, LlmService],
  exports: [JobsService],
})
export class JobsModule {}

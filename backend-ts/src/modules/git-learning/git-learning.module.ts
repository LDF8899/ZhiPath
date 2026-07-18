import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningBranch } from '../../entities/learning-branch.entity';
import { LearningCommit } from '../../entities/learning-commit.entity';
import { SkillSnapshotV3 } from '../../entities/skill-snapshot-v3.entity';
import { UserSkill } from '../../entities/user-skills.entity';
import { GitLearningController } from './git-learning.controller';
import { SkillModule } from '../skill/skill.module';
import { MatchModule } from '../match/match.module';
import { EventsModule } from '../events/events.module';
import { SkillSnapshotService } from '../../services/skill-snapshot.service';
import { LearningCommitService } from '../../services/learning-commit.service';
import { BranchService } from '../../services/branch.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LearningBranch, LearningCommit, SkillSnapshotV3, UserSkill]),
    SkillModule,
    MatchModule,
    EventsModule,
  ],
  controllers: [GitLearningController],
  providers: [SkillSnapshotService, LearningCommitService, BranchService],
  exports: [SkillSnapshotService, LearningCommitService, BranchService],
})
export class GitLearningModule {}

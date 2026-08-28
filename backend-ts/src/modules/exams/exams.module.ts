import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { ExamRecord, ExamQuestion } from '../../entities/exam.entity';
import { LearningTask } from '../../entities/learning-tasks.entity';
import { AgentsModule } from '../agents/agents.module';
import { MatchModule } from '../match/match.module';
import { SkillModule } from '../skill/skill.module';
import { GitLearningModule } from '../git-learning/git-learning.module';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { LlmService } from '../../services/llm.service';
import { LearningDomainModule } from '../../domains/learning-domain.module';

@Module({
  imports: [TypeOrmModule.forFeature([ExamRecord, ExamQuestion, LearningTask]), AgentsModule, MatchModule, SkillModule, GitLearningModule, EvaluationModule, LearningDomainModule],
  controllers: [ExamsController],
  providers: [ExamsService, LlmService],
  exports: [ExamsService],
})
export class ExamsModule {}

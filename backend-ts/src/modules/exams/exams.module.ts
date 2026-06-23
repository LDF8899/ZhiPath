import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { ExamRecord, ExamQuestion } from '../../entities/exam.entity';
import { LearningTask } from '../../entities/learning-tasks.entity';
import { AgentsModule } from '../agents/agents.module';
import { MatchModule } from '../match/match.module';
import { SkillModule } from '../skill/skill.module';
import { LlmService } from '../../services/llm.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExamRecord, ExamQuestion, LearningTask]), AgentsModule, MatchModule, SkillModule],
  controllers: [ExamsController],
  providers: [ExamsService, LlmService],
  exports: [ExamsService],
})
export class ExamsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { ExamRecord, ExamQuestion } from '../../entities/exam.entity';
import { AgentsModule } from '../agents/agents.module';
import { MatchModule } from '../match/match.module';
import { SkillModule } from '../skill/skill.module';

@Module({
  imports: [TypeOrmModule.forFeature([ExamRecord, ExamQuestion]), AgentsModule, MatchModule, SkillModule],
  controllers: [ExamsController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}

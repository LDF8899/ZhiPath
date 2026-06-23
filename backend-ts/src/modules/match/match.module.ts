import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobPosition } from '../../entities/job.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { LearningTask } from '../../entities/learning-tasks.entity';
import { ExamRecord } from '../../entities/exam.entity';
import { MatchHistory } from '../../entities/match-history.entity';
import { MatchAgentService } from '../../services/match-agent.service';
import { MatchController } from './match.controller';
import { SkillModule } from '../skill/skill.module';
import { EventsModule } from '../events/events.module';

/**
 * MatchAgent 模块 — 匹配度计算
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([JobPosition, LearningPlan, LearningTask, ExamRecord, MatchHistory]),
    SkillModule,
    EventsModule,
  ],
  controllers: [MatchController],
  providers: [MatchAgentService],
  exports: [MatchAgentService],
})
export class MatchModule {}

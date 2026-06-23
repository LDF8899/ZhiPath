import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningSession } from '../../entities/learning-sessions.entity';
import { LearningTask } from '../../entities/learning-tasks.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { SessionService } from '../../services/session.service';
import { SessionController } from './session.controller';
import { SkillModule } from '../skill/skill.module';

/**
 * LearningSession 模块 — Git Commit 学习记录
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([LearningSession, LearningTask, LearningPlan]),
    SkillModule,
  ],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}

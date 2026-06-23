import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningPlan } from '../../entities/learning.entity';
import { LearningTask } from '../../entities/learning-tasks.entity';
import { ExamRecord } from '../../entities/exam.entity';
import { ProgressController } from './progress.controller';
import { SkillModule } from '../skill/skill.module';
import { NotificationModule } from '../notification/notification.module';
import { LearningProgressService } from '../../services/learning-progress.service';

/**
 * 学习进度模块 — Phase 9 补齐 + §17 三层存储
 *
 * POST /api/user/progress/read     — 阅读讲义完成
 * POST /api/user/progress/quiz     — 习题完成
 * POST /api/user/progress/complete — 技能完成
 * GET  /api/user/progress/summary  — 进度汇总
 * GET  /api/user/progress/restore  — §17.2 恢复学习进度（Redis→MongoDB→MySQL）
 */
@Module({
  imports: [TypeOrmModule.forFeature([LearningPlan, LearningTask, ExamRecord]), SkillModule, NotificationModule],
  controllers: [ProgressController],
  providers: [LearningProgressService],
})
export class ProgressModule {}

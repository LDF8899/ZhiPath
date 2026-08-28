import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamQuestion, ExamRecord } from '../../entities/exam.entity';
import { Student } from '../../entities/student.entity';
import { QuickTestService } from './quick-test.service';
import { QuickTestController } from './quick-test.controller';
import { SkillModule } from '../skill/skill.module';
import { LlmService } from '../../services/llm.service';
import { GitLearningModule } from '../git-learning/git-learning.module';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { LearningDomainModule } from '../../domains/learning-domain.module';

/**
 * 5分钟速测模块
 */
@Module({
  imports: [TypeOrmModule.forFeature([ExamQuestion, ExamRecord, Student]), SkillModule, GitLearningModule, EvaluationModule, LearningDomainModule],
  controllers: [QuickTestController],
  providers: [QuickTestService, LlmService],
})
export class QuickTestModule {}

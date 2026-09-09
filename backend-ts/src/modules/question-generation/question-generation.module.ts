import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmService } from '../../services/llm.service';
import { NotificationModule } from '../notification/notification.module';
import { ExamQuestion } from '../../entities/exam.entity';
import { QuestionGenerationTask } from '../../entities/question-generation-task.entity';
import { QuestionGenerationSnapshot } from '../../entities/question-generation-snapshot.entity';
import { QuestionGenerationController } from './question-generation.controller';
import { QuestionGenerationService } from './question-generation.service';
import { QuestionGenerationV1Controller } from './question-generation-v1.controller';
import { PlatformJobsModule } from '../../domains/platform-jobs/platform-jobs.module';

@Module({
  imports: [TypeOrmModule.forFeature([ExamQuestion, QuestionGenerationTask, QuestionGenerationSnapshot]), NotificationModule, PlatformJobsModule],
  controllers: [QuestionGenerationController, QuestionGenerationV1Controller],
  providers: [LlmService, QuestionGenerationService],
  exports: [QuestionGenerationService],
})
export class QuestionGenerationModule {}

import { Module } from '@nestjs/common';
import { PlatformLearningModule } from '../platform-learning/platform-learning.module';
import { PlatformJobsController } from './platform-jobs.controller';
import { PlatformJobsService } from './platform-jobs.service';

@Module({
  imports: [PlatformLearningModule],
  controllers: [PlatformJobsController],
  providers: [PlatformJobsService],
  exports: [PlatformJobsService],
})
export class PlatformJobsModule {}

import { Module } from '@nestjs/common';
import { PlatformLearningController } from './platform-learning.controller';
import { PlatformLearningService } from './platform-learning.service';
import { TransactionalCommandService } from '../../platform/transactional-command/transactional-command.service';
import { LearningDomainModule } from '../learning-domain.module';

@Module({
  imports: [LearningDomainModule],
  controllers: [PlatformLearningController],
  providers: [PlatformLearningService, TransactionalCommandService],
  exports: [PlatformLearningService, TransactionalCommandService],
})
export class PlatformLearningModule {}

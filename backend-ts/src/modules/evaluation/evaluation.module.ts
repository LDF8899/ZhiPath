import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvaluationAttempt } from '../../entities/evaluation-attempt.entity';
import { EvaluationEvidence } from '../../entities/evaluation-evidence.entity';
import { EvaluationResult } from '../../entities/evaluation-result.entity';
import { EvaluationDimensionScore } from '../../entities/evaluation-dimension-score.entity';
import { EvaluationImpact } from '../../entities/evaluation-impact.entity';
import { EvaluationRubric } from '../../entities/evaluation-rubric.entity';
import { EventsModule } from '../events/events.module';
import { EvaluationController } from './evaluation.controller';
import { EvaluationService } from '../../services/evaluation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EvaluationRubric,
      EvaluationAttempt,
      EvaluationEvidence,
      EvaluationResult,
      EvaluationDimensionScore,
      EvaluationImpact,
    ]),
    EventsModule,
  ],
  controllers: [EvaluationController],
  providers: [EvaluationService],
  exports: [EvaluationService],
})
export class EvaluationModule {}

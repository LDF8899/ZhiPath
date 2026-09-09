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
import { EvaluationV1Controller } from './evaluation-v1.controller';

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
  controllers: [EvaluationController, EvaluationV1Controller],
  providers: [EvaluationService],
  exports: [EvaluationService],
})
export class EvaluationModule {}

import { IsIn } from 'class-validator';

export class UpdateLearningPathStatusDto {
  @IsIn(['active', 'paused', 'archived'])
  status!: 'active' | 'paused' | 'archived';
}


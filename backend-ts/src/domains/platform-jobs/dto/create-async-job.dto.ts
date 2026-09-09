import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';

export const PLATFORM_JOB_TYPES = [
  'agent.lecture',
  'agent.reading',
  'agent.code',
  'agent.path',
  'agent.assess',
  'agent.exam',
  'agent.skillgap',
  'agent.resume',
  'agent.profile',
  'agent.news',
  'question.generate',
  'resource.lecture',
  'resource.reading',
  'resource.quiz',
  'resource.coding',
  'resource.video',
  'resource.animation',
  'resource.diagram',
  'resource.avatar',
  'resource.path_resources',
] as const;

export class CreateAsyncJobDto {
  @ApiProperty({ enum: PLATFORM_JOB_TYPES })
  @IsIn(PLATFORM_JOB_TYPES)
  jobType: string;

  @ApiProperty({ type: Object })
  @IsObject()
  payload: Record<string, unknown>;

  @ApiPropertyOptional({ minimum: 1, maximum: 10, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  priority?: number = 5;

  @ApiPropertyOptional({ minimum: 0, maximum: 86400000, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400_000)
  delayMs?: number = 0;
}

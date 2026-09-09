import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateEvidenceDto {
  @ApiProperty({
    enum: ['learning_action', 'quiz_answer', 'exam_answer', 'code', 'conversation', 'resource', 'project', 'system'],
  })
  @IsIn(['learning_action', 'quiz_answer', 'exam_answer', 'code', 'conversation', 'resource', 'project', 'system'])
  evidenceType: string;

  @ApiProperty({ example: '完成 TypeScript 泛型练习并通过全部测试' })
  @IsString()
  @Length(1, 600)
  summary: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiPropertyOptional({ minimum: 0, maximum: 1, default: 0.7 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number = 0.7;

  @ApiPropertyOptional({ enum: ['private', 'tenant', 'public'], default: 'private' })
  @IsOptional()
  @IsIn(['private', 'tenant', 'public'])
  visibility?: string = 'private';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 80)
  sourceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  sourceId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  competencyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  learningGoalId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  learningActivityId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assessmentAttemptId?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}

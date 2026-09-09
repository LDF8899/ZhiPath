import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateLearningActivityDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  pathId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  pathNodeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  competencyId?: string;

  @ApiProperty({ enum: ['reading', 'practice', 'code', 'quiz', 'exam', 'project', 'review'] })
  @IsIn(['reading', 'practice', 'code', 'quiz', 'exam', 'project', 'review'])
  type: string;

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 14400 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(14400)
  estimatedMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  priority?: number = 5;
}

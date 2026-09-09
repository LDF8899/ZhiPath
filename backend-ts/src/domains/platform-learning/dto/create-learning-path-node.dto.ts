import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateLearningPathNodeDto {
  @ApiProperty({ example: 'typescript-generics' })
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9][a-z0-9._-]*$/)
  nodeKey: string;

  @ApiProperty({ enum: ['phase', 'competency', 'activity', 'milestone'] })
  @IsIn(['phase', 'competency', 'activity', 'milestone'])
  type: string;

  @ApiProperty({ example: '掌握 TypeScript 泛型' })
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiProperty({ minimum: 0, maximum: 100000 })
  @IsInt()
  @Min(0)
  @Max(100000)
  position: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  competencyId?: string;

  @ApiPropertyOptional({ enum: ['planned', 'ready', 'in_progress', 'completed'], default: 'planned' })
  @IsOptional()
  @IsIn(['planned', 'ready', 'in_progress', 'completed'])
  status?: string = 'planned';

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

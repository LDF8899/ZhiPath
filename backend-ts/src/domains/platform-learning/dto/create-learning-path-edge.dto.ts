import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class CreateLearningPathEdgeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fromNodeId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  toNodeId: string;

  @ApiPropertyOptional({ enum: ['next', 'prerequisite', 'optional', 'parallel'], default: 'next' })
  @IsOptional()
  @IsIn(['next', 'prerequisite', 'optional', 'parallel'])
  type?: string = 'next';
}

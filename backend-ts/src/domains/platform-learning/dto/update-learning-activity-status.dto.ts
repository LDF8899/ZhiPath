import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateLearningActivityStatusDto {
  @ApiProperty({
    enum: ['planned', 'ready', 'in_progress', 'completed', 'skipped', 'cancelled'],
  })
  @IsIn(['planned', 'ready', 'in_progress', 'completed', 'skipped', 'cancelled'])
  status: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 14400 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(14400)
  actualMinutes?: number;
}

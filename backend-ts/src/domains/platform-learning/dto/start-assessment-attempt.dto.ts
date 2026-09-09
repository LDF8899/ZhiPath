import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';

export class StartAssessmentAttemptDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, description: '最多冻结的题目数量；未提供时使用定义内全部题目' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  count?: number;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

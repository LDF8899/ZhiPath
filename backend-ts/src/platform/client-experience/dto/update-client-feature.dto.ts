import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';

export class UpdateClientFeatureDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, default: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercent?: number;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

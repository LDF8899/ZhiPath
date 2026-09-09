import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class SwitchTenantDto {
  @ApiProperty({ example: 1, description: '目标租户 ID，必须是当前用户的 active membership' })
  @IsInt()
  @Min(1)
  tenantId: number;
}

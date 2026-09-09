import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: '登录或上一次刷新返回的刷新令牌' })
  @IsString()
  @Length(32, 256)
  refreshToken: string;
}

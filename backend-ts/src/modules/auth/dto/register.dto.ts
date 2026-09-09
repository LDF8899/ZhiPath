import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'new-user' })
  @IsString()
  @Length(2, 100)
  username: string;

  @ApiProperty({ minLength: 6, example: 'change-me-123' })
  @IsString()
  @Length(6, 128)
  password: string;

  @ApiPropertyOptional({ example: '新用户' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  realName?: string;
}

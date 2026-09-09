import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'zhangsan' })
  @IsString()
  @Length(1, 100)
  username: string;

  @ApiProperty({ example: '123456', minLength: 6 })
  @IsString()
  @Length(6, 128)
  password: string;
}

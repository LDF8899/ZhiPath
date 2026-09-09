import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
} from 'class-validator';

export class CreateClientAppDto {
  @ApiProperty({ example: 'campus-web' })
  @IsString()
  @Length(3, 64)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
  clientKey: string;

  @ApiProperty({ example: '校园定制版' })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ type: [String], example: ['https://campus.example.com'] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
      require_tld: false,
    },
    { each: true },
  )
  allowedOrigins: string[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  theme?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String], example: ['dashboard', 'learning-paths'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  features?: string[];
}

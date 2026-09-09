import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateLearningGoalDto {
  @ApiProperty({ enum: ['career', 'course', 'exam', 'certificate', 'project', 'interest'] })
  @IsIn(['career', 'course', 'exam', 'certificate', 'project', 'interest'])
  goalType: string;

  @ApiProperty({ example: '掌握 TypeScript 全栈开发' })
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiProperty({ example: 'software-engineering' })
  @IsString()
  @Length(1, 80)
  domainKey: string;

  @ApiPropertyOptional({ description: '路径名称；缺省时使用目标名称' })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  pathName?: string;

  @ApiPropertyOptional({ enum: ['main', 'side'], default: 'main' })
  @IsOptional()
  @IsIn(['main', 'side'])
  pathKind?: 'main' | 'side' = 'main';

  @ApiPropertyOptional({ description: '领域注册表中的起步路线 ID；提供后会一次性物化能力节点' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  starterPathId?: string;

  @ApiPropertyOptional({ minimum: 15, maximum: 1440, default: 60 })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(1440)
  dailyMinutes?: number = 60;
}

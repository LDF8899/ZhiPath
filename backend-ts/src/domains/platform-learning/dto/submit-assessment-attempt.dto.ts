import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class AssessmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  itemId: string;

  @ApiProperty({ description: '答案值，选择题可传序号或 { answer: 序号 }' })
  @IsDefined()
  response: unknown;
}

export class SubmitAssessmentAttemptDto {
  @ApiProperty({ type: [AssessmentResponseDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AssessmentResponseDto)
  responses: AssessmentResponseDto[];
}

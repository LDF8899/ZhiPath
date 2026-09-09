import { IsBoolean } from 'class-validator';

export class ResourceFeedbackDto {
  @IsBoolean()
  useful!: boolean;
}


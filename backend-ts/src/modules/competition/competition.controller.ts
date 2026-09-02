import { Body, Controller, Get, Post } from '@nestjs/common';
import { success } from '../../common/api-response';
import { CompetitionService } from './competition.service';

@Controller('competition')
export class CompetitionController {
  constructor(private readonly competitionService: CompetitionService) {}

  @Get('health')
  health() {
    return success(this.competitionService.health());
  }

  @Get('demo-cases')
  demoCases() {
    return success(this.competitionService.getDemoCases());
  }

  @Post('run-loop')
  runLoop(@Body() body: { learnerId?: string; quizAccuracy?: number }) {
    return success(this.competitionService.runLoop(body));
  }

  @Post('feedback')
  feedback(@Body() body: { learnerId?: string; quizAccuracy?: number }) {
    return success(this.competitionService.feedback(body));
  }
}


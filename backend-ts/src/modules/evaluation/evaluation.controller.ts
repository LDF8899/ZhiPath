import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success } from '../../common/api-response';
import { EvaluationService } from '../../services/evaluation.service';

@Controller('user/evaluations')
@UseGuards(AuthGuard)
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Get()
  async list(@CurrentUser('sub') userId: number, @Query('limit') limit?: string) {
    return success(await this.evaluationService.listRecent(userId, limit ? Number(limit) : 20));
  }

  @Get(':attemptId')
  async detail(@CurrentUser('sub') userId: number, @Param('attemptId') attemptId: string) {
    return success(await this.evaluationService.getDetail(userId, Number(attemptId)));
  }
}

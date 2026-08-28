import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success, pageSuccess, error } from '../../common/api-response';
import { QuestionBankService } from './question-bank.service';

@Controller('user/question-bank')
@UseGuards(AuthGuard)
export class QuestionBankController {
  constructor(private readonly service: QuestionBankService) {}

  @Get('questions')
  async list(
    @CurrentUser('sub') userId: number,
    @Query('skillName') skillName?: string,
    @Query('questionType') questionType?: string,
    @Query('difficulty') difficulty?: string,
    @Query('source') source?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const result = await this.service.listQuestions(userId, { skillName, questionType, difficulty, source, page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined });
    return pageSuccess(result.list, result.total, result.page, result.pageSize);
  }

  @Post('assemble')
  async assemble(@CurrentUser('sub') userId: number, @Body() body: { questionIds: number[] }) {
    try { return success(await this.service.assemble(userId, body.questionIds), '已组卷'); }
    catch (e: any) { return error(400, e.message); }
  }
}

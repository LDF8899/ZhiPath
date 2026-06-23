import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { QuickTestService } from './quick-test.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success } from '../../common/api-response';

/**
 * 5分钟速测控制器
 */
@Controller('user')
@UseGuards(AuthGuard)
export class QuickTestController {
  constructor(private readonly quickTestService: QuickTestService) {}

  /**
   * 获取速测题目
   * GET /api/user/quick-test
   */
  @Get('quick-test')
  async getQuestions(@CurrentUser() user: any, @Query('direction') direction?: string) {
    const result = await this.quickTestService.getQuestions(user.sub, direction);
    return success(result);
  }

  /**
   * 提交速测答案
   * POST /api/user/quick-test/submit
   */
  @Post('quick-test/submit')
  async submitAnswers(
    @CurrentUser() user: any,
    @Body() body: { skillName: string; answers: Record<string, any>; questions: any[] },
  ) {
    const result = await this.quickTestService.submitAnswers(
      user.sub,
      body.skillName,
      body.answers,
      body.questions,
    );
    return success(result);
  }
}

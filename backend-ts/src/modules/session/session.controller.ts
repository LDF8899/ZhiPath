import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SessionService } from '../../services/session.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success } from '../../common/api-response';

/**
 * 学习会话控制器 — Git Commit 模型 API
 */
@Controller('user')
@UseGuards(AuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  /** 开始学习会话 */
  @Post('sessions/start')
  async startSession(@CurrentUser() user: any, @Body() body: { planId?: number }) {
    const session = await this.sessionService.startSession(user.sub, body.planId);
    return success(session);
  }

  /** 结束学习会话 */
  @Post('sessions/:sessionId/end')
  async endSession(@Param('sessionId') sessionId: string) {
    const session = await this.sessionService.endSession(parseInt(sessionId, 10));
    return success(session);
  }

  /** 记录学习进度 */
  @Post('sessions/:sessionId/progress')
  async recordProgress(
    @Param('sessionId') sessionId: string,
    @Body() body: { taskId: number; skillName: string; masteryBefore: number; masteryAfter: number },
  ) {
    await this.sessionService.recordProgress(
      parseInt(sessionId, 10),
      body.taskId,
      body.skillName,
      body.masteryBefore,
      body.masteryAfter,
    );
    return success({ recorded: true });
  }

  /** 获取学习历史（git log） */
  @Get('sessions/history')
  async getHistory(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const result = await this.sessionService.getHistory(
      user.sub,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
    return success(result);
  }

  /** 获取学习统计 */
  @Get('sessions/stats')
  async getStats(@CurrentUser() user: any) {
    const stats = await this.sessionService.getStats(user.sub);
    return success(stats);
  }

  /** 对比两个日期的技能变化（git diff） */
  @Get('sessions/diff')
  async diff(
    @CurrentUser() user: any,
    @Query('dateA') dateA: string,
    @Query('dateB') dateB: string,
  ) {
    const result = await this.sessionService.diff(user.sub, dateA, dateB);
    return success(result);
  }

  /** 回退到目标日期（git reset） */
  @Post('sessions/rollback')
  async rollback(@CurrentUser() user: any, @Body() body: { targetDate: string }) {
    const result = await this.sessionService.rollback(user.sub, body.targetDate);
    return success(result);
  }
}

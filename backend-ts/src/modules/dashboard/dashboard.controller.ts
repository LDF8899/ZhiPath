import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success } from '../../common/api-response';

/**
 * Dashboard 控制器 — 对齐 Python api/user/dashboard.py
 */
@Controller('user')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** GET /api/user/dashboard */
  @Get('dashboard')
  async getDashboard(@CurrentUser() user: any, @Query('user_id') userIdStr?: string) {
    const userId = userIdStr ? Number(userIdStr) : user.sub;
    const result = await this.dashboardService.getDashboard(userId);
    return success(result);
  }

  /** GET /api/user/today-actions — 今日行动推荐（P0-2）：1 主任务 + 最多 2 辅助任务 */
  @Get('today-actions')
  async getTodayActions(@CurrentUser() user: any) {
    const result = await this.dashboardService.getTodayActions(user.sub);
    return success(result);
  }

  /** GET /api/user/growth-report — 阶段成长报告（P2-2）：7/30 天学习、技能、测评、匹配变化 */
  @Get('growth-report')
  async getGrowthReport(@CurrentUser() user: any, @Query('days') days?: string) {
    const result = await this.dashboardService.getGrowthReport(user.sub, Number(days || 30));
    return success(result);
  }
}

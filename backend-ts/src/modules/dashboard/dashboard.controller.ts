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
}

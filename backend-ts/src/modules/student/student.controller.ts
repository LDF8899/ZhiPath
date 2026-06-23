import { Controller, Get, Put, Post, Body, Query, UseGuards } from '@nestjs/common';
import { StudentService } from './student.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success } from '../../common/api-response';

/**
 * Student 控制器
 */
@Controller('user')
@UseGuards(AuthGuard)
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  /** GET /api/user/profile */
  @Get('profile')
  async getProfile(@CurrentUser() user: any, @Query('user_id') userIdStr?: string) {
    const userId = userIdStr ? Number(userIdStr) : user.sub;
    const profile = await this.studentService.getProfile(userId);
    return success(profile);
  }

  /** PUT /api/user/profile */
  @Put('profile')
  async updateProfile(@CurrentUser() user: any, @Body() body: Record<string, any>) {
    const result = await this.studentService.updateProfile(user.sub, body);
    return success(result);
  }

  /** POST /api/user/onboarding — 只保存个人资料 */
  @Post('onboarding')
  async submitOnboarding(@CurrentUser() user: any, @Body() body: any) {
    const result = await this.studentService.submitOnboarding(user.sub, body);
    return success(result);
  }

  /** GET /api/user/onboarding/status */
  @Get('onboarding/status')
  async getOnboardingStatus(@CurrentUser() user: any) {
    const result = await this.studentService.getOnboardingStatus(user.sub);
    return success(result);
  }

  /** GET /api/user/plans — 获取用户所有计划 */
  @Get('plans')
  async getMyPlans(@CurrentUser() user: any) {
    const result = await this.studentService.getMyPlans(user.sub);
    return success(result);
  }

  /** POST /api/user/plans — 创建新计划 */
  @Post('plans')
  async createPlan(@CurrentUser() user: any, @Body() body: { direction: string; dailyHours?: number; importFromPlanId?: number }) {
    const result = await this.studentService.createPlan(user.sub, body);
    return success(result);
  }
}

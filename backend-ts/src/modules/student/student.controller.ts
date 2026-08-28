import { Controller, Get, Put, Post, Body, Query, Param, UseGuards } from '@nestjs/common';
import { StudentService } from './student.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success } from '../../common/api-response';
import { LearningDomainRegistry } from '../../domains/learning-domain.registry';
import type { LearningGoalType } from '../../domains/learning-domain.types';

/**
 * Student 控制器
 */
@Controller('user')
@UseGuards(AuthGuard)
export class StudentController {
  constructor(
    private readonly studentService: StudentService,
    private readonly domainRegistry: LearningDomainRegistry,
  ) {}

  /** GET /api/user/learning-domains */
  @Get('learning-domains')
  getLearningDomains() {
    return success(this.domainRegistry.list());
  }

  /** GET /api/user/learning-domains/:domainId */
  @Get('learning-domains/:domainId')
  getLearningDomain(@Param('domainId') domainId: string) {
    return success(this.domainRegistry.get(domainId));
  }

  /** GET /api/user/profile */
  @Get('profile')
  async getProfile(@CurrentUser() user: any, @Query('user_id') userIdStr?: string) {
    const userId = userIdStr ? Number(userIdStr) : user.sub;
    const profile = await this.studentService.getProfile(userId);
    return success(profile);
  }

  /** GET /api/user/profile/radar */
  @Get('profile/radar')
  async getProfileRadar(@CurrentUser() user: any) {
    return success(await this.studentService.getRadarProfile(user.sub));
  }

  /** GET /api/user/profile/ability-metrics */
  @Get('profile/ability-metrics')
  async getProfileAbilityMetrics(@CurrentUser() user: any) {
    return success(await this.studentService.getAbilityMetrics(user.sub));
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
  async createPlan(@CurrentUser() user: any, @Body() body: {
    planType?: 'main' | 'side';
    direction?: string;
    planName?: string;
    skills?: string[];
    targetJobId?: number;
    dailyHours?: number;
    importFromPlanId?: number;
    domainId?: string;
    goalType?: LearningGoalType;
    goalTitle?: string;
    starterPathId?: string;
  }) {
    const result = await this.studentService.createPlan(user.sub, body);
    return success(result);
  }
}

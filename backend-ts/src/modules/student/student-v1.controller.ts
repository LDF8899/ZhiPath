import { BadRequestException, Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { StudentService } from './student.service';

/** 统一用户画像契约；旧 /api/user/profile 仅作为兼容入口。 */
@Controller('v1/profile')
@UseGuards(AuthGuard, ScopesGuard)
export class StudentV1Controller {
  constructor(private readonly studentService: StudentService) {}

  @Get()
  @RequireScopes('learning:read')
  async get(@Req() request: PlatformRequest) {
    return apiV1Success(request, await this.studentService.getProfile(this.userId(request), this.tenantId(request)));
  }

  @Get('radar')
  @RequireScopes('learning:read')
  async radar(@Req() request: PlatformRequest) {
    return apiV1Success(request, await this.studentService.getRadarProfile(this.userId(request), this.tenantId(request)));
  }

  @Get('ability-metrics')
  @RequireScopes('learning:read')
  async abilityMetrics(@Req() request: PlatformRequest) {
    return apiV1Success(request, await this.studentService.getAbilityMetrics(this.userId(request), this.tenantId(request)));
  }

  @Put()
  @RequireScopes('learning:write')
  async update(@Req() request: PlatformRequest, @Body() body: Record<string, unknown>) {
    return apiV1Success(request, await this.studentService.updateProfile(this.userId(request), body, this.tenantId(request)));
  }

  /**
   * 完成学习者引导的规范写入口。
   *
   * 画像、技能自报和学习目标必须由同一个 application service 写入，
   * 前端不再直接依赖历史 /api/user/onboarding 控制器。
   */
  @Post('onboarding')
  @RequireScopes('learning:write')
  async onboarding(@Req() request: PlatformRequest, @Body() body: Record<string, unknown>) {
    return apiV1Success(request, await this.studentService.submitOnboarding(this.userId(request), body, this.tenantId(request)));
  }

  @Get('onboarding/status')
  @RequireScopes('learning:read')
  async onboardingStatus(@Req() request: PlatformRequest) {
    return apiV1Success(request, await this.studentService.getOnboardingStatus(this.userId(request), this.tenantId(request)));
  }

  private userId(request: PlatformRequest) { return Number(request.user?.sub || request.user?.id); }
  private tenantId(request: PlatformRequest) {
    const id = Number(request.user?.tenantId);
    if (!id) throw new BadRequestException('访问令牌缺少有效租户上下文');
    return id;
  }
}

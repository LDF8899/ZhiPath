import { BadRequestException, Body, Controller, Get, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { TaskSchedulerService } from '../../services/task-scheduler.service';

/**
 * 旧 learning_tasks_v3 的过渡适配器。
 *
 * 今日任务和“调整学习速度”暂时仍由既有 scheduler 计算，
 * 但入口、鉴权、响应信封和客户端标识统一到 v1；后续 scheduler
 * 完成迁移后可在此处替换实现而不再改动两个前端。
 */
@ApiTags('v1 learning tasks')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Client-App', required: true })
@Controller('v1/learning-tasks')
@UseGuards(AuthGuard, ScopesGuard)
export class TasksV1Controller {
  constructor(private readonly scheduler: TaskSchedulerService) {}

  @Get('today')
  @RequireScopes('learning:read')
  @ApiOperation({ summary: '获取当前用户今日学习任务（兼容投影）' })
  async today(@Req() request: PlatformRequest, @Query('planId') planId?: string) {
    const parsedPlanId = planId === undefined ? undefined : Number(planId);
    if (parsedPlanId !== undefined && (!Number.isInteger(parsedPlanId) || parsedPlanId < 1)) {
      return apiV1Success(request, { planId: null, mainTasks: [], sideTasks: [], totalEstimatedMin: 0, completedMin: 0, progressPct: 0 });
    }
    const result = await this.scheduler.getTodayTasks(this.userId(request), parsedPlanId, this.tenantId(request));
    return apiV1Success(request, result);
  }

  @Post('adjust-speed')
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: '根据近期学习表现调整计划节奏（兼容投影）' })
  async adjustSpeed(
    @Req() request: PlatformRequest,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: { planId: number },
  ) {
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      throw new BadRequestException('缺少有效的 Idempotency-Key');
    }
    const planId = Number(body?.planId);
    if (!Number.isInteger(planId) || planId < 1) throw new BadRequestException('planId 参数无效');
    const result = await this.scheduler.adjustForSpeed(this.userId(request), planId, this.tenantId(request));
    return apiV1Success(request, result);
  }

  private userId(request: PlatformRequest) {
    return Number(request.user?.sub || request.user?.id);
  }

  private tenantId(request: PlatformRequest) {
    const id = Number(request.user?.tenantId);
    if (!id) throw new BadRequestException('访问令牌缺少有效租户上下文');
    return id;
  }
}

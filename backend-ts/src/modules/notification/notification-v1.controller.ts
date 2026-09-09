import { BadRequestException, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { NotificationService } from '../../services/notification.service';

/**
 * 站内通知的稳定契约适配器。
 *
 * 通知表仍处于历史表迁移期，底层 service 暂时按 user_id 读取；该控制器
 * 先统一 v1 信封、scope、客户端上下文和幂等写入口，后续可无感切换到
 * 带 tenant_id 的规范 notifications 表。
 */
@ApiTags('v1 notifications')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Client-App', required: true })
@Controller('v1/notifications')
@UseGuards(AuthGuard, ScopesGuard)
export class NotificationV1Controller {
  constructor(private readonly notifications: NotificationService) {}

  @Get('unread-count')
  @RequireScopes('learning:read')
  @ApiOperation({ summary: '读取当前用户未读通知数' })
  async unreadCount(@Req() request: PlatformRequest) {
    return apiV1Success(request, { count: await this.notifications.getUnreadCount(this.userId(request), this.tenantId(request)) });
  }

  @Get('unread')
  @RequireScopes('learning:read')
  async unread(@Req() request: PlatformRequest, @Query('limit') limit?: string) {
    const parsed = this.limit(limit);
    return apiV1Success(request, { items: await this.notifications.getUnread(this.userId(request), parsed, this.tenantId(request)) });
  }

  @Get()
  @RequireScopes('learning:read')
  async list(@Req() request: PlatformRequest, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const p = this.positive(page, 1, 100000);
    const ps = this.positive(pageSize, 20, 100);
    const result = await this.notifications.getAll(this.userId(request), p, ps, this.tenantId(request));
    return apiV1Success(request, {
      items: result.notifications,
      pageInfo: { page: p, pageSize: ps, total: result.total, hasNextPage: p * ps < result.total },
    });
  }

  @Post(':id/read')
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async read(@Req() request: PlatformRequest, @Param('id') id: string, @Headers('idempotency-key') key: string) {
    this.requireKey(key);
    const notificationId = this.positive(id, 1, Number.MAX_SAFE_INTEGER);
    return apiV1Success(request, { read: await this.notifications.markAsRead(notificationId, this.userId(request), this.tenantId(request)) });
  }

  @Post('read-all')
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async readAll(@Req() request: PlatformRequest, @Headers('idempotency-key') key: string) {
    this.requireKey(key);
    return apiV1Success(request, { marked: await this.notifications.markAllAsRead(this.userId(request), this.tenantId(request)) });
  }

  private userId(request: PlatformRequest) { return Number(request.user?.sub || request.user?.id); }
  private tenantId(request: PlatformRequest) { return Number(request.user?.tenantId || 1); }
  private requireKey(key: string) { if (!key || key.length > 200) throw new BadRequestException('Idempotency-Key 必填且不得超过 200 字符'); }
  private limit(value?: string) { return this.positive(value, 20, 100); }
  private positive(value: string | undefined, fallback: number, max: number) {
    if (value === undefined || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) throw new BadRequestException('分页参数无效');
    return parsed;
  }
}

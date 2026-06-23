import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { NotificationService } from '../../services/notification.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success } from '../../common/api-response';

/**
 * 通知控制器 — 站内通知 API
 */
@Controller('user')
@UseGuards(AuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /** 获取未读通知数 */
  @Get('notifications/unread-count')
  async getUnreadCount(@CurrentUser() user: any) {
    const count = await this.notificationService.getUnreadCount(user.sub);
    return success({ count });
  }

  /** 获取未读通知列表 */
  @Get('notifications/unread')
  async getUnread(@CurrentUser() user: any, @Query('limit') limit?: string) {
    const notifications = await this.notificationService.getUnread(
      user.sub,
      limit ? parseInt(limit, 10) : 20,
    );
    return success(notifications);
  }

  /** 获取所有通知（分页） */
  @Get('notifications')
  async getAll(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const result = await this.notificationService.getAll(
      user.sub,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
    return success(result);
  }

  /** 标记单条通知为已读 */
  @Post('notifications/:id/read')
  async markAsRead(@Param('id') id: string, @CurrentUser() user: any) {
    const result = await this.notificationService.markAsRead(parseInt(id, 10), user.sub);
    return success({ success: result });
  }

  /** 标记所有通知为已读 */
  @Post('notifications/read-all')
  async markAllAsRead(@CurrentUser() user: any) {
    const count = await this.notificationService.markAllAsRead(user.sub);
    return success({ marked: count });
  }

  /** 删除通知 */
  @Post('notifications/:id/delete')
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    const result = await this.notificationService.delete(parseInt(id, 10), user.sub);
    return success({ success: result });
  }
}

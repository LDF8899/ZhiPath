import { Injectable, Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../database/redis.module';
import { Notification } from '../entities/notification.entity';
import { EventsService } from '../modules/events/events.service';

/**
 * 通知服务 — 站内通知系统
 *
 * 对齐 CONSTITUTION.md §25 通知系统：
 *   - 学习提醒 / 进度变化 / 岗位匹配 / 考试结果 / 系统公告
 *   - MySQL notifications 是带 tenant_id 的事实源，Redis 仅缓存未读数
 *   - 支持标记已读
 */
@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification) private notificationRepo: Repository<Notification>,
    @Inject(REDIS_CLIENT) private redis: Redis,
    @Optional() @Inject(EventsService) private eventsService?: EventsService,
  ) {}

  /**
   * 创建通知
   */
  async create(
    userId: number,
    type: Notification['type'],
    title: string,
    content: string,
    link?: string,
    tenantId?: number,
    clientAppId: number | null = null,
  ): Promise<Notification> {
    const now = Date.now();
    const scopedTenantId = await this.resolveTenantId(userId, tenantId);

    const notification = await this.notificationRepo.save({
      tenantId: scopedTenantId,
      clientAppId,
      userId,
      type,
      title,
      content,
      link: link || null,
      isRead: 0,
      createTime: now,
      updateTime: now,
      status: 1,
    });

    // 更新 Redis 未读数
    if (this.redis) {
      await this.redis.incr(`user:unread:${userId}`);
    }

    // SSE 实时推送 — 通知创建后立即推送到前端
    if (this.eventsService) {
      this.eventsService.emitNotification(userId, {
        id: notification.id,
        title: notification.title,
        type: notification.type,
      });
    }

    return notification;
  }

  /**
   * 获取未读通知列表
   */
  async getUnread(userId: number, limit: number = 20, tenantId = 1): Promise<Notification[]> {
    try {
      return await this.notificationRepo.find({
        where: { tenantId, userId, isRead: 0, status: 1 },
        order: { createTime: 'DESC' },
        take: limit,
      });
    } catch {
      // fallback: 表可能缺少 status 列
      return await this.notificationRepo.find({
        where: { tenantId, userId, isRead: 0 },
        order: { createTime: 'DESC' },
        take: limit,
      });
    }
  }

  /**
   * 获取所有通知（分页）
   */
  async getAll(
    userId: number,
    page: number = 1,
    pageSize: number = 20,
    tenantId = 1,
  ): Promise<{ notifications: Notification[]; total: number }> {
    try {
      const [notifications, total] = await this.notificationRepo.findAndCount({
        where: { tenantId, userId, status: 1 },
        order: { createTime: 'DESC' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      return { notifications, total };
    } catch {
      // fallback: 表可能缺少 status 列
      const [notifications, total] = await this.notificationRepo.findAndCount({
        where: { tenantId, userId },
        order: { createTime: 'DESC' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      return { notifications, total };
    }
  }

  /**
   * 标记单条通知为已读
   */
  async markAsRead(notificationId: number, userId: number, tenantId = 1): Promise<boolean> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, tenantId, userId, status: 1 },
    });

    if (!notification || notification.isRead === 1) return false;

    const now = Date.now();
    await this.notificationRepo.update(notificationId, { isRead: 1, updateTime: now });

    // 更新 Redis 未读数
    if (this.redis) {
      const count = await this.redis.decr(`user:unread:${userId}`);
      if (count < 0) {
        await this.redis.set(`user:unread:${userId}`, 0);
      }
    }

    return true;
  }

  /**
   * 标记所有通知为已读
   */
  async markAllAsRead(userId: number, tenantId = 1): Promise<number> {
    const now = Date.now();
    const result = await this.notificationRepo.update(
      { tenantId, userId, isRead: 0, status: 1 },
      { isRead: 1, updateTime: now },
    );

    // 重置 Redis 未读数
    if (this.redis) {
      await this.redis.set(`user:unread:${userId}`, 0);
    }

    return result.affected || 0;
  }

  /**
   * 获取未读通知数（Redis 缓存）
   */
  async getUnreadCount(userId: number, tenantId = 1): Promise<number> {
    if (this.redis) {
      const cached = await this.redis.get(`user:unread:${userId}`);
      if (cached !== null) return parseInt(cached, 10);
    }

    // 缓存未命中，从数据库计算
    let count: number;
    try {
      count = await this.notificationRepo.count({
        where: { tenantId, userId, isRead: 0, status: 1 },
      });
    } catch {
      // fallback: 表可能缺少 status 列
      count = await this.notificationRepo.count({
        where: { tenantId, userId, isRead: 0 },
      });
    }

    if (this.redis) {
      await this.redis.set(`user:unread:${userId}`, count);
    }
    return count;
  }

  /**
   * 删除通知（软删除）
   */
  async delete(notificationId: number, userId: number, tenantId = 1): Promise<boolean> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, tenantId, userId, status: 1 },
    });

    if (!notification) return false;

    const now = Date.now();
    await this.notificationRepo.update(notificationId, { status: 0, updateTime: now });

    // 如果是未读通知，更新 Redis 未读数
    if (notification.isRead === 0 && this.redis) {
      const count = await this.redis.decr(`user:unread:${userId}`);
      if (count < 0) {
        await this.redis.set(`user:unread:${userId}`, 0);
      }
    }

    return true;
  }

  // ── 便捷触发器 ──────────────────────────────────

  /** 学习进度变化通知 */
  async notifyProgress(userId: number, skillName: string, newMastery: number): Promise<void> {
    if (newMastery >= 80) {
      await this.create(
        userId,
        'progress',
        '🎉 技能达标',
        `恭喜！你的「${skillName}」掌握度已达到 ${newMastery}%`,
        '/user/progress',
      );
    }
  }

  /** 匹配度变化通知 */
  async notifyMatchChange(userId: number, jobTitle: string, newScore: number): Promise<void> {
    await this.create(
      userId,
      'job',
      '📊 匹配度更新',
      `你与「${jobTitle}」的匹配度已更新为 ${newScore}%`,
      '/user/jobs',
    );
  }

  /** 新岗位匹配通知 */
  async notifyNewJob(userId: number, jobTitle: string, matchScore: number): Promise<void> {
    if (matchScore >= 70) {
      await this.create(
        userId,
        'job',
        '💼 新岗位推荐',
        `发现与你匹配度 ${matchScore}% 的岗位：${jobTitle}`,
        '/user/jobs',
      );
    }
  }

  /** 考试结果通知 */
  async notifyExamResult(userId: number, skillName: string, passed: boolean): Promise<void> {
    if (passed) {
      await this.create(
        userId,
        'exam',
        '✅ 考试通过',
        `恭喜通过「${skillName}」考试！`,
        '/user/exams',
      );
    } else {
      await this.create(
        userId,
        'exam',
        '📝 考试未通过',
        `「${skillName}」考试未通过，建议查看错题分析并加强学习`,
        '/user/exams',
      );
    }
  }

  /** 系统通知 */
  async notifySystem(userId: number, title: string, content: string, link?: string): Promise<void> {
    await this.create(userId, 'system', title, content, link);
  }

  /**
   * 后台通知通常只有 userId。此时从 membership 解析租户，避免把新租户
   * 的通知错误写入默认租户；历史无 membership 用户才回退到租户 1。
   */
  private async resolveTenantId(userId: number, tenantId?: number): Promise<number> {
    if (tenantId && Number.isFinite(tenantId)) return tenantId;
    try {
      const rows = await this.notificationRepo.manager.query(
        `SELECT tenant_id AS tenantId
           FROM tenant_memberships
          WHERE user_id = ? AND status = 'active'
          ORDER BY tenant_id ASC LIMIT 1`,
        [userId],
      );
      if (rows?.[0]?.tenantId) return Number(rows[0].tenantId);
    } catch {
      // 兼容极早期数据库快照：membership 表不存在时使用平台默认租户。
    }
    return 1;
  }
}

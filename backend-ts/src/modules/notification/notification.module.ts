import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../../entities/notification.entity';
import { NotificationService } from '../../services/notification.service';
import { NotificationController } from './notification.controller';
import { EventsModule } from '../events/events.module';

/**
 * 通知模块 — 站内通知系统
 * 导入 EventsModule 以支持 SSE 实时推送
 */
@Module({
  imports: [TypeOrmModule.forFeature([Notification]), EventsModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}

import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsV1Controller } from './events-v1.controller';
import { EventsService } from './events.service';

/**
 * SSE 事件模块 — 实时推送
 */
@Module({
  controllers: [EventsController, EventsV1Controller],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}

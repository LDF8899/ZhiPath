import { Controller, Get, Sse, UseGuards, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, interval, map, takeUntil, Subject } from 'rxjs';
import { EventsService } from './events.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

/**
 * SSE 事件控制器
 */
@Controller('user')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  /**
   * SSE 事件流端点
   * GET /api/user/events/stream
   */
  @Get('events/stream')
  @UseGuards(AuthGuard)
  async stream(@CurrentUser() user: any, @Req() req: Request, @Res() res: Response) {
    const userId = user.sub;

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 发送连接成功事件
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

    // 订阅用户事件流
    const subscription = this.eventsService.getEventStream(userId).subscribe({
      next: (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      },
      error: (err) => {
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
        res.end();
      },
      complete: () => {
        res.end();
      },
    });

    // 心跳（每 30 秒）
    const heartbeat = interval(30000).subscribe(() => {
      res.write(`: heartbeat\n\n`);
    });

    // 客户端断开时清理
    req.on('close', () => {
      subscription.unsubscribe();
      heartbeat.unsubscribe();
      this.eventsService.closeStream(userId);
    });
  }

  /**
   * 获取连接状态
   * GET /api/user/events/status
   */
  @Get('events/status')
  @UseGuards(AuthGuard)
  getStatus() {
    return {
      connectedUsers: this.eventsService.connectedUsers,
    };
  }
}

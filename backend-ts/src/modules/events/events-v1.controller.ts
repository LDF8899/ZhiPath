import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { interval } from 'rxjs';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { EventsService } from './events.service';

/** Stable tenant-scoped SSE endpoint for all branded clients. */
@Controller('v1')
@UseGuards(AuthGuard, ScopesGuard)
export class EventsV1Controller {
  constructor(private readonly events: EventsService) {}

  @Get('events')
  @RequireScopes('learning:read')
  async stream(@Req() request: Request & { user?: any }, @Res() response: Response) {
    const userId = Number(request.user?.sub || request.user?.id);
    const tenantId = Number(request.user?.tenantId || 1);
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

    const subscription = this.events.getEventStream(userId, tenantId).subscribe({
      next: (event) => response.write(`data: ${JSON.stringify(event)}\n\n`),
      error: (error) => {
        response.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        response.end();
      },
      complete: () => response.end(),
    });
    const heartbeat = interval(30000).subscribe(() => response.write(': heartbeat\n\n'));
    request.on('close', () => {
      subscription.unsubscribe();
      heartbeat.unsubscribe();
    });
  }
}

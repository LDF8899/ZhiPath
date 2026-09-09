import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { getRequestContext, PlatformRequest } from './request-context.types';
import { LegacyRouteUsageService } from './legacy-route-usage.service';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HttpRequest');

  constructor(private readonly legacyRoutes: LegacyRouteUsageService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<PlatformRequest>();
    const response = context.switchToHttp().getResponse();
    const requestContext = getRequestContext(request);

    return next.handle().pipe(
      finalize(() => {
        const rawPath = String(request.originalUrl || request.url || '').split('?')[0];
        const routePath = (request as any).route?.path;
        const routePattern = routePath
          ? `${String((request as any).baseUrl || '').replace(/\/$/, '')}/${String(routePath).replace(/^\//, '')}`
          : rawPath.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id').replace(/\/\d+(?=\/|$)/g, '/:id');
        this.legacyRoutes.record({
          tenantId: Number(request.user?.tenantId || 0),
          clientApp: requestContext.clientApp,
          method: request.method,
          routePattern,
          statusCode: response.statusCode,
        });
        this.logger.log(
          JSON.stringify({
            event: 'http_request_completed',
            requestId: requestContext.requestId,
            clientApp: requestContext.clientApp,
            clientVersion: requestContext.clientVersion,
            tenantId: request.user?.tenantId || null,
            userId: request.user?.sub || request.user?.id || null,
            method: request.method,
            path: request.originalUrl || request.url,
            statusCode: response.statusCode,
            durationMs: Date.now() - requestContext.startedAt,
          }),
        );
      }),
    );
  }
}

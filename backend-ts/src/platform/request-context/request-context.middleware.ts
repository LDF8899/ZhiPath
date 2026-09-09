import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { randomUUID } from 'crypto';
import {
  ClientAppKey,
  PlatformRequest,
} from './request-context.types';

function readHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function cleanHeader(value: string, fallback: string, maxLength = 128): string {
  const cleaned = value.trim().slice(0, maxLength);
  return /^[a-zA-Z0-9._:-]+$/.test(cleaned) ? cleaned : fallback;
}

function readQuery(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: PlatformRequest, response: Response, next: NextFunction) {
    const suppliedRequestId = cleanHeader(
      readHeader(request.headers['x-request-id']),
      '',
    );
    // Native EventSource cannot attach custom headers. It may provide the
    // client key as a query parameter; AuthGuard still binds it to JWT `azp`.
    const requestedClient = cleanHeader(
      readHeader(request.headers['x-client-app']) ||
        readQuery(request.query?.client_app),
      'unknown',
      64,
    );
    // 这里只做输入净化；是否已注册、是否启用由 client_apps 在身份/体验层校验。
    const clientApp: ClientAppKey = requestedClient;

    request.requestContext = {
      requestId: suppliedRequestId || randomUUID(),
      clientApp,
      clientVersion: cleanHeader(
        readHeader(request.headers['x-client-version']),
        'unknown',
        64,
      ),
      startedAt: Date.now(),
    };

    response.setHeader('X-Request-Id', request.requestContext.requestId);
    response.setHeader('X-Client-App', request.requestContext.clientApp);

    const requestPath = request.originalUrl || request.url || '';
    if (/^\/api\/(user(?:\/|$)|admin\/auth(?:\/|$))/.test(requestPath)) {
      response.setHeader('Deprecation', 'true');
      response.setHeader('Sunset', 'Thu, 30 Sep 2027 00:00:00 GMT');
      response.setHeader('Link', '</api/docs>; rel="deprecation"; type="text/html"');
    }
    next();
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { getRequestContext, PlatformRequest } from './request-context.types';

function errorCode(status: number): string {
  const codes: Record<number, string> = {
    400: 'REQUEST_INVALID',
    401: 'AUTH_UNAUTHORIZED',
    403: 'AUTH_FORBIDDEN',
    404: 'RESOURCE_NOT_FOUND',
    409: 'RESOURCE_CONFLICT',
    422: 'REQUEST_UNPROCESSABLE',
    429: 'RATE_LIMITED',
  };
  return codes[status] || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED');
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<PlatformRequest>();
    const response = http.getResponse<Response>();
    const requestContext = getRequestContext(request);
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
    const responseObject =
      exceptionResponse && typeof exceptionResponse === 'object'
        ? (exceptionResponse as Record<string, unknown>)
        : null;
    const rawMessage =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any)?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join('; ')
      : rawMessage || (status >= 500 ? '服务内部错误' : '请求失败');
    const code =
      typeof responseObject?.code === 'string'
        ? responseObject.code
        : errorCode(status);
    const details = responseObject?.details ?? (Array.isArray(rawMessage) ? rawMessage : []);

    this.logger.error(
      JSON.stringify({
        event: 'http_request_failed',
        requestId: requestContext.requestId,
        clientApp: requestContext.clientApp,
        tenantId: request.user?.tenantId || null,
        userId: request.user?.sub || request.user?.id || null,
        method: request.method,
        path: request.originalUrl || request.url,
        statusCode: status,
        errorCode: code,
        message,
      }),
      exception instanceof Error ? exception.stack : undefined,
    );

    const meta = {
      requestId: requestContext.requestId,
      clientApp: requestContext.clientApp,
    };

    if ((request.originalUrl || request.url).startsWith('/api/v1/')) {
      response.status(status).json({
        error: {
          code,
          message,
        details,
          requestId: requestContext.requestId,
        },
        meta,
      });
      return;
    }

    // 兼容旧前端：保留顶层 code/message/data，同时附加稳定错误对象。
    response.status(status).json({
      code: status,
      message,
      data: null,
      error: { code, message, requestId: requestContext.requestId },
      meta,
    });
  }
}

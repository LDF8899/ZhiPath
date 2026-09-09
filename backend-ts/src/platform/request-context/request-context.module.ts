import {
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestLoggingInterceptor } from './request-logging.interceptor';
import { LegacyRouteUsageService } from './legacy-route-usage.service';

@Global()
@Module({
  providers: [
    RequestContextMiddleware,
    LegacyRouteUsageService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
  exports: [RequestContextMiddleware, LegacyRouteUsageService],
})
export class RequestContextModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
  }
}

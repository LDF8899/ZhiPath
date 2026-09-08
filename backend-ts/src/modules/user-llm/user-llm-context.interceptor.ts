import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { LlmService } from '../../services/llm.service';
import { UserLlmService } from './user-llm.service';

/**
 * 为每个已鉴权请求建立用户级 LLM 上下文。
 * Guard 会先把 JWT payload 写入 request.user；随后本拦截器把该用户配置放进
 * AsyncLocalStorage，使请求内任意模块、智能体及其异步后台链路都使用同一配置。
 */
@Injectable()
export class UserLlmContextInterceptor implements NestInterceptor {
  constructor(
    private readonly userLlmService: UserLlmService,
    private readonly llmService: LlmService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const userId = Number(request.user?.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) return next.handle();

    return from(this.userLlmService.getForCall(userId).catch(() => undefined)).pipe(
      mergeMap((config) => new Observable((subscriber) => (
        this.llmService.withUser(config, () => next.handle().subscribe(subscriber))
      ))),
    );
  }
}

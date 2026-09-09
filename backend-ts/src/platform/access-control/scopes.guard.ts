import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformRequest } from '../request-context/request-context.types';
import { REQUIRED_SCOPES } from './require-scopes.decorator';

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_SCOPES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<PlatformRequest>();
    const granted = new Set(request.user?.scopes || []);
    if (granted.has('platform:*') || required.every((scope) => granted.has(scope))) return true;
    throw new ForbiddenException('当前租户成员没有执行此操作的权限');
  }
}

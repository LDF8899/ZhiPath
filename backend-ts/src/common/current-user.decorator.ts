import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 从 request 中提取当前用户
 * 用法：@CurrentUser() user: UserEntity
 */
export const CurrentUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

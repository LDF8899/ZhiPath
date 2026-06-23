import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * 管理员权限 Guard v3.0
 *
 * 检查 JWT payload 中的 role 字段是否为 'admin'
 * 替代旧的 group.name 查表方案
 */
@Injectable()
export class AdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.role !== 'admin') {
      throw new ForbiddenException('无管理权限');
    }

    return true;
  }
}

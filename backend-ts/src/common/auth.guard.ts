import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * JWT 鉴权 Guard v3.0
 *
 * 验证 Bearer Token（JWT），解析出 user 信息挂载到 request.user
 * 替代旧的 session 表查询方案
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 优先从 Authorization header 读取，fallback 到 query param（SSE 场景）
    let token: string | undefined;
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
    if (!token && request.query?.token) {
      token = request.query.token;
    }

    if (!token) {
      throw new UnauthorizedException('未登录，请先登录');
    }

    try {
      const payload = this.jwtService.verify(token);
      request.user = payload; // { sub, username, role, iat, exp }
      return true;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedException('token已过期，请重新登录');
      }
      throw new UnauthorizedException('token无效，请重新登录');
    }
  }
}

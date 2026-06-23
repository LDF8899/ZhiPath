import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '../../common/auth.guard';
import { success } from '../../common/api-response';

/**
 * Auth 控制器 v3.0
 * POST /api/admin/auth/login
 * POST /api/admin/auth/register
 * GET  /api/admin/auth/me
 */
@Controller('admin/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    const result = await this.authService.login(body.username, body.password);
    return success(result);
  }

  @Post('register')
  async register(@Body() body: { username: string; password: string; realName?: string }) {
    const result = await this.authService.register(body.username, body.password, body.realName);
    return success(result);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@Req() req: any) {
    // JWT 鉴权由 AuthGuard 完成，user 已挂载到 request
    const userId = req.user?.sub || req.user?.id;
    if (!userId) {
      return { code: 401, message: '未登录', data: null };
    }

    const user = await this.authService.getMe(Number(userId));
    if (!user) {
      return { code: 401, message: '用户不存在', data: null };
    }

    return success(user);
  }
}

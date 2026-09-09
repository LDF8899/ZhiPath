import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import {
  getRequestContext,
  PlatformRequest,
} from '../../platform/request-context/request-context.types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SwitchTenantDto } from './dto/switch-tenant.dto';

@ApiTags('v1 identity')
@ApiHeader({
  name: 'X-Client-App',
  required: true,
  description: 'zhipath-web 或 codenova-web',
})
@Controller('v1')
export class AuthV1Controller {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '统一客户端登录' })
  @ApiOkResponse({ description: '登录成功并签发带 azp 的访问令牌' })
  async login(@Req() request: PlatformRequest, @Body() body: LoginDto) {
    const { clientApp } = getRequestContext(request);
    if (clientApp === 'unknown') {
      throw new BadRequestException('缺少有效的 X-Client-App 请求头');
    }
    const result = await this.authService.login(
      body.username,
      body.password,
      clientApp,
    );
    return apiV1Success(request, result);
  }

  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '轮换刷新令牌并签发新访问令牌' })
  async refresh(@Req() request: PlatformRequest, @Body() body: RefreshTokenDto) {
    const { clientApp } = getRequestContext(request);
    if (clientApp === 'unknown') throw new BadRequestException('缺少有效的 X-Client-App 请求头');
    const result = await this.authService.refresh(body.refreshToken, clientApp);
    return apiV1Success(request, result);
  }

  @Get('me/tenants')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '当前用户可访问的租户列表' })
  async tenants(@Req() request: PlatformRequest) {
    const userId = Number(request.user?.sub || request.user?.id);
    return apiV1Success(request, await this.authService.listTenants(userId));
  }

  @Post('auth/switch-tenant')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '切换当前工作租户并轮换令牌' })
  async switchTenant(@Req() request: PlatformRequest, @Body() body: SwitchTenantDto) {
    const { clientApp } = getRequestContext(request);
    if (clientApp === 'unknown') throw new BadRequestException('缺少有效的 X-Client-App 请求头');
    const userId = Number(request.user?.sub || request.user?.id);
    const result = await this.authService.switchTenant(userId, Number(body.tenantId), clientApp);
    return apiV1Success(request, result);
  }

  @Post('auth/logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '撤销当前客户端刷新令牌' })
  async logout(@Req() request: PlatformRequest, @Body() body: RefreshTokenDto) {
    const { clientApp } = getRequestContext(request);
    await this.authService.revokeRefreshToken(body.refreshToken, clientApp);
    return apiV1Success(request, { revoked: true });
  }

  @Post('auth/register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '统一客户端注册' })
  async register(@Req() request: PlatformRequest, @Body() body: RegisterDto) {
    const result = await this.authService.register(
      body.username,
      body.password,
      body.realName,
    );
    return apiV1Success(request, result);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '当前用户' })
  async me(@Req() request: PlatformRequest) {
    const userId = request.user?.sub || request.user?.id;
    const tenantId = Number(request.user?.tenantId || 0) || undefined;
    const user = userId ? await this.authService.getMe(Number(userId), tenantId) : null;
    if (!user) throw new NotFoundException('用户不存在');
    return apiV1Success(request, user);
  }
}

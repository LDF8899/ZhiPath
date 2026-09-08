import { Controller, Get, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success } from '../../common/api-response';
import { UserLlmService } from './user-llm.service';

/**
 * 用户 AI 服务商配置 — /api/user/llm/*
 * 用户按预算自选服务商并自带 API Key；key 加密落库，云端请求走后端 LlmService 代理。
 */
@Controller('user/llm')
@UseGuards(AuthGuard)
export class UserLlmController {
  constructor(private readonly userLlmService: UserLlmService) {}

  /** GET /api/user/llm/providers — 可选服务商清单 */
  @Get('providers')
  listProviders() {
    return success(this.userLlmService.listProviders());
  }

  /** GET /api/user/llm/config — 当前用户配置（脱敏） */
  @Get('config')
  async getConfig(@CurrentUser('sub') userId: number) {
    return success(await this.userLlmService.getConfig(Number(userId)));
  }

  /** POST /api/user/llm/config — 保存当前用户配置 */
  @Post('config')
  async saveConfig(
    @CurrentUser('sub') userId: number,
    @Body() body: { provider?: string; apiKey?: string; baseUrl?: string },
  ) {
    const result = await this.userLlmService.saveConfig(Number(userId), body);
    return success(result, result.ok ? '已保存' : '参数错误');
  }

  /** DELETE /api/user/llm/config — 清除当前用户配置和已保存的密钥 */
  @Delete('config')
  async clearConfig(@CurrentUser('sub') userId: number) {
    await this.userLlmService.clearConfig(Number(userId));
    return success({ ok: true }, '已清除');
  }
}

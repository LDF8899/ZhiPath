import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { ChatService } from './chat.service';
import { ChatHistoryService } from '../../services/chat-history.service';

/** 跨定制前端共享的导师对话契约；正文仍允许存放 Mongo，索引和归属由用户身份约束。 */
@Controller('v1/chat')
@UseGuards(AuthGuard, ScopesGuard)
export class ChatV1Controller {
  constructor(private readonly chat: ChatService, private readonly history: ChatHistoryService) {}

  @Post()
  @RequireScopes('learning:write')
  async send(@Req() req: PlatformRequest, @Body() body: { message: string; sessionId?: string; pageContext?: string; session_id?: string; page_context?: string }) {
    const result = await this.chat.chat(this.userId(req), {
      message: body.message,
      session_id: body.sessionId || body.session_id,
      page_context: body.pageContext || body.page_context,
    }, { tenantId: this.tenantId(req), clientApp: req.requestContext?.clientApp });
    return apiV1Success(req, result);
  }

  @Get('sessions')
  @RequireScopes('learning:read')
  async sessions(@Req() req: PlatformRequest, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const p = Number(page) || 1; const ps = Math.min(100, Number(pageSize) || 20);
    return apiV1Success(req, await this.history.listSessions(this.userId(req), this.tenantId(req), p, ps));
  }

  @Get('sessions/:id')
  @RequireScopes('learning:read')
  async session(@Req() req: PlatformRequest, @Param('id') id: string) {
    return apiV1Success(req, await this.history.getSession(this.userId(req), id, this.tenantId(req)));
  }

  @Delete('sessions/:id')
  @RequireScopes('learning:write')
  async remove(@Req() req: PlatformRequest, @Param('id') id: string) {
    return apiV1Success(req, { deleted: await this.history.deleteSession(this.userId(req), id, this.tenantId(req)) });
  }

  private userId(req: PlatformRequest) { return Number(req.user?.sub || req.user?.id); }
  private tenantId(req: PlatformRequest) { const id = Number(req.user?.tenantId); if (!id) throw new Error('访问令牌缺少有效租户上下文'); return id; }
}

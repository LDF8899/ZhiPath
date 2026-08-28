import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success, pageSuccess, error } from '../../common/api-response';
import { ChatService } from './chat.service';
import { ChatHistoryService } from '../../services/chat-history.service';
import { ActionExecutorService } from './action-executor.service';
import { GeneratedResourceService } from '../../services/generated-resource.service';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../database/redis.module';

/**
 * Chat 控制器 — 对齐 Python POST /api/user/chat + chat-sessions
 *
 * 三层意图识别：
 *   Phase B: 关键词匹配（0延迟）
 *   Phase C: LLM Tool Calling（1-2s）
 *   Fallback: 普通 LLM 聊天
 */
@Controller('user')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(
    private chatService: ChatService,
    private chatHistory: ChatHistoryService,
    private actionExecutor: ActionExecutorService,
    private generatedResources: GeneratedResourceService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  /** POST /api/user/chat — 主聊天接口 */
  @Post('chat')
  async chat(
    @CurrentUser('sub') userId: number,
    @Body() body: { message: string; session_id?: string; page_context?: string },
  ) {
    const result = await this.chatService.chat(userId, body);
    return success(result);
  }

  /** GET /api/user/chat-sessions — 对话历史列表 */
  @Get('chat-sessions')
  async listSessions(
    @CurrentUser('sub') userId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = Number(page) || 1;
    const ps = Number(pageSize) || 20;
    const skip = (p - 1) * ps;

    try {
      const mongoDb = this.chatHistory.getDb();
      const query = { user_id: String(userId) };
      const cursor = mongoDb.collection('chat_sessions').find(query).sort({ created_at: -1 }).skip(skip).limit(ps);
      const items = await cursor.toArray();
      const total = await mongoDb.collection('chat_sessions').countDocuments(query);

      const cleaned = items.map((doc: any) => {
        doc._id = doc._id?.toString();
        return doc;
      });

      return pageSuccess(cleaned, total, p, ps);
    } catch (err: any) {
      console.error('[ChatController] listSessions failed:', err.message);
      throw new HttpException('获取会话列表失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /** GET /api/user/chat-sessions/:sessionId — 对话详情 */
  @Get('chat-sessions/:sessionId')
  async getSession(
    @CurrentUser('sub') userId: number,
    @Param('sessionId') sessionId: string,
  ) {
    try {
      const mongoDb = this.chatHistory.getDb();
      const doc = await mongoDb.collection('chat_sessions').findOne({
        session_id: sessionId,
        user_id: String(userId),
      });
      if (!doc) return success(null, '会话不存在');
      (doc as any)._id = doc._id?.toString();
      return success(doc);
    } catch (err: any) {
      console.error('[ChatController] getSession failed:', err.message);
      throw new HttpException('获取会话详情失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /** DELETE /api/user/chat-sessions/:sessionId — 删除对话 */
  @Delete('chat-sessions/:sessionId')
  async deleteSession(
    @CurrentUser('sub') userId: number,
    @Param('sessionId') sessionId: string,
  ) {
    try {
      const mongoDb = this.chatHistory.getDb();
      const result = await mongoDb.collection('chat_sessions').deleteOne({
        session_id: sessionId,
        user_id: String(userId),
      });
      await this.chatHistory.clearSession(userId, sessionId);
      return success({ deleted: result.deletedCount });
    } catch (err: any) {
      console.error('[ChatController] deleteSession failed:', err.message);
      throw new HttpException('删除会话失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /** GET /api/user/video-task/:taskId — 视频生成进度查询 */
  /** GET /api/user/generated-resources */
  @Get('generated-resources')
  async listGeneratedResources(
    @CurrentUser('sub') userId: number,
    @Query('chatSessionId') chatSessionId?: string,
    @Query('source') source?: string,
    @Query('resourceType') resourceType?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const resources = await this.generatedResources.listForUser(userId, {
      chatSessionId,
      source: source as any,
      resourceType,
      status: status as any,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return success(resources);
  }

  /** GET /api/user/generated-resources/:id */
  @Get('generated-resources/:id')
  async getGeneratedResource(@CurrentUser('sub') userId: number, @Param('id') id: string) {
    const resource = await this.generatedResources.getById(userId, parseInt(id, 10));
    return success(resource);
  }

  /** POST /api/user/generated-resources/:id/feedback */
  @Post('generated-resources/:id/feedback')
  async feedbackGeneratedResource(
    @CurrentUser('sub') userId: number,
    @Param('id') id: string,
    @Body() body: { useful: boolean },
  ) {
    const resource = await this.generatedResources.setFeedback(userId, parseInt(id, 10), Boolean(body.useful));
    return success(resource);
  }

  @Get('video-task/:taskId')
  async getVideoTask(@Param('taskId') taskId: string) {
    const task = await ActionExecutorService.getVideoTaskStatic(this.redis, taskId);
    if (!task) return success(null, '任务不存在或已过期');
    return success({
      status: task.status,
      progress: task.progress,
      message: task.message,
      result: task.result,
      error: task.error,
      elapsedSec: Math.round((Date.now() - task.startTime) / 1000),
    });
  }

  /** POST /api/user/video-task — 直接触发视频生成（跳过 IntentRouter），支持素材展示（assets） */
  @Post('video-task')
  async createVideoTask(
    @CurrentUser('sub') userId: number,
    @Body() body: any,
  ) {
    const result = await this.actionExecutor.generateVideoFromAction(body, userId);
    return success(result);
  }

}

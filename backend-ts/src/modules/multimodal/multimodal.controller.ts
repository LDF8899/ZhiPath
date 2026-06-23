import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success } from '../../common/api-response';
import { MultimodalService } from '../../services/multimodal.service';
import { XunfeiAvatarService } from '../../services/xunfei-avatar.service';

/**
 * 多模态智能体控制器 — T5
 *
 * POST /api/user/multimodal/animation  生成 HTML 动画
 * POST /api/user/multimodal/diagram    生成 Mermaid 图表
 * POST /api/user/multimodal/video      生成短视频（智谱，缺 key 优雅降级）
 * POST /api/user/multimodal/avatar     生成数字人讲解（讯飞，缺 key 优雅降级）
 * GET  /api/user/multimodal/:skill     聚合查询某技能已有多模态资源
 */
@Controller('user/multimodal')
@UseGuards(AuthGuard)
export class MultimodalController {
  constructor(
    private readonly multimodal: MultimodalService,
    private readonly xunfeiAvatar: XunfeiAvatarService,
  ) {}

  /** 生成 HTML 动画演示 */
  @Post('animation')
  async animation(
    @CurrentUser('sub') _userId: number,
    @Body() body: { skillName: string; difficulty?: string },
  ) {
    const result = await this.multimodal.generateAnimation(body.skillName, body.difficulty || 'beginner');
    return success(result);
  }

  /** 生成 Mermaid 图表 */
  @Post('diagram')
  async diagram(
    @CurrentUser('sub') _userId: number,
    @Body() body: { skillName: string; diagramType?: string },
  ) {
    const result = await this.multimodal.generateDiagram(body.skillName, body.diagramType || 'flowchart');
    return success(result);
  }

  /** 生成短视频（智谱 AI） */
  @Post('video')
  async video(
    @CurrentUser('sub') _userId: number,
    @Body() body: { skillName: string },
  ) {
    const result = await this.multimodal.generateVideo(body.skillName);
    return success(result);
  }

  /** 生成数字人讲解（讯飞） */
  @Post('avatar')
  async avatar(
    @CurrentUser('sub') _userId: number,
    @Body() body: { skillName: string },
  ) {
    const result = await this.multimodal.generateAvatar(body.skillName);
    return success(result);
  }

  /** 创建数字人会话（独立端点，前端按需调用） */
  @Post('avatar/session')
  async createAvatarSession(
    @CurrentUser('sub') _userId: number,
    @Body() body: { voiceId?: string },
  ) {
    const session = await this.xunfeiAvatar.createSession({ voiceId: body.voiceId });
    return success(session);
  }

  /** 向数字人会话发送文本驱动生成 */
  @Post('avatar/speak')
  async avatarSpeak(
    @CurrentUser('sub') _userId: number,
    @Body() body: { sessionId: string; text: string },
  ) {
    await this.xunfeiAvatar.sendText(body.sessionId, body.text);
    return success({ ok: true });
  }

  /** 关闭数字人会话 */
  @Delete('avatar/session/:id')
  async closeAvatarSession(
    @CurrentUser('sub') _userId: number,
    @Param('id') sessionId: string,
  ) {
    await this.xunfeiAvatar.closeSession(sessionId);
    return success({ ok: true });
  }

  /** 聚合查询某技能已有的全部多模态资源（不触发生成） */
  @Get(':skill')
  async list(@Param('skill') skill: string) {
    const result = await this.multimodal.getMultimodal(decodeURIComponent(skill));
    return success(result);
  }
}

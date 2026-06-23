import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * 讯飞数字人服务 — XunfeiAvatarService
 *
 * 职责：
 *   1. 获取 access_token（HMAC-SHA256 签名）
 *   2. 创建数字人会话（WebRTC 流）
 *   3. 发送文本驱动生成（数字人朗读讲解词）
 *   4. 关闭会话
 *
 * 讯飞数字人 API 文档：https://www.xfyun.cn/doc/digital-human/
 * 端点可通过 XFYUN_BASE_URL 环境变量覆盖（方便调试/切换环境）。
 */
@Injectable()
export class XunfeiAvatarService {
  private readonly logger = new Logger(XunfeiAvatarService.name);

  private readonly appId: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly avatarId: string;
  private readonly serviceId: string;
  private readonly baseUrl: string;

  /** 缓存的 access_token（有效期约 24h） */
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private config: ConfigService) {
    this.appId = this.config.get('XFYUN_APP_ID', '');
    this.apiKey = this.config.get('XFYUN_API_KEY', '');
    this.apiSecret = this.config.get('XFYUN_API_SECRET', '');
    this.avatarId = this.config.get('XFYUN_AVATAR_ID', '110017');
    this.serviceId = this.config.get('XFYUN_SERVICE_ID', '');
    this.baseUrl = this.config.get('XFYUN_BASE_URL', 'https://avatar.xfyun.cn/openapi');
  }

  /** 检查凭据是否已配置 */
  isConfigured(): boolean {
    return !!(this.appId && this.apiKey && this.apiSecret);
  }

  // ── 1. 获取 access_token ──────────────────────────────────

  /**
   * 获取讯飞 access_token。
   * 使用 APIKey + APISecret 通过 HMAC-SHA256 签名认证。
   * 自动缓存，过期前 5 分钟自动刷新。
   */
  async getAccessToken(): Promise<string> {
    // 命中缓存直接返回
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 5 * 60 * 1000) {
      return this.accessToken;
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();

    // 构造签名：HMAC-SHA256(appId + timestamp, apiSecret)
    const signString = this.appId + timestamp;
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(signString)
      .digest('base64');

    const url = `${this.baseUrl}/v1/token`;
    this.logger.log(`[XunfeiAvatar] Fetching access_token from ${url}`);

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: this.appId,
        apiKey: this.apiKey,
        apiSecret: this.apiSecret,
        timestamp,
        signature,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`获取 access_token 失败: HTTP ${resp.status} - ${text}`);
    }

    const json: any = await resp.json();
    if (json.code !== 0 && json.code !== '0') {
      throw new Error(`获取 access_token 失败: ${json.message || JSON.stringify(json)}`);
    }

    this.accessToken = json.data?.accessToken || json.accessToken || '';
    // token 有效期默认 24h
    this.tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000;
    this.logger.log('[XunfeiAvatar] access_token 获取成功');

    return this.accessToken!;
  }

  // ── 2. 创建数字人会话 ──────────────────────────────────────

  /**
   * 创建数字人会话，返回 WebRTC 播放所需的参数。
   *
   * @returns { sessionId, streamUrl, token, roomId, userId }
   */
  async createSession(options?: {
    voiceId?: string;
  }): Promise<XunfeiSessionResult> {
    if (!this.isConfigured()) {
      throw new Error('讯飞数字人凭据未配置');
    }

    const accessToken = await this.getAccessToken();
    const url = `${this.baseUrl}/v1/session/create`;

    this.logger.log(`[XunfeiAvatar] Creating session with avatarId=${this.avatarId}`);

    const body: Record<string, any> = {
      appId: this.appId,
      digitalHumanId: this.avatarId,
      rtcType: 'webrtc',
    };
    if (this.serviceId) {
      body.serviceId = this.serviceId;
    }
    if (options?.voiceId) {
      body.voiceId = options.voiceId;
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`创建会话失败: HTTP ${resp.status} - ${text}`);
    }

    const json: any = await resp.json();
    if (json.code !== 0 && json.code !== '0') {
      throw new Error(`创建会话失败: ${json.message || JSON.stringify(json)}`);
    }

    const data = json.data || json;
    const result: XunfeiSessionResult = {
      sessionId: data.sessionId || data.session_id || '',
      streamUrl: data.streamUrl || data.stream_url || data.rtcUrl || '',
      token: data.token || data.rtcToken || '',
      roomId: data.roomId || data.room_id || '',
      userId: data.userId || data.user_id || '',
    };

    this.logger.log(`[XunfeiAvatar] Session created: ${result.sessionId}`);
    return result;
  }

  // ── 3. 发送文本驱动生成 ──────────────────────────────────────

  /**
   * 向已创建的会话发送文本，驱动生成讲解视频。
   * 数字人会朗读传入的 text。
   */
  async sendText(sessionId: string, text: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('讯飞数字人凭据未配置');
    }

    const accessToken = await this.getAccessToken();
    const url = `${this.baseUrl}/v1/message`;

    this.logger.log(`[XunfeiAvatar] Sending text to session ${sessionId} (${text.length} chars)`);

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        sessionId,
        msgType: 'text',
        content: text,
      }),
    });

    if (!resp.ok) {
      const respText = await resp.text();
      throw new Error(`发送文本失败: HTTP ${resp.status} - ${respText}`);
    }

    const json: any = await resp.json();
    if (json.code !== 0 && json.code !== '0') {
      throw new Error(`发送文本失败: ${json.message || JSON.stringify(json)}`);
    }

    this.logger.log(`[XunfeiAvatar] Text sent to session ${sessionId}`);
  }

  // ── 4. 关闭会话 ──────────────────────────────────────────────

  /**
   * 关闭数字人会话，释放资源。
   */
  async closeSession(sessionId: string): Promise<void> {
    if (!this.isConfigured() || !sessionId) return;

    try {
      const accessToken = await this.getAccessToken();
      const url = `${this.baseUrl}/v1/session/close`;

      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ sessionId }),
      });

      this.logger.log(`[XunfeiAvatar] Session closed: ${sessionId}`);
    } catch (e: any) {
      this.logger.warn(`[XunfeiAvatar] 关闭会话失败（忽略）: ${e.message}`);
    }
  }
}

/** 讯飞数字人会话结果 */
export interface XunfeiSessionResult {
  sessionId: string;
  streamUrl: string;
  token: string;
  roomId: string;
  userId: string;
}

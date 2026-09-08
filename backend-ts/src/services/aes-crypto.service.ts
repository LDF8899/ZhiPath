import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * API Key 加解密 — AES-256-GCM
 *
 * 用户自带的 LLM API Key 以密文落库。密钥来自环境变量 LLM_KEY_ENCRYPT_SECRET；
 * 未配置该密钥时禁止写入，避免任何环境把用户密钥以可逆明文形式落库。
 */
@Injectable()
export class AesCryptoService {
  private readonly secret: string;
  private readonly configured: boolean;

  constructor(config: ConfigService) {
    this.secret = (config.get('LLM_KEY_ENCRYPT_SECRET') || '').trim();
    this.configured = Boolean(this.secret);
    if (!this.configured) {
      console.warn(
        '[AesCrypto] LLM_KEY_ENCRYPT_SECRET 未配置，用户 API Key 保存功能已禁用。',
      );
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /** 派生 AES 密钥：secret → sha256 → 32 字节 */
  private keyBytes(): Buffer {
    return createHash('sha256').update(this.secret).digest();
  }

  /**
   * 加密：iv(12) + tag(16) + cipher 拼接，base64 输出。
   * 未配置 secret 时拒绝加密，绝不降级为明文存储。
   */
  encrypt(plain: string): string {
    if (!plain) return '';
    if (!this.configured) throw new Error('LLM_KEY_ENCRYPT_SECRET 未配置');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.keyBytes(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  /** 解密 encrypt() 的输出。无法解析或校验失败时返回空串。 */
  decrypt(payload: string): string {
    if (!payload) return '';
    // 仅为迁移早期开发数据保留读取能力；后续保存会自动改写为 AES 密文。
    if (payload.startsWith('plain:')) {
      try {
        return Buffer.from(payload.slice(6), 'base64').toString('utf8');
      } catch {
        return '';
      }
    }
    try {
      const raw = Buffer.from(payload, 'base64');
      if (raw.length < 28) return '';
      const iv = raw.subarray(0, 12);
      const tag = raw.subarray(12, 28);
      const data = raw.subarray(28);
      const decipher = createDecipheriv('aes-256-gcm', this.keyBytes(), iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch {
      return '';
    }
  }
}

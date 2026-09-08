import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { UserLlmConfig } from '../../entities/user-llm-config.entity';
import { AesCryptoService } from '../../services/aes-crypto.service';
import { LLM_PROVIDER_OPTIONS, getLlmProvider } from '../../services/llm-provider.registry';

/**
 * 用户自选 LLM 服务商配置 — 读写 user_llm_config 表
 * API Key 加密落库，读取时只回脱敏后缀，明文永不出后端。
 */
@Injectable()
export class UserLlmService {
  private ensurePromise: Promise<void> | null = null;
  private readonly callCache = new Map<number, {
    expiresAt: number;
    value: { provider: string; apiKey: string; baseUrl?: string } | undefined;
  }>();

  constructor(
    @InjectRepository(UserLlmConfig) private readonly repo: Repository<UserLlmConfig>,
    private readonly aes: AesCryptoService,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  /** 确保表存在（synchronize=false，需手动建表） */
  private ensureTable(): Promise<void> {
    if (!this.ensurePromise) {
      this.ensurePromise = this.dataSource
        .query(`
          CREATE TABLE IF NOT EXISTS user_llm_config (
            id BIGINT NOT NULL AUTO_INCREMENT,
            status TINYINT NOT NULL DEFAULT 1,
            create_time BIGINT NULL,
            update_time BIGINT NULL,
            user_id BIGINT NOT NULL,
            provider VARCHAR(50) NOT NULL,
            api_key_enc TEXT NULL,
            base_url VARCHAR(300) NULL,
            enabled TINYINT NOT NULL DEFAULT 1,
            PRIMARY KEY (id),
            UNIQUE KEY uk_user_llm_config_user (user_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `)
        .then(() => undefined)
        .catch((e: any) => {
          this.ensurePromise = null;
          throw e;
        });
    }
    return this.ensurePromise;
  }

  /** 可选服务商清单，供前端展示 */
  listProviders() {
    return LLM_PROVIDER_OPTIONS.map((p) => ({
      id: p.id,
      label: p.label,
      defaultBaseUrl: p.defaultBaseUrl,
      note: p.note,
      accent: p.accent,
      needsApiKey: p.id !== 'ollama',
    }));
  }

  private maskKey(key: string): string | null {
    if (!key) return null;
    if (key.length <= 4) return '•'.repeat(key.length);
    return `${key.slice(0, 3)}••••${key.slice(-4)}`;
  }

  /**
   * 供 LlmService 调用前注入的「明文运行时配置」。
   * 仅服务端内部使用，返回明文 key 用于构造 OpenAI client，绝不对外暴露。
   */
  async getForCall(userId: number): Promise<{ provider: string; apiKey: string; baseUrl?: string } | undefined> {
    const cached = this.callCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    await this.ensureTable();
    const row = await this.repo.findOne({ where: { userId, status: 1, enabled: 1 } });
    if (!row) {
      this.callCache.set(userId, { expiresAt: Date.now() + 30_000, value: undefined });
      return undefined;
    }
    const provider = getLlmProvider(row.provider);
    if (!provider) return undefined;
    // ollama 无需 key
    if (provider.id === 'ollama') {
      const value = { provider: 'ollama', apiKey: '', baseUrl: row.baseUrl || undefined };
      this.callCache.set(userId, { expiresAt: Date.now() + 30_000, value });
      return value;
    }
    const clear = this.aes.decrypt(row.apiKeyEnc || '');
    if (!clear) return undefined; // key 解密失败视为未配置
    const value = { provider: provider.id, apiKey: clear, baseUrl: row.baseUrl || undefined };
    this.callCache.set(userId, { expiresAt: Date.now() + 30_000, value });
    return value;
  }

  /** 读取当前用户配置（脱敏视图，不回明文 key） */
  async getConfig(userId: number) {
    await this.ensureTable();
    const row = await this.repo.findOne({ where: { userId, status: 1 } });
    if (!row) {
      return { provider: null, configured: false, keyMasked: null, baseUrl: null, enabled: 0 };
    }
    const clear = this.aes.decrypt(row.apiKeyEnc || '');
    const provider = getLlmProvider(row.provider);
    const needsKey = (provider?.id ?? row.provider) !== 'ollama';
    // 配置了非 ollama 服务商但 key 解密失败/为空时视为未真正配置
    const configured = needsKey ? Boolean(clear) : Boolean(row.apiKeyEnc || row.enabled);
    return {
      provider: row.provider,
      configured,
      keyMasked: configured && needsKey ? this.maskKey(clear) : null,
      baseUrl: row.baseUrl || null,
      enabled: row.enabled,
    };
  }

  /** 保存当前用户配置（provider + apiKey，可选 baseUrl） */
  async saveConfig(userId: number, body: { provider?: string; apiKey?: string; baseUrl?: string }) {
    await this.ensureTable();
    const provider = (body.provider || '').trim();
    const providerDef = getLlmProvider(provider);
    if (!providerDef) {
      return { ok: false, message: `不支持的服务商：${provider}` };
    }

    const needsKey = provider !== 'ollama';
    const apiKey = (body.apiKey || '').trim();

    const existing = await this.repo.findOne({ where: { userId } });
    const existingClear = existing?.provider === provider
      ? this.aes.decrypt(existing.apiKeyEnc || '')
      : '';
    const canKeepExistingKey = Boolean(
      needsKey
      && !apiKey
      && existing
      && existing.provider === provider
      && existingClear,
    );
    if (needsKey && !apiKey && !canKeepExistingKey) {
      return { ok: false, message: '请填写该服务商的 API Key' };
    }

    let baseUrl: string | null = null;
    if (body.baseUrl && body.baseUrl.trim()) {
      try {
        const parsed = new URL(body.baseUrl.trim());
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
          return { ok: false, message: 'Base URL 必须是无账号密码的 HTTP(S) 地址' };
        }
        if (provider !== 'ollama' && parsed.protocol !== 'https:') {
          return { ok: false, message: '云端服务商的 Base URL 必须使用 HTTPS' };
        }
        baseUrl = parsed.toString().replace(/\/+$/, '');
      } catch {
        return { ok: false, message: 'Base URL 格式不正确' };
      }
    }

    if (needsKey && !this.aes.isConfigured()) {
      return { ok: false, message: '服务器尚未配置 API Key 加密密钥，请联系管理员' };
    }

    const now = Date.now();
    const enc = needsKey && apiKey ? this.aes.encrypt(apiKey) : '';

    if (existing) {
      // 用户没重填 key 时保留旧 key（前端交互时 key 输入框为空表示沿用）
      const finalEnc = canKeepExistingKey
        ? (existing.apiKeyEnc?.startsWith('plain:') ? this.aes.encrypt(existingClear) : existing.apiKeyEnc)
        : enc;
      existing.provider = provider;
      existing.apiKeyEnc = finalEnc || '';
      existing.baseUrl = baseUrl;
      existing.enabled = 1;
      existing.status = 1;
      existing.updateTime = now;
      await this.repo.save(existing);
    } else {
      const row = this.repo.create({
        userId,
        provider,
        apiKeyEnc: enc || '',
        baseUrl,
        enabled: 1,
        createTime: now,
        updateTime: now,
      });
      await this.repo.save(row);
    }

    const view = await this.getConfig(userId);
    this.callCache.delete(userId);
    return { ok: true, ...view };
  }

  /** 彻底删除配置，确保旧 API Key 密文也不再保留。 */
  async clearConfig(userId: number): Promise<void> {
    await this.ensureTable();
    await this.repo.delete({ userId });
    this.callCache.delete(userId);
  }
}

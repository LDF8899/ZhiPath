import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * 用户自选 LLM 服务商配置表 — user_llm_config
 *
 * 记录每位用户自带的 API Key（AES 加密存储，key 永不出后端）。
 * 用户按预算自选服务商，AI 请求走后端 LlmService 代理，费用进用户自己的服务商账户。
 */
@Entity('user_llm_config')
@Index(['tenantId', 'userId'], { unique: true })
export class UserLlmConfig extends BaseEntity {
  @Column({ type: 'bigint', name: 'tenant_id', default: 1 })
  tenantId: number;

  @Column({ type: 'bigint', name: 'user_id', comment: '关联users_v3' })
  userId: number;

  @Column({ type: 'varchar', length: 50, name: 'provider', comment: '服务商标识，如 deepseek/zhipu/openai/ollama' })
  provider: string;

  @Column({ type: 'text', name: 'api_key_enc', nullable: true, comment: '加密后的 API Key' })
  apiKeyEnc: string;

  /** 可选：OpenAI 兼容端点自定义 base URL（默认用该 provider 的官方地址） */
  @Column({ type: 'varchar', length: 300, name: 'base_url', nullable: true, comment: '可选自定义 base URL' })
  baseUrl: string | null;

  @Column({ type: 'tinyint', default: 1, name: 'enabled', comment: '1=启用（该用户 AI 请求走此配置）0=停用（回落平台默认）' })
  enabled: number;
}

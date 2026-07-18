import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type GeneratedResourceStatus = 'pending' | 'running' | 'success' | 'failed';
export type GeneratedResourceSource = 'chat' | 'agent_office' | 'knowledge' | 'queue' | 'manual';

@Entity('generated_resources_v3')
export class GeneratedResource extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', length: 40, name: 'resource_type' })
  resourceType: string;

  @Column({ type: 'varchar', length: 200, name: 'title' })
  title: string;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'skill_name' })
  skillName: string | null;

  @Column({ type: 'varchar', length: 30, default: 'manual', name: 'source' })
  source: GeneratedResourceSource;

  @Column({ type: 'bigint', nullable: true, name: 'source_task_id' })
  sourceTaskId: number | null;

  @Column({ type: 'varchar', length: 160, nullable: true, unique: true, name: 'external_id' })
  externalId: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true, name: 'chat_session_id' })
  chatSessionId: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true, name: 'chat_message_id' })
  chatMessageId: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'agent_type' })
  agentType: string | null;

  @Column({
    type: 'enum',
    enum: ['pending', 'running', 'success', 'failed'],
    default: 'pending',
    name: 'resource_status',
  })
  resourceStatus: GeneratedResourceStatus;

  @Column({ type: 'json', nullable: true, name: 'payload' })
  payload: Record<string, any> | any[] | null;

  @Column({ type: 'json', nullable: true, name: 'preview_meta' })
  previewMeta: Record<string, any> | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'provider' })
  provider: string | null;

  @Column({ type: 'json', nullable: true, name: 'raw_request' })
  rawRequest: Record<string, any> | null;

  @Column({ type: 'json', nullable: true, name: 'raw_response' })
  rawResponse: Record<string, any> | null;

  @Column({ type: 'int', default: 0, name: 'cost_tokens' })
  costTokens: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, name: 'cost_credits' })
  costCredits: number;

  @Column({ type: 'int', nullable: true, name: 'duration_ms' })
  durationMs: number | null;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;
}

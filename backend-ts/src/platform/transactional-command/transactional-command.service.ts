import { ConflictException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';

export interface CommandContext {
  tenantId: number;
  userId: number;
  clientApp: string;
  requestId: string;
  idempotencyKey: string;
  ipAddress?: string;
}

export interface CommandExecution {
  runner: QueryRunner;
  clientAppId: number;
  emit: (
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  audit: (
    action: string,
    resourceType: string,
    resourceId: string | null,
    details?: Record<string, unknown>,
  ) => Promise<void>;
}

@Injectable()
export class TransactionalCommandService {
  constructor(private readonly dataSource: DataSource) {}

  async execute<T extends Record<string, unknown>>(
    context: CommandContext,
    route: string,
    requestPayload: unknown,
    responseStatus: number,
    handler: (execution: CommandExecution) => Promise<T>,
  ): Promise<T & { idempotencyReplayed?: boolean }> {
    const requestHash = this.hash(JSON.stringify(requestPayload));
    const keyHash = this.hash(context.idempotencyKey);
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const clients = await runner.query(
        "SELECT id FROM client_apps WHERE client_key = ? AND status = 'active'",
        [context.clientApp],
      );
      if (!clients.length) throw new ConflictException('客户端未注册或已停用');
      const clientAppId = Number(clients[0].id);

      try {
        await runner.query(
          `INSERT INTO idempotency_keys
            (tenant_id, user_id, client_app_id, key_hash, route, request_hash, state, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, 'processing', DATE_ADD(NOW(3), INTERVAL 1 DAY))`,
          [context.tenantId, context.userId, clientAppId, keyHash, route, requestHash],
        );
      } catch (error: any) {
        if (error?.code !== 'ER_DUP_ENTRY' && error?.driverError?.code !== 'ER_DUP_ENTRY') throw error;
        const existing = await runner.query(
          `SELECT request_hash AS requestHash, state, response_json AS responseJson
             FROM idempotency_keys
            WHERE tenant_id = ? AND user_id = ? AND client_app_id = ?
              AND route = ? AND key_hash = ?`,
          [context.tenantId, context.userId, clientAppId, route, keyHash],
        );
        await runner.rollbackTransaction();
        if (!existing.length || existing[0].requestHash !== requestHash) {
          throw new ConflictException('Idempotency-Key 已被另一个请求使用');
        }
        if (existing[0].state !== 'completed') {
          throw new ConflictException('同一请求正在处理中，请稍后重试');
        }
        const response = this.parseJson(existing[0].responseJson) as T;
        return { ...response, idempotencyReplayed: true };
      }

      const execution: CommandExecution = {
        runner,
        clientAppId,
        emit: async (aggregateType, aggregateId, eventType, payload) => {
          await runner.query(
            `INSERT INTO outbox_events
              (public_id, tenant_id, aggregate_type, aggregate_id, event_type, payload_json)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [randomUUID(), context.tenantId, aggregateType, aggregateId, eventType, JSON.stringify(payload)],
          );
        },
        audit: async (action, resourceType, resourceId, details = {}) => {
          await runner.query(
            `INSERT INTO audit_logs
              (public_id, tenant_id, client_app_id, actor_user_id, action, resource_type,
               resource_id, request_id, result, ip_address, details_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success', ?, ?)`,
            [
              randomUUID(),
              context.tenantId,
              clientAppId,
              context.userId,
              action,
              resourceType,
              resourceId,
              context.requestId,
              context.ipAddress || null,
              JSON.stringify(details),
            ],
          );
        },
      };

      const response = await handler(execution);
      await runner.query(
        `UPDATE idempotency_keys
            SET state = 'completed', response_status = ?, response_json = ?
          WHERE tenant_id = ? AND user_id = ? AND client_app_id = ?
            AND route = ? AND key_hash = ?`,
        [
          responseStatus,
          JSON.stringify(response),
          context.tenantId,
          context.userId,
          clientAppId,
          route,
          keyHash,
        ],
      );
      await runner.commitTransaction();
      return response;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private parseJson(value: unknown): unknown {
    return typeof value === 'string' ? JSON.parse(value) : value;
  }
}

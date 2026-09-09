import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { LlmAttributionContext } from '../../services/llm.service';

export class PlatformJobCancelledError extends Error {
  constructor() {
    super('Platform job cancellation was requested');
    this.name = 'PlatformJobCancelledError';
  }
}

@Injectable()
export class PlatformJobTrackerService {
  constructor(private readonly dataSource: DataSource) {}

  async start(jobId?: string): Promise<boolean> {
    if (!jobId) return true;
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT id, agent_run_id AS agentRunId, status, cancel_requested_at AS cancelRequestedAt
           FROM async_jobs WHERE public_id = ? FOR UPDATE`,
        [jobId],
      );
      if (!rows.length) return false;
      if (this.shouldCancel(rows[0])) {
        await this.markCancelled(manager, rows[0].id, rows[0].agentRunId);
        return false;
      }
      if (!['queued', 'running'].includes(rows[0].status)) return false;
      await manager.query(
        `UPDATE async_jobs SET status = 'running', progress_percent = GREATEST(progress_percent, 1),
                started_at = COALESCE(started_at, NOW(3)), updated_at = NOW(3)
          WHERE public_id = ? AND status IN ('queued', 'running')`,
        [jobId],
      );
      if (rows[0].agentRunId) {
        await manager.query(
          `UPDATE agent_runs SET status = 'running', started_at = COALESCE(started_at, NOW(3)), updated_at = NOW(3)
            WHERE id = ?`,
          [rows[0].agentRunId],
        );
        await manager.query(
          `UPDATE agent_run_steps SET status = 'running', started_at = COALESCE(started_at, NOW(3))
            WHERE agent_run_id = ? AND sequence_no = 1`,
          [rows[0].agentRunId],
        );
      }
      return true;
    });
  }

  async getAttribution(jobId?: string): Promise<LlmAttributionContext | undefined> {
    if (!jobId) return undefined;
    const rows = await this.dataSource.query(
      `SELECT job.tenant_id AS tenantId, job.user_id AS userId,
              client.client_key AS clientApp, job.request_id AS requestId,
              job.agent_run_id AS agentRunId
         FROM async_jobs job
         JOIN client_apps client ON client.id = job.client_app_id
        WHERE job.public_id = ?`,
      [jobId],
    );
    if (!rows.length) return undefined;
    return {
      tenantId: Number(rows[0].tenantId),
      userId: Number(rows[0].userId),
      clientApp: rows[0].clientApp,
      requestId: rows[0].requestId,
      agentRunId: rows[0].agentRunId ? Number(rows[0].agentRunId) : null,
    };
  }

  /**
   * Cooperative cancellation checkpoint for work that cannot be forcefully
   * aborted by BullMQ once active. Returns false after durably finalizing the
   * platform job and its agent run as cancelled.
   */
  async checkpoint(jobId?: string): Promise<boolean> {
    if (!jobId) return true;
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT id, agent_run_id AS agentRunId, status, cancel_requested_at AS cancelRequestedAt
           FROM async_jobs WHERE public_id = ? FOR UPDATE`,
        [jobId],
      );
      if (!rows.length) return false;
      if (!this.shouldCancel(rows[0])) return ['queued', 'running'].includes(rows[0].status);
      await this.markCancelled(manager, rows[0].id, rows[0].agentRunId);
      return false;
    });
  }

  async assertActive(jobId?: string): Promise<void> {
    if (!(await this.checkpoint(jobId))) throw new PlatformJobCancelledError();
  }

  async finalizeCancellation(jobId?: string): Promise<void> {
    if (!jobId) return;
    await this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT id, agent_run_id AS agentRunId, status
           FROM async_jobs WHERE public_id = ? FOR UPDATE`,
        [jobId],
      );
      if (!rows.length || rows[0].status === 'completed') return;
      await this.markCancelled(manager, rows[0].id, rows[0].agentRunId);
    });
  }

  async progress(jobId: string | undefined, progress: number): Promise<void> {
    if (!jobId) return;
    await this.dataSource.query(
      `UPDATE async_jobs SET progress_percent = ?, updated_at = NOW(3)
        WHERE public_id = ? AND status = 'running'`,
      [Math.max(0, Math.min(100, Math.round(progress))), jobId],
    );
  }

  async complete(jobId: string | undefined, result: unknown): Promise<boolean> {
    if (!jobId) return true;
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT id, tenant_id AS tenantId, user_id AS userId, client_app_id AS clientAppId,
                agent_run_id AS agentRunId, job_type AS jobType, payload_json AS payload,
                request_id AS requestId, status
           FROM async_jobs WHERE public_id = ? FOR UPDATE`,
        [jobId],
      );
      if (!rows.length) return false;
      if (this.shouldCancel(rows[0])) {
        await this.markCancelled(manager, rows[0].id, rows[0].agentRunId);
        return false;
      }
      if (rows[0].status === 'completed') return true;
      if (rows[0].status !== 'running') return false;
      const row = rows[0];
      await manager.query(
        `UPDATE async_jobs SET status = 'completed', progress_percent = 100, result_json = ?,
                error_json = NULL, completed_at = NOW(3), updated_at = NOW(3)
          WHERE id = ?`,
        [JSON.stringify(result ?? null), row.id],
      );
      if (row.agentRunId) {
        await manager.query(
          `UPDATE agent_runs SET status = 'completed', output_json = ?, completed_at = NOW(3), updated_at = NOW(3)
            WHERE id = ?`,
          [JSON.stringify(result ?? null), row.agentRunId],
        );
        await manager.query(
          `UPDATE agent_run_steps SET status = 'completed', output_json = ?, completed_at = NOW(3)
            WHERE agent_run_id = ? AND sequence_no = 1`,
          [JSON.stringify(result ?? null), row.agentRunId],
        );
      }
      const artifactId = randomUUID();
      const payload = this.parseJson(row.payload) || {};
      await manager.query(
        `INSERT INTO generated_artifacts
          (public_id, tenant_id, owner_user_id, artifact_type, title, content_json,
           producer_run_id, provenance_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          artifactId,
          row.tenantId,
          row.userId,
          row.jobType,
          payload.skillName ? `${payload.skillName} ${row.jobType}` : row.jobType,
          JSON.stringify(result ?? null),
          row.agentRunId || null,
          JSON.stringify({ asyncJobId: jobId, requestId: row.requestId, clientAppId: row.clientAppId }),
        ],
      );
      await manager.query(
        `INSERT INTO outbox_events
          (public_id, tenant_id, aggregate_type, aggregate_id, event_type, payload_json)
         VALUES (?, ?, 'async_job', ?, 'async.job.completed.v1', ?)`,
        [randomUUID(), row.tenantId, jobId, JSON.stringify({ id: jobId, artifactId })],
      );
      return true;
    });
  }

  async fail(jobId: string | undefined, error: unknown, willRetry: boolean): Promise<void> {
    if (!jobId) return;
    const message = error instanceof Error ? error.message : String(error);
    await this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT id, agent_run_id AS agentRunId, status, cancel_requested_at AS cancelRequestedAt
           FROM async_jobs WHERE public_id = ? FOR UPDATE`,
        [jobId],
      );
      if (!rows.length) return;
      if (this.shouldCancel(rows[0])) {
        await this.markCancelled(manager, rows[0].id, rows[0].agentRunId);
        return;
      }
      const status = willRetry ? 'queued' : 'failed';
      await manager.query(
        `UPDATE async_jobs SET status = ?, error_json = ?, attempt_count = attempt_count + 1,
                completed_at = IF(? = 'failed', NOW(3), NULL), updated_at = NOW(3)
          WHERE public_id = ?`,
        [status, JSON.stringify({ message, retryable: willRetry }), status, jobId],
      );
      if (rows[0].agentRunId) {
        await manager.query(
          `UPDATE agent_runs SET status = ?, completed_at = IF(? = 'failed', NOW(3), NULL), updated_at = NOW(3)
            WHERE id = ?`,
          [status, status, rows[0].agentRunId],
        );
        await manager.query(
          `UPDATE agent_run_steps SET status = ?, error_json = ?,
                  completed_at = IF(? = 'failed', NOW(3), NULL)
            WHERE agent_run_id = ? AND sequence_no = 1`,
          [status, JSON.stringify({ message, retryable: willRetry }), status, rows[0].agentRunId],
        );
      }
      if (!willRetry) {
        await manager.query(
          `INSERT INTO outbox_events
            (public_id, tenant_id, aggregate_type, aggregate_id, event_type, payload_json)
           SELECT UUID(), tenant_id, 'async_job', public_id, 'async.job.failed.v1',
                  JSON_OBJECT('id', public_id, 'status', 'failed', 'message', ?)
             FROM async_jobs WHERE id = ?`,
          [message, rows[0].id],
        );
      }
    });
  }

  private shouldCancel(row: any): boolean {
    return row.status === 'cancelling' || row.status === 'cancelled' || Boolean(row.cancelRequestedAt);
  }

  private async markCancelled(manager: any, jobId: number, agentRunId?: number | null): Promise<void> {
    const updated = await manager.query(
      `UPDATE async_jobs SET status = 'cancelled', completed_at = COALESCE(completed_at, NOW(3)),
              updated_at = NOW(3) WHERE id = ? AND status NOT IN ('completed', 'cancelled')`,
      [jobId],
    );
    if (Number(updated?.affectedRows || 0) > 0) {
      await manager.query(
        `INSERT INTO outbox_events
          (public_id, tenant_id, aggregate_type, aggregate_id, event_type, payload_json)
         SELECT UUID(), tenant_id, 'async_job', public_id, 'async.job.cancelled.v1',
                JSON_OBJECT('id', public_id, 'status', 'cancelled')
           FROM async_jobs WHERE id = ?`,
        [jobId],
      );
    }
    if (!agentRunId) return;
    await manager.query(
      `UPDATE agent_runs SET status = 'cancelled', completed_at = COALESCE(completed_at, NOW(3)),
              updated_at = NOW(3) WHERE id = ? AND status <> 'completed'`,
      [agentRunId],
    );
    await manager.query(
      `UPDATE agent_run_steps SET status = 'cancelled', completed_at = COALESCE(completed_at, NOW(3))
        WHERE agent_run_id = ? AND status <> 'completed'`,
      [agentRunId],
    );
  }

  private parseJson(value: any): any {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  }
}

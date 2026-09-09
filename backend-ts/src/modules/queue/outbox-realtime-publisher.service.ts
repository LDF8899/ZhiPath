import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { EventsService } from '../events/events.service';

const REALTIME_EVENT_TYPES = [
  'async.job.completed.v1',
  'async.job.failed.v1',
  'async.job.cancelled.v1',
] as const;

/**
 * Publishes durable terminal job facts to the modular monolith's SSE channel.
 * The database job remains the source of truth; reconnecting clients reconcile
 * through GET /api/v1/jobs even when no SSE connection existed at publish time.
 */
@Injectable()
export class OutboxRealtimePublisherService {
  private readonly logger = new Logger(OutboxRealtimePublisherService.name);
  private publishing = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly events: EventsService,
  ) {}

  @Interval(1_000)
  async publish(): Promise<void> {
    if (this.publishing) return;
    this.publishing = true;
    try {
      const placeholders = REALTIME_EVENT_TYPES.map(() => '?').join(',');
      const rows = await this.dataSource.query(
        `SELECT id, aggregate_id AS aggregateId, event_type AS eventType, payload_json AS payload
           FROM outbox_events
          WHERE status = 'pending' AND available_at <= NOW(3)
            AND event_type IN (${placeholders})
          ORDER BY id LIMIT 50`,
        [...REALTIME_EVENT_TYPES],
      );
      for (const row of rows) await this.publishOne(row);
    } finally {
      this.publishing = false;
    }
  }

  private async publishOne(event: any): Promise<void> {
    const claimed = await this.dataSource.query(
      `UPDATE outbox_events SET status = 'processing', attempt_count = attempt_count + 1
        WHERE id = ? AND status = 'pending'`,
      [event.id],
    );
    if (!claimed.affectedRows) return;
    try {
      const jobs = await this.dataSource.query(
        `SELECT user_id AS userId, tenant_id AS tenantId, job_type AS jobType, status, progress_percent AS progress,
                result_json AS result, error_json AS error
           FROM async_jobs WHERE public_id = ?`,
        [event.aggregateId],
      );
      if (jobs.length) {
        const job = jobs[0];
        const eventPayload = {
          type: 'async_job_status',
          data: {
            id: event.aggregateId,
            type: job.jobType,
            status: job.status,
            progress: Number(job.progress),
            result: this.parseJson(job.result),
            error: this.parseJson(job.error),
            event: this.parseJson(event.payload),
          },
        };
        const tenantId = Number(job.tenantId || 1);
        if (tenantId === 1) this.events.emit(Number(job.userId), eventPayload);
        else this.events.emit(Number(job.userId), eventPayload, tenantId);
      }
      await this.dataSource.query(
        `UPDATE outbox_events SET status = 'published', published_at = NOW(3), last_error = NULL
          WHERE id = ?`,
        [event.id],
      );
    } catch (error: any) {
      this.logger.error(`Failed to publish realtime outbox event ${event.id}: ${error?.message || error}`);
      await this.dataSource.query(
        `UPDATE outbox_events
            SET status = IF(attempt_count >= 10, 'failed', 'pending'),
                available_at = DATE_ADD(NOW(3), INTERVAL 5 SECOND), last_error = ?
          WHERE id = ?`,
        [String(error?.message || error).slice(0, 4000), event.id],
      );
    }
  }

  private parseJson(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { QueueService } from './queue.service';
import { PlatformJobTrackerService } from './platform-job-tracker.service';

@Injectable()
export class OutboxJobDispatcherService {
  private readonly logger = new Logger(OutboxJobDispatcherService.name);
  private dispatching = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly queueService: QueueService,
    private readonly tracker: PlatformJobTrackerService,
  ) {}

  @Interval(1_000)
  async dispatch(): Promise<void> {
    if (this.dispatching) return;
    this.dispatching = true;
    try {
      const events = await this.dataSource.query(
        `SELECT id, event_type AS eventType, aggregate_id AS aggregateId, payload_json AS payload
           FROM outbox_events
          WHERE status = 'pending' AND available_at <= NOW(3)
            AND event_type IN ('async.job.requested.v1', 'async.job.cancellation_requested.v1')
          ORDER BY id LIMIT 20`,
      );
      for (const event of events) await this.dispatchOne(event);
    } finally {
      this.dispatching = false;
    }
  }

  private async dispatchOne(event: any): Promise<void> {
    const claimed = await this.dataSource.query(
      `UPDATE outbox_events SET status = 'processing', attempt_count = attempt_count + 1
        WHERE id = ? AND status = 'pending'`,
      [event.id],
    );
    if (!claimed.affectedRows) return;
    try {
      if (event.eventType === 'async.job.cancellation_requested.v1') {
        await this.cancel(event.aggregateId);
      } else {
        await this.enqueue(event.aggregateId, this.parseJson(event.payload));
      }
      await this.dataSource.query(
        `UPDATE outbox_events SET status = 'published', published_at = NOW(3), last_error = NULL
          WHERE id = ?`,
        [event.id],
      );
    } catch (error: any) {
      this.logger.error(`Failed to dispatch platform job event ${event.id}: ${error?.message || error}`);
      await this.dataSource.query(
        `UPDATE outbox_events
            SET status = IF(attempt_count >= 10, 'failed', 'pending'),
                available_at = DATE_ADD(NOW(3), INTERVAL 5 SECOND), last_error = ?
          WHERE id = ?`,
        [String(error?.message || error).slice(0, 4000), event.id],
      );
    }
  }

  private async enqueue(jobId: string, payload: any): Promise<void> {
    const rows = await this.dataSource.query(
      `SELECT user_id AS userId, job_type AS jobType, status, priority, sort_order AS sortOrder,
              queue_name AS queueName, queue_job_id AS queueJobId, payload_json AS payload,
              available_at AS availableAt, deleted_at AS deletedAt
         FROM async_jobs WHERE public_id = ?`,
      [jobId],
    );
    if (!rows.length) throw new Error(`Async job ${jobId} does not exist`);
    const row = rows[0];
    if (row.deletedAt || row.status !== 'queued') return;
    const forceRequeue = payload?.forceRequeue === true;
    if (row.queueJobId && forceRequeue) {
      const removed = await this.queueService.cancelJob(row.queueName, String(row.queueJobId));
      if (!removed) return;
      await this.dataSource.query(
        `UPDATE async_jobs SET queue_name = NULL, queue_job_id = NULL, updated_at = NOW(3) WHERE public_id = ?`,
        [jobId],
      );
      row.queueJobId = null;
    }
    if (row.queueJobId) return;
    const params = payload?.payload || this.parseJson(row.payload) || {};
    const availableAt = row.availableAt ? new Date(row.availableAt).getTime() : Date.now();
    const computedDelay = Math.max(0, availableAt - Date.now());
    const common = {
      priority: Number(row.priority || payload?.priority || 5),
      delay: Math.max(computedDelay, Number(payload?.delayMs || 0)),
      jobId,
      platformJobId: jobId,
    };
    const queued = (row.jobType.startsWith('agent.') || row.jobType === 'question.generate')
      ? await this.queueService.addAgentTask(row.userId, row.jobType === 'question.generate' ? 'question-generation' : row.jobType.slice(6), params, common)
      : await this.queueService.addResourceTask(row.userId, row.jobType.slice(9), params, common);
    await this.dataSource.query(
      `UPDATE async_jobs SET queue_name = ?, queue_job_id = ?, updated_at = NOW(3)
        WHERE public_id = ?`,
      [queued.queue, String(queued.jobId), jobId],
    );
  }

  private async cancel(jobId: string): Promise<void> {
    const rows = await this.dataSource.query(
      `SELECT queue_name AS queueName, queue_job_id AS queueJobId, status
         FROM async_jobs WHERE public_id = ?`,
      [jobId],
    );
    if (!rows.length) return;
    const row = rows[0];
    let removed = false;
    if (row.queueName && row.queueJobId) {
      removed = await this.queueService.cancelJob(row.queueName, String(row.queueJobId));
    }
    if (!row.queueJobId || removed) {
      await this.tracker.finalizeCancellation(jobId);
    }
  }

  private parseJson(value: any): any {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  }
}

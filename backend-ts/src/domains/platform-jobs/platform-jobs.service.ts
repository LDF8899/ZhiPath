import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  CommandContext,
  TransactionalCommandService,
} from '../../platform/transactional-command/transactional-command.service';
import { CreateAsyncJobDto } from './dto/create-async-job.dto';

@Injectable()
export class PlatformJobsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly commands: TransactionalCommandService,
  ) {}

  async list(tenantId: number, userId: number, page: number, pageSize: number, status?: string) {
    const offset = (page - 1) * pageSize;
    const statusClause = status ? ' AND status = ?' : '';
    const listParams = status ? [tenantId, userId, status, pageSize, offset] : [tenantId, userId, pageSize, offset];
    const countParams = status ? [tenantId, userId, status] : [tenantId, userId];
    const [items, countRows] = await Promise.all([
      this.dataSource.query(
        `SELECT public_id AS id, job_type AS type, status, priority, sort_order AS sortOrder,
                progress_percent AS progress,
                result_json AS result, error_json AS error, request_id AS requestId,
                attempt_count AS attemptCount, created_at AS createdAt,
                started_at AS startedAt, completed_at AS completedAt
           FROM async_jobs
          WHERE tenant_id = ? AND user_id = ? AND deleted_at IS NULL${statusClause}
          ORDER BY priority DESC, sort_order ASC, created_at DESC LIMIT ? OFFSET ?`,
        listParams,
      ),
      this.dataSource.query(
        `SELECT COUNT(*) AS total FROM async_jobs WHERE tenant_id = ? AND user_id = ? AND deleted_at IS NULL${statusClause}`,
        countParams,
      ),
    ]);
    const total = Number(countRows[0]?.total || 0);
    return {
      items: items.map((item: any) => ({
        ...item,
        progress: Number(item.progress),
        result: this.parseJson(item.result),
        error: this.parseJson(item.error),
      })),
      pageInfo: { page, pageSize, total, hasNextPage: offset + items.length < total },
    };
  }

  async get(tenantId: number, userId: number, publicId: string) {
    const rows = await this.dataSource.query(
      `SELECT job.public_id AS id, job.job_type AS type, job.status,
              job.priority, job.sort_order AS sortOrder, job.progress_percent AS progress, job.payload_json AS payload,
              job.result_json AS result, job.error_json AS error,
              job.request_id AS requestId, job.attempt_count AS attemptCount,
              job.created_at AS createdAt, job.started_at AS startedAt,
              job.completed_at AS completedAt, run.public_id AS agentRunId
         FROM async_jobs job
         LEFT JOIN agent_runs run ON run.id = job.agent_run_id
        WHERE job.public_id = ? AND job.tenant_id = ? AND job.user_id = ? AND job.deleted_at IS NULL`,
      [publicId, tenantId, userId],
    );
    if (!rows.length) throw new NotFoundException('异步作业不存在');
    return {
      ...rows[0],
      progress: Number(rows[0].progress),
      payload: this.parseJson(rows[0].payload),
      result: this.parseJson(rows[0].result),
      error: this.parseJson(rows[0].error),
    };
  }

  async create(context: CommandContext, dto: CreateAsyncJobDto) {
    return this.commands.execute(context, '/api/v1/jobs', dto, 202, async ({ runner, clientAppId, emit, audit }) => {
      const jobId = randomUUID();
      const orderRows = await runner.query(
        `SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextOrder
           FROM async_jobs WHERE tenant_id = ? AND user_id = ? AND deleted_at IS NULL`,
        [context.tenantId, context.userId],
      );
      const priority = Math.max(1, Math.min(10, Number(dto.priority || 5)));
      const sortOrder = Number(orderRows[0]?.nextOrder || 1);
      let agentRunId: number | null = null;
      let agentRunPublicId: string | null = null;
      if (dto.jobType.startsWith('agent.')) {
        agentRunPublicId = randomUUID();
        const runInsert = await runner.query(
          `INSERT INTO agent_runs
            (public_id, tenant_id, user_id, client_app_id, run_type, status, input_json, request_id)
           VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)`,
          [
            agentRunPublicId,
            context.tenantId,
            context.userId,
            clientAppId,
            dto.jobType.slice('agent.'.length),
            JSON.stringify(dto.payload),
            context.requestId,
          ],
        );
        agentRunId = Number(runInsert.insertId);
        await runner.query(
          `INSERT INTO agent_run_steps (tenant_id, agent_run_id, step_key, sequence_no, status, input_json)
           VALUES (?, ?, 'execute', 1, 'queued', ?)`,
          [context.tenantId, agentRunId, JSON.stringify(dto.payload)],
        );
      }
      await runner.query(
        `INSERT INTO async_jobs
          (public_id, tenant_id, user_id, client_app_id, agent_run_id, job_type,
           status, priority, sort_order, progress_percent, payload_json, request_id, available_at)
         VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?, 0, ?, ?, DATE_ADD(NOW(3), INTERVAL ? MICROSECOND))`,
        [
          jobId,
          context.tenantId,
          context.userId,
          clientAppId,
          agentRunId,
          dto.jobType,
          priority,
          sortOrder,
          JSON.stringify(dto.payload),
          context.requestId,
          (dto.delayMs || 0) * 1000,
        ],
      );
      const response = {
        id: jobId,
        type: dto.jobType,
        status: 'queued',
        progress: 0,
        agentRunId: agentRunPublicId,
      };
      await emit('async_job', jobId, 'async.job.requested.v1', {
        ...response,
        payload: dto.payload,
        priority,
        delayMs: dto.delayMs || 0,
      });
      await audit('async_job.create', 'async_job', jobId, {
        type: dto.jobType,
        agentRunId: agentRunPublicId,
      });
      return response;
    });
  }

  async cancel(context: CommandContext, jobId: string) {
    return this.commands.execute(
      context,
      '/api/v1/jobs/:id/cancel',
      { jobId },
      200,
      async ({ runner, emit, audit }) => {
        const rows = await runner.query(
          `SELECT id, status FROM async_jobs
            WHERE public_id = ? AND tenant_id = ? AND user_id = ? FOR UPDATE`,
          [jobId, context.tenantId, context.userId],
        );
        if (!rows.length) throw new NotFoundException('异步作业不存在');
        if (['completed', 'failed', 'cancelled'].includes(rows[0].status)) {
          throw new ConflictException('已结束的异步作业不能取消');
        }
        await runner.query(
          `UPDATE async_jobs SET status = 'cancelling', cancel_requested_at = NOW(3) WHERE id = ?`,
          [rows[0].id],
        );
        const response = { id: jobId, status: 'cancelling' };
        await emit('async_job', jobId, 'async.job.cancellation_requested.v1', response);
        await audit('async_job.cancel', 'async_job', jobId);
        return response;
      },
    );
  }

  async urgent(context: CommandContext, jobId: string) {
    return this.commands.execute(context, '/api/v1/agent-office/tasks/:id/urgent', { jobId }, 200, async ({ runner, emit, audit }) => {
      const rows = await runner.query(
        `SELECT id, status, priority, queue_job_id AS queueJobId
           FROM async_jobs WHERE public_id = ? AND tenant_id = ? AND user_id = ? AND deleted_at IS NULL FOR UPDATE`,
        [jobId, context.tenantId, context.userId],
      );
      if (!rows.length) throw new NotFoundException('异步作业不存在');
      if (!['queued', 'running'].includes(rows[0].status)) throw new ConflictException('只有排队中或执行中的作业可以调整优先级');
      const nextPriority = Number(rows[0].priority) === 10 ? 5 : 10;
      await runner.query(`UPDATE async_jobs SET priority = ?, updated_at = NOW(3) WHERE id = ?`, [nextPriority, rows[0].id]);
      const response = { id: jobId, priority: nextPriority, urgent: nextPriority === 10 };
      await emit('async_job', jobId, 'async.job.requested.v1', { ...response, forceRequeue: rows[0].status === 'queued' && !!rows[0].queueJobId });
      await audit('async_job.urgent', 'async_job', jobId, response);
      return response;
    });
  }

  /** 将排队任务移到队尾；执行中的任务保持运行，不会被强制中断。 */
  async skip(context: CommandContext, jobId: string) {
    return this.commands.execute(context, '/api/v1/agent-office/tasks/:id/skip', { jobId }, 200, async ({ runner, emit, audit }) => {
      const rows = await runner.query(
        `SELECT id, status, queue_job_id AS queueJobId
           FROM async_jobs WHERE public_id = ? AND tenant_id = ? AND user_id = ? AND deleted_at IS NULL FOR UPDATE`,
        [jobId, context.tenantId, context.userId],
      );
      if (!rows.length) throw new NotFoundException('异步作业不存在');
      if (rows[0].status !== 'queued') throw new ConflictException('只有排队中的作业可以跳过');
      const orderRows = await runner.query(
        `SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextOrder FROM async_jobs
          WHERE tenant_id = ? AND user_id = ? AND deleted_at IS NULL`,
        [context.tenantId, context.userId],
      );
      await runner.query(
        `UPDATE async_jobs SET sort_order = ?, available_at = DATE_ADD(NOW(3), INTERVAL 1 SECOND), updated_at = NOW(3) WHERE id = ?`,
        [Number(orderRows[0]?.nextOrder || 1), rows[0].id],
      );
      const response = { id: jobId, status: 'queued', skipped: true };
      await emit('async_job', jobId, 'async.job.requested.v1', { ...response, delayMs: 1000, forceRequeue: !!rows[0].queueJobId });
      await audit('async_job.skip', 'async_job', jobId, response);
      return response;
    });
  }

  async reorder(context: CommandContext, jobIds: string[]) {
    return this.commands.execute(context, '/api/v1/agent-office/tasks/reorder', { jobIds }, 200, async ({ runner, audit }) => {
      const ids = [...new Set(jobIds.map(String))].slice(0, 200);
      if (!ids.length) throw new ConflictException('至少提供一个任务');
      const placeholders = ids.map(() => '?').join(',');
      const rows = await runner.query(
        `SELECT public_id AS id FROM async_jobs WHERE tenant_id = ? AND user_id = ? AND deleted_at IS NULL AND status = 'queued' AND public_id IN (${placeholders})`,
        [context.tenantId, context.userId, ...ids],
      );
      const allowed = new Set(rows.map((r: any) => String(r.id)));
      let order = 0;
      for (const id of ids) if (allowed.has(id)) await runner.query(`UPDATE async_jobs SET sort_order = ?, updated_at = NOW(3) WHERE public_id = ?`, [order++, id]);
      await audit('async_job.reorder', 'async_job', null, { count: order });
      return { reordered: order };
    });
  }

  async remove(context: CommandContext, jobId: string) {
    return this.commands.execute(context, '/api/v1/agent-office/tasks/:id', { jobId }, 200, async ({ runner, emit, audit }) => {
      const rows = await runner.query(
        `SELECT id, status, queue_job_id AS queueJobId FROM async_jobs
          WHERE public_id = ? AND tenant_id = ? AND user_id = ? AND deleted_at IS NULL FOR UPDATE`,
        [jobId, context.tenantId, context.userId],
      );
      if (!rows.length) throw new NotFoundException('异步作业不存在');
      if (['completed', 'failed', 'cancelled'].includes(rows[0].status)) {
        await runner.query(`UPDATE async_jobs SET deleted_at = NOW(3), updated_at = NOW(3) WHERE id = ?`, [rows[0].id]);
      } else {
        await runner.query(`UPDATE async_jobs SET status = 'cancelling', cancel_requested_at = NOW(3), deleted_at = NOW(3), updated_at = NOW(3) WHERE id = ?`, [rows[0].id]);
        await emit('async_job', jobId, 'async.job.cancellation_requested.v1', { id: jobId, reason: 'deleted' });
      }
      await audit('async_job.delete', 'async_job', jobId);
      return { id: jobId, deleted: true };
    });
  }

  async retry(context: CommandContext, jobId: string) {
    return this.commands.execute(
      context,
      '/api/v1/jobs/:id/retry',
      { jobId },
      200,
      async ({ runner, emit, audit }) => {
        const rows = await runner.query(
          `SELECT id, job_type AS type, payload_json AS payload, priority, attempt_count AS attemptCount
             FROM async_jobs
            WHERE public_id = ? AND tenant_id = ? AND user_id = ?
              AND deleted_at IS NULL AND status IN ('failed', 'cancelled') FOR UPDATE`,
          [jobId, context.tenantId, context.userId],
        );
        if (!rows.length) throw new ConflictException('只有失败或已取消的异步作业可以重试');
        await runner.query(
          `UPDATE async_jobs SET status = 'queued', progress_percent = 0, result_json = NULL,
                  error_json = NULL, queue_name = NULL, queue_job_id = NULL,
                  attempt_count = attempt_count + 1, available_at = NOW(3),
                  started_at = NULL, completed_at = NULL, cancel_requested_at = NULL
            WHERE id = ?`,
          [rows[0].id],
        );
        const response = { id: jobId, type: rows[0].type, status: 'queued', progress: 0 };
        await emit('async_job', jobId, 'async.job.requested.v1', {
          ...response,
          payload: this.parseJson(rows[0].payload),
          priority: Number(rows[0].priority || 5),
          delayMs: 0,
          retry: Number(rows[0].attemptCount) + 1,
        });
        await audit('async_job.retry', 'async_job', jobId, { attempt: Number(rows[0].attemptCount) + 1 });
        return response;
      },
    );
  }

  private parseJson(value: any): any {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  }
}

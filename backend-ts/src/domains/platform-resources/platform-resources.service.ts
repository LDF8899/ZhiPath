import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class PlatformResourcesService {
  constructor(private readonly dataSource: DataSource) {}

  async list(tenantId: number, userId: number, page: number, pageSize: number, type?: string, search?: string) {
    const offset = (page - 1) * pageSize;
    const filters = ['artifact.tenant_id = ?', 'artifact.owner_user_id = ?', 'artifact.deleted_at IS NULL'];
    const params: unknown[] = [tenantId, userId];
    if (type?.trim()) {
      filters.push('artifact.artifact_type = ?');
      params.push(type.trim());
    }
    if (search?.trim()) {
      filters.push('artifact.title LIKE ?');
      params.push(`%${search.trim()}%`);
    }
    const where = filters.join(' AND ');
    const [rows, countRows] = await Promise.all([
      this.dataSource.query(
        `SELECT artifact.public_id AS id, artifact.artifact_type AS type,
                artifact.artifact_status AS status, artifact.schema_version AS schemaVersion, artifact.title,
                artifact.feedback_useful AS feedbackUseful, artifact.feedback_at AS feedbackAt,
                artifact.content_json AS content, artifact.object_key AS objectKey,
                artifact.provenance_json AS provenance, artifact.created_at AS createdAt,
                artifact.updated_at AS updatedAt, run.public_id AS producerRunId
           FROM generated_artifacts artifact
           LEFT JOIN agent_runs run ON run.id = artifact.producer_run_id
          WHERE ${where}
          ORDER BY artifact.created_at DESC, artifact.id DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
      ),
      this.dataSource.query(`SELECT COUNT(*) AS total FROM generated_artifacts artifact WHERE ${where}`, params),
    ]);
    const total = Number(countRows[0]?.total || 0);
    return {
      items: rows.map((row: any) => this.normalize(row)),
      pageInfo: { page, pageSize, total, hasNextPage: offset + rows.length < total },
    };
  }

  async detail(tenantId: number, userId: number, publicId: string) {
    const rows = await this.dataSource.query(
      `SELECT artifact.public_id AS id, artifact.artifact_type AS type,
              artifact.artifact_status AS status, artifact.schema_version AS schemaVersion, artifact.title,
              artifact.feedback_useful AS feedbackUseful, artifact.feedback_at AS feedbackAt,
              artifact.content_json AS content, artifact.object_key AS objectKey,
              artifact.provenance_json AS provenance, artifact.created_at AS createdAt,
              artifact.updated_at AS updatedAt, run.public_id AS producerRunId
         FROM generated_artifacts artifact
         LEFT JOIN agent_runs run ON run.id = artifact.producer_run_id
        WHERE artifact.public_id = ? AND artifact.tenant_id = ?
          AND artifact.owner_user_id = ? AND artifact.deleted_at IS NULL`,
      [publicId, tenantId, userId],
    );
    if (!rows.length) throw new NotFoundException('生成产物不存在');
    return this.normalize(rows[0]);
  }

  async search(tenantId: number, userId: number, query: string, limit: number) {
    const result = await this.list(tenantId, userId, 1, limit, undefined, query.trim() || undefined);
    return { items: result.items, pageInfo: result.pageInfo, query };
  }

  async feedback(tenantId: number, userId: number, publicId: string, useful: boolean) {
    const result = await this.dataSource.query(
      `UPDATE generated_artifacts
          SET feedback_useful = ?, feedback_at = NOW(3), updated_at = NOW(3)
        WHERE public_id = ? AND tenant_id = ? AND owner_user_id = ? AND deleted_at IS NULL`,
      [useful ? 1 : 0, publicId, tenantId, userId],
    );
    if (!Number(result?.affectedRows || 0)) throw new NotFoundException('生成产物不存在');
    return this.detail(tenantId, userId, publicId);
  }

  private normalize(row: any) {
    const provenance = this.parseJson(row.provenance) || {};
    return {
      ...row,
      status: row.status || 'completed',
      schemaVersion: Number(row.schemaVersion || 1),
      feedbackUseful: row.feedbackUseful === null || row.feedbackUseful === undefined
        ? null
        : Boolean(Number(row.feedbackUseful)),
      content: this.parseJson(row.content),
      provenance,
      source: provenance.source || null,
      skillName: provenance.skillName || null,
      chatSessionId: provenance.chatSessionId || null,
      errorMessage: provenance.errorMessage || null,
    };
  }

  private parseJson(value: unknown) {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  }
}

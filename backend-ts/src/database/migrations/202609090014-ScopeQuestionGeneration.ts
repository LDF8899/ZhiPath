import { MigrationInterface, QueryRunner } from 'typeorm';

/** 将题目生成任务纳入统一租户与 durable job 关联。 */
export class ScopeQuestionGeneration1788867000014 implements MigrationInterface {
  name = 'ScopeQuestionGeneration1788867000014';
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE question_generation_tasks ADD COLUMN tenant_id BIGINT NULL AFTER id');
    await q.query('ALTER TABLE question_generation_tasks ADD COLUMN platform_job_id CHAR(36) NULL AFTER tenant_id');
    await q.query('ALTER TABLE question_generation_snapshots ADD COLUMN tenant_id BIGINT NULL AFTER id');
    const backfill = `
      UPDATE %s t LEFT JOIN (
        SELECT user_id, MIN(tenant_id) tenant_id FROM tenant_memberships WHERE status='active' GROUP BY user_id
      ) m ON m.user_id=t.user_id SET t.tenant_id=COALESCE(m.tenant_id,1) WHERE t.tenant_id IS NULL`;
    await q.query(backfill.replace('%s', 'question_generation_tasks'));
    await q.query(backfill.replace('%s', 'question_generation_snapshots'));
    await q.query('ALTER TABLE question_generation_tasks MODIFY COLUMN tenant_id BIGINT NOT NULL');
    await q.query('ALTER TABLE question_generation_snapshots MODIFY COLUMN tenant_id BIGINT NOT NULL');
    await q.query('ALTER TABLE question_generation_tasks ADD UNIQUE KEY uq_question_generation_platform_job (platform_job_id)');
    await q.query('ALTER TABLE question_generation_tasks ADD KEY idx_question_generation_tenant_user_status (tenant_id,user_id,task_status)');
    await q.query('ALTER TABLE question_generation_snapshots ADD KEY idx_question_generation_snapshot_tenant_user (tenant_id,user_id)');
    await q.query('ALTER TABLE question_generation_tasks ADD CONSTRAINT fk_question_generation_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)');
    await q.query('ALTER TABLE question_generation_snapshots ADD CONSTRAINT fk_question_generation_snapshot_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)');
    await q.query('ALTER TABLE question_generation_tasks ADD CONSTRAINT fk_question_generation_platform_job FOREIGN KEY (platform_job_id) REFERENCES async_jobs(public_id)');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE question_generation_tasks DROP FOREIGN KEY fk_question_generation_platform_job');
    await q.query('ALTER TABLE question_generation_snapshots DROP FOREIGN KEY fk_question_generation_snapshot_tenant');
    await q.query('ALTER TABLE question_generation_tasks DROP FOREIGN KEY fk_question_generation_tenant');
    await q.query('ALTER TABLE question_generation_tasks DROP KEY idx_question_generation_tenant_user_status');
    await q.query('ALTER TABLE question_generation_snapshots DROP KEY idx_question_generation_snapshot_tenant_user');
    await q.query('ALTER TABLE question_generation_tasks DROP KEY uq_question_generation_platform_job');
    await q.query('ALTER TABLE question_generation_tasks DROP COLUMN platform_job_id');
    await q.query('ALTER TABLE question_generation_tasks DROP COLUMN tenant_id');
    await q.query('ALTER TABLE question_generation_snapshots DROP COLUMN tenant_id');
  }
}

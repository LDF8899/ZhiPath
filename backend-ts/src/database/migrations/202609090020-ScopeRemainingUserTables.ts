import { MigrationInterface, QueryRunner } from 'typeorm';

/** Add an explicit tenant column to every remaining user-owned legacy table. */
export class ScopeRemainingUserTables1788954600020 implements MigrationInterface {
  name = 'ScopeRemainingUserTables1788954600020';

  private readonly tables = [
    'course_abilities_v3',
    'course_chapters_v3',
    'evaluation_attempts_v3',
    'evaluation_dimension_scores_v3',
    'evaluation_evidence_v3',
    'evaluation_impacts_v3',
    'evaluation_results_v3',
    'evidence_chunks',
    'generated_resources_v3',
    'job_applications_v3',
    'knowledge_ingestion_tasks',
    'notifications_v3_legacy',
    'operation_logs_v3',
    'skill_snapshots',
  ];

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 1 AFTER id`);
      await queryRunner.query(`
        UPDATE ${table} legacy
        LEFT JOIN (
          SELECT user_id, MIN(tenant_id) AS tenant_id
          FROM tenant_memberships
          WHERE status = 'active'
          GROUP BY user_id
        ) membership ON membership.user_id = legacy.user_id
        SET legacy.tenant_id = COALESCE(membership.tenant_id, 1)
      `);
      await queryRunner.query(`
        ALTER TABLE ${table}
          ADD KEY idx_${table}_tenant_user (tenant_id, user_id),
          ADD CONSTRAINT fk_${table}_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [...this.tables].reverse()) {
      await queryRunner.query(`ALTER TABLE ${table} DROP FOREIGN KEY fk_${table}_tenant, DROP INDEX idx_${table}_tenant_user, DROP COLUMN tenant_id`);
    }
  }
}

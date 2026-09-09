import { MigrationInterface, QueryRunner } from 'typeorm';

/** Match history is user-owned and must follow the same tenant boundary. */
export class ScopeMatchHistory1788954600023 implements MigrationInterface {
  name = 'ScopeMatchHistory1788954600023';

  async up(queryRunner: QueryRunner): Promise<void> {
    const columns = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'match_history_v3' AND COLUMN_NAME = 'tenant_id'`,
    );
    if (!Number(columns[0]?.count || 0)) {
      await queryRunner.query(`ALTER TABLE match_history_v3 ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 1 AFTER userId`);
    }
    await queryRunner.query(`
      UPDATE match_history_v3 history
      LEFT JOIN (
        SELECT user_id, MIN(tenant_id) AS tenant_id
        FROM tenant_memberships WHERE status = 'active' GROUP BY user_id
      ) membership ON membership.user_id = history.userId
      SET history.tenant_id = COALESCE(membership.tenant_id, 1)
    `);
    const indexes = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'match_history_v3'
         AND INDEX_NAME = 'idx_match_history_tenant_user_job'`,
    );
    if (!Number(indexes[0]?.count || 0)) {
      await queryRunner.query(`ALTER TABLE match_history_v3 ADD INDEX idx_match_history_tenant_user_job (tenant_id, userId, jobId)`);
    }
    const constraints = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM information_schema.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'match_history_v3'
         AND CONSTRAINT_NAME = 'fk_match_history_tenant'`,
    );
    if (!Number(constraints[0]?.count || 0)) {
      await queryRunner.query(`ALTER TABLE match_history_v3 ADD CONSTRAINT fk_match_history_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE match_history_v3 DROP FOREIGN KEY fk_match_history_tenant, DROP INDEX idx_match_history_tenant_user_job, DROP COLUMN tenant_id`);
  }
}

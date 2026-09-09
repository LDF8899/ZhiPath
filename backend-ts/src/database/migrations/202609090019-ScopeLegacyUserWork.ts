import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tenant-scope the remaining actively used per-user legacy work tables.  The
 * default keeps compatibility controllers deployable while v1 services move
 * to explicit tenant filters.
 */
export class ScopeLegacyUserWork1788954600019 implements MigrationInterface {
  name = 'ScopeLegacyUserWork1788954600019';

  private readonly tables = [
    'learning_branches_v3',
    'learning_commits_v3',
    'skill_snapshots_v3',
    'learning_sessions_v3',
    'learning_tasks_v3',
    'resumes_v3',
    'remediation_runs',
    'user_llm_config',
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

    await queryRunner.query('ALTER TABLE user_llm_config DROP INDEX uk_user_llm_config_user');
    await queryRunner.query(
      'ALTER TABLE user_llm_config ADD UNIQUE KEY uk_user_llm_config_scope (tenant_id, user_id)',
    );

    // Composite parent keys let child foreign keys prove that linked records
    // belong to the same tenant, rather than merely existing globally.
    await queryRunner.query(
      'ALTER TABLE learning_plans_v3 ADD UNIQUE KEY uq_learning_plans_tenant_id (tenant_id, id)',
    );
    await queryRunner.query(
      'ALTER TABLE learning_branches_v3 ADD UNIQUE KEY uq_learning_branches_tenant_id (tenant_id, id)',
    );
    await queryRunner.query(
      'ALTER TABLE learning_commits_v3 ADD UNIQUE KEY uq_learning_commits_tenant_id (tenant_id, id)',
    );
    await queryRunner.query(`
      ALTER TABLE learning_branches_v3
        ADD CONSTRAINT fk_learning_branches_tenant_plan
        FOREIGN KEY (tenant_id, plan_id) REFERENCES learning_plans_v3(tenant_id, id)
    `);
    await queryRunner.query(`
      ALTER TABLE learning_commits_v3
        ADD CONSTRAINT fk_learning_commits_tenant_branch
        FOREIGN KEY (tenant_id, branch_id) REFERENCES learning_branches_v3(tenant_id, id)
    `);
    await queryRunner.query(`
      ALTER TABLE learning_tasks_v3
        ADD CONSTRAINT fk_learning_tasks_tenant_plan
        FOREIGN KEY (tenant_id, plan_id) REFERENCES learning_plans_v3(tenant_id, id)
    `);
    await queryRunner.query(`
      ALTER TABLE learning_sessions_v3
        ADD CONSTRAINT fk_learning_sessions_tenant_plan
        FOREIGN KEY (tenant_id, plan_id) REFERENCES learning_plans_v3(tenant_id, id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE learning_sessions_v3 DROP FOREIGN KEY fk_learning_sessions_tenant_plan');
    await queryRunner.query('ALTER TABLE learning_tasks_v3 DROP FOREIGN KEY fk_learning_tasks_tenant_plan');
    await queryRunner.query('ALTER TABLE learning_commits_v3 DROP FOREIGN KEY fk_learning_commits_tenant_branch');
    await queryRunner.query('ALTER TABLE learning_branches_v3 DROP FOREIGN KEY fk_learning_branches_tenant_plan');
    await queryRunner.query('ALTER TABLE learning_commits_v3 DROP INDEX uq_learning_commits_tenant_id');
    await queryRunner.query('ALTER TABLE learning_branches_v3 DROP INDEX uq_learning_branches_tenant_id');
    await queryRunner.query('ALTER TABLE learning_plans_v3 DROP INDEX uq_learning_plans_tenant_id');
    await queryRunner.query('ALTER TABLE user_llm_config DROP INDEX uk_user_llm_config_scope, ADD UNIQUE KEY uk_user_llm_config_user (user_id)');
    for (const table of [...this.tables].reverse()) {
      await queryRunner.query(`ALTER TABLE ${table} DROP FOREIGN KEY fk_${table}_tenant, DROP INDEX idx_${table}_tenant_user, DROP COLUMN tenant_id`);
    }
  }
}

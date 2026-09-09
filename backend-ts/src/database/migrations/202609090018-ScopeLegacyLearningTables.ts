import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bring the three historical learning tables into the same tenant boundary as
 * the v1 read models.  The columns intentionally default to the platform
 * tenant so old routes and existing rows remain deployable during migration.
 */
export class ScopeLegacyLearningTables1788954600018 implements MigrationInterface {
  name = 'ScopeLegacyLearningTables1788954600018';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE students_v3 ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 1 AFTER id',
    );
    await queryRunner.query(
      'ALTER TABLE user_skills_v3 ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 1 AFTER id',
    );
    await queryRunner.query(
      'ALTER TABLE learning_plans_v3 ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 1 AFTER id',
    );

    // A user may belong to more than one tenant.  Existing legacy rows are
    // assigned to their oldest active membership, falling back to tenant 1.
    for (const table of ['students_v3', 'user_skills_v3', 'learning_plans_v3']) {
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
    }

    await queryRunner.query('ALTER TABLE students_v3 DROP INDEX uk_user_id');
    await queryRunner.query(
      'ALTER TABLE students_v3 ADD UNIQUE KEY uk_students_tenant_user (tenant_id, user_id), ADD KEY idx_students_tenant (tenant_id)',
    );
    await queryRunner.query('ALTER TABLE user_skills_v3 DROP INDEX uk_user_skill');
    await queryRunner.query(
      'ALTER TABLE user_skills_v3 ADD UNIQUE KEY uk_user_skill_tenant (tenant_id, user_id, skill_name), ADD KEY idx_user_skills_tenant (tenant_id, user_id)',
    );
    await queryRunner.query(
      'ALTER TABLE learning_plans_v3 ADD KEY idx_learning_plans_tenant_user (tenant_id, user_id, plan_status), ADD CONSTRAINT fk_learning_plans_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)',
    );
    await queryRunner.query(
      'ALTER TABLE students_v3 ADD CONSTRAINT fk_students_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id), ADD KEY idx_students_tenant_user (tenant_id, user_id)',
    );
    await queryRunner.query(
      'ALTER TABLE user_skills_v3 ADD CONSTRAINT fk_user_skills_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE user_skills_v3 DROP FOREIGN KEY fk_user_skills_tenant, DROP INDEX uk_user_skill_tenant, DROP INDEX idx_user_skills_tenant, DROP COLUMN tenant_id');
    await queryRunner.query('ALTER TABLE students_v3 DROP FOREIGN KEY fk_students_tenant, DROP INDEX uk_students_tenant_user, DROP INDEX idx_students_tenant, DROP INDEX idx_students_tenant_user, ADD UNIQUE KEY uk_user_id (user_id), DROP COLUMN tenant_id');
    await queryRunner.query('ALTER TABLE learning_plans_v3 DROP FOREIGN KEY fk_learning_plans_tenant, DROP INDEX idx_learning_plans_tenant_user, DROP COLUMN tenant_id');
    await queryRunner.query('ALTER TABLE user_skills_v3 ADD UNIQUE KEY uk_user_skill (user_id, skill_name)');
  }
}

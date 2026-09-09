import { MigrationInterface, QueryRunner } from 'typeorm';

/** 将 Agent Office 的旧表纳入租户边界；旧数据按用户当前 membership 回填。 */
export class ScopeAgentOffice1788867000013 implements MigrationInterface {
  name = 'ScopeAgentOffice1788867000013';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE agent_profiles_v3 ADD COLUMN tenant_id BIGINT NULL AFTER id`);
    await queryRunner.query(`ALTER TABLE agent_tasks_v3 ADD COLUMN tenant_id BIGINT NULL AFTER id`);
    await queryRunner.query(`
      UPDATE agent_profiles_v3 p
      LEFT JOIN (
        SELECT user_id, MIN(tenant_id) AS tenant_id
        FROM tenant_memberships WHERE status = 'active' GROUP BY user_id
      ) m ON m.user_id = p.user_id
      SET p.tenant_id = COALESCE(m.tenant_id, 1)
      WHERE p.tenant_id IS NULL
    `);
    await queryRunner.query(`
      UPDATE agent_tasks_v3 t
      LEFT JOIN (
        SELECT user_id, MIN(tenant_id) AS tenant_id
        FROM tenant_memberships WHERE status = 'active' GROUP BY user_id
      ) m ON m.user_id = t.user_id
      SET t.tenant_id = COALESCE(m.tenant_id, 1)
      WHERE t.tenant_id IS NULL
    `);
    await queryRunner.query(`ALTER TABLE agent_profiles_v3 MODIFY COLUMN tenant_id BIGINT NOT NULL`);
    await queryRunner.query(`ALTER TABLE agent_tasks_v3 MODIFY COLUMN tenant_id BIGINT NOT NULL`);
    await queryRunner.query(`ALTER TABLE agent_profiles_v3 ADD KEY idx_agent_profiles_tenant_user (tenant_id, user_id, status)`);
    await queryRunner.query(`ALTER TABLE agent_tasks_v3 ADD KEY idx_agent_tasks_tenant_user_status (tenant_id, user_id, task_status, status)`);
    await queryRunner.query(`ALTER TABLE agent_profiles_v3 ADD CONSTRAINT fk_agent_profiles_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)`);
    await queryRunner.query(`ALTER TABLE agent_tasks_v3 ADD CONSTRAINT fk_agent_tasks_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE agent_tasks_v3 DROP FOREIGN KEY fk_agent_tasks_tenant');
    await queryRunner.query('ALTER TABLE agent_profiles_v3 DROP FOREIGN KEY fk_agent_profiles_tenant');
    await queryRunner.query('ALTER TABLE agent_tasks_v3 DROP KEY idx_agent_tasks_tenant_user_status');
    await queryRunner.query('ALTER TABLE agent_profiles_v3 DROP KEY idx_agent_profiles_tenant_user');
    await queryRunner.query('ALTER TABLE agent_tasks_v3 DROP COLUMN tenant_id');
    await queryRunner.query('ALTER TABLE agent_profiles_v3 DROP COLUMN tenant_id');
  }
}

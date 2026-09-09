import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenancyAndRbac1788867000002 implements MigrationInterface {
  name = 'CreateTenancyAndRbac1788867000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenants (
        id BIGINT NOT NULL AUTO_INCREMENT,
        tenant_key VARCHAR(64) NOT NULL,
        name VARCHAR(120) NOT NULL,
        tenant_type VARCHAR(32) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        plan_code VARCHAR(64) NOT NULL DEFAULT 'free',
        quota_config_json JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_tenants_key (tenant_key),
        KEY idx_tenants_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE roles (
        id BIGINT NOT NULL AUTO_INCREMENT,
        role_key VARCHAR(64) NOT NULL,
        name VARCHAR(100) NOT NULL,
        scope VARCHAR(20) NOT NULL DEFAULT 'tenant',
        PRIMARY KEY (id),
        UNIQUE KEY uq_roles_key (role_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE permissions (
        id BIGINT NOT NULL AUTO_INCREMENT,
        permission_key VARCHAR(100) NOT NULL,
        name VARCHAR(160) NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_permissions_key (permission_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE role_permissions (
        role_id BIGINT NOT NULL,
        permission_id BIGINT NOT NULL,
        PRIMARY KEY (role_id, permission_id),
        CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE tenant_memberships (
        id BIGINT NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        role_key VARCHAR(64) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_tenant_memberships_tenant_user (tenant_id, user_id),
        KEY idx_tenant_memberships_user_status (user_id, status),
        KEY idx_tenant_memberships_role (role_key),
        CONSTRAINT fk_tenant_memberships_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_tenant_memberships_user FOREIGN KEY (user_id) REFERENCES users_v3(id),
        CONSTRAINT fk_tenant_memberships_role FOREIGN KEY (role_key) REFERENCES roles(role_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE user_client_preferences (
        id BIGINT NOT NULL AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        client_app_id BIGINT NOT NULL,
        tenant_id BIGINT NOT NULL,
        onboarding_state VARCHAR(32) NOT NULL DEFAULT 'pending',
        locale VARCHAR(16) NOT NULL DEFAULT 'zh-CN',
        preference_json JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_user_client_preferences_scope (user_id, client_app_id, tenant_id),
        CONSTRAINT fk_user_client_preferences_user FOREIGN KEY (user_id) REFERENCES users_v3(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_client_preferences_client FOREIGN KEY (client_app_id) REFERENCES client_apps(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_client_preferences_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(
      `INSERT INTO tenants (tenant_key, name, tenant_type, plan_code, quota_config_json)
       VALUES ('platform-default', '智途学习平台', 'platform', 'development', JSON_OBJECT())`,
    );
    await queryRunner.query(`
      INSERT INTO roles (role_key, name, scope) VALUES
        ('student', '学习者', 'tenant'),
        ('admin', '租户管理员', 'tenant')
    `);
    await queryRunner.query(`
      INSERT INTO permissions (permission_key, name) VALUES
        ('learning:read', '查看学习数据'),
        ('learning:write', '修改学习数据'),
        ('assessment:take', '参加测评'),
        ('tenant:manage', '管理租户'),
        ('platform:*', '平台管理')
    `);
    await queryRunner.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r JOIN permissions p
       WHERE (r.role_key = 'student' AND p.permission_key IN ('learning:read', 'learning:write', 'assessment:take'))
          OR (r.role_key = 'admin')
    `);
    await queryRunner.query(`
      INSERT INTO tenant_memberships (tenant_id, user_id, role_key)
      SELECT t.id, u.id, u.role
        FROM tenants t JOIN users_v3 u
       WHERE t.tenant_key = 'platform-default' AND u.status = 1
    `);
    await queryRunner.query(`
      UPDATE client_apps c JOIN tenants t
         SET c.default_tenant_id = t.id
       WHERE t.tenant_key = 'platform-default'
    `);
    await queryRunner.query(`
      ALTER TABLE client_apps
        ADD CONSTRAINT fk_client_apps_default_tenant
        FOREIGN KEY (default_tenant_id) REFERENCES tenants(id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE client_apps DROP FOREIGN KEY fk_client_apps_default_tenant');
    await queryRunner.query('UPDATE client_apps SET default_tenant_id = NULL');
    await queryRunner.query('DROP TABLE user_client_preferences');
    await queryRunner.query('DROP TABLE tenant_memberships');
    await queryRunner.query('DROP TABLE role_permissions');
    await queryRunner.query('DROP TABLE permissions');
    await queryRunner.query('DROP TABLE roles');
    await queryRunner.query('DROP TABLE tenants');
  }
}

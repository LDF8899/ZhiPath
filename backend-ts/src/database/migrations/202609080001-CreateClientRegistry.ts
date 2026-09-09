import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClientRegistry1788867000001 implements MigrationInterface {
  name = 'CreateClientRegistry1788867000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE client_apps (
        id BIGINT NOT NULL AUTO_INCREMENT,
        client_key VARCHAR(64) NOT NULL,
        name VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        default_tenant_id BIGINT NULL,
        config_version INT NOT NULL DEFAULT 1,
        allowed_origins_json JSON NOT NULL,
        theme_config_json JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_client_apps_key (client_key),
        KEY idx_client_apps_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE client_features (
        id BIGINT NOT NULL AUTO_INCREMENT,
        client_app_id BIGINT NOT NULL,
        feature_key VARCHAR(100) NOT NULL,
        enabled TINYINT NOT NULL DEFAULT 1,
        config_json JSON NULL,
        rollout_percent TINYINT UNSIGNED NOT NULL DEFAULT 100,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_client_features_app_key (client_app_id, feature_key),
        CONSTRAINT fk_client_features_app FOREIGN KEY (client_app_id)
          REFERENCES client_apps(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(
      `INSERT INTO client_apps
        (client_key, name, allowed_origins_json, theme_config_json)
       VALUES (?, ?, ?, ?), (?, ?, ?, ?)`,
      [
        'zhipath-web',
        '智途 ZhiPath',
        JSON.stringify(['http://localhost:5173', 'http://127.0.0.1:5173']),
        JSON.stringify({ brand: 'zhipath', primaryColor: '#2563eb' }),
        'codenova-web',
        'CodeNova',
        JSON.stringify(['http://localhost:5180', 'http://127.0.0.1:5180']),
        JSON.stringify({ brand: 'codenova', primaryColor: '#7c3aed' }),
      ],
    );

    await queryRunner.query(`
      INSERT INTO client_features (client_app_id, feature_key, enabled, config_json)
      SELECT id, feature_key, enabled, JSON_OBJECT()
      FROM client_apps
      JOIN (
        SELECT 'dashboard' AS feature_key, 1 AS enabled
        UNION ALL SELECT 'learning-paths', 1
        UNION ALL SELECT 'assessment', 1
        UNION ALL SELECT 'remediation', 1
      ) defaults
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE client_features');
    await queryRunner.query('DROP TABLE client_apps');
  }
}

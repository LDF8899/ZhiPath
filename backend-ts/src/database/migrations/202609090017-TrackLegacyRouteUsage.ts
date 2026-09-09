import { MigrationInterface, QueryRunner } from 'typeorm';

/** 为兼容路由下线提供可审计的真实调用量，而不是依赖代码搜索猜测。 */
export class TrackLegacyRouteUsage1788867000017 implements MigrationInterface {
  name = 'TrackLegacyRouteUsage1788867000017';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE api_route_usage_daily (
        id BIGINT NOT NULL AUTO_INCREMENT,
        usage_date DATE NOT NULL,
        tenant_id BIGINT NOT NULL DEFAULT 0 COMMENT '0 表示匿名或尚未解析租户',
        client_app VARCHAR(100) NOT NULL,
        method VARCHAR(10) NOT NULL,
        route_pattern VARCHAR(500) NOT NULL,
        request_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
        error_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
        last_status_code SMALLINT UNSIGNED NULL,
        last_used_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_api_route_usage_dimension (usage_date, tenant_id, client_app, method, route_pattern),
        KEY idx_api_route_usage_route_date (route_pattern, usage_date),
        KEY idx_api_route_usage_client_date (client_app, usage_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE api_route_usage_daily');
  }
}

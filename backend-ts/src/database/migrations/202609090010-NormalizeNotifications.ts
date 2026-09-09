import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 将历史 notifications_v3 迁移为平台规范通知表。
 *
 * 通知是用户可见的业务事实，必须显式携带 tenant_id；client_app_id
 * 仅用于来源与观测，后台任务产生的通知允许为空，不能参与授权判断。
 */
export class NormalizeNotifications1788957000010 implements MigrationInterface {
  name = 'NormalizeNotifications1788957000010';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notifications (
        id BIGINT NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT NOT NULL,
        client_app_id BIGINT NULL,
        user_id BIGINT NOT NULL,
        type ENUM('learning','progress','job','exam','system') NOT NULL,
        title VARCHAR(200) NOT NULL,
        content TEXT NULL,
        link VARCHAR(500) NULL,
        is_read TINYINT NOT NULL DEFAULT 0,
        create_time BIGINT NULL,
        update_time BIGINT NULL,
        status TINYINT NULL DEFAULT 1,
        PRIMARY KEY (id),
        KEY idx_notifications_tenant_user_read (tenant_id, user_id, is_read, status, create_time),
        KEY idx_notifications_tenant_created (tenant_id, create_time),
        CONSTRAINT fk_notifications_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_notifications_client_app FOREIGN KEY (client_app_id) REFERENCES client_apps(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 一个用户在迁移期可能存在多条 membership，取最小的 active tenant，
    // 保证回填稳定且不会因为 join 放大历史通知行数。
    await queryRunner.query(`
      INSERT INTO notifications
        (id, tenant_id, client_app_id, user_id, type, title, content, link,
         is_read, create_time, update_time, status)
      SELECT n.id,
             COALESCE(tm.tenant_id, 1),
             NULL,
             n.user_id, n.type, n.title, n.content, n.link,
             n.is_read, n.create_time, n.update_time, COALESCE(n.status, 1)
        FROM notifications_v3 n
        LEFT JOIN (
          SELECT user_id, MIN(tenant_id) AS tenant_id
            FROM tenant_memberships
           WHERE status = 'active'
           GROUP BY user_id
        ) tm ON tm.user_id = n.user_id
    `);

    // 保留原表用于审计/回滚，但应用实体不再写入它。
    await queryRunner.query('RENAME TABLE notifications_v3 TO notifications_v3_legacy');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('RENAME TABLE notifications_v3_legacy TO notifications_v3');
    await queryRunner.query('DROP TABLE notifications');
  }
}

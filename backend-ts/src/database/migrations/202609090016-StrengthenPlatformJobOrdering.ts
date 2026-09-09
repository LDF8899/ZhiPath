import { MigrationInterface, QueryRunner } from 'typeorm';

/** 持久化平台任务的优先级、顺序及软删除状态，保证多前端看到同一份队列语义。 */
export class StrengthenPlatformJobOrdering1788867000016 implements MigrationInterface {
  name = 'StrengthenPlatformJobOrdering1788867000016';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE async_jobs
        ADD COLUMN priority TINYINT UNSIGNED NOT NULL DEFAULT 5 AFTER status,
        ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER priority,
        ADD COLUMN deleted_at DATETIME(3) NULL AFTER completed_at,
        ADD KEY idx_async_jobs_dispatch_priority (status, available_at, priority, sort_order, id),
        ADD KEY idx_async_jobs_tenant_user_order (tenant_id, user_id, deleted_at, priority, sort_order, created_at)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE async_jobs
        DROP INDEX idx_async_jobs_dispatch_priority,
        DROP INDEX idx_async_jobs_tenant_user_order,
        DROP COLUMN deleted_at,
        DROP COLUMN sort_order,
        DROP COLUMN priority
    `);
  }
}

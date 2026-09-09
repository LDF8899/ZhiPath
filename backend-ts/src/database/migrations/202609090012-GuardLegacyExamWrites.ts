import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 兼容尚未移除的历史考试写入口。规范 v1 写入会显式传 tenant_id；旧入口
 * 在完全下线前默认落入平台默认租户，避免 NOT NULL 升级造成运行时中断。
 */
export class GuardLegacyExamWrites1788957000012 implements MigrationInterface {
  name = 'GuardLegacyExamWrites1788957000012';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE exam_records_v3 MODIFY tenant_id BIGINT NOT NULL DEFAULT 1');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE exam_records_v3 MODIFY tenant_id BIGINT NOT NULL');
  }
}

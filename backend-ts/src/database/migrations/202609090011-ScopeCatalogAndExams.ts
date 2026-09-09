import { MigrationInterface, QueryRunner } from 'typeorm';

/** 为题库、考试记录和资讯目录补齐显式租户范围。 */
export class ScopeCatalogAndExams1788957000011 implements MigrationInterface {
  name = 'ScopeCatalogAndExams1788957000011';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE exam_questions_v3 ADD COLUMN tenant_id BIGINT NULL AFTER id');
    await queryRunner.query('ALTER TABLE exam_records_v3 ADD COLUMN tenant_id BIGINT NULL AFTER id');
    await queryRunner.query('ALTER TABLE news_v3 ADD COLUMN tenant_id BIGINT NULL AFTER id');

    await queryRunner.query(`
      UPDATE exam_records_v3 record
      LEFT JOIN (
        SELECT user_id, MIN(tenant_id) AS tenant_id
          FROM tenant_memberships
         WHERE status = 'active'
         GROUP BY user_id
      ) membership ON membership.user_id = record.user_id
      SET record.tenant_id = COALESCE(membership.tenant_id, 1)
    `);
    await queryRunner.query('ALTER TABLE exam_records_v3 MODIFY tenant_id BIGINT NOT NULL');
    await queryRunner.query('ALTER TABLE exam_records_v3 ADD KEY idx_exam_records_tenant_user (tenant_id, user_id, create_time)');
    await queryRunner.query('ALTER TABLE exam_records_v3 ADD CONSTRAINT fk_exam_records_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)');

    // 题目与资讯默认是平台公共目录；企业/学校专属内容可在后续写入 tenant_id。
    await queryRunner.query('ALTER TABLE exam_questions_v3 ADD KEY idx_exam_questions_tenant_status (tenant_id, status, create_time)');
    await queryRunner.query('ALTER TABLE exam_questions_v3 ADD CONSTRAINT fk_exam_questions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)');
    await queryRunner.query('ALTER TABLE news_v3 ADD KEY idx_news_tenant_status_publish (tenant_id, status, publish_time)');
    await queryRunner.query('ALTER TABLE news_v3 ADD CONSTRAINT fk_news_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE news_v3 DROP FOREIGN KEY fk_news_tenant, DROP INDEX idx_news_tenant_status_publish, DROP COLUMN tenant_id');
    await queryRunner.query('ALTER TABLE exam_questions_v3 DROP FOREIGN KEY fk_exam_questions_tenant, DROP INDEX idx_exam_questions_tenant_status, DROP COLUMN tenant_id');
    await queryRunner.query('ALTER TABLE exam_records_v3 DROP FOREIGN KEY fk_exam_records_tenant, DROP INDEX idx_exam_records_tenant_user, DROP COLUMN tenant_id');
  }
}

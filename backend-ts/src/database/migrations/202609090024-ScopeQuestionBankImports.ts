import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bring the OCR question-bank import workflow into the same tenant boundary
 * as exam_questions_v3. Older installations did not create these optional
 * tables at all, so this migration is deliberately idempotent.
 */
export class ScopeQuestionBankImports1788954600024 implements MigrationInterface {
  name = 'ScopeQuestionBankImports1788954600024';

  async up(queryRunner: QueryRunner): Promise<void> {
    const hasImports = await queryRunner.hasTable('question_bank_imports');
    if (!hasImports) {
      await queryRunner.query(`
        CREATE TABLE question_bank_imports (
          id BIGINT NOT NULL AUTO_INCREMENT,
          tenant_id BIGINT NOT NULL DEFAULT 1,
          user_id BIGINT NOT NULL,
          filename VARCHAR(512) NOT NULL,
          file_type VARCHAR(20) NOT NULL,
          import_status VARCHAR(32) NOT NULL DEFAULT 'processing',
          total_questions INT NOT NULL DEFAULT 0,
          imported_count INT NOT NULL DEFAULT 0,
          parse_result JSON NULL,
          progress INT NOT NULL DEFAULT 0,
          pages_total INT NOT NULL DEFAULT 0,
          pages_done INT NOT NULL DEFAULT 0,
          error_message TEXT NULL,
          storage_key VARCHAR(512) NULL,
          file_size INT NULL,
          file_hash VARCHAR(64) NULL,
          status TINYINT NOT NULL DEFAULT 1,
          create_time BIGINT NULL,
          update_time BIGINT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uq_qbi_tenant_id (tenant_id, id),
          KEY idx_qbi_tenant_user_time (tenant_id, user_id, create_time),
          KEY idx_qbi_status (status),
          CONSTRAINT fk_qbi_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } else {
      const table = await queryRunner.getTable('question_bank_imports');
      if (!table?.findColumnByName('tenant_id')) {
        await queryRunner.query('ALTER TABLE question_bank_imports ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 1 AFTER id');
      }
      await queryRunner.query('UPDATE question_bank_imports SET tenant_id = 1 WHERE tenant_id IS NULL');
      await queryRunner.query('ALTER TABLE question_bank_imports ADD KEY idx_qbi_tenant_user_time (tenant_id, user_id, create_time)').catch(() => undefined);
      await queryRunner.query('ALTER TABLE question_bank_imports ADD CONSTRAINT fk_qbi_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)').catch(() => undefined);
    }

    const hasCandidates = await queryRunner.hasTable('question_bank_import_candidates');
    if (!hasCandidates) {
      await queryRunner.query(`
        CREATE TABLE question_bank_import_candidates (
          id BIGINT NOT NULL AUTO_INCREMENT,
          tenant_id BIGINT NOT NULL DEFAULT 1,
          import_id BIGINT NOT NULL,
          user_id BIGINT NOT NULL,
          source_order INT NOT NULL,
          question_type VARCHAR(32) NOT NULL DEFAULT 'choice',
          stem TEXT NOT NULL,
          options JSON NULL,
          answer JSON NULL,
          explanation TEXT NULL,
          difficulty TINYINT NOT NULL DEFAULT 3,
          confidence DECIMAL(3,2) NULL,
          topic_suggestions JSON NULL,
          needs_review TINYINT NOT NULL DEFAULT 0,
          imported TINYINT NOT NULL DEFAULT 0,
          question_id BIGINT NULL,
          status TINYINT NOT NULL DEFAULT 1,
          create_time BIGINT NULL,
          update_time BIGINT NULL,
          PRIMARY KEY (id),
          KEY idx_qbic_tenant_import_order (tenant_id, import_id, source_order),
          KEY idx_qbic_tenant_user (tenant_id, user_id),
          CONSTRAINT fk_qbic_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
          CONSTRAINT fk_qbic_import FOREIGN KEY (tenant_id, import_id) REFERENCES question_bank_imports(tenant_id, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } else {
      const table = await queryRunner.getTable('question_bank_import_candidates');
      if (!table?.findColumnByName('tenant_id')) {
        await queryRunner.query('ALTER TABLE question_bank_import_candidates ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 1 AFTER id');
      }
      await queryRunner.query('UPDATE question_bank_import_candidates SET tenant_id = 1 WHERE tenant_id IS NULL');
      await queryRunner.query('ALTER TABLE question_bank_import_candidates ADD KEY idx_qbic_tenant_import_order (tenant_id, import_id, source_order)').catch(() => undefined);
      await queryRunner.query('ALTER TABLE question_bank_import_candidates ADD KEY idx_qbic_tenant_user (tenant_id, user_id)').catch(() => undefined);
      await queryRunner.query('ALTER TABLE question_bank_import_candidates ADD CONSTRAINT fk_qbic_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)').catch(() => undefined);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // These tables were optional and absent on the original schema. Drop only
    // the objects introduced by this migration, in dependency order.
    if (await queryRunner.hasTable('question_bank_import_candidates')) {
      await queryRunner.query('DROP TABLE question_bank_import_candidates');
    }
    if (await queryRunner.hasTable('question_bank_imports')) {
      await queryRunner.query('DROP TABLE question_bank_imports');
    }
  }
}

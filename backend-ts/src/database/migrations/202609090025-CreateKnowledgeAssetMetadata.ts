import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MySQL owns knowledge-asset identity and lifecycle metadata. MongoDB keeps
 * only the large, schema-versioned body during the transition period.
 */
export class CreateKnowledgeAssetMetadata1788954600025 implements MigrationInterface {
  name = 'CreateKnowledgeAssetMetadata1788954600025';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS knowledge_assets (
        id BIGINT NOT NULL AUTO_INCREMENT,
        public_id CHAR(36) NOT NULL,
        tenant_id BIGINT NULL,
        skill_key VARCHAR(191) NOT NULL,
        content_type VARCHAR(64) NOT NULL,
        title VARCHAR(500) NULL,
        source_ref VARCHAR(255) NULL,
        content_hash CHAR(64) NULL,
        schema_version INT NOT NULL DEFAULT 1,
        lifecycle_status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published',
        metadata_json JSON NULL,
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_knowledge_assets_public_id (public_id),
        UNIQUE KEY uq_knowledge_assets_scope (tenant_id, skill_key, content_type),
        KEY idx_knowledge_assets_tenant_status (tenant_id, lifecycle_status, updated_at),
        CONSTRAINT fk_knowledge_assets_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS knowledge_assets');
  }
}

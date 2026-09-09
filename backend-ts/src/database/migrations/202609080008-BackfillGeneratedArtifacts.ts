import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 将历史 generated_resources_v3 展开到规范产物台账。
 *
 * 迁移采用可重放设计：legacy_resource_id 在租户内唯一，重复执行不会重复插入。
 * 旧表暂不删除，供兼容接口和双读校验使用；后续发布周期再决定清理时机。
 */
export class BackfillGeneratedArtifacts1788867000008 implements MigrationInterface {
  name = 'BackfillGeneratedArtifacts1788867000008';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE generated_artifacts
        ADD COLUMN legacy_resource_id BIGINT NULL AFTER public_id,
        ADD COLUMN artifact_status VARCHAR(24) NOT NULL DEFAULT 'completed' AFTER artifact_type,
        ADD UNIQUE KEY uq_generated_artifacts_legacy (tenant_id, legacy_resource_id),
        ADD KEY idx_generated_artifacts_status (tenant_id, owner_user_id, artifact_status, created_at)
    `);

    await queryRunner.query(`
      INSERT INTO generated_artifacts
        (public_id, legacy_resource_id, tenant_id, owner_user_id, artifact_type,
         artifact_status, schema_version, title, content_json, provenance_json,
         created_at, updated_at)
      SELECT
        UUID(), legacy.id, membership.tenant_id, legacy.user_id, legacy.resource_type,
        CASE legacy.resource_status
          WHEN 'success' THEN 'completed'
          WHEN 'failed' THEN 'failed'
          WHEN 'running' THEN 'running'
          ELSE 'pending'
        END,
        1, legacy.title, legacy.payload,
        JSON_OBJECT(
          'source', legacy.source,
          'sourceTaskId', legacy.source_task_id,
          'externalId', legacy.external_id,
          'chatSessionId', legacy.chat_session_id,
          'chatMessageId', legacy.chat_message_id,
          'agentType', legacy.agent_type,
          'skillName', legacy.skill_name,
          'provider', legacy.provider,
          'previewMeta', legacy.preview_meta,
          'rawRequest', legacy.raw_request,
          'rawResponse', legacy.raw_response,
          'errorMessage', legacy.error_message
        ),
        FROM_UNIXTIME(COALESCE(legacy.create_time, legacy.update_time, UNIX_TIMESTAMP() * 1000) / 1000),
        FROM_UNIXTIME(COALESCE(legacy.update_time, legacy.create_time, UNIX_TIMESTAMP() * 1000) / 1000)
      FROM generated_resources_v3 legacy
      JOIN (
        SELECT user_id, MIN(tenant_id) AS tenant_id
          FROM tenant_memberships
         WHERE status = 'active'
         GROUP BY user_id
      ) membership ON membership.user_id = legacy.user_id
      WHERE legacy.status = 1
      ON DUPLICATE KEY UPDATE
        artifact_status = VALUES(artifact_status),
        title = VALUES(title),
        content_json = VALUES(content_json),
        provenance_json = VALUES(provenance_json),
        updated_at = VALUES(updated_at)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DELETE FROM generated_artifacts WHERE legacy_resource_id IS NOT NULL',
    );
    await queryRunner.query(`
      ALTER TABLE generated_artifacts
        DROP INDEX uq_generated_artifacts_legacy,
        DROP INDEX idx_generated_artifacts_status,
        DROP COLUMN artifact_status,
        DROP COLUMN legacy_resource_id
    `);
  }
}


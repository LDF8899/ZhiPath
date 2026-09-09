import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Preserve and quarantine legacy learning snapshots that reference missing
 * branches/commits, then enforce tenant-scoped referential integrity.
 */
export class ArchiveOrphanLearningSnapshots1788954600021 implements MigrationInterface {
  name = 'ArchiveOrphanLearningSnapshots1788954600021';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS legacy_orphan_archive (
        id BIGINT NOT NULL AUTO_INCREMENT,
        source_table VARCHAR(120) NOT NULL,
        source_id BIGINT NOT NULL,
        tenant_id BIGINT NULL,
        user_id BIGINT NULL,
        reason VARCHAR(255) NOT NULL,
        row_json JSON NOT NULL,
        archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_legacy_orphan_archive_source (source_table, source_id),
        KEY idx_legacy_orphan_archive_tenant (tenant_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Keep a full JSON copy before removing records that cannot satisfy the
    // new composite foreign keys. This is intentionally idempotent.
    await queryRunner.query(`
      INSERT INTO legacy_orphan_archive
        (source_table, source_id, tenant_id, user_id, reason, row_json)
      SELECT
        'skill_snapshots_v3', s.id, s.tenant_id, s.user_id,
        'missing learning branch or commit',
        JSON_OBJECT(
          'status', s.status,
          'id', s.id,
          'tenant_id', s.tenant_id,
          'create_time', s.create_time,
          'update_time', s.update_time,
          'user_id', s.user_id,
          'branch_id', s.branch_id,
          'commit_id', s.commit_id,
          'skills_json', s.skills_json,
          'radar_json', s.radar_json,
          'ability_metrics_json', s.ability_metrics_json,
          'match_summary_json', s.match_summary_json,
          'total_mastery', s.total_mastery,
          'skill_count', s.skill_count,
          'depth_score', s.depth_score,
          'breadth_score', s.breadth_score,
          'balance_score', s.balance_score
        )
      FROM skill_snapshots_v3 s
      LEFT JOIN learning_branches_v3 b
        ON b.tenant_id = s.tenant_id AND b.id = s.branch_id
      LEFT JOIN learning_commits_v3 c
        ON c.tenant_id = s.tenant_id AND c.id = s.commit_id
      WHERE (b.id IS NULL OR c.id IS NULL)
        AND NOT EXISTS (
          SELECT 1 FROM legacy_orphan_archive a
          WHERE a.source_table = 'skill_snapshots_v3' AND a.source_id = s.id
        )
    `);

    await queryRunner.query(`
      DELETE s FROM skill_snapshots_v3 s
      LEFT JOIN learning_branches_v3 b
        ON b.tenant_id = s.tenant_id AND b.id = s.branch_id
      LEFT JOIN learning_commits_v3 c
        ON c.tenant_id = s.tenant_id AND c.id = s.commit_id
      WHERE b.id IS NULL OR c.id IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE skill_snapshots_v3
        ADD KEY idx_skill_snapshots_v3_tenant_branch (tenant_id, branch_id),
        ADD CONSTRAINT fk_skill_snapshots_v3_tenant_branch
          FOREIGN KEY (tenant_id, branch_id)
          REFERENCES learning_branches_v3 (tenant_id, id),
        ADD CONSTRAINT fk_skill_snapshots_v3_tenant_commit
          FOREIGN KEY (tenant_id, commit_id)
          REFERENCES learning_commits_v3 (tenant_id, id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE skill_snapshots_v3
        DROP FOREIGN KEY fk_skill_snapshots_v3_tenant_commit,
        DROP FOREIGN KEY fk_skill_snapshots_v3_tenant_branch,
        DROP INDEX idx_skill_snapshots_v3_tenant_branch
    `);
    // The archive is deliberately retained on rollback so recovery remains
    // possible even if the integrity constraints are reverted.
  }
}

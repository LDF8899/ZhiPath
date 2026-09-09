import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Child records used to inherit tenant scope only through their parent row.
 * Keeping tenant_id on every transactional relation makes tenant filtering
 * explicit and composite foreign keys prevent a child from linking records
 * that belong to different tenants.
 */
export class EnforceTenantScopedChildren1788867000007 implements MigrationInterface {
  name = 'EnforceTenantScopedChildren1788867000007';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE learning_paths ADD UNIQUE KEY uq_learning_paths_tenant_id (tenant_id, id)');
    await queryRunner.query('ALTER TABLE learning_path_nodes ADD UNIQUE KEY uq_learning_path_nodes_tenant_id (tenant_id, id)');
    await queryRunner.query('ALTER TABLE competencies ADD UNIQUE KEY uq_competencies_tenant_id (tenant_id, id)');
    await queryRunner.query('ALTER TABLE assessment_attempts ADD UNIQUE KEY uq_assessment_attempts_tenant_id (tenant_id, id)');
    await queryRunner.query('ALTER TABLE assessment_items ADD UNIQUE KEY uq_assessment_items_tenant_id (tenant_id, id)');
    await queryRunner.query('ALTER TABLE evidence_items ADD UNIQUE KEY uq_evidence_items_tenant_id (tenant_id, id)');
    await queryRunner.query('ALTER TABLE learning_goals ADD UNIQUE KEY uq_learning_goals_tenant_id (tenant_id, id)');
    await queryRunner.query('ALTER TABLE learning_activities ADD UNIQUE KEY uq_learning_activities_tenant_id (tenant_id, id)');
    await queryRunner.query('ALTER TABLE agent_runs ADD UNIQUE KEY uq_agent_runs_tenant_id (tenant_id, id)');

    await queryRunner.query('ALTER TABLE learning_path_edges ADD COLUMN tenant_id BIGINT NULL AFTER id');
    await queryRunner.query(`
      UPDATE learning_path_edges edge
      JOIN learning_paths path ON path.id = edge.path_id
      SET edge.tenant_id = path.tenant_id
    `);
    await queryRunner.query(`
      ALTER TABLE learning_path_edges
        MODIFY tenant_id BIGINT NOT NULL,
        ADD KEY idx_learning_path_edges_tenant_path (tenant_id, path_id),
        ADD CONSTRAINT fk_learning_path_edges_tenant_path
          FOREIGN KEY (tenant_id, path_id) REFERENCES learning_paths(tenant_id, id),
        ADD CONSTRAINT fk_learning_path_edges_tenant_from
          FOREIGN KEY (tenant_id, from_node_id) REFERENCES learning_path_nodes(tenant_id, id),
        ADD CONSTRAINT fk_learning_path_edges_tenant_to
          FOREIGN KEY (tenant_id, to_node_id) REFERENCES learning_path_nodes(tenant_id, id)
    `);

    await queryRunner.query('ALTER TABLE assessment_responses ADD COLUMN tenant_id BIGINT NULL AFTER id');
    await queryRunner.query(`
      UPDATE assessment_responses response
      JOIN assessment_attempts attempt ON attempt.id = response.attempt_id
      SET response.tenant_id = attempt.tenant_id
    `);
    await queryRunner.query(`
      ALTER TABLE assessment_responses
        MODIFY tenant_id BIGINT NOT NULL,
        ADD KEY idx_assessment_responses_tenant_attempt (tenant_id, attempt_id),
        ADD CONSTRAINT fk_assessment_responses_tenant_attempt
          FOREIGN KEY (tenant_id, attempt_id) REFERENCES assessment_attempts(tenant_id, id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_assessment_responses_tenant_item
          FOREIGN KEY (tenant_id, item_id) REFERENCES assessment_items(tenant_id, id)
    `);

    await queryRunner.query('ALTER TABLE assessment_scores ADD COLUMN tenant_id BIGINT NULL AFTER id');
    await queryRunner.query(`
      UPDATE assessment_scores score
      JOIN assessment_attempts attempt ON attempt.id = score.attempt_id
      SET score.tenant_id = attempt.tenant_id
    `);
    await queryRunner.query(`
      ALTER TABLE assessment_scores
        MODIFY tenant_id BIGINT NOT NULL,
        ADD KEY idx_assessment_scores_tenant_attempt (tenant_id, attempt_id),
        ADD CONSTRAINT fk_assessment_scores_tenant_attempt
          FOREIGN KEY (tenant_id, attempt_id) REFERENCES assessment_attempts(tenant_id, id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_assessment_scores_tenant_competency
          FOREIGN KEY (tenant_id, competency_id) REFERENCES competencies(tenant_id, id)
    `);

    await queryRunner.query('ALTER TABLE evidence_links ADD COLUMN tenant_id BIGINT NULL AFTER id');
    await queryRunner.query(`
      UPDATE evidence_links link
      JOIN evidence_items item ON item.id = link.evidence_item_id
      SET link.tenant_id = item.tenant_id
    `);
    await queryRunner.query(`
      ALTER TABLE evidence_links
        MODIFY tenant_id BIGINT NOT NULL,
        ADD KEY idx_evidence_links_tenant_item (tenant_id, evidence_item_id),
        ADD CONSTRAINT fk_evidence_links_tenant_item
          FOREIGN KEY (tenant_id, evidence_item_id) REFERENCES evidence_items(tenant_id, id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_evidence_links_tenant_competency
          FOREIGN KEY (tenant_id, competency_id) REFERENCES competencies(tenant_id, id),
        ADD CONSTRAINT fk_evidence_links_tenant_goal
          FOREIGN KEY (tenant_id, learning_goal_id) REFERENCES learning_goals(tenant_id, id),
        ADD CONSTRAINT fk_evidence_links_tenant_activity
          FOREIGN KEY (tenant_id, learning_activity_id) REFERENCES learning_activities(tenant_id, id),
        ADD CONSTRAINT fk_evidence_links_tenant_attempt
          FOREIGN KEY (tenant_id, assessment_attempt_id) REFERENCES assessment_attempts(tenant_id, id)
    `);

    await queryRunner.query('ALTER TABLE agent_run_steps ADD COLUMN tenant_id BIGINT NULL AFTER id');
    await queryRunner.query(`
      UPDATE agent_run_steps step
      JOIN agent_runs run ON run.id = step.agent_run_id
      SET step.tenant_id = run.tenant_id
    `);
    await queryRunner.query(`
      ALTER TABLE agent_run_steps
        MODIFY tenant_id BIGINT NOT NULL,
        ADD KEY idx_agent_run_steps_tenant_run (tenant_id, agent_run_id),
        ADD CONSTRAINT fk_agent_run_steps_tenant_run
          FOREIGN KEY (tenant_id, agent_run_id) REFERENCES agent_runs(tenant_id, id) ON DELETE CASCADE
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE agent_run_steps
        DROP FOREIGN KEY fk_agent_run_steps_tenant_run,
        DROP INDEX idx_agent_run_steps_tenant_run,
        DROP COLUMN tenant_id
    `);
    await queryRunner.query(`
      ALTER TABLE evidence_links
        DROP FOREIGN KEY fk_evidence_links_tenant_attempt,
        DROP FOREIGN KEY fk_evidence_links_tenant_activity,
        DROP FOREIGN KEY fk_evidence_links_tenant_goal,
        DROP FOREIGN KEY fk_evidence_links_tenant_competency,
        DROP FOREIGN KEY fk_evidence_links_tenant_item,
        DROP INDEX idx_evidence_links_tenant_item,
        DROP COLUMN tenant_id
    `);
    await queryRunner.query(`
      ALTER TABLE assessment_scores
        DROP FOREIGN KEY fk_assessment_scores_tenant_competency,
        DROP FOREIGN KEY fk_assessment_scores_tenant_attempt,
        DROP INDEX idx_assessment_scores_tenant_attempt,
        DROP COLUMN tenant_id
    `);
    await queryRunner.query(`
      ALTER TABLE assessment_responses
        DROP FOREIGN KEY fk_assessment_responses_tenant_item,
        DROP FOREIGN KEY fk_assessment_responses_tenant_attempt,
        DROP INDEX idx_assessment_responses_tenant_attempt,
        DROP COLUMN tenant_id
    `);
    await queryRunner.query(`
      ALTER TABLE learning_path_edges
        DROP FOREIGN KEY fk_learning_path_edges_tenant_to,
        DROP FOREIGN KEY fk_learning_path_edges_tenant_from,
        DROP FOREIGN KEY fk_learning_path_edges_tenant_path,
        DROP INDEX idx_learning_path_edges_tenant_path,
        DROP COLUMN tenant_id
    `);
    await queryRunner.query('ALTER TABLE agent_runs DROP INDEX uq_agent_runs_tenant_id');
    await queryRunner.query('ALTER TABLE learning_activities DROP INDEX uq_learning_activities_tenant_id');
    await queryRunner.query('ALTER TABLE learning_goals DROP INDEX uq_learning_goals_tenant_id');
    await queryRunner.query('ALTER TABLE evidence_items DROP INDEX uq_evidence_items_tenant_id');
    await queryRunner.query('ALTER TABLE assessment_items DROP INDEX uq_assessment_items_tenant_id');
    await queryRunner.query('ALTER TABLE assessment_attempts DROP INDEX uq_assessment_attempts_tenant_id');
    await queryRunner.query('ALTER TABLE competencies DROP INDEX uq_competencies_tenant_id');
    await queryRunner.query('ALTER TABLE learning_path_nodes DROP INDEX uq_learning_path_nodes_tenant_id');
    await queryRunner.query('ALTER TABLE learning_paths DROP INDEX uq_learning_paths_tenant_id');
  }
}

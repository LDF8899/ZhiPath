import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLearningAndAssessmentCore1788867000005 implements MigrationInterface {
  name = 'CreateLearningAndAssessmentCore1788867000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE competencies (
        id BIGINT NOT NULL AUTO_INCREMENT,
        public_id CHAR(36) NOT NULL,
        tenant_id BIGINT NOT NULL,
        competency_key VARCHAR(160) NOT NULL,
        name VARCHAR(160) NOT NULL,
        domain_key VARCHAR(80) NOT NULL DEFAULT 'general',
        level_no INT NULL,
        description TEXT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_competencies_public_id (public_id),
        UNIQUE KEY uq_competencies_tenant_key (tenant_id, competency_key),
        KEY idx_competencies_tenant_domain (tenant_id, domain_key),
        CONSTRAINT fk_competencies_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE learning_goals (
        id BIGINT NOT NULL AUTO_INCREMENT,
        public_id CHAR(36) NOT NULL,
        tenant_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        goal_type VARCHAR(32) NOT NULL,
        title VARCHAR(200) NOT NULL,
        domain_key VARCHAR(80) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'active',
        legacy_plan_id BIGINT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_learning_goals_public_id (public_id),
        UNIQUE KEY uq_learning_goals_legacy (tenant_id, legacy_plan_id),
        KEY idx_learning_goals_owner_status (tenant_id, user_id, status),
        CONSTRAINT fk_learning_goals_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_learning_goals_user FOREIGN KEY (user_id) REFERENCES users_v3(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE learning_paths (
        id BIGINT NOT NULL AUTO_INCREMENT,
        public_id CHAR(36) NOT NULL,
        tenant_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        goal_id BIGINT NOT NULL,
        name VARCHAR(160) NOT NULL,
        path_kind VARCHAR(24) NOT NULL DEFAULT 'main',
        lifecycle_status VARCHAR(24) NOT NULL DEFAULT 'active',
        version_no INT NOT NULL DEFAULT 1,
        current_phase INT NOT NULL DEFAULT 0,
        daily_minutes INT NULL,
        snapshot_json JSON NULL,
        legacy_plan_id BIGINT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_learning_paths_public_id (public_id),
        UNIQUE KEY uq_learning_paths_legacy (tenant_id, legacy_plan_id),
        KEY idx_learning_paths_owner_status (tenant_id, user_id, lifecycle_status),
        CONSTRAINT fk_learning_paths_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_learning_paths_user FOREIGN KEY (user_id) REFERENCES users_v3(id),
        CONSTRAINT fk_learning_paths_goal FOREIGN KEY (goal_id) REFERENCES learning_goals(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE learning_path_nodes (
        id BIGINT NOT NULL AUTO_INCREMENT,
        public_id CHAR(36) NOT NULL,
        tenant_id BIGINT NOT NULL,
        path_id BIGINT NOT NULL,
        parent_node_id BIGINT NULL,
        competency_id BIGINT NULL,
        node_key VARCHAR(100) NOT NULL,
        node_type VARCHAR(32) NOT NULL,
        title VARCHAR(200) NOT NULL,
        position_no INT NOT NULL,
        lifecycle_status VARCHAR(24) NOT NULL DEFAULT 'planned',
        metadata_json JSON NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_learning_path_nodes_public_id (public_id),
        UNIQUE KEY uq_learning_path_nodes_key (path_id, node_key),
        KEY idx_learning_path_nodes_order (path_id, position_no),
        CONSTRAINT fk_learning_path_nodes_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_learning_path_nodes_path FOREIGN KEY (path_id) REFERENCES learning_paths(id) ON DELETE CASCADE,
        CONSTRAINT fk_learning_path_nodes_parent FOREIGN KEY (parent_node_id) REFERENCES learning_path_nodes(id),
        CONSTRAINT fk_learning_path_nodes_competency FOREIGN KEY (competency_id) REFERENCES competencies(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE learning_path_edges (
        id BIGINT NOT NULL AUTO_INCREMENT,
        path_id BIGINT NOT NULL,
        from_node_id BIGINT NOT NULL,
        to_node_id BIGINT NOT NULL,
        edge_type VARCHAR(24) NOT NULL DEFAULT 'next',
        PRIMARY KEY (id),
        UNIQUE KEY uq_learning_path_edges_nodes (path_id, from_node_id, to_node_id, edge_type),
        CONSTRAINT fk_learning_path_edges_path FOREIGN KEY (path_id) REFERENCES learning_paths(id) ON DELETE CASCADE,
        CONSTRAINT fk_learning_path_edges_from FOREIGN KEY (from_node_id) REFERENCES learning_path_nodes(id) ON DELETE CASCADE,
        CONSTRAINT fk_learning_path_edges_to FOREIGN KEY (to_node_id) REFERENCES learning_path_nodes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE learning_activities (
        id BIGINT NOT NULL AUTO_INCREMENT,
        public_id CHAR(36) NOT NULL,
        tenant_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        path_id BIGINT NOT NULL,
        path_node_id BIGINT NULL,
        competency_id BIGINT NULL,
        activity_type VARCHAR(32) NOT NULL,
        title VARCHAR(200) NOT NULL,
        activity_status VARCHAR(24) NOT NULL DEFAULT 'planned',
        planned_date DATE NULL,
        estimated_minutes INT NULL,
        actual_minutes INT NULL,
        priority TINYINT NOT NULL DEFAULT 5,
        started_at DATETIME(3) NULL,
        completed_at DATETIME(3) NULL,
        legacy_task_id BIGINT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_learning_activities_public_id (public_id),
        UNIQUE KEY uq_learning_activities_legacy (tenant_id, legacy_task_id),
        KEY idx_learning_activities_schedule (tenant_id, user_id, planned_date, activity_status),
        CONSTRAINT fk_learning_activities_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_learning_activities_user FOREIGN KEY (user_id) REFERENCES users_v3(id),
        CONSTRAINT fk_learning_activities_path FOREIGN KEY (path_id) REFERENCES learning_paths(id),
        CONSTRAINT fk_learning_activities_node FOREIGN KEY (path_node_id) REFERENCES learning_path_nodes(id),
        CONSTRAINT fk_learning_activities_competency FOREIGN KEY (competency_id) REFERENCES competencies(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE user_competency_states (
        id BIGINT NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        competency_id BIGINT NOT NULL,
        mastery_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
        confidence DECIMAL(4,3) NOT NULL DEFAULT 0.300,
        evidence_version INT NOT NULL DEFAULT 1,
        calculated_at DATETIME(3) NOT NULL,
        source_legacy_skill_id BIGINT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_user_competency_states_scope (tenant_id, user_id, competency_id),
        KEY idx_user_competency_states_mastery (tenant_id, user_id, mastery_percent),
        CONSTRAINT fk_user_competency_states_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_user_competency_states_user FOREIGN KEY (user_id) REFERENCES users_v3(id),
        CONSTRAINT fk_user_competency_states_competency FOREIGN KEY (competency_id) REFERENCES competencies(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE assessment_definitions (
        id BIGINT NOT NULL AUTO_INCREMENT,
        public_id CHAR(36) NOT NULL,
        tenant_id BIGINT NOT NULL,
        definition_key VARCHAR(120) NOT NULL,
        title VARCHAR(200) NOT NULL,
        assessment_kind VARCHAR(40) NOT NULL,
        version_no INT NOT NULL DEFAULT 1,
        status VARCHAR(24) NOT NULL DEFAULT 'published',
        settings_json JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_assessment_definitions_public_id (public_id),
        UNIQUE KEY uq_assessment_definitions_key_version (tenant_id, definition_key, version_no),
        CONSTRAINT fk_assessment_definitions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE assessment_items (
        id BIGINT NOT NULL AUTO_INCREMENT,
        public_id CHAR(36) NOT NULL,
        tenant_id BIGINT NOT NULL,
        definition_id BIGINT NOT NULL,
        competency_id BIGINT NULL,
        item_type VARCHAR(32) NOT NULL,
        prompt_text TEXT NOT NULL,
        content_json JSON NOT NULL,
        answer_json JSON NULL,
        difficulty TINYINT NULL,
        position_no INT NOT NULL DEFAULT 0,
        legacy_question_id BIGINT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_assessment_items_public_id (public_id),
        UNIQUE KEY uq_assessment_items_legacy (tenant_id, legacy_question_id),
        KEY idx_assessment_items_definition_order (definition_id, position_no),
        CONSTRAINT fk_assessment_items_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_assessment_items_definition FOREIGN KEY (definition_id) REFERENCES assessment_definitions(id),
        CONSTRAINT fk_assessment_items_competency FOREIGN KEY (competency_id) REFERENCES competencies(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE assessment_attempts (
        id BIGINT NOT NULL AUTO_INCREMENT,
        public_id CHAR(36) NOT NULL,
        tenant_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        definition_id BIGINT NULL,
        competency_id BIGINT NULL,
        assessment_kind VARCHAR(40) NOT NULL,
        attempt_status VARCHAR(24) NOT NULL,
        source_type VARCHAR(40) NOT NULL,
        source_legacy_id BIGINT NOT NULL,
        started_at DATETIME(3) NULL,
        completed_at DATETIME(3) NULL,
        metadata_json JSON NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_assessment_attempts_public_id (public_id),
        UNIQUE KEY uq_assessment_attempts_legacy (tenant_id, source_type, source_legacy_id),
        KEY idx_assessment_attempts_user_time (tenant_id, user_id, started_at),
        CONSTRAINT fk_assessment_attempts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_assessment_attempts_user FOREIGN KEY (user_id) REFERENCES users_v3(id),
        CONSTRAINT fk_assessment_attempts_definition FOREIGN KEY (definition_id) REFERENCES assessment_definitions(id),
        CONSTRAINT fk_assessment_attempts_competency FOREIGN KEY (competency_id) REFERENCES competencies(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE assessment_responses (
        id BIGINT NOT NULL AUTO_INCREMENT,
        attempt_id BIGINT NOT NULL,
        item_id BIGINT NULL,
        response_json JSON NOT NULL,
        is_correct TINYINT NULL,
        score DECIMAL(8,2) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY idx_assessment_responses_attempt (attempt_id),
        CONSTRAINT fk_assessment_responses_attempt FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE,
        CONSTRAINT fk_assessment_responses_item FOREIGN KEY (item_id) REFERENCES assessment_items(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE assessment_scores (
        id BIGINT NOT NULL AUTO_INCREMENT,
        attempt_id BIGINT NOT NULL,
        competency_id BIGINT NULL,
        score DECIMAL(8,2) NOT NULL,
        max_score DECIMAL(8,2) NOT NULL DEFAULT 100,
        normalized_score DECIMAL(6,2) NOT NULL,
        passed TINYINT NULL,
        confidence DECIMAL(4,3) NOT NULL DEFAULT 0.700,
        feedback_json JSON NULL,
        source_legacy_result_id BIGINT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY idx_assessment_scores_attempt (attempt_id),
        CONSTRAINT fk_assessment_scores_attempt FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE,
        CONSTRAINT fk_assessment_scores_competency FOREIGN KEY (competency_id) REFERENCES competencies(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE evidence_items (
        id BIGINT NOT NULL AUTO_INCREMENT,
        public_id CHAR(36) NOT NULL,
        tenant_id BIGINT NOT NULL,
        owner_user_id BIGINT NOT NULL,
        evidence_type VARCHAR(40) NOT NULL,
        summary VARCHAR(600) NULL,
        content_json JSON NULL,
        content_hash CHAR(64) NULL,
        confidence DECIMAL(4,3) NOT NULL DEFAULT 0.700,
        visibility VARCHAR(24) NOT NULL DEFAULT 'private',
        source_type VARCHAR(80) NULL,
        source_id VARCHAR(100) NULL,
        source_legacy_evidence_id BIGINT NULL,
        occurred_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_evidence_items_public_id (public_id),
        UNIQUE KEY uq_evidence_items_legacy (tenant_id, source_legacy_evidence_id),
        KEY idx_evidence_items_owner_time (tenant_id, owner_user_id, created_at),
        CONSTRAINT fk_evidence_items_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_evidence_items_owner FOREIGN KEY (owner_user_id) REFERENCES users_v3(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE evidence_links (
        id BIGINT NOT NULL AUTO_INCREMENT,
        evidence_item_id BIGINT NOT NULL,
        link_type VARCHAR(40) NOT NULL,
        competency_id BIGINT NULL,
        learning_goal_id BIGINT NULL,
        learning_activity_id BIGINT NULL,
        assessment_attempt_id BIGINT NULL,
        PRIMARY KEY (id),
        KEY idx_evidence_links_item (evidence_item_id),
        KEY idx_evidence_links_competency (competency_id, evidence_item_id),
        CONSTRAINT fk_evidence_links_item FOREIGN KEY (evidence_item_id) REFERENCES evidence_items(id) ON DELETE CASCADE,
        CONSTRAINT fk_evidence_links_competency FOREIGN KEY (competency_id) REFERENCES competencies(id),
        CONSTRAINT fk_evidence_links_goal FOREIGN KEY (learning_goal_id) REFERENCES learning_goals(id),
        CONSTRAINT fk_evidence_links_activity FOREIGN KEY (learning_activity_id) REFERENCES learning_activities(id),
        CONSTRAINT fk_evidence_links_attempt FOREIGN KEY (assessment_attempt_id) REFERENCES assessment_attempts(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Expand + backfill: existing v3 tables remain the active compatibility source.
    await queryRunner.query(`
      INSERT IGNORE INTO competencies (public_id, tenant_id, competency_key, name, domain_key)
      SELECT UUID(), t.id, LOWER(TRIM(sk.skill_name)), TRIM(sk.skill_name), 'general'
      FROM tenants t JOIN (
        SELECT skill_name FROM user_skills_v3 WHERE status = 1 AND skill_name IS NOT NULL AND skill_name <> ''
        UNION SELECT skill_name FROM learning_tasks_v3 WHERE status = 1 AND skill_name IS NOT NULL AND skill_name <> ''
        UNION SELECT skill_name FROM evaluation_attempts_v3 WHERE status = 1 AND skill_name IS NOT NULL AND skill_name <> ''
        UNION SELECT skill_name FROM exam_questions_v3 WHERE skill_name IS NOT NULL AND skill_name <> ''
      ) sk
      WHERE t.tenant_key = 'platform-default'
    `);
    await queryRunner.query(`
      INSERT INTO learning_goals
        (public_id, tenant_id, user_id, goal_type, title, domain_key, status, legacy_plan_id, created_at, updated_at)
      SELECT UUID(), tm.tenant_id, p.user_id, p.goal_type,
             COALESCE(NULLIF(p.goal_title, ''), p.plan_name), p.domain_id,
             p.plan_status, p.id,
             FROM_UNIXTIME(COALESCE(p.create_time, UNIX_TIMESTAMP() * 1000) / 1000),
             FROM_UNIXTIME(COALESCE(p.update_time, p.create_time, UNIX_TIMESTAMP() * 1000) / 1000)
        FROM learning_plans_v3 p
        JOIN tenant_memberships tm ON tm.user_id = p.user_id AND tm.status = 'active'
       WHERE p.status = 1
    `);
    await queryRunner.query(`
      INSERT INTO learning_paths
        (public_id, tenant_id, user_id, goal_id, name, path_kind, lifecycle_status, current_phase,
         daily_minutes, snapshot_json, legacy_plan_id, created_at, updated_at)
      SELECT UUID(), g.tenant_id, p.user_id, g.id, p.plan_name, p.plan_type, p.plan_status, p.current_phase,
             IFNULL(ROUND(p.daily_hours * 60), NULL), p.path_data, p.id, g.created_at, g.updated_at
        FROM learning_plans_v3 p JOIN learning_goals g ON g.legacy_plan_id = p.id
       WHERE p.status = 1
    `);
    await queryRunner.query(`
      INSERT INTO learning_path_nodes
        (public_id, tenant_id, path_id, node_key, node_type, title, position_no, lifecycle_status, metadata_json)
      SELECT UUID(), lp.tenant_id, lp.id, CONCAT('phase-', phase_data.phase_no), 'phase',
             COALESCE(NULLIF(phase_data.phase_name, ''), CONCAT('阶段 ', phase_data.phase_no)),
             phase_data.phase_no * 1000, 'planned', JSON_OBJECT()
        FROM learning_paths lp
        JOIN learning_plans_v3 legacy ON legacy.id = lp.legacy_plan_id
        JOIN JSON_TABLE(legacy.path_data, '$.phases[*]' COLUMNS (
          phase_no FOR ORDINALITY,
          phase_name VARCHAR(200) PATH '$.name'
        )) phase_data
    `);
    await queryRunner.query(`
      INSERT INTO learning_path_nodes
        (public_id, tenant_id, path_id, parent_node_id, competency_id, node_key, node_type, title,
         position_no, lifecycle_status, metadata_json)
      SELECT UUID(), lp.tenant_id, lp.id, parent.id, c.id,
             CONCAT('skill-', phase_data.phase_no, '-', skill_data.skill_no), 'competency',
             COALESCE(NULLIF(skill_data.skill_name, ''), CONCAT('能力 ', phase_data.phase_no, '-', skill_data.skill_no)),
             phase_data.phase_no * 1000 + skill_data.skill_no,
             CASE skill_data.skill_status
               WHEN 'done' THEN 'completed' WHEN 'in_progress' THEN 'in_progress' ELSE 'planned' END,
             JSON_OBJECT('legacyDuration', skill_data.duration_text)
        FROM learning_paths lp
        JOIN learning_plans_v3 legacy ON legacy.id = lp.legacy_plan_id
        JOIN JSON_TABLE(legacy.path_data, '$.phases[*]' COLUMNS (
          phase_no FOR ORDINALITY,
          skills JSON PATH '$.skills'
        )) phase_data
        JOIN JSON_TABLE(phase_data.skills, '$[*]' COLUMNS (
          skill_no FOR ORDINALITY,
          skill_name VARCHAR(200) PATH '$.name',
          skill_status VARCHAR(40) PATH '$.status',
          duration_text VARCHAR(80) PATH '$.duration'
        )) skill_data
        JOIN learning_path_nodes parent ON parent.path_id = lp.id AND parent.node_key = CONCAT('phase-', phase_data.phase_no)
        LEFT JOIN competencies c ON c.tenant_id = lp.tenant_id AND c.competency_key = LOWER(TRIM(skill_data.skill_name))
    `);
    await queryRunner.query(`
      INSERT INTO learning_path_edges (path_id, from_node_id, to_node_id, edge_type)
      SELECT path_id, id, next_id, 'next'
      FROM (
        SELECT id, path_id, LEAD(id) OVER (PARTITION BY path_id ORDER BY position_no, id) AS next_id
        FROM learning_path_nodes WHERE node_type = 'competency'
      ) ordered_nodes
      WHERE next_id IS NOT NULL
    `);
    await queryRunner.query(`
      INSERT INTO learning_activities
        (public_id, tenant_id, user_id, path_id, competency_id, activity_type, title, activity_status,
         planned_date, estimated_minutes, actual_minutes, priority, started_at, completed_at,
         legacy_task_id, created_at, updated_at)
      SELECT UUID(), lp.tenant_id, task.user_id, lp.id, c.id, task.task_type, task.skill_name,
             CASE task.task_status
               WHEN 'pending' THEN 'planned' WHEN 'done' THEN 'completed'
               WHEN 'skipped' THEN 'skipped' ELSE 'in_progress' END,
             STR_TO_DATE(task.plan_date, '%Y-%m-%d'), task.estimated_min, task.actual_min, task.priority,
             IF(task.start_time IS NULL, NULL, FROM_UNIXTIME(task.start_time / 1000)),
             IF(task.complete_time IS NULL, NULL, FROM_UNIXTIME(task.complete_time / 1000)),
             task.id,
             FROM_UNIXTIME(COALESCE(task.create_time, UNIX_TIMESTAMP() * 1000) / 1000),
             FROM_UNIXTIME(COALESCE(task.update_time, task.create_time, UNIX_TIMESTAMP() * 1000) / 1000)
        FROM learning_tasks_v3 task
        JOIN learning_paths lp ON lp.legacy_plan_id = task.plan_id
        LEFT JOIN competencies c ON c.tenant_id = lp.tenant_id AND c.competency_key = LOWER(TRIM(task.skill_name))
       WHERE task.status = 1
    `);
    await queryRunner.query(`
      INSERT INTO user_competency_states
        (tenant_id, user_id, competency_id, mastery_percent, confidence, calculated_at, source_legacy_skill_id)
      SELECT tm.tenant_id, s.user_id, c.id, s.mastery_pct, LEAST(1, s.trust_weight),
             FROM_UNIXTIME(COALESCE(s.update_time, s.create_time, UNIX_TIMESTAMP() * 1000) / 1000), s.id
        FROM user_skills_v3 s
        JOIN tenant_memberships tm ON tm.user_id = s.user_id AND tm.status = 'active'
        JOIN competencies c ON c.tenant_id = tm.tenant_id AND c.competency_key = LOWER(TRIM(s.skill_name))
       WHERE s.status = 1
      ON DUPLICATE KEY UPDATE
        mastery_percent = VALUES(mastery_percent), confidence = VALUES(confidence),
        calculated_at = VALUES(calculated_at), source_legacy_skill_id = VALUES(source_legacy_skill_id)
    `);
    await queryRunner.query(`
      INSERT INTO assessment_definitions
        (public_id, tenant_id, definition_key, title, assessment_kind, settings_json)
      SELECT UUID(), t.id, CONCAT('legacy-exam-type-', types.exam_type),
             CONCAT('历史题库类型 ', types.exam_type), 'exam', JSON_OBJECT('legacyExamType', types.exam_type)
        FROM tenants t JOIN (SELECT DISTINCT exam_type FROM exam_questions_v3) types
       WHERE t.tenant_key = 'platform-default'
    `);
    await queryRunner.query(`
      INSERT INTO assessment_items
        (public_id, tenant_id, definition_id, competency_id, item_type, prompt_text, content_json,
         answer_json, difficulty, position_no, legacy_question_id)
      SELECT UUID(), d.tenant_id, d.id, c.id, q.question_type, q.title, q.content, q.answer,
             q.difficulty, COALESCE(q.source_order, q.id), q.id
        FROM exam_questions_v3 q
        JOIN assessment_definitions d ON d.definition_key = CONCAT('legacy-exam-type-', q.exam_type)
        LEFT JOIN competencies c ON c.tenant_id = d.tenant_id AND c.competency_key = LOWER(TRIM(q.skill_name))
    `);
    await queryRunner.query(`
      INSERT INTO assessment_attempts
        (public_id, tenant_id, user_id, competency_id, assessment_kind, attempt_status,
         source_type, source_legacy_id, started_at, completed_at, metadata_json)
      SELECT UUID(), tm.tenant_id, a.user_id, c.id, a.attempt_type, a.attempt_status,
             'evaluation_attempt', a.id,
             IF(a.started_at IS NULL, NULL, FROM_UNIXTIME(a.started_at / 1000)),
             IF(a.completed_at IS NULL, NULL, FROM_UNIXTIME(a.completed_at / 1000)), a.metadata_json
        FROM evaluation_attempts_v3 a
        JOIN tenant_memberships tm ON tm.user_id = a.user_id AND tm.status = 'active'
        LEFT JOIN competencies c ON c.tenant_id = tm.tenant_id AND c.competency_key = LOWER(TRIM(a.skill_name))
       WHERE a.status = 1
    `);
    await queryRunner.query(`
      INSERT INTO assessment_attempts
        (public_id, tenant_id, user_id, definition_id, competency_id, assessment_kind, attempt_status,
         source_type, source_legacy_id, started_at, completed_at, metadata_json)
      SELECT UUID(), tm.tenant_id, r.user_id, d.id, c.id, 'exam',
             IF(r.score IS NULL, 'started', 'graded'), 'exam_record', r.id,
             FROM_UNIXTIME(COALESCE(r.create_time, UNIX_TIMESTAMP() * 1000) / 1000),
             IF(r.score IS NULL, NULL, FROM_UNIXTIME(COALESCE(r.update_time, r.create_time) / 1000)),
             JSON_OBJECT('questionIds', r.question_ids, 'answers', r.answers, 'wrongAnalysis', r.wrong_analysis)
        FROM exam_records_v3 r
        JOIN tenant_memberships tm ON tm.user_id = r.user_id AND tm.status = 'active'
        LEFT JOIN assessment_definitions d ON d.tenant_id = tm.tenant_id AND d.definition_key = CONCAT('legacy-exam-type-', r.exam_type)
        LEFT JOIN competencies c ON c.tenant_id = tm.tenant_id AND c.competency_key = LOWER(TRIM(r.skill_name))
       WHERE r.status = 1
    `);
    await queryRunner.query(`
      INSERT INTO assessment_scores
        (attempt_id, competency_id, score, max_score, normalized_score, passed, confidence,
         feedback_json, source_legacy_result_id, created_at)
      SELECT a.id, c.id, r.score, r.max_score, r.normalized_score, r.passed,
             LEAST(1, r.confidence), r.feedback_json, r.id,
             FROM_UNIXTIME(COALESCE(r.create_time, UNIX_TIMESTAMP() * 1000) / 1000)
        FROM evaluation_results_v3 r
        JOIN assessment_attempts a ON a.source_type = 'evaluation_attempt' AND a.source_legacy_id = r.attempt_id
        LEFT JOIN competencies c ON c.tenant_id = a.tenant_id AND c.competency_key = LOWER(TRIM(r.skill_name))
       WHERE r.status = 1
    `);
    await queryRunner.query(`
      INSERT INTO assessment_scores
        (attempt_id, competency_id, score, max_score, normalized_score, passed, confidence,
         feedback_json, source_legacy_result_id, created_at)
      SELECT a.id, a.competency_id, r.score, 100, r.score, r.passed, 1.000,
             r.wrong_analysis, NULL,
             FROM_UNIXTIME(COALESCE(r.update_time, r.create_time, UNIX_TIMESTAMP() * 1000) / 1000)
        FROM exam_records_v3 r
        JOIN assessment_attempts a ON a.source_type = 'exam_record' AND a.source_legacy_id = r.id
       WHERE r.status = 1 AND r.score IS NOT NULL
    `);
    await queryRunner.query(`
      INSERT INTO evidence_items
        (public_id, tenant_id, owner_user_id, evidence_type, summary, content_json, confidence,
         source_type, source_id, source_legacy_evidence_id, occurred_at, created_at)
      SELECT UUID(), tm.tenant_id, e.user_id, e.evidence_type, e.summary, e.payload_json, 0.700,
             e.source_type, e.source_id, e.id,
             FROM_UNIXTIME(COALESCE(e.create_time, UNIX_TIMESTAMP() * 1000) / 1000),
             FROM_UNIXTIME(COALESCE(e.create_time, UNIX_TIMESTAMP() * 1000) / 1000)
        FROM evaluation_evidence_v3 e
        JOIN tenant_memberships tm ON tm.user_id = e.user_id AND tm.status = 'active'
       WHERE e.status = 1
    `);
    await queryRunner.query(`
      INSERT INTO evidence_links
        (evidence_item_id, link_type, competency_id, assessment_attempt_id)
      SELECT item.id, 'assessment', c.id, attempt.id
        FROM evaluation_evidence_v3 legacy
        JOIN evidence_items item ON item.source_legacy_evidence_id = legacy.id
        LEFT JOIN competencies c ON c.tenant_id = item.tenant_id AND c.competency_key = LOWER(TRIM(legacy.skill_name))
        LEFT JOIN assessment_attempts attempt
          ON attempt.tenant_id = item.tenant_id
         AND attempt.source_type = 'evaluation_attempt'
         AND attempt.source_legacy_id = legacy.attempt_id
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE evidence_links');
    await queryRunner.query('DROP TABLE evidence_items');
    await queryRunner.query('DROP TABLE assessment_scores');
    await queryRunner.query('DROP TABLE assessment_responses');
    await queryRunner.query('DROP TABLE assessment_attempts');
    await queryRunner.query('DROP TABLE assessment_items');
    await queryRunner.query('DROP TABLE assessment_definitions');
    await queryRunner.query('DROP TABLE user_competency_states');
    await queryRunner.query('DROP TABLE learning_activities');
    await queryRunner.query('DROP TABLE learning_path_edges');
    await queryRunner.query('DROP TABLE learning_path_nodes');
    await queryRunner.query('DROP TABLE learning_paths');
    await queryRunner.query('DROP TABLE learning_goals');
    await queryRunner.query('DROP TABLE competencies');
  }
}

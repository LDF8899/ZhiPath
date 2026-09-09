import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlatformInfrastructure1788867000004 implements MigrationInterface {
  name = 'CreatePlatformInfrastructure1788867000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE outbox_events (
        id BIGINT NOT NULL AUTO_INCREMENT,
        public_id CHAR(36) NOT NULL,
        tenant_id BIGINT NULL,
        aggregate_type VARCHAR(80) NOT NULL,
        aggregate_id VARCHAR(100) NOT NULL,
        event_type VARCHAR(120) NOT NULL,
        payload_json JSON NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        attempt_count INT NOT NULL DEFAULT 0,
        available_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        published_at DATETIME(3) NULL,
        last_error TEXT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_outbox_events_public_id (public_id),
        KEY idx_outbox_events_dispatch (status, available_at, id),
        KEY idx_outbox_events_tenant_aggregate (tenant_id, aggregate_type, aggregate_id),
        CONSTRAINT fk_outbox_events_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE idempotency_keys (
        id BIGINT NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        client_app_id BIGINT NOT NULL,
        key_hash CHAR(64) NOT NULL,
        route VARCHAR(180) NOT NULL,
        request_hash CHAR(64) NOT NULL,
        state VARCHAR(20) NOT NULL DEFAULT 'processing',
        response_status INT NULL,
        response_json JSON NULL,
        expires_at DATETIME(3) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_idempotency_scope (tenant_id, user_id, client_app_id, route, key_hash),
        KEY idx_idempotency_expiry (expires_at),
        CONSTRAINT fk_idempotency_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_idempotency_user FOREIGN KEY (user_id) REFERENCES users_v3(id),
        CONSTRAINT fk_idempotency_client FOREIGN KEY (client_app_id) REFERENCES client_apps(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id BIGINT NOT NULL AUTO_INCREMENT,
        public_id CHAR(36) NOT NULL,
        tenant_id BIGINT NULL,
        client_app_id BIGINT NULL,
        actor_user_id BIGINT NULL,
        action VARCHAR(120) NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        resource_id VARCHAR(100) NULL,
        request_id VARCHAR(128) NOT NULL,
        result VARCHAR(20) NOT NULL,
        ip_address VARCHAR(64) NULL,
        details_json JSON NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_audit_logs_public_id (public_id),
        KEY idx_audit_logs_tenant_time (tenant_id, created_at),
        KEY idx_audit_logs_actor_time (actor_user_id, created_at),
        KEY idx_audit_logs_request (request_id),
        CONSTRAINT fk_audit_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_audit_logs_client FOREIGN KEY (client_app_id) REFERENCES client_apps(id),
        CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_user_id) REFERENCES users_v3(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id BIGINT NOT NULL AUTO_INCREMENT,
        token_hash CHAR(64) NOT NULL,
        user_id BIGINT NOT NULL,
        tenant_id BIGINT NOT NULL,
        client_app_id BIGINT NOT NULL,
        expires_at DATETIME(3) NOT NULL,
        revoked_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_refresh_tokens_hash (token_hash),
        KEY idx_refresh_tokens_user_client (user_id, client_app_id, revoked_at),
        CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users_v3(id) ON DELETE CASCADE,
        CONSTRAINT fk_refresh_tokens_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_refresh_tokens_client FOREIGN KEY (client_app_id) REFERENCES client_apps(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE agent_runs (
        id BIGINT NOT NULL AUTO_INCREMENT,
        public_id CHAR(36) NOT NULL,
        tenant_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        client_app_id BIGINT NOT NULL,
        run_type VARCHAR(80) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'queued',
        input_json JSON NOT NULL,
        output_json JSON NULL,
        request_id VARCHAR(128) NOT NULL,
        started_at DATETIME(3) NULL,
        completed_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_agent_runs_public_id (public_id),
        KEY idx_agent_runs_tenant_user_time (tenant_id, user_id, created_at),
        KEY idx_agent_runs_status_time (status, created_at),
        CONSTRAINT fk_agent_runs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_agent_runs_user FOREIGN KEY (user_id) REFERENCES users_v3(id),
        CONSTRAINT fk_agent_runs_client FOREIGN KEY (client_app_id) REFERENCES client_apps(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE agent_run_steps (
        id BIGINT NOT NULL AUTO_INCREMENT,
        agent_run_id BIGINT NOT NULL,
        step_key VARCHAR(100) NOT NULL,
        sequence_no INT NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'queued',
        input_json JSON NULL,
        output_json JSON NULL,
        error_json JSON NULL,
        started_at DATETIME(3) NULL,
        completed_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_agent_run_steps_sequence (agent_run_id, sequence_no),
        CONSTRAINT fk_agent_run_steps_run FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE async_jobs (
        id BIGINT NOT NULL AUTO_INCREMENT,
        public_id CHAR(36) NOT NULL,
        tenant_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        client_app_id BIGINT NOT NULL,
        job_type VARCHAR(80) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'queued',
        progress_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
        payload_json JSON NOT NULL,
        result_json JSON NULL,
        error_json JSON NULL,
        request_id VARCHAR(128) NOT NULL,
        attempt_count INT NOT NULL DEFAULT 0,
        available_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        started_at DATETIME(3) NULL,
        completed_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_async_jobs_public_id (public_id),
        KEY idx_async_jobs_dispatch (status, available_at, id),
        KEY idx_async_jobs_tenant_user_time (tenant_id, user_id, created_at),
        CONSTRAINT fk_async_jobs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_async_jobs_user FOREIGN KEY (user_id) REFERENCES users_v3(id),
        CONSTRAINT fk_async_jobs_client FOREIGN KEY (client_app_id) REFERENCES client_apps(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE generated_artifacts (
        id BIGINT NOT NULL AUTO_INCREMENT,
        public_id CHAR(36) NOT NULL,
        tenant_id BIGINT NOT NULL,
        owner_user_id BIGINT NOT NULL,
        artifact_type VARCHAR(80) NOT NULL,
        schema_version INT NOT NULL DEFAULT 1,
        title VARCHAR(255) NOT NULL,
        content_json JSON NULL,
        object_key VARCHAR(500) NULL,
        producer_run_id BIGINT NULL,
        provenance_json JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_generated_artifacts_public_id (public_id),
        KEY idx_generated_artifacts_owner_type (tenant_id, owner_user_id, artifact_type, created_at),
        CONSTRAINT fk_generated_artifacts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_generated_artifacts_owner FOREIGN KEY (owner_user_id) REFERENCES users_v3(id),
        CONSTRAINT fk_generated_artifacts_run FOREIGN KEY (producer_run_id) REFERENCES agent_runs(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE ai_usage_ledger (
        id BIGINT NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        client_app_id BIGINT NOT NULL,
        agent_run_id BIGINT NULL,
        provider VARCHAR(64) NOT NULL,
        model VARCHAR(120) NOT NULL,
        input_tokens INT NOT NULL DEFAULT 0,
        output_tokens INT NOT NULL DEFAULT 0,
        latency_ms INT NOT NULL DEFAULT 0,
        cost_micros BIGINT NOT NULL DEFAULT 0,
        request_id VARCHAR(128) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY idx_ai_usage_tenant_time (tenant_id, created_at),
        KEY idx_ai_usage_client_time (client_app_id, created_at),
        KEY idx_ai_usage_request (request_id),
        CONSTRAINT fk_ai_usage_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_ai_usage_user FOREIGN KEY (user_id) REFERENCES users_v3(id),
        CONSTRAINT fk_ai_usage_client FOREIGN KEY (client_app_id) REFERENCES client_apps(id),
        CONSTRAINT fk_ai_usage_run FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE ai_usage_ledger');
    await queryRunner.query('DROP TABLE generated_artifacts');
    await queryRunner.query('DROP TABLE async_jobs');
    await queryRunner.query('DROP TABLE agent_run_steps');
    await queryRunner.query('DROP TABLE agent_runs');
    await queryRunner.query('DROP TABLE refresh_tokens');
    await queryRunner.query('DROP TABLE audit_logs');
    await queryRunner.query('DROP TABLE idempotency_keys');
    await queryRunner.query('DROP TABLE outbox_events');
  }
}

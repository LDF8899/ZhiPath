import { MigrationInterface, QueryRunner } from 'typeorm';

export class StrengthenAsyncJobsAndAssessment1788867000006 implements MigrationInterface {
  name = 'StrengthenAsyncJobsAndAssessment1788867000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE async_jobs
        ADD COLUMN queue_name VARCHAR(80) NULL AFTER job_type,
        ADD COLUMN queue_job_id VARCHAR(120) NULL AFTER queue_name,
        ADD COLUMN agent_run_id BIGINT NULL AFTER client_app_id,
        ADD COLUMN cancel_requested_at DATETIME(3) NULL AFTER available_at,
        ADD UNIQUE KEY uq_async_jobs_queue_job (queue_name, queue_job_id),
        ADD KEY idx_async_jobs_agent_run (agent_run_id),
        ADD CONSTRAINT fk_async_jobs_agent_run FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id)
    `);
    await queryRunner.query(`
      ALTER TABLE assessment_responses
        ADD UNIQUE KEY uq_assessment_responses_attempt_item (attempt_id, item_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE assessment_responses DROP INDEX uq_assessment_responses_attempt_item',
    );
    await queryRunner.query(`
      ALTER TABLE async_jobs
        DROP FOREIGN KEY fk_async_jobs_agent_run,
        DROP INDEX idx_async_jobs_agent_run,
        DROP INDEX uq_async_jobs_queue_job,
        DROP COLUMN cancel_requested_at,
        DROP COLUMN agent_run_id,
        DROP COLUMN queue_job_id,
        DROP COLUMN queue_name
    `);
  }
}

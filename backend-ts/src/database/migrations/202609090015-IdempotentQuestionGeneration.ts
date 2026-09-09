import { MigrationInterface, QueryRunner } from 'typeorm';

export class IdempotentQuestionGeneration1788867000015 implements MigrationInterface {
  name = 'IdempotentQuestionGeneration1788867000015';
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE question_generation_tasks ADD COLUMN idempotency_key VARCHAR(200) NULL AFTER platform_job_id');
    await q.query('ALTER TABLE question_generation_tasks ADD UNIQUE KEY uq_question_generation_idempotency (tenant_id,user_id,idempotency_key)');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE question_generation_tasks DROP KEY uq_question_generation_idempotency');
    await q.query('ALTER TABLE question_generation_tasks DROP COLUMN idempotency_key');
  }
}

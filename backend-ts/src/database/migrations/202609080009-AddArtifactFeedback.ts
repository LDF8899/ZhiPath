import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArtifactFeedback1788867000009 implements MigrationInterface {
  name = 'AddArtifactFeedback1788867000009';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE generated_artifacts
        ADD COLUMN feedback_useful TINYINT NULL AFTER provenance_json,
        ADD COLUMN feedback_at DATETIME(3) NULL AFTER feedback_useful
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE generated_artifacts
        DROP COLUMN feedback_at,
        DROP COLUMN feedback_useful
    `);
  }
}


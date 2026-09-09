import { MigrationInterface, QueryRunner } from 'typeorm';

/** Keep structured profile extensions in MySQL; Mongo remains a read model. */
export class AddStudentProfileMeta1788954600022 implements MigrationInterface {
  name = 'AddStudentProfileMeta1788954600022';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE students_v3 ADD COLUMN profile_meta_json JSON NULL AFTER awards`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE students_v3 DROP COLUMN profile_meta_json`);
  }
}

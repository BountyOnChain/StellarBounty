import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubmissionAttachments1747657400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE submissions
      ADD COLUMN attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE submissions
      DROP COLUMN IF EXISTS attachments;
    `);
  }
}

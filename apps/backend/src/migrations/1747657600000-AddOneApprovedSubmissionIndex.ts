import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOneApprovedSubmissionIndex1747657600000 implements MigrationInterface {
  name = 'AddOneApprovedSubmissionIndex1747657600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_submissions_one_approved_per_bounty"
      ON "submissions" ("bountyId")
      WHERE "status" = 'approved';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "idx_submissions_one_approved_per_bounty";
    `);
  }
}

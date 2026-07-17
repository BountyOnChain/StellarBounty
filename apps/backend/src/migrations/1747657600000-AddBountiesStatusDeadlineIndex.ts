import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBountiesStatusDeadlineIndex1747657600000 implements MigrationInterface {
  name = 'AddBountiesStatusDeadlineIndex1747657600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "idx_bounties_status_deadline"
      ON "bounties" ("status", "deadline")
      WHERE "status" IN ('open', 'in_progress')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "idx_bounties_status_deadline"
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueActiveBountyTitle1747700200000 implements MigrationInterface {
  name = 'AddUniqueActiveBountyTitle1747700200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_bounties_title_active"
      ON "bounties" ("title")
      WHERE "deletedAt" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "uq_bounties_title_active";
    `);
  }
}

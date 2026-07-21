import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContributorAndOwnerIndexes1747700100000 implements MigrationInterface {
  name = 'AddContributorAndOwnerIndexes1747700100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "idx_submissions_contributor"
      ON "submissions" ("contributorAddress");
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_bounties_owner"
      ON "bounties" ("ownerAddress");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_submissions_contributor";`);
    await queryRunner.query(`DROP INDEX "idx_bounties_owner";`);
  }
}

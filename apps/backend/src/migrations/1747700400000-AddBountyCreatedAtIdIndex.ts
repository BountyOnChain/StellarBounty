import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBountyCreatedAtIdIndex1747700400000 implements MigrationInterface {
  name = 'AddBountyCreatedAtIdIndex1747700400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "idx_bounties_created_at_id"
      ON "bounties" ("createdAt" DESC, "id" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_bounties_created_at_id";`);
  }
}

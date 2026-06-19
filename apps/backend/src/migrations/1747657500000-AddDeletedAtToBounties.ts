import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeletedAtToBounties1747657500000 implements MigrationInterface {
  name = 'AddDeletedAtToBounties1747657500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bounties"
      ADD COLUMN "deletedAt" TIMESTAMPTZ NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bounties"
      DROP COLUMN "deletedAt"
    `);
  }
}

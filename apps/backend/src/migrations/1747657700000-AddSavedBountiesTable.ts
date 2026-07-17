import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSavedBountiesTable1747657700000 implements MigrationInterface {
  name = 'AddSavedBountiesTable1747657700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "saved_bounties" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "address" character varying NOT NULL,
        "bountyId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_bounties" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_saved_bounties_address_bountyId" UNIQUE ("address", "bountyId")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_saved_bounties_address" ON "saved_bounties" ("address")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_saved_bounties_address"`);
    await queryRunner.query(`DROP TABLE "saved_bounties"`);
  }
}
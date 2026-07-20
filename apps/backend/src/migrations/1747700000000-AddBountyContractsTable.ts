import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBountyContractsTable1747700000000 implements MigrationInterface {
  name = 'AddBountyContractsTable1747700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bounty_contracts" (
        "bounty_id" varchar NOT NULL,
        "network" varchar NOT NULL,
        "contract_id" varchar NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_bounty_contracts" PRIMARY KEY ("bounty_id", "network")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_bounty_contracts_bounty_id"
      ON "bounty_contracts" ("bounty_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_bounty_contracts_bounty_id";`);
    await queryRunner.query(`DROP TABLE "bounty_contracts";`);
  }
}

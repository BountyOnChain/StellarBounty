import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNoncesTable1747657300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE nonces (
        address VARCHAR PRIMARY KEY,
        nonce VARCHAR NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS nonces;
    `);
  }
}

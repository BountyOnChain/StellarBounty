import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIdempotencyRecordsTable1747657700000 implements MigrationInterface {
  name = 'AddIdempotencyRecordsTable1747657700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "idempotency_records" (
        "key" VARCHAR(255) PRIMARY KEY,
        "requestHash" VARCHAR(64) NOT NULL,
        "responseHash" VARCHAR(64) NOT NULL,
        "responseBody" TEXT NOT NULL,
        "statusCode" INTEGER NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_idempotency_records_expiresAt"
      ON "idempotency_records" ("expiresAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_idempotency_records_expiresAt";
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "idempotency_records";
    `);
  }
}

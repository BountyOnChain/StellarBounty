import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshTokensTable1747657400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        address VARCHAR NOT NULL,
        "tokenHash" VARCHAR NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "revokedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX "IDX_refresh_tokens_address" ON refresh_tokens(address);
      CREATE UNIQUE INDEX "IDX_refresh_tokens_token_hash" ON refresh_tokens("tokenHash");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_refresh_tokens_token_hash";
      DROP INDEX IF EXISTS "IDX_refresh_tokens_address";
      DROP TABLE IF EXISTS refresh_tokens;
    `);
  }
}

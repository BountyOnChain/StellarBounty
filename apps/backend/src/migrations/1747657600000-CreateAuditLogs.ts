import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogs1747657600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        address VARCHAR NOT NULL,
        action VARCHAR NOT NULL,
        "resourceType" VARCHAR NOT NULL,
        "resourceId" VARCHAR,
        outcome VARCHAR NOT NULL DEFAULT 'success',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX "IDX_audit_logs_address" ON audit_logs(address);
      CREATE INDEX "IDX_audit_logs_resource" ON audit_logs("resourceType", "resourceId");
      CREATE INDEX "IDX_audit_logs_created_at" ON audit_logs("createdAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS audit_logs;
    `);
  }
}

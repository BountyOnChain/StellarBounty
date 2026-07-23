import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBountyStatusDeadlineIndex0002 implements MigrationInterface {
  name = 'AddBountyStatusDeadlineIndex0002';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_bounties_status_deadline
      ON bounties (status, deadline);
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_bounties_status_deadline;
    `);
  }
}

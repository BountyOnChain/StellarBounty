import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApprovalQueuedStatus1747700300000 implements MigrationInterface {
  name = 'AddApprovalQueuedStatus1747700300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE bounty_status_enum ADD VALUE IF NOT EXISTS 'approval_queued';`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE bounties SET status = 'open' WHERE status = 'approval_queued';

      ALTER TABLE bounties ALTER COLUMN status DROP DEFAULT;

      ALTER TYPE bounty_status_enum RENAME TO bounty_status_enum_old;

      CREATE TYPE bounty_status_enum AS ENUM ('open', 'in_progress', 'completed', 'cancelled');

      ALTER TABLE bounties ALTER COLUMN status TYPE bounty_status_enum
        USING status::text::bounty_status_enum;

      ALTER TABLE bounties ALTER COLUMN status SET DEFAULT 'open';

      DROP TYPE bounty_status_enum_old;
    `);
  }
}

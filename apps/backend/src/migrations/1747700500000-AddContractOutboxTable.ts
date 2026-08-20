import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContractOutboxTable1747700500000 implements MigrationInterface {
  name = 'AddContractOutboxTable1747700500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE contract_outbox_events (
        event_id      TEXT PRIMARY KEY,
        contract_id   TEXT NOT NULL,
        network       TEXT NOT NULL,
        event_type    TEXT NOT NULL,
        ledger        INTEGER NOT NULL,
        payload       JSONB NOT NULL DEFAULT '{}',
        received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed_at  TIMESTAMPTZ NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_contract_outbox_events_unprocessed
        ON contract_outbox_events (received_at)
        WHERE processed_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX idx_contract_outbox_events_contract
        ON contract_outbox_events (contract_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS contract_outbox_events');
  }
}

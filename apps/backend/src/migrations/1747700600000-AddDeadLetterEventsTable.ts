import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeadLetterEventsTable1747700600000 implements MigrationInterface {
  name = 'AddDeadLetterEventsTable1747700600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE dead_letter_events (
        event_id      TEXT PRIMARY KEY,
        contract_id   TEXT NOT NULL,
        network       TEXT NOT NULL,
        event_type    TEXT NOT NULL,
        ledger        INTEGER NOT NULL,
        payload       JSONB NOT NULL DEFAULT '{}',
        received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        attempts      INTEGER NOT NULL DEFAULT 0,
        last_error    TEXT NULL,
        failed_at     TIMESTAMPTZ NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_dead_letter_events_type
        ON dead_letter_events (event_type)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS dead_letter_events');
  }
}

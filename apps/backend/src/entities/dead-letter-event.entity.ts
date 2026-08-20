import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('dead_letter_events')
@Index('idx_dead_letter_events_type', ['eventType'])
export class DeadLetterEvent {
  @PrimaryColumn({ name: 'event_id', type: 'text' })
  eventId!: string;

  @Column({ name: 'contract_id', type: 'text' })
  contractId!: string;

  @Column({ type: 'text' })
  network!: string;

  @Column({ name: 'event_type', type: 'text' })
  eventType!: string;

  @Column({ type: 'int' })
  ledger!: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload!: Record<string, unknown>;

  @Column({ name: 'received_at', type: 'timestamptz', default: () => 'NOW()' })
  receivedAt!: Date;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt!: Date | null;
}

import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('contract_outbox_events')
@Index('idx_contract_outbox_events_unprocessed', ['receivedAt'], { where: '"processed_at" IS NULL' })
@Index('idx_contract_outbox_events_contract', ['contractId'])
export class OutboxEvent {
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

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt!: Date | null;
}

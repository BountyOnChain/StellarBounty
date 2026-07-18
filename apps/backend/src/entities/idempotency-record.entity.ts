import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('idempotency_records')
export class IdempotencyRecord {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  key!: string;

  @Column({ type: 'varchar', length: 64 })
  requestHash!: string;

  @Column({ type: 'varchar', length: 64 })
  responseHash!: string;

  @Column({ type: 'text' })
  responseBody!: string;

  @Column({ type: 'integer' })
  statusCode!: number;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

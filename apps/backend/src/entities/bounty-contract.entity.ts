import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('bounty_contracts')
@Index('idx_bounty_contracts_bounty_id', ['bountyId'])
export class BountyContract {
  @PrimaryColumn()
  bountyId!: string;

  @PrimaryColumn()
  network!: string;

  @Column({ name: 'contract_id' })
  contractId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BountyStatus = 'open' | 'closed' | 'paid';

@Entity('bounties')
export class Bounty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 20, scale: 7, name: 'reward_amount' })
  rewardAmount: number;

  @Column({ type: 'timestamptz' })
  deadline: Date;

  @Column({
    type: 'enum',
    enum: ['open', 'closed', 'paid'],
    default: 'open',
  })
  status: BountyStatus;

  @Column({ type: 'varchar', length: 56, name: 'owner_address' })
  ownerAddress: string;

  @Column({ type: 'varchar', array: true, default: '{}' })
  tags: string[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

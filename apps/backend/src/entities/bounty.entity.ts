import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Submission } from './submission.entity';

export enum BountyStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('bounties')
export class Bounty {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column('text')
  description!: string;

  @Column('bigint')
  rewardAmount!: string;

  @Column({ type: 'timestamptz', nullable: true })
  deadline!: Date | null;

  @Column({ type: 'enum', enum: BountyStatus, enumName: 'bounty_status_enum', default: BountyStatus.OPEN })
  status!: BountyStatus;

  @Column()
  ownerAddress!: string;

  @OneToMany(() => Submission, (submission) => submission.bounty)
  submissions!: Submission[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}

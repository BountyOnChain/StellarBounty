import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Bounty } from './bounty.entity';

export enum SubmissionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('submissions')
@Index('idx_submissions_one_approved_per_bounty', ['bountyId'], {
  unique: true,
  where: `"status" = 'approved'`,
})
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  bountyId!: string;

  @ManyToOne(() => Bounty, (bounty) => bounty.submissions, { onDelete: 'CASCADE' })
  bounty!: Bounty;

  @Column()
  contributorAddress!: string;

  @Column()
  link!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'enum', enum: SubmissionStatus, enumName: 'submission_status_enum', default: SubmissionStatus.PENDING })
  status!: SubmissionStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

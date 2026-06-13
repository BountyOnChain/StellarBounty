import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Bounty } from './bounty.entity';

export enum SubmissionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export type SubmissionAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  uploadedAt: string;
  downloadUrl?: string;
};

@Entity('submissions')
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

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  attachments!: SubmissionAttachment[];

  @Column({ type: 'enum', enum: SubmissionStatus, enumName: 'submission_status_enum', default: SubmissionStatus.PENDING })
  status!: SubmissionStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

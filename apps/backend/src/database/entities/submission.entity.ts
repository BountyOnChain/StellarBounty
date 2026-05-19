import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'bounty_id' })
  bountyId: string;

  @Column({ type: 'varchar', length: 56, name: 'contributor_address' })
  contributorAddress: string;

  @Column({ type: 'text', name: 'work_link' })
  workLink: string;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  notes?: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  status: SubmissionStatus;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

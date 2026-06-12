import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Submission } from './submission.entity';
import { Tag } from './tag.entity';

export enum BountyStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum BountyCategory {
  DEVELOPMENT = 'development',
  DESIGN = 'design',
  WRITING = 'writing',
  RESEARCH = 'research',
  MARKETING = 'marketing',
  OTHER = 'other',
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

  @Column({
    type: 'enum',
    enum: BountyCategory,
    enumName: 'bounty_category_enum',
    default: BountyCategory.DEVELOPMENT,
  })
  category!: BountyCategory;

  @OneToMany(() => Submission, (submission) => submission.bounty)
  submissions!: Submission[];

  @ManyToMany(() => Tag, (tag) => tag.bounties, { cascade: ['insert'] })
  @JoinTable({
    name: 'bounties_tags',
    joinColumn: { name: 'bountyId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tagId', referencedColumnName: 'id' },
  })
  tags!: Tag[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

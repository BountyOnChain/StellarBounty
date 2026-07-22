import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Submission } from './submission.entity';
import { stroopTransformer } from '../bounties/stroop.utils';

export enum BountyStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// 截止时间自动化只扫描活跃 bounty，实体索引声明需和迁移保持同名以通过 schema drift 检查。
@Index('idx_bounties_status_deadline', ['status', 'deadline'], {
  where: `"status" IN ('open', 'in_progress')`,
})
@Entity('bounties')
export class Bounty {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column('text')
  description!: string;

  @Column('bigint', { transformer: stroopTransformer })
  rewardAmount!: bigint;

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

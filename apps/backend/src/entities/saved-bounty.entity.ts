import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('saved_bounties')
@Unique(['address', 'bountyId'])
export class SavedBounty {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  address!: string;

  @Column('uuid')
  bountyId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Bounty } from './bounty.entity';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @ManyToMany(() => Bounty, (bounty) => bounty.tags)
  bounties!: Bounty[];
}

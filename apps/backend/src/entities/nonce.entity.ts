import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('nonces')
export class Nonce {
  @PrimaryColumn()
  address!: string;

  @Column()
  nonce!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;
}

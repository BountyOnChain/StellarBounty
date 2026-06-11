import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Bounty } from './src/entities/bounty.entity';
import { Submission } from './src/entities/submission.entity';
import { Nonce } from './src/entities/nonce.entity';
import { InitSchema1747657200000 } from './src/migrations/1747657200000-InitSchema';
import { AddNoncesTable1747657300000 } from './src/migrations/1747657300000-AddNoncesTable';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Bounty, Submission, Nonce],
  migrations: [InitSchema1747657200000, AddNoncesTable1747657300000],
  synchronize: false,
});

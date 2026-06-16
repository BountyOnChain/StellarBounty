import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Bounty } from './entities/bounty.entity';
import { Submission } from './entities/submission.entity';
import { Nonce } from './entities/nonce.entity';
import { createDbPoolExtraFromEnv } from './db-pool.config';
import { InitSchema1747657200000 } from './migrations/1747657200000-InitSchema';
import { AddNoncesTable1747657300000 } from './migrations/1747657300000-AddNoncesTable';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Bounty, Submission, Nonce],
  migrations: [InitSchema1747657200000, AddNoncesTable1747657300000],
  extra: createDbPoolExtraFromEnv(),
  synchronize: false,
});

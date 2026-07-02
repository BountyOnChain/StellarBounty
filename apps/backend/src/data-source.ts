import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Bounty } from './entities/bounty.entity';
import { Submission } from './entities/submission.entity';
import { Nonce } from './entities/nonce.entity';
import { createDbPoolExtraFromEnv } from './db-pool.config';
import { InitSchema1747657200000 } from './migrations/1747657200000-InitSchema';
import { AddNoncesTable1747657300000 } from './migrations/1747657300000-AddNoncesTable';
import { AddTagsColumn1747657400000 } from './migrations/1747657400000-AddTagsColumn';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Bounty, Submission, Nonce],
  migrations: [
    InitSchema1747657200000,
    AddNoncesTable1747657300000,
    AddTagsColumn1747657400000,
  ],
  extra: createDbPoolExtraFromEnv(),
  synchronize: false,
  retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS || '5', 10),
  retryDelay: parseInt(process.env.DB_RETRY_DELAY_MS || '3000', 10),
} as DataSourceOptions);

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Bounty } from './entities/bounty.entity';
import { Submission } from './entities/submission.entity';
import { Nonce } from './entities/nonce.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { InitSchema1747657200000 } from './migrations/1747657200000-InitSchema';
import { AddNoncesTable1747657300000 } from './migrations/1747657300000-AddNoncesTable';
import { AddRefreshTokensTable1747657400000 } from './migrations/1747657400000-AddRefreshTokensTable';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Bounty, Submission, Nonce, RefreshToken],
  migrations: [
    InitSchema1747657200000,
    AddNoncesTable1747657300000,
    AddRefreshTokensTable1747657400000,
  ],
  synchronize: false,
});

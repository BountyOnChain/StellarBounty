import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Bounty } from './entities/bounty.entity';
import { SavedBounty } from './entities/saved-bounty.entity';
import { BountyContract } from './entities/bounty-contract.entity';
import { Submission } from './entities/submission.entity';
import { Nonce } from './entities/nonce.entity';
import { createDbPoolExtraFromEnv } from './db-pool.config';
import { InitSchema1747657200000 } from './migrations/1747657200000-InitSchema';
import { AddNoncesTable1747657300000 } from './migrations/1747657300000-AddNoncesTable';
import { AddTagsColumn1747657400000 } from './migrations/1747657400000-AddTagsColumn';
import { AddDeletedAtToBounties1747657500000 } from './migrations/1747657500000-AddDeletedAtToBounties';
import { AddOneApprovedSubmissionIndex1747657600000 } from './migrations/1747657600000-AddOneApprovedSubmissionIndex';
import { AddSavedBountiesTable1747657700000 } from './migrations/1747657700000-AddSavedBountiesTable';
import { AddBountyContractsTable1747700000000 } from './migrations/1747700000000-AddBountyContractsTable';
import { AddUniqueActiveBountyTitle1747700200000 } from './migrations/1747700200000-AddUniqueActiveBountyTitle';
import { AddBountyCreatedAtIdIndex1747700400000 } from './migrations/1747700400000-AddBountyCreatedAtIdIndex';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Bounty, SavedBounty, BountyContract, Submission, Nonce],
  migrations: [
    InitSchema1747657200000,
    AddNoncesTable1747657300000,
    AddTagsColumn1747657400000,
    AddDeletedAtToBounties1747657500000,
    AddOneApprovedSubmissionIndex1747657600000,
    AddSavedBountiesTable1747657700000,
    AddBountyContractsTable1747700000000,
    AddUniqueActiveBountyTitle1747700200000,
    AddBountyCreatedAtIdIndex1747700400000,
  ],
  extra: createDbPoolExtraFromEnv(),
  synchronize: false,
  retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS || '5', 10),
  retryDelay: parseInt(process.env.DB_RETRY_DELAY_MS || '3000', 10),
} as DataSourceOptions);

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bounty } from '../entities/bounty.entity';
import { BountyContract } from '../entities/bounty-contract.entity';
import { Submission } from '../entities/submission.entity';
import { MetricsModule } from '../metrics/metrics.module';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { StellarRpcClient } from '../common/stellar-rpc-client';
import { CircuitBreaker } from '../common/circuit-breaker';
import { ContractRegistryService } from './contract-registry.service';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, Bounty, BountyContract]), MetricsModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, StellarRpcClient, CircuitBreaker, ContractRegistryService],
  exports: [StellarRpcClient],
})
export class SubmissionsModule {}

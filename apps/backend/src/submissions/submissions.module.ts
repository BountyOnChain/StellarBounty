import { Module } from '@nestjs/common';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { SorobanService } from './soroban.service';
import { BountyStoreService } from './bounty-store.service';

@Module({
  controllers: [SubmissionsController],
  providers: [SubmissionsService, SorobanService, BountyStoreService],
  exports: [SubmissionsService, BountyStoreService],
})
export class SubmissionsModule {}

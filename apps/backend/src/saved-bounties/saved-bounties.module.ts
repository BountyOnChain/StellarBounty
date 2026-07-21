import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bounty } from '../entities/bounty.entity';
import { SavedBounty } from '../entities/saved-bounty.entity';
import { SavedBountiesController } from './saved-bounties.controller';
import { SavedBountiesService } from './saved-bounties.service';

@Module({
  imports: [TypeOrmModule.forFeature([SavedBounty, Bounty])],
  controllers: [SavedBountiesController],
  providers: [SavedBountiesService],
})
export class SavedBountiesModule {}
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bounty } from '../entities/bounty.entity';
import { Submission } from '../entities/submission.entity';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { CircuitBreakerService } from '../common/circuit-breaker.service';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, Bounty])],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, CircuitBreakerService],
})
export class SubmissionsModule {}

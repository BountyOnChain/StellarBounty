import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { DeadLetterEvent } from '../entities/dead-letter-event.entity';
import { Bounty, BountyStatus } from '../entities/bounty.entity';
import { BountyContract } from '../entities/bounty-contract.entity';
import { MetricsService } from '../metrics/metrics.service';

const MAX_ATTEMPTS = 5;

@Injectable()
export class EventProjector {
  private readonly logger = new Logger(EventProjector.name);

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outbox: Repository<OutboxEvent>,
    @InjectRepository(DeadLetterEvent)
    private readonly deadLetter: Repository<DeadLetterEvent>,
    @InjectRepository(Bounty)
    private readonly bounties: Repository<Bounty>,
    @InjectRepository(BountyContract)
    private readonly contracts: Repository<BountyContract>,
    private readonly metrics: MetricsService,
  ) {}

  async projectPendingEvents(): Promise<number> {
    const pending = await this.outbox.find({
      where: { processedAt: IsNull() },
      order: { ledger: 'ASC', eventId: 'ASC' },
      take: 200,
    });

    let projected = 0;

    for (const event of pending) {
      try {
        await this.projectEvent(event);
        event.processedAt = new Date();
        await this.outbox.save(event);
        this.metrics.recordContractEventProcessed(event.eventType);
        projected++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Projection failed for event ${event.eventId}: ${message}`);
        await this.handleFailedEvent(event, message);
      }
    }

    return projected;
  }

  private async projectEvent(event: OutboxEvent): Promise<void> {
    const contract = await this.contracts.findOne({
      where: { contractId: event.contractId, network: event.network },
    });
    if (!contract) {
      this.logger.debug(`No bounty mapping for contract ${event.contractId}; skipping projection.`);
      return;
    }

    const bounty = await this.bounties.findOneBy({ id: contract.bountyId });
    if (!bounty) {
      this.logger.warn(`Bounty ${contract.bountyId} not found for contract ${event.contractId}; skipping.`);
      return;
    }

    const payload = event.payload as Record<string, unknown>;
    const operation = payload.operation as string | undefined;

    switch (event.eventType) {
      case 'queueop':
        bounty.status = BountyStatus.APPROVAL_QUEUED;
        await this.bounties.save(bounty);
        this.logger.log(`Projected queueop: bounty ${bounty.id} -> APPROVAL_QUEUED`);
        break;

      case 'execop':
        if (operation === 'approve') {
          bounty.status = BountyStatus.COMPLETED;
          await this.bounties.save(bounty);
          this.logger.log(`Projected execop/approve: bounty ${bounty.id} -> COMPLETED`);
        } else if (operation === 'cancel') {
          bounty.status = BountyStatus.CANCELLED;
          await this.bounties.save(bounty);
          this.logger.log(`Projected execop/cancel: bounty ${bounty.id} -> CANCELLED`);
        } else if (operation === 'resolve') {
          this.logger.log(`Projected execop/resolve for bounty ${bounty.id} (no status change)`);
        } else {
          this.logger.debug(`Unknown execop sub-type: ${operation} for bounty ${bounty.id}`);
        }
        break;

      case 'dispute':
        this.logger.log(`Projected dispute event for bounty ${bounty.id} (logged, no status change)`);
        break;

      case 'resolve':
        this.logger.log(`Projected resolve event for bounty ${bounty.id} (logged, no status change)`);
        break;

      case 'cancelop':
        this.logger.log(`Projected cancelop event for bounty ${bounty.id} (logged, no status change)`);
        break;

      case 'rotarb':
        this.logger.log(`Projected rotarb event for bounty ${bounty.id} (logged, no status change)`);
        break;

      case 'reentrant':
        this.logger.warn(`Projected reentrant event for bounty ${bounty.id} (defensive logging)`);
        break;

      default:
        this.logger.debug(`Unhandled event type: ${event.eventType} for bounty ${bounty.id}`);
    }
  }

  private async handleFailedEvent(event: OutboxEvent, errorMessage: string): Promise<void> {
    const existing = await this.deadLetter.findOneBy({ eventId: event.eventId });

    if (existing) {
      existing.attempts += 1;
      existing.lastError = errorMessage;
      existing.failedAt = new Date();

      if (existing.attempts >= MAX_ATTEMPTS) {
        this.logger.error(`Event ${event.eventId} exceeded max attempts; moved to dead-letter table.`);
        this.metrics.recordContractEventDeadLettered(event.eventType);
      }

      await this.deadLetter.save(existing);
    } else {
      const dead = this.deadLetter.create({
        eventId: event.eventId,
        contractId: event.contractId,
        network: event.network,
        eventType: event.eventType,
        ledger: event.ledger,
        payload: event.payload,
        receivedAt: event.receivedAt,
        attempts: 1,
        lastError: errorMessage,
        failedAt: new Date(),
      });
      await this.deadLetter.save(dead);

      if (1 >= MAX_ATTEMPTS) {
        this.logger.error(`Event ${event.eventId} exceeded max attempts on first attempt; dead-lettered.`);
        this.metrics.recordContractEventDeadLettered(event.eventType);
      }
    }
  }
}

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';
import { EVENT_SYNC_LOCK_ID } from './events-lock.constants';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { BountyContract } from '../entities/bounty-contract.entity';
import { MetricsService } from '../metrics/metrics.service';
import { StellarRpcClient } from '../common/stellar-rpc-client';
import { EventProjector } from './event-projector';

@Injectable()
export class SorobanEventsPoller implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SorobanEventsPoller.name);
  private interval?: ReturnType<typeof setInterval>;

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outbox: Repository<OutboxEvent>,
    @InjectRepository(BountyContract)
    private readonly contracts: Repository<BountyContract>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
    private readonly rpcClient: StellarRpcClient,
    private readonly projector: EventProjector,
  ) {}

  onModuleInit(): void {
    if (!this.config.get<boolean>('CONTRACT_EVENT_SYNC_ENABLED', false)) {
      this.logger.log('Contract event sync is disabled.');
      return;
    }

    const intervalMs = this.config.get<number>('CONTRACT_EVENT_SYNC_INTERVAL_MS', 30_000);
    this.interval = setInterval(() => {
      void this.poll().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Contract event poll failed: ${message}`);
      });
    }, intervalMs);
    this.interval.unref();
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async poll(): Promise<{ eventsReceived: number; eventsProjected: number }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let lockAcquired = false;

    try {
      const lockRows: { acquired: boolean }[] = await queryRunner.query(
        'SELECT pg_try_advisory_lock($1) AS acquired',
        [EVENT_SYNC_LOCK_ID],
      );
      lockAcquired = lockRows[0]?.acquired === true;

      if (!lockAcquired) {
        this.logger.debug('Contract event sync skipped; another replica holds the lock.');
        return { eventsReceived: 0, eventsProjected: 0 };
      }

      const contracts = await this.contracts.find();
      if (contracts.length === 0) {
        return { eventsReceived: 0, eventsProjected: 0 };
      }

      const network = this.config.get<string>('STELLAR_NETWORK', 'testnet');
      const lastProcessedLedger = await this.getLastProcessedLedger();
      const latestLedger = await this.getLatestLedger();

      if (latestLedger <= lastProcessedLedger) {
        return { eventsReceived: 0, eventsProjected: 0 };
      }

      let totalReceived = 0;
      for (const contract of contracts) {
        const count = await this.fetchAndStoreEvents(
          contract.contractId,
          contract.network || network,
          lastProcessedLedger + 1,
          latestLedger,
        );
        totalReceived += count;
      }

      await this.setLastProcessedLedger(latestLedger);
      this.metrics.recordContractEventsReceived(totalReceived);

      const totalProjected = await this.projector.projectPendingEvents();

      if (totalReceived > 0 || totalProjected > 0) {
        this.logger.log(
          `Contract event sync: ${totalReceived} received, ${totalProjected} projected (ledger ${lastProcessedLedger} -> ${latestLedger}).`,
        );
      }

      return { eventsReceived: totalReceived, eventsProjected: totalProjected };
    } finally {
      if (lockAcquired) {
        await queryRunner.query('SELECT pg_advisory_unlock($1)', [EVENT_SYNC_LOCK_ID]);
      }
      await queryRunner.release();
    }
  }

  private async fetchAndStoreEvents(
    contractId: string,
    network: string,
    startLedger: number,
    endLedger: number,
  ): Promise<number> {
    if (!this.rpcClient.isInitialized()) {
      const rpcUrl = this.config.get<string>('STELLAR_RPC_URL');
      if (!rpcUrl) {
        this.logger.debug('STELLAR_RPC_URL not configured; skipping event sync.');
        return 0;
      }
      const passphrase = network === 'mainnet'
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET;
      this.rpcClient.initialize(rpcUrl, passphrase);
    }

    const server = this.rpcClient.getServer();
    let stored = 0;
    let cursor: string | undefined;

    do {
      const request: StellarSdk.rpc.Server.GetEventsRequest = {
        startLedger,
        endLedger,
        filters: [{ type: 'contract', contractIds: [contractId] }],
        limit: 100,
      };
      if (cursor) {
        Object.assign(request, { cursor });
      }

      const response = await server.getEvents(request);

      for (const event of response.events) {
        if (event.type !== 'contract') continue;

        const topics = (event as StellarSdk.rpc.Api.EventResponse).topic;
        const eventType = this.extractEventType(topics);
        if (!eventType) continue;

        const eventValue = (event as StellarSdk.rpc.Api.EventResponse).value;
        const payload = this.buildPayload(eventType, topics, eventValue, event.txHash);
        const contractIdStr = typeof event.contractId === 'string'
          ? event.contractId
          : contractId;

        const outboxEvent = this.outbox.create({
          eventId: event.id,
          contractId: contractIdStr,
          network,
          eventType,
          ledger: event.ledger,
          payload,
          receivedAt: new Date(),
        });

        await this.outbox
          .createQueryBuilder()
          .insert()
          .into(OutboxEvent)
          .values({
            eventId: outboxEvent.eventId,
            contractId: outboxEvent.contractId,
            network: outboxEvent.network,
            eventType: outboxEvent.eventType,
            ledger: outboxEvent.ledger,
            payload: outboxEvent.payload as unknown as Record<string, never>,
            receivedAt: outboxEvent.receivedAt,
          })
          .orIgnore()
          .execute();

        stored++;
      }

      cursor = response.cursor;
    } while (cursor && cursor !== '');

    return stored;
  }

  private extractEventType(topics: StellarSdk.xdr.ScVal[]): string | null {
    if (topics.length === 0) return null;
    const first = topics[0];
    if (first?.switch().name === 'scvSymbol') {
      return first.sym().toString();
    }
    if (first?.switch().name === 'scvString') {
      return first.str().toString();
    }
    return null;
  }

  private buildPayload(
    eventType: string,
    topics: StellarSdk.xdr.ScVal[],
    value: StellarSdk.xdr.ScVal,
    txHash: string,
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = { txHash };

    if (topics.length > 1) {
      const second = topics[1];
      const name = second?.switch().name;
      if (name === 'scvAddress') {
        payload.address = second.address().toString();
      } else if (name === 'scvSymbol') {
        payload.operation = second.sym().toString();
      } else if (name === 'scvString') {
        payload.operation = second.str().toString();
      }
    }

    if (topics.length > 2) {
      const third = topics[2];
      if (third?.switch().name === 'scvAddress') {
        payload.targetAddress = third.address().toString();
      }
    }

    const valueName = value?.switch().name;
    if (valueName === 'scvU32' || valueName === 'scvI32') {
      payload.unlockAt = Number(value.u32());
    } else if (valueName === 'scvU64' || valueName === 'scvI64') {
      payload.unlockAt = Number(value.u64());
    } else if (valueName === 'scvAddress') {
      payload.resolvedAddress = value.address().toString();
    }

    return payload;
  }

  private async getLastProcessedLedger(): Promise<number> {
    const rows: { ledger: number }[] = await this.dataSource.query(
      `SELECT COALESCE(MAX(ledger), 0) AS ledger FROM contract_outbox_events`,
    );
    return rows[0]?.ledger ?? 0;
  }

  private async setLastProcessedLedger(ledger: number): Promise<void> {
    // Stored in the outbox table via MAX(ledger); no separate state table needed.
    void ledger;
  }

  private async getLatestLedger(): Promise<number> {
    if (!this.rpcClient.isInitialized()) {
      return 0;
    }
    try {
      const server = this.rpcClient.getServer();
      const info = await server.getLatestLedger();
      return info.sequence;
    } catch {
      return 0;
    }
  }
}

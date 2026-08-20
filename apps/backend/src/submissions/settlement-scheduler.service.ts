import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Bounty, BountyStatus } from '../entities/bounty.entity';
import { Submission, SubmissionStatus } from '../entities/submission.entity';
import { MetricsService } from '../metrics/metrics.service';
import { SETTLEMENT_SCHEDULER_LOCK_ID } from '../bounties/bounty-automation-lock.constants';
import { withStellarRpcRetry } from '../common/stellar-rpc-retry';
import { ContractRegistryService } from './contract-registry.service';

type SettlementResult = {
  processedAt: Date;
  attempted: number;
  succeeded: number;
  failed: number;
};

@Injectable()
export class SettlementSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SettlementSchedulerService.name);
  private interval?: NodeJS.Timeout;

  constructor(
    @InjectRepository(Bounty)
    private readonly bountyRepo: Repository<Bounty>,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
    private readonly contractRegistryService: ContractRegistryService,
  ) {}

  onModuleInit(): void {
    if (!this.config.get<boolean>('SETTLEMENT_SCHEDULER_ENABLED', true)) {
      return;
    }

    const intervalMs = this.config.get<number>('SETTLEMENT_SCHEDULER_INTERVAL_MS', 15 * 60 * 1000);
    this.interval = setInterval(() => {
      void this.runSettlement().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Settlement scheduler failed: ${message}`);
      });
    }, intervalMs);
    this.interval.unref();
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async runSettlement(now = new Date()): Promise<SettlementResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let lockAcquired = false;

    try {
      const lockRows: { acquired: boolean }[] = await queryRunner.query(
        'SELECT pg_try_advisory_lock($1) AS acquired',
        [SETTLEMENT_SCHEDULER_LOCK_ID],
      );
      lockAcquired = lockRows[0]?.acquired === true;
      if (!lockAcquired) {
        this.logger.debug('Settlement scheduler skipped; another replica holds the lock.');
        return { processedAt: now, attempted: 0, succeeded: 0, failed: 0 };
      }

      const queuedBounties = await this.bountyRepo.find({
        where: { status: BountyStatus.APPROVAL_QUEUED },
        relations: { submissions: true },
      });

      let succeeded = 0;
      let failed = 0;

      for (const bounty of queuedBounties) {
        this.metrics.recordSettlementAttempt();
        const pendingSubmission = bounty.submissions.find(
          (s) => s.status === SubmissionStatus.PENDING,
        );
        if (!pendingSubmission) {
          this.logger.warn(
            `Settlement: bounty ${bounty.id} has no pending submission; skipping.`,
          );
          continue;
        }

        try {
          await this.callExecuteApprove(bounty.id);
          bounty.status = BountyStatus.COMPLETED;
          pendingSubmission.status = SubmissionStatus.APPROVED;
          await this.bountyRepo.save(bounty);
          await this.submissionRepo.save(pendingSubmission);
          this.metrics.recordSettlementSuccess();
          succeeded += 1;
          this.logger.log(
            `Settlement complete: bounty ${bounty.id} → COMPLETED, submission ${pendingSubmission.id} → APPROVED.`,
          );
        } catch (error) {
          this.metrics.recordSettlementFailure();
          failed += 1;
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Settlement failed for bounty ${bounty.id}: ${message}. Will retry on next cycle.`,
          );
        }
      }

      return { processedAt: now, attempted: queuedBounties.length, succeeded, failed };
    } finally {
      if (lockAcquired) {
        await queryRunner.query('SELECT pg_advisory_unlock($1)', [SETTLEMENT_SCHEDULER_LOCK_ID]);
      }
      await queryRunner.release();
    }
  }

  private resolveRpcUrls(network: string): string[] {
    const primary =
      this.config.get<string>('STELLAR_RPC_URL') ??
      (network === 'mainnet'
        ? 'https://mainnet.stellar.validationcloud.io/v1/rpc'
        : 'https://soroban-testnet.stellar.org');
    const backup = this.config.get<string>('STELLAR_RPC_URL_BACKUP');
    return backup ? [primary, backup] : [primary];
  }

  private async getDynamicFee(
    server: StellarSdk.rpc.Server,
    retryOptions: ReturnType<typeof this.createStellarRpcRetryOptions>,
  ): Promise<number> {
    try {
      const feeStats = await withStellarRpcRetry(
        'getFeeStats',
        () => server.getFeeStats(),
        retryOptions,
      );
      const feeStatsAny = feeStats as unknown as { feeCharged: { p95: string } };
      const p95 = Number(feeStatsAny.feeCharged.p95);
      const maxFee = Number(this.config.get<number>('STELLAR_MAX_FEE', 100000));
      return Math.min(p95, maxFee);
    } catch {
      return Number(StellarSdk.BASE_FEE);
    }
  }

  private async callExecuteApprove(bountyId: string): Promise<void> {
    const network = this.config.get<string>('STELLAR_NETWORK', 'testnet');
    const contractId = await this.contractRegistryService.findContractFor(bountyId, network);
    if (!contractId) {
      throw new Error(`No contract mapped for bounty ${bountyId}; cannot settle.`);
    }

    const rpcUrls = this.resolveRpcUrls(network);
    const networkPassphrase =
      network === 'mainnet' ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET;

    const retryOptions = this.createStellarRpcRetryOptions();
    let lastError: unknown;

    for (const rpcUrl of rpcUrls) {
      try {
        const server = new StellarSdk.rpc.Server(rpcUrl);
        const signingSecret = this.config.get<string>('STELLAR_SIGNING_SECRET');
        if (!signingSecret) {
          throw new Error('STELLAR_SIGNING_SECRET is required for settlement');
        }
        const signingKeypair = StellarSdk.Keypair.fromSecret(signingSecret);
        const account = await withStellarRpcRetry(
          'getAccount',
          () => server.getAccount(signingKeypair.publicKey()),
          retryOptions,
        );

        const fee = await this.getDynamicFee(server, retryOptions);

        const contract = new StellarSdk.Contract(contractId);
        const tx = new StellarSdk.TransactionBuilder(account, {
          fee: String(fee),
          networkPassphrase,
        })
          .addOperation(contract.call('execute_approve'))
          .setTimeout(30)
          .build();

        const simResult = await withStellarRpcRetry(
          'simulateTransaction',
          () => server.simulateTransaction(tx),
          retryOptions,
        );
        if ('error' in simResult) {
          const errorDetails = (simResult as StellarSdk.rpc.Api.SimulateTransactionErrorResponse).error;
          throw new Error(`Simulation failed: ${errorDetails}`);
        }

        const prepared = await withStellarRpcRetry(
          'prepareTransaction',
          () => server.prepareTransaction(tx),
          retryOptions,
        );
        prepared.sign(signingKeypair);
        await withStellarRpcRetry(
          'sendTransaction',
          () => server.sendTransaction(prepared),
          retryOptions,
        );

        if (rpcUrl !== rpcUrls[0]) {
          this.logger.log(
            `Settlement RPC failover: primary failed, backup succeeded. bountyId=${bountyId}, backupRpcUrl=${rpcUrl}`,
          );
        }
        return;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Settlement RPC call failed: bountyId=${bountyId}, contractId=${contractId}, rpcUrl=${rpcUrl}, error=${message}`,
        );
      }
    }

    throw lastError;
  }

  private createStellarRpcRetryOptions() {
    const maxRetries = Number(this.config.get<number>('STELLAR_RPC_RETRY_MAX_RETRIES', 3));
    const baseDelayMs = Number(this.config.get<number>('STELLAR_RPC_RETRY_BASE_DELAY_MS', 1000));

    return {
      maxRetries,
      baseDelayMs,
      logger: this.logger,
      onFailure: ({ operation, retryable }: { operation: string; retryable: boolean }) => {
        this.metrics.recordStellarRpcFailure({ operation, retryable });
      },
      onRetry: ({ operation, retryable }: { operation: string; retryable: boolean }) => {
        this.metrics.recordStellarRpcRetry({ operation, retryable });
      },
    };
  }
}

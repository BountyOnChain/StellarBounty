import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Bounty, BountyStatus } from '../entities/bounty.entity';
import { Submission, SubmissionStatus } from '../entities/submission.entity';
import { MetricsService } from '../metrics/metrics.service';
import { withStellarRpcRetry } from '../common/stellar-rpc-retry';
import { CreateSubmissionDto } from './submissions.dto';

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(Bounty)
    private readonly bountyRepo: Repository<Bounty>,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {}

  async create(bountyId: string, dto: CreateSubmissionDto, contributorAddress: string) {
    const bounty = await this.bountyRepo.findOneBy({ id: bountyId });
    if (!bounty) throw new NotFoundException('Bounty not found');

    const submission = this.submissionRepo.create({
      bountyId,
      link: dto.link,
      notes: dto.notes ?? null,
      contributorAddress,
    });
    return this.submissionRepo.save(submission);
  }

  async findAll(bountyId: string, ownerAddress: string) {
    const bounty = await this.bountyRepo.findOneBy({ id: bountyId });
    if (!bounty) throw new NotFoundException('Bounty not found');
    if (bounty.ownerAddress !== ownerAddress) throw new ForbiddenException();
    return this.submissionRepo.findBy({ bountyId });
  }

  async approve(bountyId: string, subId: string, ownerAddress: string) {
    const bounty = await this.bountyRepo.findOneBy({ id: bountyId });
    if (!bounty) throw new NotFoundException('Bounty not found');
    if (bounty.ownerAddress !== ownerAddress) throw new ForbiddenException();

    const alreadyApproved = await this.submissionRepo.findOneBy({
      bountyId,
      status: SubmissionStatus.APPROVED,
    });
    if (alreadyApproved) throw new BadRequestException('A submission is already approved for this bounty');

    const submission = await this.submissionRepo.findOneBy({ id: subId, bountyId });
    if (!submission) throw new NotFoundException('Submission not found');

    await this.callContractApprove(bountyId, ownerAddress);

    submission.status = SubmissionStatus.APPROVED;
    bounty.status = BountyStatus.COMPLETED;
    await this.bountyRepo.save(bounty);
    return this.submissionRepo.save(submission);
  }

  async reject(bountyId: string, subId: string, ownerAddress: string) {
    const bounty = await this.bountyRepo.findOneBy({ id: bountyId });
    if (!bounty) throw new NotFoundException('Bounty not found');
    if (bounty.ownerAddress !== ownerAddress) throw new ForbiddenException();

    const submission = await this.submissionRepo.findOneBy({ id: subId, bountyId });
    if (!submission) throw new NotFoundException('Submission not found');

    submission.status = SubmissionStatus.REJECTED;
    return this.submissionRepo.save(submission);
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

  private async callContractApprove(bountyId: string, ownerAddress: string): Promise<void> {
    const contractId =
      this.config.get<string>(`SOROBAN_CONTRACT_${bountyId.toUpperCase()}`) ??
      this.config.get<string>('SOROBAN_CONTRACT_ID');
    if (!contractId) return; // no contract configured — skip (dev/test mode)

    const network = this.config.get<string>('STELLAR_NETWORK', 'testnet');
    const rpcUrls = this.resolveRpcUrls(network);
    const networkPassphrase =
      network === 'mainnet'
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET;

    const retryOptions = this.createStellarRpcRetryOptions();
    let lastError: unknown;
    for (const rpcUrl of rpcUrls) {
      try {
        const server = new StellarSdk.rpc.Server(rpcUrl);
        const account = await withStellarRpcRetry(
          'getAccount',
          () => server.getAccount(ownerAddress),
          retryOptions,
        );

        const contract = new StellarSdk.Contract(contractId);
        const tx = new StellarSdk.TransactionBuilder(account, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase,
        })
          .addOperation(
            contract.call('approve', StellarSdk.nativeToScVal(ownerAddress, { type: 'address' })),
          )
          .setTimeout(30)
          .build();

        const simResult = await withStellarRpcRetry(
          'simulateTransaction',
          () => server.simulateTransaction(tx),
          retryOptions,
        );
        if ('error' in simResult) {
          const errorDetails = (simResult as StellarSdk.rpc.Api.SimulateTransactionErrorResponse).error;
          this.logger.warn(
            `Stellar transaction simulation failed: bountyId=${bountyId}, contractId=${contractId}, error=${errorDetails}`,
          );
          throw new BadRequestException(
            `Transaction simulation failed: ${errorDetails}. The contract call would not succeed.`,
          );
        }
        if ('transactionData' in simResult) {
          this.logger.log(`Stellar tx simulation OK: bountyId=${bountyId}`);
        }

        const prepared = await withStellarRpcRetry(
          'prepareTransaction',
          () => server.prepareTransaction(tx),
          retryOptions,
        );
        // The backend signs only if a server-side signing key is configured.
        const signingSecret = this.config.get<string>('STELLAR_SIGNING_SECRET');
        if (signingSecret) {
          const signingKeypair = StellarSdk.Keypair.fromSecret(signingSecret);
          prepared.sign(signingKeypair);
          await withStellarRpcRetry(
            'sendTransaction',
            () => server.sendTransaction(prepared),
            retryOptions,
          );
        }
        // Success — log which RPC was used if we fell back from primary
        if (rpcUrl !== rpcUrls[0]) {
          this.logger.log(
            `Stellar RPC failover: primary failed, backup succeeded. bountyId=${bountyId}, backupRpcUrl=${rpcUrl}`,
          );
        }
        return; // success — stop trying
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        lastError = error;
        this.logger.warn(
          `Stellar RPC attempt failed: bountyId=${bountyId}, rpcUrl=${rpcUrl}, error=${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    // All RPC URLs exhausted
    this.logger.warn(
      `Stellar contract approval failed after all RPC endpoints failed: bountyId=${bountyId}, contractId=${contractId}, rpcUrls=${rpcUrls.join(',')}, lastError=${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
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

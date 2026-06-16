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
import { CreateSubmissionDto } from './submissions.dto';

const DEFAULT_STELLAR_MAX_FEE_STROOPS = '100000';

interface StellarFeeEstimate {
  inclusionFeeStroops: string;
  maxFeeStroops: bigint;
  p95FeeStroops: string;
  source: 'rpc-p95' | 'max-fee-fallback';
}

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(Bounty)
    private readonly bountyRepo: Repository<Bounty>,
    private readonly config: ConfigService,
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
    if (alreadyApproved)
      throw new BadRequestException('A submission is already approved for this bounty');

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

  private getConfiguredMaxFee(): bigint {
    const configured = this.config.get<unknown>('STELLAR_MAX_FEE', DEFAULT_STELLAR_MAX_FEE_STROOPS);
    const parsed = this.parsePositiveStroops(configured);

    if (parsed) return parsed;

    this.logger.warn(
      `Invalid STELLAR_MAX_FEE=${String(configured)}; using default ${DEFAULT_STELLAR_MAX_FEE_STROOPS} stroops`,
    );
    return BigInt(DEFAULT_STELLAR_MAX_FEE_STROOPS);
  }

  private parsePositiveStroops(value: unknown): bigint | null {
    const normalized = String(value ?? '').trim();
    if (!/^\d+$/.test(normalized)) return null;

    const parsed = BigInt(normalized);
    return parsed > 0n ? parsed : null;
  }

  private clampFeeToMax(fee: bigint, maxFee: bigint): bigint {
    return fee > maxFee ? maxFee : fee;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async estimateStellarInclusionFee(
    server: StellarSdk.rpc.Server,
    maxFeeStroops: bigint,
  ): Promise<StellarFeeEstimate> {
    try {
      const feeStats = await server.getFeeStats();
      const p95Fee =
        this.parsePositiveStroops(feeStats.sorobanInclusionFee?.p95) ??
        this.parsePositiveStroops(feeStats.inclusionFee?.p95);

      if (!p95Fee) throw new Error('RPC fee stats did not include a positive p95 fee');

      const inclusionFee = this.clampFeeToMax(p95Fee, maxFeeStroops);
      if (inclusionFee < p95Fee) {
        this.logger.warn(
          `Capping Stellar p95 fee from ${p95Fee.toString()} to ${inclusionFee.toString()} stroops`,
        );
      }

      return {
        inclusionFeeStroops: inclusionFee.toString(),
        maxFeeStroops,
        p95FeeStroops: p95Fee.toString(),
        source: 'rpc-p95',
      };
    } catch (error) {
      this.logger.warn(
        `Stellar fee stats unavailable; using STELLAR_MAX_FEE=${maxFeeStroops.toString()} stroops: ${this.getErrorMessage(error)}`,
      );

      return {
        inclusionFeeStroops: maxFeeStroops.toString(),
        maxFeeStroops,
        p95FeeStroops: 'unavailable',
        source: 'max-fee-fallback',
      };
    }
  }

  private capPreparedTransactionFee(
    prepared: StellarSdk.Transaction,
    feeEstimate: StellarFeeEstimate,
    networkPassphrase: string,
  ): { transaction: StellarSdk.Transaction; simulatedResourceFeeStroops: string } {
    const preparedFee = this.parsePositiveStroops(prepared.fee);
    const inclusionFee = this.parsePositiveStroops(feeEstimate.inclusionFeeStroops) ?? 0n;

    if (!preparedFee) {
      return { transaction: prepared, simulatedResourceFeeStroops: 'unavailable' };
    }

    const simulatedResourceFee = preparedFee > inclusionFee ? preparedFee - inclusionFee : 0n;
    const cappedFee = this.clampFeeToMax(preparedFee, feeEstimate.maxFeeStroops);

    if (cappedFee === preparedFee) {
      return {
        transaction: prepared,
        simulatedResourceFeeStroops: simulatedResourceFee.toString(),
      };
    }

    this.logger.warn(
      `Capping prepared Stellar fee from ${preparedFee.toString()} to ${cappedFee.toString()} stroops`,
    );

    return {
      transaction: StellarSdk.TransactionBuilder.cloneFrom(prepared, {
        fee: cappedFee.toString(),
        networkPassphrase,
      }).build(),
      simulatedResourceFeeStroops: simulatedResourceFee.toString(),
    };
  }

  private async callContractApprove(bountyId: string, ownerAddress: string): Promise<void> {
    const contractId =
      this.config.get<string>(`SOROBAN_CONTRACT_${bountyId.toUpperCase()}`) ??
      this.config.get<string>('SOROBAN_CONTRACT_ID');
    if (!contractId) return; // no contract configured — skip (dev/test mode)

    const network = this.config.get<string>('STELLAR_NETWORK', 'testnet');
    const rpcUrl =
      this.config.get<string>('STELLAR_RPC_URL') ??
      (network === 'mainnet'
        ? 'https://mainnet.stellar.validationcloud.io/v1/rpc'
        : 'https://soroban-testnet.stellar.org');

    const server = new StellarSdk.rpc.Server(rpcUrl);
    const networkPassphrase =
      network === 'mainnet' ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET;

    try {
      const account = await server.getAccount(ownerAddress);
      const maxFee = this.getConfiguredMaxFee();
      const feeEstimate = await this.estimateStellarInclusionFee(server, maxFee);

      const contract = new StellarSdk.Contract(contractId);
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: feeEstimate.inclusionFeeStroops,
        networkPassphrase,
      })
        .addOperation(
          contract.call('approve', StellarSdk.nativeToScVal(ownerAddress, { type: 'address' })),
        )
        .setTimeout(30)
        .build();

      let transactionToSubmit = tx;
      let simulatedResourceFee = 'unavailable';

      try {
        const prepared = await server.prepareTransaction(tx);
        const capped = this.capPreparedTransactionFee(prepared, feeEstimate, networkPassphrase);
        transactionToSubmit = capped.transaction;
        simulatedResourceFee = capped.simulatedResourceFeeStroops;
      } catch (error) {
        this.logger.warn(
          `Stellar transaction simulation failed; proceeding with p95 inclusion fee only: ${this.getErrorMessage(error)}`,
        );
      }

      this.logger.log(
        `Using Stellar fee: ${transactionToSubmit.fee} stroops (p95=${feeEstimate.p95FeeStroops}, simulated=${simulatedResourceFee}, max=${maxFee.toString()}, source=${feeEstimate.source})`,
      );

      // The backend signs only if a server-side signing key is configured.
      const signingSecret = this.config.get<string>('STELLAR_SIGNING_SECRET');
      if (signingSecret) {
        const signingKeypair = StellarSdk.Keypair.fromSecret(signingSecret);
        transactionToSubmit.sign(signingKeypair);
        await server.sendTransaction(transactionToSubmit);
      }
    } catch (error) {
      const message = this.getErrorMessage(error);
      this.logger.warn(
        `Stellar contract approval skipped after RPC failure: bountyId=${bountyId}, contractId=${contractId}, rpcUrl=${rpcUrl}, error=${message}`,
      );
    }
    // If no signing secret, the transaction is prepared but not submitted —
    // the client is expected to sign and submit it separately.
  }
}

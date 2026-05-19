import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SorobanService } from './soroban.service';
import { BountyStoreService } from './bounty-store.service';
import {
  Submission,
  SubmissionStatus,
  SubmissionStore,
} from './interfaces/submission.interface';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  // In-memory store (MVP stage — replace with TypeORM/Prisma later)
  private readonly submissions: SubmissionStore = {};

  constructor(
    private readonly sorobanService: SorobanService,
    private readonly bountyStore: BountyStoreService,
  ) {}

  /**
   * Create a new submission for a bounty.
   * Only one submission per user per bounty is allowed.
   */
  create(
    bountyId: string,
    submitterAddress: string,
    dto: CreateSubmissionDto,
  ): Submission {
    // Check for duplicate submission
    const existing = Object.values(this.submissions).find(
      (s) => s.bountyId === bountyId && s.submitterAddress === submitterAddress,
    );

    if (existing) {
      throw new ConflictException(
        'You have already submitted to this bounty.',
      );
    }

    const now = new Date().toISOString();
    const submission: Submission = {
      id: uuidv4(),
      bountyId,
      submitterAddress,
      workLink: dto.workLink,
      notes: dto.notes,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    this.submissions[submission.id] = submission;
    this.logger.log(
      `Submission ${submission.id} created for bounty ${bountyId} by ${submitterAddress}`,
    );

    return submission;
  }

  /**
   * Get all submissions for a specific bounty.
   * Verifies the caller is the bounty owner before returning results.
   * In MVP mode (bounty not in store), ownership check is skipped with a warning.
   */
  findByBountyId(bountyId: string, callerAddress?: string): Submission[] {
    // If caller address is provided, verify they are the bounty owner
    if (callerAddress) {
      const bounty = this.bountyStore.findOneSafe(bountyId);
      if (bounty && bounty.ownerAddress !== callerAddress) {
        throw new ForbiddenException(
          'Only the bounty owner can view submissions.',
        );
      }
      // If bounty not in store (MVP mode), skip ownership check gracefully
      if (!bounty) {
        this.logger.warn(
          `Bounty ${bountyId} not in store — ownership check skipped for GET (MVP mode). ` +
          'Bounties must be registered via BountyStoreService.upsert() for full security.',
        );
      }
    }

    return Object.values(this.submissions)
      .filter((s) => s.bountyId === bountyId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }

  /**
   * Get a single submission by ID.
   */
  findOne(submissionId: string): Submission {
    const submission = this.submissions[submissionId];
    if (!submission) {
      throw new NotFoundException(`Submission ${submissionId} not found.`);
    }
    return submission;
  }

  /**
   * Approve a submission.
   * - Only bounty owner can approve
   * - Only ONE submission can be approved per bounty
   * - Approving calls the Soroban contract `release` to transfer funds
   *
   * @returns Transaction hash from Soroban if successful
   */
  async approve(
    submissionId: string,
    bountyId: string,
    ownerAddress: string,
  ): Promise<{ status: string; txHash?: string }> {
    const submission = this.findOne(submissionId);

    // Ownership check: verify the caller is the actual bounty owner
    if (!this.bountyStore.isOwner(bountyId, ownerAddress)) {
      throw new ForbiddenException(
        'Only the bounty owner can approve submissions.',
      );
    }

    // Prevent self-approval
    if (submission.submitterAddress === ownerAddress) {
      throw new BadRequestException('Cannot approve your own submission.');
    }

    // Verify status
    if (submission.status !== 'pending') {
      throw new ConflictException(
        `Submission is already ${submission.status}. Only pending submissions can be approved.`,
      );
    }

    // Check no other submission is already approved for this bounty
    const alreadyApproved = Object.values(this.submissions).find(
      (s) => s.bountyId === bountyId && s.status === 'approved',
    );

    if (alreadyApproved) {
      throw new ConflictException(
        `Bounty ${bountyId} already has an approved submission (${alreadyApproved.id}). Only one approval allowed per bounty.`,
      );
    }

    // Update status
    submission.status = 'approved';
    submission.updatedAt = new Date().toISOString();

    // Call Soroban contract to release funds
    let txHash: string | undefined;
    try {
      txHash = await this.sorobanService.releaseBounty(
        bountyId,
        submission.submitterAddress,
      );
      this.logger.log(
        `Submission ${submissionId} approved. Soroban release TX: ${txHash}`,
      );
    } catch (error) {
      this.logger.error(
        `Soroban release failed for submission ${submissionId}: ${(error as Error).message}`,
      );
      // Keep submission as approved but flag the error
      submission.status = 'approved';
      submission.updatedAt = new Date().toISOString();
      throw new Error(
        `Submission approved but payout failed: ${(error as Error).message}`,
      );
    }

    return { status: 'approved', txHash };
  }

  /**
   * Reject a submission.
   * Only bounty owner can reject.
   */
  reject(
    submissionId: string,
    bountyId: string,
    ownerAddress: string,
  ): { status: string } {
    const submission = this.findOne(submissionId);

    // Ownership check: verify the caller is the actual bounty owner
    if (!this.bountyStore.isOwner(bountyId, ownerAddress)) {
      throw new ForbiddenException(
        'Only the bounty owner can reject submissions.',
      );
    }

    // Prevent self-rejection
    if (submission.submitterAddress === ownerAddress) {
      throw new BadRequestException('Cannot reject your own submission.');
    }

    // Verify status
    if (submission.status !== 'pending') {
      throw new ConflictException(
        `Submission is already ${submission.status}. Only pending submissions can be rejected.`,
      );
    }

    submission.status = 'rejected';
    submission.updatedAt = new Date().toISOString();

    this.logger.log(`Submission ${submissionId} rejected.`);
    return { status: 'rejected' };
  }

  /**
   * Get all submissions by a specific submitter.
   */
  findBySubmitter(submitterAddress: string): Submission[] {
    return Object.values(this.submissions)
      .filter((s) => s.submitterAddress === submitterAddress)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }
}

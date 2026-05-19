import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Bounty, BountyStore } from './interfaces/bounty.interface';

/**
 * In-memory bounty store for MVP purposes.
 * This will be replaced by the actual Bounty module once it exists.
 *
 * Provides a lightweight way to look up bounty owners for ownership verification
 * in the Submissions module (approve/reject operations).
 */
@Injectable()
export class BountyStoreService {
  private readonly logger = new Logger(BountyStoreService.name);

  // In-memory store (MVP stage — replace with TypeORM/Prisma later)
  private readonly bounties: BountyStore = {};

  /**
   * Register or update a bounty in the store.
   * Called by external modules or seed data.
   */
  upsert(bounty: Bounty): void {
    this.bounties[bounty.id] = bounty;
    this.logger.log(`Bounty ${bounty.id} upserted in store (owner: ${bounty.ownerAddress})`);
  }

  /**
   * Find a bounty by ID.
   * Throws NotFoundException if not found.
   */
  findOne(bountyId: string): Bounty {
    const bounty = this.bounties[bountyId];
    if (!bounty) {
      throw new NotFoundException(`Bounty ${bountyId} not found in store.`);
    }
    return bounty;
  }

  /**
   * Find a bounty by ID without throwing.
   * Returns null if not found (safe for MVP mode when Bounty module doesn't exist yet).
   */
  findOneSafe(bountyId: string): Bounty | null {
    return this.bounties[bountyId] || null;
  }

  /**
   * Get the owner address of a bounty.
   * Throws if the bounty doesn't exist.
   */
  getOwnerAddress(bountyId: string): string {
    return this.findOne(bountyId).ownerAddress;
  }

  /**
   * Check if a wallet address is the owner of a bounty.
   * Logs a warning if bounty is not in store (MVP mode).
   * Returns false if bounty not found or wallet doesn't match.
   */
  isOwner(bountyId: string, walletAddress: string): boolean {
    const bounty = this.findOneSafe(bountyId);
    if (!bounty) {
      this.logger.warn(
        `Bounty ${bountyId} not in store — ownership check skipped (MVP mode). ` +
        'Call upsert() to register bounties, or integrate with the Bounty module.',
      );
      return false;
    }
    return bounty.ownerAddress === walletAddress;
  }
}

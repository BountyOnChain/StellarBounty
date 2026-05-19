import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Bounty, BountyStatus, PaginatedResult } from './interfaces/bounty.interface';
import { CreateBountyDto, BountyResponseDto } from './dto/create-bounty.dto';
import { UpdateBountyDto } from './dto/update-bounty.dto';

@Injectable()
export class BountiesService {
  private readonly logger = new Logger(BountiesService.name);

  // In-memory store (MVP — persistence added in Issue #7)
  private readonly bounties: Map<string, Bounty> = new Map();

  /**
   * Create a new bounty.
   * @param dto Create payload
   * @param ownerAddress Stellar wallet of the creator
   */
  create(dto: CreateBountyDto, ownerAddress: string): BountyResponseDto {
    const now = new Date().toISOString();
    const bounty: Bounty = {
      id: uuidv4(),
      title: dto.title,
      description: dto.description,
      rewardAmount: dto.rewardAmount,
      deadline: dto.deadline,
      status: 'open',
      ownerAddress,
      tags: dto.tags || [],
      createdAt: now,
      updatedAt: now,
    };

    this.bounties.set(bounty.id, bounty);
    this.logger.log(`Bounty ${bounty.id} created by ${ownerAddress}`);
    return this.toResponse(bounty);
  }

  /**
   * List all bounties with pagination.
   */
  findAll(page: number = 1, limit: number = 20): PaginatedResult<BountyResponseDto> {
    const allBounties = Array.from(this.bounties.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = allBounties.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const start = (page - 1) * limit;
    const data = allBounties.slice(start, start + limit).map(this.toResponse);

    return {
      data,
      meta: { total, page, limit, totalPages },
    };
  }

  /**
   * Find a single bounty by ID.
   */
  findOne(id: string): BountyResponseDto {
    const bounty = this.bounties.get(id);
    if (!bounty) {
      throw new NotFoundException(`Bounty ${id} not found.`);
    }
    return this.toResponse(bounty);
  }

  /**
   * Update a bounty (owner only).
   */
  update(
    id: string,
    dto: UpdateBountyDto,
    callerAddress: string,
  ): BountyResponseDto {
    const bounty = this.getBountyOrThrow(id);

    // Owner check
    if (bounty.ownerAddress !== callerAddress) {
      throw new ForbiddenException('Only the bounty owner can update this bounty.');
    }

    // Can only update if still open
    if (bounty.status !== 'open') {
      throw new ConflictException(
        `Cannot update a bounty that is ${bounty.status}. Only open bounties can be updated.`,
      );
    }

    Object.assign(bounty, dto);
    bounty.updatedAt = new Date().toISOString();
    this.bounties.set(id, bounty);

    this.logger.log(`Bounty ${id} updated by ${callerAddress}`);
    return this.toResponse(bounty);
  }

  /**
   * Soft-delete / cancel a bounty (owner only).
   */
  remove(id: string, callerAddress: string): { success: boolean } {
    const bounty = this.getBountyOrThrow(id);

    // Owner check
    if (bounty.ownerAddress !== callerAddress) {
      throw new ForbiddenException('Only the bounty owner can cancel this bounty.');
    }

    // Can only cancel if still open
    if (bounty.status !== 'open') {
      throw new ConflictException(
        `Cannot cancel a bounty that is ${bounty.status}. Only open bounties can be cancelled.`,
      );
    }

    bounty.status = 'closed';
    bounty.updatedAt = new Date().toISOString();
    this.bounties.set(id, bounty);

    this.logger.log(`Bounty ${id} cancelled by ${callerAddress}`);
    return { success: true };
  }

  // ── Internal helpers ──────────────────────────────────

  private getBountyOrThrow(id: string): Bounty {
    const bounty = this.bounties.get(id);
    if (!bounty) {
      throw new NotFoundException(`Bounty ${id} not found.`);
    }
    return bounty;
  }

  private toResponse(b: Bounty): BountyResponseDto {
    return {
      id: b.id,
      title: b.title,
      description: b.description,
      rewardAmount: b.rewardAmount,
      deadline: b.deadline,
      status: b.status,
      ownerAddress: b.ownerAddress,
      tags: b.tags,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  }
}

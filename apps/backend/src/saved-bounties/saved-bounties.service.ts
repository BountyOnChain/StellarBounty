import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedBounty } from '../entities/saved-bounty.entity';
import { Bounty } from '../entities/bounty.entity';

@Injectable()
export class SavedBountiesService {
  constructor(
    @InjectRepository(SavedBounty)
    private readonly saved: Repository<SavedBounty>,
    @InjectRepository(Bounty)
    private readonly bounties: Repository<Bounty>,
  ) {}

  async findAll(address: string) {
    const savedRecords = await this.saved.find({
      where: { address },
      order: { createdAt: 'DESC' },
    });

    if (savedRecords.length === 0) return [];

    const bountyIds = savedRecords.map((s) => s.bountyId);
    const bountyMap = new Map<string, Bounty>();
    const bounties = await this.bounties.find({
      where: bountyIds.map((id) => ({ id })),
      withDeleted: true,
    });
    for (const b of bounties) {
      bountyMap.set(b.id, b);
    }

    return savedRecords.map((s) => {
      const bounty = bountyMap.get(s.bountyId);
      return {
        id: s.id,
        address: s.address,
        bountyId: s.bountyId,
        createdAt: s.createdAt.toISOString(),
        title: bounty?.title ?? 'Deleted bounty',
        rewardAmount: bounty?.rewardAmount?.toString() ?? null,
        deadline: bounty?.deadline?.toISOString() ?? null,
        status: bounty?.status ?? 'deleted',
      };
    });
  }
}
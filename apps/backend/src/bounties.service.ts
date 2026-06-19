import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBountyDto, UpdateBountyDto } from './bounties/dto/bounty.dto';
import { sanitizeDescription } from './common/sanitize-description';
import { Bounty } from './entities/bounty.entity';

@Injectable()
export class BountiesService {
  constructor(
    @InjectRepository(Bounty)
    private readonly bounties: Repository<Bounty>,
  ) {}

  async create(dto: CreateBountyDto) {
    const bounty = this.bounties.create({
      ...dto,
      description: sanitizeDescription(dto.description),
      rewardAmount: BigInt(dto.rewardAmount),
      deadline: dto.deadline ? new Date(dto.deadline) : null,
    });
    return this.bounties.save(bounty);
  }

  async findAll() {
    return this.bounties.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const bounty = await this.bounties.findOne({ where: { id } });
    if (!bounty) {
      throw new NotFoundException('Bounty not found');
    }
    return bounty;
  }

  async update(id: string, dto: UpdateBountyDto) {
    const bounty = await this.findOne(id);
    Object.assign(bounty, {
      ...dto,
      description: dto.description === undefined ? bounty.description : sanitizeDescription(dto.description),
      rewardAmount: dto.rewardAmount !== undefined ? BigInt(dto.rewardAmount) : bounty.rewardAmount,
      deadline: dto.deadline === undefined ? bounty.deadline : new Date(dto.deadline),
    });
    return this.bounties.save(bounty);
  }

  async remove(id: string) {
    const bounty = await this.findOne(id);
    await this.bounties.softRemove(bounty);
    return { deleted: true };
  }

  async restore(id: string) {
    // softRemove sets deletedAt, restore unsets it
    const bounty = await this.bounties.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!bounty) {
      throw new NotFoundException('Bounty not found');
    }
    if (bounty.deletedAt === null) {
      return bounty;
    }
    await this.bounties.restore(id);
    return this.findOne(id);
  }
}

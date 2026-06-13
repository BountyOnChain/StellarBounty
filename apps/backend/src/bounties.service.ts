import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBountyDto, UpdateBountyDto } from './bounties/dto/bounty.dto';
import { Bounty } from './entities/bounty.entity';
import { NotificationsService } from './notifications/notifications.service';

@Injectable()
export class BountiesService {
  constructor(
    @InjectRepository(Bounty)
    private readonly bounties: Repository<Bounty>,
    @Optional()
    private readonly notifications?: NotificationsService,
  ) {}

  async create(dto: CreateBountyDto) {
    const bounty = this.bounties.create({
      ...dto,
      deadline: dto.deadline ? new Date(dto.deadline) : null,
    });
    const saved = await this.bounties.save(bounty);
    this.notifications?.emitBountyCreated(saved);
    return saved;
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
      deadline: dto.deadline === undefined ? bounty.deadline : new Date(dto.deadline),
    });
    const saved = await this.bounties.save(bounty);
    this.notifications?.emitBountyUpdated(saved);
    return saved;
  }

  async remove(id: string) {
    const bounty = await this.findOne(id);
    await this.bounties.remove(bounty);
    return { deleted: true };
  }
}

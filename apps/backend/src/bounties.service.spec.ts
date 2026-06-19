import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BountiesService } from '../bounties.service';
import { Bounty } from '../entities/bounty.entity';

describe('BountiesService — Re-initialization Protection', () => {
  let service: BountiesService;
  let repo: Repository<Bounty>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BountiesService,
        {
          provide: getRepositoryToken(Bounty),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BountiesService>(BountiesService);
    repo = module.get<Repository<Bounty>>(getRepositoryToken(Bounty));
  });

  it('should create a bounty when none exists with same id', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(null);
    const savedBounty = { id: 'bounty-1', title: 'Test Bounty', status: 'active' };
    jest.spyOn(repo, 'save').mockResolvedValue(savedBounty as Bounty);
    jest.spyOn(repo, 'create').mockReturnValue(savedBounty as Bounty);

    const result = await service.create({ title: 'Test Bounty', description: 'test' });
    expect(repo.create).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
    expect(result).toEqual(savedBounty);
  });

  it('should throw NotFoundException for missing bounty on findOne', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(null);

    await expect(service.findOne('nonexistent-id')).rejects.toThrow('Bounty not found');
  });

  it('should update existing bounty fields', async () => {
    const existingBounty = { id: 'bounty-1', title: 'Old Title', status: 'active' };
    jest.spyOn(repo, 'findOne').mockResolvedValue(existingBounty as Bounty);
    jest.spyOn(repo, 'save').mockImplementation((dto) => Promise.resolve(dto));

    const result = await service.update('bounty-1', { title: 'New Title' });
    expect(repo.save).toHaveBeenCalled();
    expect(result.title).toBe('New Title');
  });

  it('should delete a bounty successfully', async () => {
    const existingBounty = { id: 'bounty-1', title: 'Test', status: 'active' };
    jest.spyOn(repo, 'findOne').mockResolvedValue(existingBounty as Bounty);
    jest.spyOn(repo, 'remove').mockResolvedValue(undefined);

    const result = await service.remove('bounty-1');
    expect(repo.remove).toHaveBeenCalledWith(existingBounty);
    expect(result).toEqual({ deleted: true });
  });
});

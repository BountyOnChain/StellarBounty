import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from '../entities/audit-log.entity';

type MockRepository<T extends object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('AuditService', () => {
  let service: AuditService;
  let repository: MockRepository<AuditLog>;

  beforeEach(async () => {
    repository = {
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => input),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: repository,
        },
      ],
    }).compile();

    service = moduleRef.get(AuditService);
  });

  it('persists an audit log with scrubbed sensitive metadata', async () => {
    await service.log('GOWNER', 'bounty.create', 'bounty', 'bounty1', {
      status: 'open',
      signature: 'secret-signature',
      nested: {
        token: 'secret-token',
        safe: 'kept',
      },
    });

    expect(repository.create).toHaveBeenCalledWith({
      address: 'GOWNER',
      action: 'bounty.create',
      resourceType: 'bounty',
      resourceId: 'bounty1',
      outcome: 'success',
      metadata: {
        status: 'open',
        nested: {
          safe: 'kept',
        },
      },
    });
    expect(repository.save).toHaveBeenCalled();
  });

  it('does not throw when audit persistence fails', async () => {
    repository.save!.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(service.log('GOWNER', 'bounty.create', 'bounty', 'bounty1')).resolves.toBeUndefined();
  });
});

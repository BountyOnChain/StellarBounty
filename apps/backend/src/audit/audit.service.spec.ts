import { Repository } from 'typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from '../entities/audit-log.entity';

type MockRepository<T extends object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('AuditService', () => {
  it('stores audit events without sensitive metadata', async () => {
    const repository: MockRepository<AuditLog> = {
      create: jest.fn((input) => input as AuditLog),
      save: jest.fn(async (input) => input as AuditLog),
    };
    const service = new AuditService(repository as unknown as Repository<AuditLog>);

    await service.log({
      address: 'GOWNER',
      action: 'bounty.create',
      resourceType: 'bounty',
      resourceId: 'bounty1',
      metadata: {
        rewardAmount: '100',
        signature: 'signed',
        nested: { accessToken: 'token', safe: true },
      },
    });

    expect(repository.create).toHaveBeenCalledWith({
      address: 'GOWNER',
      action: 'bounty.create',
      resourceType: 'bounty',
      resourceId: 'bounty1',
      outcome: 'success',
      metadata: {
        rewardAmount: '100',
        nested: { safe: true },
      },
    });
    expect(repository.save).toHaveBeenCalled();
  });
});

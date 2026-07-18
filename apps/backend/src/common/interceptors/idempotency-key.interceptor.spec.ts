import { BadRequestException, CallHandler, ConflictException, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { Repository } from 'typeorm';
import { IdempotencyRecord } from '../../entities/idempotency-record.entity';
import { IdempotencyKeyInterceptor } from './idempotency-key.interceptor';

type MockRepo = {
  findOne: jest.Mock;
  delete: jest.Mock;
  create: jest.Mock;
  insert: jest.Mock;
};

describe('IdempotencyKeyInterceptor', () => {
  function buildContext(params: {
    key?: string;
    body?: Record<string, unknown>;
    responseStatusCode?: number;
  }): { context: ExecutionContext; response: { setHeader: jest.Mock; status: jest.Mock; statusCode: number } } {
    const request = {
      method: 'POST',
      originalUrl: '/api/v1/bounties',
      params: {},
      query: {},
      body: params.body ?? {},
      user: { address: 'GUSER' },
      header: (name: string) => (name === 'Idempotency-Key' ? params.key : undefined),
    };

    const response = {
      statusCode: params.responseStatusCode ?? 201,
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;

    return { context, response };
  }

  function createRepo(overrides: Partial<MockRepo> = {}): MockRepo {
    return {
      findOne: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
      create: jest.fn((input) => input as IdempotencyRecord),
      insert: jest.fn().mockResolvedValue({}),
      ...overrides,
    };
  }

  it('throws when Idempotency-Key header is missing', async () => {
    const repo = createRepo();
    const interceptor = new IdempotencyKeyInterceptor(
      repo as unknown as Repository<IdempotencyRecord>,
    );
    const { context } = buildContext({});
    const next: CallHandler = { handle: jest.fn(() => of({ ok: true })) };

    expect(() => interceptor.intercept(context, next)).toThrow(BadRequestException);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('replays a stored response and marks response header', async () => {
    const now = Date.now();
    const repo = createRepo();
    const interceptor = new IdempotencyKeyInterceptor(
      repo as unknown as Repository<IdempotencyRecord>,
    );
    const { context, response } = buildContext({
      key: 'same-key',
      body: { title: 'A', description: 'B', rewardAmount: '1000', ownerAddress: 'GUSER' },
    });
    const request = context.switchToHttp().getRequest() as any;
    const requestHash = (interceptor as any).hash(
      (interceptor as any).serialize((interceptor as any).buildRequestFingerprint(request)),
    );
    (repo.findOne as jest.Mock).mockResolvedValue({
      key: 'same-key',
      requestHash,
      responseHash: 'hash',
      responseBody: JSON.stringify({ id: 'bounty-1', title: 'Replay' }),
      statusCode: 201,
      expiresAt: new Date(now + 60_000),
    } as IdempotencyRecord);
    const next: CallHandler = { handle: jest.fn(() => of({ id: 'new' })) };

    const replayed = await firstValueFrom(interceptor.intercept(context, next));

    expect(replayed).toEqual({ id: 'bounty-1', title: 'Replay' });
    expect(next.handle).not.toHaveBeenCalled();
    expect(response.setHeader).toHaveBeenCalledWith('Idempotent-Replayed', 'true');
    expect(response.status).toHaveBeenCalledWith(201);
  });

  it('rejects when a key is reused with different payload', async () => {
    const now = Date.now();
    const repo = createRepo({
      findOne: jest.fn().mockResolvedValue({
        key: 'same-key',
        requestHash: 'stored-hash-for-different-payload',
        responseHash: 'hash',
        responseBody: JSON.stringify({ id: 'bounty-1' }),
        statusCode: 201,
        expiresAt: new Date(now + 60_000),
      } as IdempotencyRecord),
    });
    const interceptor = new IdempotencyKeyInterceptor(
      repo as unknown as Repository<IdempotencyRecord>,
    );
    const { context } = buildContext({
      key: 'same-key',
      body: { title: 'new payload' },
    });
    const next: CallHandler = { handle: jest.fn(() => of({ id: 'new' })) };

    await expect(firstValueFrom(interceptor.intercept(context, next))).rejects.toThrow(
      ConflictException,
    );
    expect(next.handle).not.toHaveBeenCalled();
  });
});

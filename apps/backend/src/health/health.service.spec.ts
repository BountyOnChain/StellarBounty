import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';

// Mock StellarSdk
jest.mock('@stellar/stellar-sdk', () => ({
  rpc: {
    Server: jest.fn(),
  },
  nativeToScVal: jest.fn((val: string) => ({ type: 'symbol', value: val })),
}));

import * as StellarSdk from '@stellar/stellar-sdk';

describe('HealthService', () => {
  let dataSource: Pick<DataSource, 'query'>;
  let configService: Partial<ConfigService>;
  let service: HealthService;

  beforeEach(() => {
    dataSource = {
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    configService = {
      get: jest.fn().mockReturnValue(undefined),
    };
    service = new HealthService(
      dataSource as DataSource,
      configService as ConfigService,
    );
  });

  it('returns connected database status when SELECT 1 succeeds', async () => {
    const health = await service.getHealth();

    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    expect(health).toMatchObject({
      status: 'ok',
      database: 'connected',
      environment: expect.any(String),
      version: '0.1.0',
    });
    expect(health.timestamp).toEqual(expect.any(String));
    expect(health.uptime).toEqual(expect.any(Number));
  });

  it('returns degraded when database is disconnected', async () => {
    jest
      .spyOn(dataSource, 'query')
      .mockRejectedValueOnce(new Error('connection refused'));

    await expect(service.getHealth()).resolves.toMatchObject({
      status: 'degraded',
      database: 'disconnected',
    });
  });

  it('returns stellarRpc as not_configured when STELLAR_NETWORK is unset', async () => {
    const health = await service.getHealth();
    expect(health.stellarRpc).toBe('not_configured');
  });

  it('returns stellarRpc as connected when RPC responds', async () => {
    (configService.get as jest.Mock).mockImplementation(
      (key: string) => {
        if (key === 'STELLAR_NETWORK') return 'testnet';
        return undefined;
      },
    );

    const mockServer = {
      getHealth: jest.fn().mockResolvedValue({}),
    };
    (StellarSdk.rpc.Server as jest.Mock).mockImplementation(
      () => mockServer,
    );

    const health = await service.getHealth();
    expect(health.stellarRpc).toBe('connected');
  });

  it('returns stellarRpc as disconnected when RPC fails', async () => {
    (configService.get as jest.Mock).mockImplementation(
      (key: string) => {
        if (key === 'STELLAR_NETWORK') return 'testnet';
        return undefined;
      },
    );

    const mockServer = {
      getHealth: jest
        .fn()
        .mockRejectedValue(new Error('RPC unreachable')),
    };
    (StellarSdk.rpc.Server as jest.Mock).mockImplementation(
      () => mockServer,
    );

    const health = await service.getHealth();
    expect(health.stellarRpc).toBe('disconnected');
  });

  it('returns contract as not_configured when SOROBAN_CONTRACT_ID is unset', async () => {
    const health = await service.getHealth();
    expect(health.contract).toBe('not_configured');
  });

  it('returns contract as reachable when contract data responds', async () => {
    (configService.get as jest.Mock).mockImplementation(
      (key: string) => {
        if (key === 'STELLAR_NETWORK') return 'testnet';
        if (key === 'SOROBAN_CONTRACT_ID') return 'C123';
        return undefined;
      },
    );

    const mockServer = {
      getHealth: jest.fn().mockResolvedValue({}),
      getContractData: jest.fn().mockResolvedValue({}),
    };
    (StellarSdk.rpc.Server as jest.Mock).mockImplementation(
      () => mockServer,
    );

    const health = await service.getHealth();
    expect(health.contract).toBe('reachable');
  });

  it('returns degraded when RPC is down but DB is up', async () => {
    (configService.get as jest.Mock).mockImplementation(
      (key: string) => {
        if (key === 'STELLAR_NETWORK') return 'testnet';
        return undefined;
      },
    );

    const mockServer = {
      getHealth: jest
        .fn()
        .mockRejectedValue(new Error('RPC down')),
    };
    (StellarSdk.rpc.Server as jest.Mock).mockImplementation(
      () => mockServer,
    );

    const health = await service.getHealth();
    expect(health.status).toBe('degraded');
    expect(health.database).toBe('connected');
    expect(health.stellarRpc).toBe('disconnected');
  });

  it('returns degraded when contract is unreachable but DB is up', async () => {
    (configService.get as jest.Mock).mockImplementation(
      (key: string) => {
        if (key === 'STELLAR_NETWORK') return 'testnet';
        if (key === 'SOROBAN_CONTRACT_ID') return 'C123';
        return undefined;
      },
    );

    const mockServer = {
      getHealth: jest.fn().mockResolvedValue({}),
      getContractData: jest
        .fn()
        .mockRejectedValue(new Error('contract not found')),
    };
    (StellarSdk.rpc.Server as jest.Mock).mockImplementation(
      () => mockServer,
    );

    const health = await service.getHealth();
    expect(health.status).toBe('degraded');
    expect(health.contract).toBe('unreachable');
  });

  it('returns ok when no stellar config is set (DB-only mode)', async () => {
    const health = await service.getHealth();
    expect(health.status).toBe('ok');
    expect(health.stellarRpc).toBe('not_configured');
    expect(health.contract).toBe('not_configured');
  });
});

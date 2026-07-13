import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { HealthResponseDto } from './dto/health.dto';

const DATABASE_HEALTH_TIMEOUT_MS = 250;
const STELLAR_RPC_TIMEOUT_MS = 2000;

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async getHealth(): Promise<HealthResponseDto> {
    const [database, stellarRpc, contract] = await Promise.allSettled([
      this.getDatabaseStatus(),
      this.getStellarRpcStatus(),
      this.getContractStatus(),
    ]);

    const dbStatus =
      database.status === 'fulfilled' ? database.value : 'disconnected';
    const rpcStatus =
      stellarRpc.status === 'fulfilled' ? stellarRpc.value : 'disconnected';
    const contractStatus =
      contract.status === 'fulfilled' ? contract.value : 'unreachable';

    const isDegraded =
      dbStatus === 'disconnected' ||
      (rpcStatus !== 'not_configured' && rpcStatus === 'disconnected') ||
      (contractStatus !== 'not_configured' && contractStatus === 'unreachable');

    return {
      status: isDegraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? 'development',
      version: '0.1.0',
      uptime: process.uptime(),
      database: dbStatus,
      stellarRpc: rpcStatus,
      contract: contractStatus,
    };
  }

  private async getDatabaseStatus(): Promise<'connected' | 'disconnected'> {
    try {
      await Promise.race([
        this.dataSource.query('SELECT 1'),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Database health check timed out')),
            DATABASE_HEALTH_TIMEOUT_MS,
          ),
        ),
      ]);
      return 'connected';
    } catch {
      return 'disconnected';
    }
  }

  private resolveRpcUrls(): string[] {
    const network = this.config.get<string>('STELLAR_NETWORK');
    const primary =
      this.config.get<string>('STELLAR_RPC_URL') ??
      (network === 'mainnet'
        ? 'https://mainnet.stellar.validationcloud.io/v1/rpc'
        : 'https://soroban-testnet.stellar.org');
    const backup = this.config.get<string>('STELLAR_RPC_URL_BACKUP');
    return backup ? [primary, backup] : [primary];
  }

  private async probeRpc(url: string): Promise<boolean> {
    const server = new StellarSdk.rpc.Server(url);
    await Promise.race([
      server.getHealth(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Stellar RPC health check timed out')),
          STELLAR_RPC_TIMEOUT_MS,
        ),
      ),
    ]);
    return true;
  }

  private async getStellarRpcStatus(): Promise<
    'connected' | 'disconnected' | 'not_configured'
  > {
    const network = this.config.get<string>('STELLAR_NETWORK');
    if (!network) return 'not_configured';

    const urls = this.resolveRpcUrls();
    for (const url of urls) {
      try {
        await this.probeRpc(url);
        return 'connected';
      } catch {
        // try next backup URL
      }
    }
    return 'disconnected';
  }

  private async getContractStatus(): Promise<
    'reachable' | 'unreachable' | 'not_configured'
  > {
    const contractId = this.config.get<string>('SOROBAN_CONTRACT_ID');
    if (!contractId) return 'not_configured';

    const network = this.config.get<string>('STELLAR_NETWORK');
    const urls = this.resolveRpcUrls();
    for (const url of urls) {
      try {
        const server = new StellarSdk.rpc.Server(url);
        await Promise.race([
          server.getContractData(
            contractId,
            StellarSdk.nativeToScVal('STATUS', { type: 'symbol' }),
          ),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Contract health check timed out')),
              STELLAR_RPC_TIMEOUT_MS,
            ),
          ),
        ]);
        return 'reachable';
      } catch {
        // try next backup URL
      }
    }
    return 'unreachable';
  }
}

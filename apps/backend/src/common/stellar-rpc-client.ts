import { Injectable, Logger } from '@nestjs/common';
import * as StellarSdk from '@stellar/stellar-sdk';
import { CircuitOpenError, CircuitBreaker, CircuitState } from './circuit-breaker';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class StellarRpcClient {
  private readonly logger = new Logger(StellarRpcClient.name);
  private server: StellarSdk.rpc.Server | null = null;
  private networkPassphrase: string | null = null;

  constructor(private readonly circuitBreaker: CircuitBreaker, private readonly metrics?: MetricsService) {}

  getAccount(address: string): Promise<StellarSdk.Account> {
    return this.executeWithBreaker(() => this.getServer().getAccount(address));
  }

  prepareTransaction(tx: StellarSdk.Transaction): Promise<StellarSdk.Transaction | StellarSdk.FeeBumpTransaction> {
    const server = this.getServer();
    return this.executeWithBreaker(() => server.prepareTransaction(tx));
  }

  sendTransaction(tx: StellarSdk.Transaction): Promise<StellarSdk.rpc.Api.SendTransactionResponse> {
    const server = this.getServer();
    return this.executeWithBreaker(() => server.sendTransaction(tx));
  }

  getServer(): StellarSdk.rpc.Server {
    if (!this.server) {
      throw new Error('StellarRpcClient has not been initialized with a server');
    }
    return this.server;
  }

  initialize(rpcUrl: string, networkPassphrase: string): void {
    const shouldReset = !this.server || !this.networkPassphrase;
    this.server = new StellarSdk.rpc.Server(rpcUrl);
    this.networkPassphrase = networkPassphrase;

    if (shouldReset) {
      this.circuitBreaker.addListener((_previousState, nextState) => {
        if (nextState === CircuitState.CLOSED) {
          this.logger.log('StellarRpcClient circuit closed — resuming normal operation');
        }
      });
    }

    this.logger.log(`StellarRpcClient initialized with rpcUrl=${rpcUrl}`);
  }

  isInitialized(): boolean {
    return this.server !== null;
  }

  private async executeWithBreaker<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await this.circuitBreaker.execute(fn);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        this.logger.warn(`Stellar RPC call skipped: circuit breaker is open. Retry after ${error.retryAfterMs}ms`);
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Stellar RPC call failed: ${message}`);
      throw error instanceof Error ? error : new Error(message);
    }
  }
}

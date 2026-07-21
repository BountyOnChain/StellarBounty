import { Injectable, Logger, Optional } from '@nestjs/common';
import * as StellarSdk from '@stellar/stellar-sdk';
import { CircuitOpenError, CircuitBreaker, CircuitState } from './circuit-breaker';
import { MetricsService } from '../metrics/metrics.service';
import {
  ConcurrencyLimiter,
  ConcurrencyLimiterError,
  RpcHostLimiterManager,
  type ConcurrencyLimiterOptions,
} from './concurrency-limiter';

@Injectable()
export class StellarRpcClient {
  private readonly logger = new Logger(StellarRpcClient.name);
  private server: StellarSdk.rpc.Server | null = null;
  private networkPassphrase: string | null = null;
  private rpcUrl: string | null = null;
  private readonly limiterManager: RpcHostLimiterManager;

  constructor(
    private readonly circuitBreaker: CircuitBreaker,
    private readonly metrics?: MetricsService,
    @Optional() limiterOptions?: Partial<ConcurrencyLimiterOptions>,
  ) {
    this.limiterManager = new RpcHostLimiterManager(limiterOptions);
  }

  getAccount(address: string): Promise<StellarSdk.Account> {
    return this.executeWithLimiter(() => this.executeWithBreaker(() => this.getServer().getAccount(address)));
  }

  prepareTransaction(tx: StellarSdk.Transaction): Promise<StellarSdk.Transaction | StellarSdk.FeeBumpTransaction> {
    const server = this.getServer();
    return this.executeWithLimiter(() => this.executeWithBreaker(() => server.prepareTransaction(tx)));
  }

  sendTransaction(tx: StellarSdk.Transaction): Promise<StellarSdk.rpc.Api.SendTransactionResponse> {
    const server = this.getServer();
    return this.executeWithLimiter(() => this.executeWithBreaker(() => server.sendTransaction(tx)));
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
    this.rpcUrl = rpcUrl;

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

  /** Expose limiter metrics for Prometheus. */
  getLimiterMetrics(): { activeCount: number; queueLength: number } {
    if (!this.rpcUrl) return { activeCount: 0, queueLength: 0 };
    const limiter = this.limiterManager.getLimiterForUrl(this.rpcUrl);
    return { activeCount: limiter.getActiveCount(), queueLength: limiter.getQueueLength() };
  }

  private async executeWithLimiter<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.rpcUrl) {
      return fn();
    }

    const limiter = this.limiterManager.getLimiterForUrl(this.rpcUrl);
    try {
      const result = await limiter.execute(fn);
      this.reportLimiterMetrics(limiter);
      return result;
    } catch (error) {
      this.reportLimiterMetrics(limiter);
      if (error instanceof ConcurrencyLimiterError) {
        this.logger.warn(`Stellar RPC call throttled: ${error.message}`);
        throw error;
      }
      throw error;
    }
  }

  private reportLimiterMetrics(limiter: ConcurrencyLimiter): void {
    if (this.metrics) {
      this.metrics.updateRpcLimiterMetrics(limiter.getActiveCount(), limiter.getQueueLength());
    }
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

import { Logger } from '@nestjs/common';

export interface ConcurrencyLimiterOptions {
  /** Maximum concurrent requests per host. Default: 4 */
  maxConcurrency: number;
  /** Maximum requests per second per host. Default: 10 */
  maxRatePerSecond: number;
  /** Maximum age (ms) of a queued request before it is dropped with 503. Default: 5000 */
  queueTtlMs: number;
  /** Maximum number of queued requests waiting for a slot. Default: 50 */
  maxQueueSize: number;
}

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  enqueueTime: number;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

export class ConcurrencyLimiterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrencyLimiterError';
  }
}

/**
 * Lightweight per-host concurrency + rate limiter for Stellar RPC calls.
 *
 * Enforces:
 *  - Max concurrent in-flight requests (semaphore)
 *  - Max requests per second (token bucket)
 *  - Queue TTL — stale requests are rejected with 503
 */
export class ConcurrencyLimiter {
  private readonly logger = new Logger(ConcurrencyLimiter.name);
  private readonly options: ConcurrencyLimiterOptions;

  private activeCount = 0;
  private tokens: number;
  private lastRefillTime = Date.now();
  private queue: QueuedRequest<any>[] = [];
  private drainTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: Partial<ConcurrencyLimiterOptions> = {}) {
    this.options = {
      maxConcurrency: options.maxConcurrency ?? 4,
      maxRatePerSecond: options.maxRatePerSecond ?? 10,
      queueTtlMs: options.queueTtlMs ?? 5_000,
      maxQueueSize: options.maxQueueSize ?? 50,
    };
    this.tokens = this.options.maxRatePerSecond;
  }

  /**
   * Execute a function through the limiter. Queues if at capacity.
   * Rejects with ConcurrencyLimiterError if the queue is full or the request expires.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.refillTokens();

    // If we have capacity (both concurrency and rate), execute immediately
    if (this.activeCount < this.options.maxConcurrency && this.consumeToken()) {
      return this.run(fn);
    }

    // Check queue limits
    if (this.queue.length >= this.options.maxQueueSize) {
      this.logger.warn('RPC call rejected: queue full');
      throw new ConcurrencyLimiterError('RPC rate limiter queue is full');
    }

    // Enqueue
    return new Promise<T>((resolve, reject) => {
      const entry: QueuedRequest<T> = {
        execute: fn,
        enqueueTime: Date.now(),
        resolve,
        reject,
      };
      this.queue.push(entry);

      this.ensureDrainTimer();
    });
  }

  /** Number of in-flight requests. */
  getActiveCount(): number {
    return this.activeCount;
  }

  /** Number of requests waiting in the queue. */
  getQueueLength(): number {
    return this.queue.length;
  }

  /** Tear down the drain timer (for testing or shutdown). */
  destroy(): void {
    if (this.drainTimer) {
      clearInterval(this.drainTimer);
      this.drainTimer = null;
    }
  }

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    this.activeCount += 1;
    try {
      return await fn();
    } finally {
      this.activeCount -= 1;
      this.processQueue();
    }
  }

  private processQueue(): void {
    // Purge expired entries
    this.purgeExpired();

    while (this.queue.length > 0 && this.activeCount < this.options.maxConcurrency) {
      this.refillTokens();
      if (!this.consumeToken()) break;

      const entry = this.queue.shift()!;
      this.run(entry.execute).then(entry.resolve, entry.reject);
    }

    if (this.queue.length === 0 && this.drainTimer) {
      clearInterval(this.drainTimer);
      this.drainTimer = null;
    }
  }

  private purgeExpired(): void {
    const now = Date.now();
    while (this.queue.length > 0 && now - this.queue[0].enqueueTime > this.options.queueTtlMs) {
      const expired = this.queue.shift()!;
      this.logger.warn(`RPC call dropped: queued for ${now - expired.enqueueTime}ms (limit ${this.options.queueTtlMs}ms)`);
      expired.reject(new ConcurrencyLimiterError('RPC call expired in queue (503)'));
    }
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefillTime) / 1000;
    if (elapsed <= 0) return;

    this.tokens = Math.min(
      this.options.maxRatePerSecond,
      this.tokens + elapsed * this.options.maxRatePerSecond,
    );
    this.lastRefillTime = now;
  }

  private consumeToken(): boolean {
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  private ensureDrainTimer(): void {
    if (this.drainTimer) return;
    this.drainTimer = setInterval(() => {
      this.processQueue();
    }, 100);
  }
}

/**
 * Per-host limiter manager. Creates and caches limiters keyed by RPC URL host.
 */
export class RpcHostLimiterManager {
  private readonly limiters = new Map<string, ConcurrencyLimiter>();
  private readonly options: Partial<ConcurrencyLimiterOptions>;

  constructor(options: Partial<ConcurrencyLimiterOptions> = {}) {
    this.options = options;
  }

  getLimiter(host: string): ConcurrencyLimiter {
    let limiter = this.limiters.get(host);
    if (!limiter) {
      limiter = new ConcurrencyLimiter(this.options);
      this.limiters.set(host, limiter);
    }
    return limiter;
  }

  getLimiterForUrl(url: string): ConcurrencyLimiter {
    const host = new URL(url).host;
    return this.getLimiter(host);
  }

  destroyAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.destroy();
    }
    this.limiters.clear();
  }
}

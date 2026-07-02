import { Injectable, Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 0,
  OPEN = 1,
  HALF_OPEN = 2,
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  failureWindowMs: number;
  recoveryTimeoutMs: number;
}

export type CircuitBreakerListener = (previousState: CircuitState, nextState: CircuitState, error?: Error) => void;

@Injectable()
export class CircuitBreaker {
  private readonly logger = new Logger(CircuitBreaker.name);
  private readonly options: CircuitBreakerOptions;
  private readonly listeners: CircuitBreakerListener[] = [];

  private failureCount = 0;
  private lastFailureTime = 0;
  private state: CircuitState = CircuitState.CLOSED;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      failureWindowMs: options.failureWindowMs ?? 60_000,
      recoveryTimeoutMs: options.recoveryTimeoutMs ?? 30_000,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      const elapsedSinceFailure = Date.now() - this.lastFailureTime;
      if (elapsedSinceFailure >= this.options.recoveryTimeoutMs) {
        this.setState(CircuitState.HALF_OPEN);
      } else {
        throw new CircuitOpenError(this.options.recoveryTimeoutMs - elapsedSinceFailure);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  getCurrentState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  getName(): string {
    return this.name;
  }

  addListener(listener: CircuitBreakerListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private onSuccess(): void {
    const previousState = this.state;
    this.failureCount = 0;
    if (previousState !== CircuitState.CLOSED) {
      this.setState(CircuitState.CLOSED);
    }
  }

  private onFailure(error: Error): void {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold && this.state === CircuitState.CLOSED) {
      this.setState(CircuitState.OPEN, error);
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.setState(CircuitState.OPEN, error);
    }
  }

  private setState(nextState: CircuitState, lastError?: Error): void {
    const previousState = this.state;
    this.state = nextState;

    this.logger.warn(
      `Circuit breaker state transition: ${CircuitState[previousState]} -> ${CircuitState[nextState]}${lastError ? `, reason=${lastError.message}` : ''}`,
    );

    this.listeners.forEach((listener) => {
      try {
        listener(previousState, nextState, lastError);
      } catch {
        // Ignore listener errors to prevent cascading failures
      }
    });
  }

  private readonly name = 'circuit-breaker';
}

export class CircuitOpenError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`Circuit breaker is open. Retry after ${retryAfterMs}ms`);
    this.retryAfterMs = retryAfterMs;
  }
}

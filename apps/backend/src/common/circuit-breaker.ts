import { Logger } from '@nestjs/common';

/**
 * Circuit breaker states:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Fail fast, requests are rejected immediately
 * - HALF_OPEN: Testing recovery, one test request allowed
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export type CircuitBreakerConfig = {
  /** Number of consecutive failures within failureWindowMs to trip the circuit */
  failureThreshold: number;
  /** Time window in ms for counting consecutive failures */
  failureWindowMs: number;
  /** Time in ms to wait in OPEN state before transitioning to HALF_OPEN */
  openTimeoutMs: number;
  /** Optional logger for state change events */
  logger?: Pick<Logger, 'log' | 'warn'>;
  /** Optional callback when circuit state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
};

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_FAILURE_WINDOW_MS = 60_000;
const DEFAULT_OPEN_TIMEOUT_MS = 30_000;

/**
 * Circuit breaker for Stellar RPC calls.
 *
 * Tracks consecutive failures and prevents calls when the circuit is open.
 * After a configurable timeout, it transitions to HALF_OPEN and allows one
 * test request to check if the RPC has recovered.
 */
export class StellarRpcCircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private firstFailureAt = 0;
  private openedAt = 0;
  private readonly failureThreshold: number;
  private readonly failureWindowMs: number;
  private readonly openTimeoutMs: number;
  private readonly logger?: Pick<Logger, 'log' | 'warn'>;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.failureThreshold = config.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.failureWindowMs = config.failureWindowMs ?? DEFAULT_FAILURE_WINDOW_MS;
    this.openTimeoutMs = config.openTimeoutMs ?? DEFAULT_OPEN_TIMEOUT_MS;
    this.logger = config.logger;
    this.onStateChange = config.onStateChange;
  }

  getState(): CircuitState {
    if (this.state === CircuitState.OPEN) {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.openTimeoutMs) {
        this.transitionTo(CircuitState.HALF_OPEN);
      }
    }
    return this.state;
  }

  /**
   * Check if a request is allowed through the circuit breaker.
   * Returns true if allowed, false if the circuit is open.
   */
  allowRequest(): boolean {
    const currentState = this.getState();

    if (currentState === CircuitState.CLOSED) {
      return true;
    }

    if (currentState === CircuitState.HALF_OPEN) {
      return true;
    }

    // OPEN state — reject
    return false;
  }

  /**
   * Record a successful RPC call.
   * Resets failure count and closes the circuit if it was HALF_OPEN.
   */
  recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.logger?.log('Circuit breaker: HALF_OPEN → CLOSED (test request succeeded)');
      this.transitionTo(CircuitState.CLOSED);
    }
    this.failureCount = 0;
    this.firstFailureAt = 0;
  }

  /**
   * Record a failed RPC call.
   * Increments failure count and opens the circuit if threshold is reached.
   */
  recordFailure(): void {
    const now = Date.now();

    // Reset the failure window if enough time has passed
    if (this.failureCount === 0 || now - this.firstFailureAt > this.failureWindowMs) {
      this.failureCount = 1;
      this.firstFailureAt = now;
    } else {
      this.failureCount += 1;
    }

    if (this.state === CircuitState.HALF_OPEN) {
      this.logger?.warn('Circuit breaker: HALF_OPEN → OPEN (test request failed)');
      this.transitionTo(CircuitState.OPEN);
      this.openedAt = now;
      return;
    }

    if (this.failureCount >= this.failureThreshold) {
      this.logger?.warn(
        `Circuit breaker: CLOSED → OPEN (${this.failureCount} failures in ${this.failureWindowMs}ms)`,
      );
      this.transitionTo(CircuitState.OPEN);
      this.openedAt = now;
    }
  }

  /**
   * Force-reset the circuit breaker to CLOSED state.
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.failureCount = 0;
    this.firstFailureAt = 0;
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;
    const previousState = this.state;
    this.state = newState;
    this.onStateChange?.(previousState, newState);
  }
}

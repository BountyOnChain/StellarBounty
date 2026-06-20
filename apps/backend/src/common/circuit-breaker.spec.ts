import { CircuitState, StellarRpcCircuitBreaker } from './circuit-breaker';

describe('StellarRpcCircuitBreaker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts in CLOSED state', () => {
    const cb = new StellarRpcCircuitBreaker();
    expect(cb.getState()).toBe(CircuitState.CLOSED);
    expect(cb.allowRequest()).toBe(true);
  });

  it('stays CLOSED when failures are below threshold', () => {
    const cb = new StellarRpcCircuitBreaker({ failureThreshold: 5 });

    for (let i = 0; i < 4; i++) {
      cb.recordFailure();
    }

    expect(cb.getState()).toBe(CircuitState.CLOSED);
    expect(cb.allowRequest()).toBe(true);
  });

  it('transitions to OPEN after reaching failure threshold', () => {
    const onStateChange = jest.fn();
    const cb = new StellarRpcCircuitBreaker({
      failureThreshold: 5,
      onStateChange,
    });

    for (let i = 0; i < 5; i++) {
      cb.recordFailure();
    }

    expect(cb.getState()).toBe(CircuitState.OPEN);
    expect(cb.allowRequest()).toBe(false);
    expect(onStateChange).toHaveBeenCalledWith(CircuitState.CLOSED, CircuitState.OPEN);
  });

  it('rejects requests when OPEN', () => {
    const cb = new StellarRpcCircuitBreaker({ failureThreshold: 3 });

    for (let i = 0; i < 3; i++) {
      cb.recordFailure();
    }

    expect(cb.allowRequest()).toBe(false);
  });

  it('transitions to HALF_OPEN after open timeout', () => {
    const cb = new StellarRpcCircuitBreaker({
      failureThreshold: 3,
      openTimeoutMs: 30_000,
    });

    for (let i = 0; i < 3; i++) {
      cb.recordFailure();
    }
    expect(cb.getState()).toBe(CircuitState.OPEN);

    jest.advanceTimersByTime(30_000);
    expect(cb.getState()).toBe(CircuitState.HALF_OPEN);
    expect(cb.allowRequest()).toBe(true);
  });

  it('transitions back to CLOSED when test request succeeds in HALF_OPEN', () => {
    const onStateChange = jest.fn();
    const cb = new StellarRpcCircuitBreaker({
      failureThreshold: 3,
      openTimeoutMs: 30_000,
      onStateChange,
    });

    for (let i = 0; i < 3; i++) {
      cb.recordFailure();
    }

    jest.advanceTimersByTime(30_000);
    expect(cb.getState()).toBe(CircuitState.HALF_OPEN);

    cb.recordSuccess();
    expect(cb.getState()).toBe(CircuitState.CLOSED);
    expect(onStateChange).toHaveBeenCalledWith(CircuitState.HALF_OPEN, CircuitState.CLOSED);
  });

  it('transitions back to OPEN when test request fails in HALF_OPEN', () => {
    const cb = new StellarRpcCircuitBreaker({
      failureThreshold: 3,
      openTimeoutMs: 30_000,
    });

    for (let i = 0; i < 3; i++) {
      cb.recordFailure();
    }

    jest.advanceTimersByTime(30_000);
    expect(cb.getState()).toBe(CircuitState.HALF_OPEN);

    cb.recordFailure();
    expect(cb.getState()).toBe(CircuitState.OPEN);
  });

  it('resets failure count on success in CLOSED state', () => {
    const cb = new StellarRpcCircuitBreaker({ failureThreshold: 5 });

    // 4 failures (below threshold)
    for (let i = 0; i < 4; i++) {
      cb.recordFailure();
    }

    // Success resets the count
    cb.recordSuccess();

    // 4 more failures should still be below threshold
    for (let i = 0; i < 4; i++) {
      cb.recordFailure();
    }

    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });

  it('force-reset returns to CLOSED', () => {
    const cb = new StellarRpcCircuitBreaker({ failureThreshold: 3 });

    for (let i = 0; i < 3; i++) {
      cb.recordFailure();
    }
    expect(cb.getState()).toBe(CircuitState.OPEN);

    cb.reset();
    expect(cb.getState()).toBe(CircuitState.CLOSED);
    expect(cb.allowRequest()).toBe(true);
  });

  it('resets failure window after window expires', () => {
    const cb = new StellarRpcCircuitBreaker({
      failureThreshold: 3,
      failureWindowMs: 60_000,
    });

    // 2 failures
    cb.recordFailure();
    cb.recordFailure();

    // Advance past the window
    jest.advanceTimersByTime(61_000);

    // Only 1 more failure (not enough to trip)
    cb.recordFailure();
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });

  it('logs state transitions', () => {
    const logger = { log: jest.fn(), warn: jest.fn() };
    const cb = new StellarRpcCircuitBreaker({
      failureThreshold: 3,
      openTimeoutMs: 30_000,
      logger,
    });

    for (let i = 0; i < 3; i++) {
      cb.recordFailure();
    }
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('CLOSED → OPEN'),
    );

    jest.advanceTimersByTime(30_000);
    cb.recordSuccess();
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('HALF_OPEN → CLOSED'),
    );
  });
});

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject calls
  HALF_OPEN = 'HALF_OPEN', // Testing if recovered
}

interface CircuitBreakerOptions {
  failureThreshold: number;   // Failures before opening
  resetTimeoutMs: number;     // Time in OPEN before trying HALF_OPEN
  halfOpenMaxCalls: number;   // Max calls in HALF_OPEN state
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuits = new Map<string, {
    state: CircuitState;
    failures: number;
    lastFailureTime: number;
    halfOpenCalls: number;
  }>();

  private readonly options: CircuitBreakerOptions;

  constructor(private readonly config: ConfigService) {
    this.options = {
      failureThreshold: this.config.get<number>('CIRCUIT_BREAKER_FAILURE_THRESHOLD', 3),
      resetTimeoutMs: this.config.get<number>('CIRCUIT_BREAKER_RESET_TIMEOUT_MS', 30000),
      halfOpenMaxCalls: this.config.get<number>('CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS', 1),
    };
  }

  getCircuitState(name: string): CircuitState {
    const circuit = this.circuits.get(name);
    if (!circuit) return CircuitState.CLOSED;
    return circuit.state;
  }

  async execute<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const circuit = this.getOrCreateCircuit(name);

    // Check if circuit is OPEN
    if (circuit.state === CircuitState.OPEN) {
      const now = Date.now();
      if (now - circuit.lastFailureTime >= this.options.resetTimeoutMs) {
        // Transition to HALF_OPEN
        circuit.state = CircuitState.HALF_OPEN;
        circuit.halfOpenCalls = 0;
        this.logger.log(`Circuit '${name}' transitioning to HALF_OPEN`);
      } else {
        // Circuit is OPEN — fail fast
        throw new Error(
          `Circuit breaker '${name}' is OPEN. RPC calls suspended for ${Math.ceil(
            (this.options.resetTimeoutMs - (now - circuit.lastFailureTime)) / 1000,
          )}s. Last failure: ${circuit.failures} consecutive failures.`,
        );
      }
    }

    // Limit calls in HALF_OPEN state
    if (circuit.state === CircuitState.HALF_OPEN) {
      if (circuit.halfOpenCalls >= this.options.halfOpenMaxCalls) {
        throw new Error(
          `Circuit breaker '${name}' is HALF_OPEN and max test calls (${this.options.halfOpenMaxCalls}) reached.`,
        );
      }
      circuit.halfOpenCalls++;
    }

    try {
      const result = await fn();
      this.onSuccess(name, circuit);
      return result;
    } catch (error) {
      this.onFailure(name, circuit, error);
      throw error;
    }
  }

  private getOrCreateCircuit(name: string) {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, {
        state: CircuitState.CLOSED,
        failures: 0,
        lastFailureTime: 0,
        halfOpenCalls: 0,
      });
    }
    return this.circuits.get(name)!;
  }

  private onSuccess(name: string, circuit: { state: CircuitState; failures: number; halfOpenCalls: number }) {
    if (circuit.state === CircuitState.HALF_OPEN) {
      // Success in HALF_OPEN → close the circuit
      circuit.state = CircuitState.CLOSED;
      circuit.failures = 0;
      circuit.halfOpenCalls = 0;
      this.logger.log(`Circuit '${name}' CLOSED (recovery confirmed)`);
    } else if (circuit.state === CircuitState.CLOSED) {
      // Reset failure count on success
      circuit.failures = 0;
    }
  }

  private onFailure(name: string, circuit: { state: CircuitState; failures: number; lastFailureTime: number; halfOpenCalls: number }, error: unknown) {
    circuit.failures++;
    circuit.lastFailureTime = Date.now();

    const message = error instanceof Error ? error.message : String(error);

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Failure in HALF_OPEN → back to OPEN
      circuit.state = CircuitState.OPEN;
      this.logger.warn(
        `Circuit '${name}' re-OPENED (HALF_OPEN test failed): ${message}`,
      );
    } else if (circuit.failures >= this.options.failureThreshold) {
      // Too many failures → open the circuit
      circuit.state = CircuitState.OPEN;
      this.logger.warn(
        `Circuit '${name}' OPENED after ${circuit.failures} consecutive failures: ${message}`,
      );
    }
  }
}

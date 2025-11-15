/**
 * Resilience Patterns - Circuit Breaker, Bulkhead, and Fallback
 * Production-grade failure handling patterns
 */

export interface CircuitBreakerOptions {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes to close
  timeout: number; // Time in ms before attempting reset
  monitoringPeriod?: number; // Rolling window in ms
}

export interface BulkheadOptions {
  maxConcurrent: number; // Max concurrent executions
  maxQueue: number; // Max queued requests
  queueTimeout?: number; // Timeout for queued requests
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit Breaker Pattern
 * Prevents cascading failures by failing fast when service is unhealthy
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private failureTimestamps: number[] = [];

  constructor(private options: CircuitBreakerOptions) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.options.timeout) {
        // Try to transition to HALF_OPEN
        this.state = 'HALF_OPEN';
        console.log('⚠️  Circuit breaker: HALF_OPEN (attempting reset)');
      } else {
        // Circuit is still open
        if (fallback) {
          console.log('🔴 Circuit breaker: OPEN (using fallback)');
          return await fallback();
        }
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();

      // Success
      this.onSuccess();
      return result;
    } catch (error) {
      // Failure
      this.onFailure();

      // Use fallback if available
      if (fallback) {
        console.log('🔴 Circuit breaker: Execution failed, using fallback');
        return await fallback();
      }

      throw error;
    }
  }

  /**
   * Record a successful execution
   */
  private onSuccess(): void {
    this.failures = 0;

    if (this.state === 'HALF_OPEN') {
      this.successes++;

      if (this.successes >= this.options.successThreshold) {
        this.state = 'CLOSED';
        this.successes = 0;
        console.log('✅ Circuit breaker: CLOSED (recovered)');
      }
    }
  }

  /**
   * Record a failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    // Track failure timestamps for monitoring period
    if (this.options.monitoringPeriod) {
      this.failureTimestamps.push(this.lastFailureTime);

      // Remove old timestamps
      const cutoff = this.lastFailureTime - this.options.monitoringPeriod;
      this.failureTimestamps = this.failureTimestamps.filter(t => t > cutoff);

      // Check failure rate within monitoring period
      if (this.failureTimestamps.length >= this.options.failureThreshold) {
        this.state = 'OPEN';
        console.log(`🔴 Circuit breaker: OPEN (${this.failures} failures)`);
      }
    } else {
      // Simple failure count
      if (this.failures >= this.options.failureThreshold) {
        this.state = 'OPEN';
        console.log(`🔴 Circuit breaker: OPEN (${this.failures} failures)`);
      }
    }

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.successes = 0;
      console.log('🔴 Circuit breaker: OPEN (failed during half-open)');
    }
  }

  /**
   * Get current state
   */
  getState(): {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureTime: number;
  } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    this.failureTimestamps = [];
    console.log('🔄 Circuit breaker: RESET');
  }

  /**
   * Force open the circuit breaker
   */
  forceOpen(): void {
    this.state = 'OPEN';
    console.log('🔴 Circuit breaker: FORCED OPEN');
  }
}

/**
 * Bulkhead Pattern
 * Isolates resources to prevent failure propagation
 */
export class Bulkhead {
  private running: number = 0;
  private queue: Array<{
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    fn: () => Promise<any>;
    timeout?: NodeJS.Timeout;
  }> = [];

  constructor(private options: BulkheadOptions) {}

  /**
   * Execute a function with bulkhead protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we can execute immediately
    if (this.running < this.options.maxConcurrent) {
      return await this.run(fn);
    }

    // Check if queue is full
    if (this.queue.length >= this.options.maxQueue) {
      throw new Error('Bulkhead queue is full');
    }

    // Queue the request
    return new Promise((resolve, reject) => {
      const timeout = this.options.queueTimeout
        ? setTimeout(() => {
            const index = this.queue.findIndex(q => q.resolve === resolve);
            if (index !== -1) {
              this.queue.splice(index, 1);
              reject(new Error('Bulkhead queue timeout'));
            }
          }, this.options.queueTimeout)
        : undefined;

      this.queue.push({
        resolve,
        reject,
        fn,
        timeout,
      });

      console.log(`⏳ Bulkhead: Queued (${this.queue.length}/${this.options.maxQueue})`);
    });
  }

  /**
   * Run a function and manage concurrency
   */
  private async run<T>(fn: () => Promise<T>): Promise<T> {
    this.running++;

    try {
      const result = await fn();
      return result;
    } finally {
      this.running--;
      this.processQueue();
    }
  }

  /**
   * Process queued requests
   */
  private processQueue(): void {
    if (this.queue.length === 0 || this.running >= this.options.maxConcurrent) {
      return;
    }

    const next = this.queue.shift();
    if (!next) return;

    if (next.timeout) {
      clearTimeout(next.timeout);
    }

    this.run(next.fn)
      .then(next.resolve)
      .catch(next.reject);
  }

  /**
   * Get current state
   */
  getState(): {
    running: number;
    queued: number;
    available: number;
  } {
    return {
      running: this.running,
      queued: this.queue.length,
      available: this.options.maxConcurrent - this.running,
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue.forEach(q => {
      if (q.timeout) clearTimeout(q.timeout);
      q.reject(new Error('Bulkhead cleared'));
    });
    this.queue = [];
  }
}

/**
 * Retry with Exponential Backoff and Jitter
 */
export class SmartRetry {
  /**
   * Execute with exponential backoff and jitter
   */
  static async execute<T>(
    fn: () => Promise<T>,
    options: {
      maxAttempts: number;
      initialDelay: number;
      maxDelay: number;
      multiplier: number;
      jitter: boolean;
    }
  ): Promise<T> {
    let attempt = 0;
    let delay = options.initialDelay;

    while (attempt < options.maxAttempts) {
      try {
        return await fn();
      } catch (error) {
        attempt++;

        if (attempt >= options.maxAttempts) {
          throw error;
        }

        // Calculate delay with exponential backoff
        delay = Math.min(delay * options.multiplier, options.maxDelay);

        // Add jitter to prevent thundering herd
        if (options.jitter) {
          delay = delay * (0.5 + Math.random() * 0.5);
        }

        console.log(`🔄 Retry attempt ${attempt}/${options.maxAttempts} after ${delay}ms`);

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Max retry attempts reached');
  }
}

/**
 * Timeout wrapper
 */
export class Timeout {
  /**
   * Execute with timeout
   */
  static async execute<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    fallback?: () => Promise<T>
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => {
          if (fallback) {
            return fallback().then(resolve => resolve as any);
          }
          reject(new Error(`Timeout after ${timeoutMs}ms`));
        }, timeoutMs)
      ),
    ]);
  }
}

/**
 * Combined Resilience Manager
 * Combines all patterns for maximum resilience
 */
export class ResilienceManager {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private bulkheads: Map<string, Bulkhead> = new Map();

  /**
   * Execute with full resilience protection
   */
  async execute<T>(
    name: string,
    fn: () => Promise<T>,
    options: {
      circuitBreaker?: CircuitBreakerOptions;
      bulkhead?: BulkheadOptions;
      retry?: {
        maxAttempts: number;
        initialDelay: number;
        maxDelay: number;
        multiplier: number;
        jitter: boolean;
      };
      timeout?: number;
      fallback?: () => Promise<T>;
    } = {}
  ): Promise<T> {
    // Get or create circuit breaker
    let circuitBreaker: CircuitBreaker | undefined;
    if (options.circuitBreaker) {
      if (!this.circuitBreakers.has(name)) {
        this.circuitBreakers.set(name, new CircuitBreaker(options.circuitBreaker));
      }
      circuitBreaker = this.circuitBreakers.get(name);
    }

    // Get or create bulkhead
    let bulkhead: Bulkhead | undefined;
    if (options.bulkhead) {
      if (!this.bulkheads.has(name)) {
        this.bulkheads.set(name, new Bulkhead(options.bulkhead));
      }
      bulkhead = this.bulkheads.get(name);
    }

    // Wrap function with all patterns
    const wrappedFn = async () => {
      let executeFn = fn;

      // Apply retry
      if (options.retry) {
        const retryOptions = options.retry;
        executeFn = () => SmartRetry.execute(fn, retryOptions);
      }

      // Apply timeout
      if (options.timeout) {
        const timeout = options.timeout;
        const timeoutFn = executeFn;
        executeFn = () => Timeout.execute(timeoutFn, timeout, options.fallback);
      }

      // Apply bulkhead
      if (bulkhead) {
        return await bulkhead.execute(executeFn);
      }

      return await executeFn();
    };

    // Apply circuit breaker (outermost layer)
    if (circuitBreaker) {
      return await circuitBreaker.execute(wrappedFn, options.fallback);
    }

    return await wrappedFn();
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(name: string): any {
    return this.circuitBreakers.get(name)?.getState();
  }

  /**
   * Get bulkhead state
   */
  getBulkheadState(name: string): any {
    return this.bulkheads.get(name)?.getState();
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(name: string): void {
    this.circuitBreakers.get(name)?.reset();
  }

  /**
   * Clear bulkhead queue
   */
  clearBulkhead(name: string): void {
    this.bulkheads.get(name)?.clear();
  }

  /**
   * Get all states
   */
  getAllStates(): {
    circuitBreakers: Record<string, any>;
    bulkheads: Record<string, any>;
  } {
    const circuitBreakers: Record<string, any> = {};
    const bulkheads: Record<string, any> = {};

    for (const [name, cb] of this.circuitBreakers.entries()) {
      circuitBreakers[name] = cb.getState();
    }

    for (const [name, bh] of this.bulkheads.entries()) {
      bulkheads[name] = bh.getState();
    }

    return { circuitBreakers, bulkheads };
  }
}

// Singleton instance
export const resilienceManager = new ResilienceManager();

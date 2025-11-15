/**
 * Connection Pool Manager - Reusable connections for connectors
 */

import { EventEmitter } from 'events';

export interface PoolOptions {
  min?: number;
  max?: number;
  acquireTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  evictionRunIntervalMillis?: number;
  maxUses?: number; // Max uses before connection is destroyed
  validateOnBorrow?: boolean;
}

export interface PooledConnection<T> {
  id: string;
  resource: T;
  createdAt: number;
  lastUsedAt: number;
  uses: number;
  inUse: boolean;
}

export class ConnectionPool<T> extends EventEmitter {
  private min: number;
  private max: number;
  private acquireTimeoutMillis: number;
  private idleTimeoutMillis: number;
  private evictionRunIntervalMillis: number;
  private maxUses: number;
  private validateOnBorrow: boolean;

  private pool: PooledConnection<T>[] = [];
  private waitingQueue: Array<{
    resolve: (connection: PooledConnection<T>) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];

  private factory: {
    create: () => Promise<T>;
    destroy: (resource: T) => Promise<void>;
    validate?: (resource: T) => Promise<boolean>;
  };

  private evictionInterval: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;

  constructor(
    factory: {
      create: () => Promise<T>;
      destroy: (resource: T) => Promise<void>;
      validate?: (resource: T) => Promise<boolean>;
    },
    options: PoolOptions = {}
  ) {
    super();

    this.factory = factory;
    this.min = options.min || 0;
    this.max = options.max || 10;
    this.acquireTimeoutMillis = options.acquireTimeoutMillis || 30000;
    this.idleTimeoutMillis = options.idleTimeoutMillis || 30000;
    this.evictionRunIntervalMillis = options.evictionRunIntervalMillis || 10000;
    this.maxUses = options.maxUses || 1000;
    this.validateOnBorrow = options.validateOnBorrow !== false;

    this.startEvictionTimer();
  }

  async initialize(): Promise<void> {
    // Pre-create minimum connections
    const promises = [];
    for (let i = 0; i < this.min; i++) {
      promises.push(this.createConnection());
    }
    await Promise.all(promises);
    this.emit('initialized', this.pool.length);
  }

  private async createConnection(): Promise<PooledConnection<T>> {
    if (this.pool.length >= this.max) {
      throw new Error('Pool has reached maximum size');
    }

    try {
      const resource = await this.factory.create();
      const connection: PooledConnection<T> = {
        id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        resource,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        uses: 0,
        inUse: false,
      };

      this.pool.push(connection);
      this.emit('connectionCreated', connection.id);

      return connection;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private async destroyConnection(connection: PooledConnection<T>): Promise<void> {
    try {
      await this.factory.destroy(connection.resource);
      this.pool = this.pool.filter(c => c.id !== connection.id);
      this.emit('connectionDestroyed', connection.id);
    } catch (error) {
      this.emit('error', error);
    }
  }

  private async validateConnection(connection: PooledConnection<T>): Promise<boolean> {
    if (!this.factory.validate) {
      return true;
    }

    try {
      return await this.factory.validate(connection.resource);
    } catch (error) {
      this.emit('validationFailed', connection.id, error);
      return false;
    }
  }

  async acquire(): Promise<PooledConnection<T>> {
    if (this.isShuttingDown) {
      throw new Error('Pool is shutting down');
    }

    // Try to find an available connection
    let connection = this.pool.find(c => !c.inUse);

    // If no available connection and pool not at max, create new one
    if (!connection && this.pool.length < this.max) {
      connection = await this.createConnection();
    }

    // If connection found, validate and return
    if (connection) {
      if (this.validateOnBorrow) {
        const isValid = await this.validateConnection(connection);
        if (!isValid) {
          await this.destroyConnection(connection);
          return this.acquire(); // Retry
        }
      }

      // Check if connection has exceeded max uses
      if (connection.uses >= this.maxUses) {
        await this.destroyConnection(connection);
        return this.acquire(); // Retry
      }

      connection.inUse = true;
      connection.lastUsedAt = Date.now();
      connection.uses++;

      this.emit('acquired', connection.id);
      return connection;
    }

    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeFromWaitingQueue(resolve);
        reject(new Error(`Acquire timeout after ${this.acquireTimeoutMillis}ms`));
      }, this.acquireTimeoutMillis);

      this.waitingQueue.push({ resolve, reject, timeout });
      this.emit('waiting', this.waitingQueue.length);
    });
  }

  async release(connection: PooledConnection<T>): Promise<void> {
    if (!this.pool.includes(connection)) {
      throw new Error('Connection does not belong to this pool');
    }

    connection.inUse = false;
    connection.lastUsedAt = Date.now();

    this.emit('released', connection.id);

    // If there are waiting requests, fulfill the next one
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift();
      if (waiter) {
        clearTimeout(waiter.timeout);
        waiter.resolve(connection);
        connection.inUse = true;
        connection.uses++;
      }
    }
  }

  async destroy(connection: PooledConnection<T>): Promise<void> {
    await this.destroyConnection(connection);

    // Maintain minimum pool size
    if (this.pool.length < this.min && !this.isShuttingDown) {
      await this.createConnection();
    }
  }

  async use<R>(fn: (resource: T) => Promise<R>): Promise<R> {
    const connection = await this.acquire();

    try {
      return await fn(connection.resource);
    } finally {
      await this.release(connection);
    }
  }

  private removeFromWaitingQueue(resolve: Function): void {
    const index = this.waitingQueue.findIndex(w => w.resolve === resolve);
    if (index !== -1) {
      const waiter = this.waitingQueue.splice(index, 1)[0];
      clearTimeout(waiter.timeout);
    }
  }

  private startEvictionTimer(): void {
    this.evictionInterval = setInterval(() => {
      this.evictIdleConnections();
    }, this.evictionRunIntervalMillis);
  }

  private async evictIdleConnections(): Promise<void> {
    const now = Date.now();
    const connectionsToEvict = this.pool.filter(
      c => !c.inUse &&
           this.pool.length > this.min &&
           (now - c.lastUsedAt) > this.idleTimeoutMillis
    );

    for (const connection of connectionsToEvict) {
      await this.destroyConnection(connection);
    }

    if (connectionsToEvict.length > 0) {
      this.emit('evicted', connectionsToEvict.length);
    }
  }

  getStats(): {
    total: number;
    available: number;
    inUse: number;
    waiting: number;
    min: number;
    max: number;
  } {
    return {
      total: this.pool.length,
      available: this.pool.filter(c => !c.inUse).length,
      inUse: this.pool.filter(c => c.inUse).length,
      waiting: this.waitingQueue.length,
      min: this.min,
      max: this.max,
    };
  }

  async drain(): Promise<void> {
    this.isShuttingDown = true;

    // Stop accepting new requests
    if (this.evictionInterval) {
      clearInterval(this.evictionInterval);
      this.evictionInterval = null;
    }

    // Reject all waiting requests
    while (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift();
      if (waiter) {
        clearTimeout(waiter.timeout);
        waiter.reject(new Error('Pool is draining'));
      }
    }

    // Wait for all connections to be released
    const maxWait = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.pool.some(c => c.inUse)) {
      if (Date.now() - startTime > maxWait) {
        throw new Error('Timeout waiting for connections to be released');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Destroy all connections
    const destroyPromises = this.pool.map(c => this.destroyConnection(c));
    await Promise.all(destroyPromises);

    this.emit('drained');
  }

  async clear(): Promise<void> {
    await this.drain();
    this.pool = [];
    this.isShuttingDown = false;
    await this.initialize();
  }
}

/**
 * Connection Pool Manager - Manages multiple pools for different connector types
 */
export class ConnectionPoolManager {
  private pools: Map<string, ConnectionPool<any>> = new Map();

  getOrCreatePool<T>(
    name: string,
    factory: {
      create: () => Promise<T>;
      destroy: (resource: T) => Promise<void>;
      validate?: (resource: T) => Promise<boolean>;
    },
    options?: PoolOptions
  ): ConnectionPool<T> {
    if (!this.pools.has(name)) {
      const pool = new ConnectionPool(factory, options);
      this.pools.set(name, pool);
      pool.initialize().catch(err => {
        console.error(`Failed to initialize pool ${name}:`, err);
      });
    }

    return this.pools.get(name) as ConnectionPool<T>;
  }

  getPool<T>(name: string): ConnectionPool<T> | undefined {
    return this.pools.get(name) as ConnectionPool<T> | undefined;
  }

  async drainAll(): Promise<void> {
    const drainPromises = Array.from(this.pools.values()).map(pool => pool.drain());
    await Promise.all(drainPromises);
    this.pools.clear();
  }

  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [name, pool] of this.pools.entries()) {
      stats[name] = pool.getStats();
    }
    return stats;
  }
}

// Singleton instance
export const connectionPoolManager = new ConnectionPoolManager();

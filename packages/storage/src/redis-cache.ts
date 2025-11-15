/**
 * Redis Cache - Distributed caching and state management
 */

import { createClient, RedisClientType } from 'redis';

export interface RedisCacheOptions {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  ttl?: number; // Default TTL in seconds
}

export class RedisCache {
  private client: RedisClientType;
  private keyPrefix: string;
  private defaultTTL: number;
  private isConnected: boolean = false;

  constructor(options: RedisCacheOptions = {}) {
    const redisUrl = options.url ||
      `redis://${options.host || 'localhost'}:${options.port || 6379}`;

    this.client = createClient({
      url: redisUrl,
      password: options.password,
      database: options.db || 0,
    });

    this.keyPrefix = options.keyPrefix || 'uwg:';
    this.defaultTTL = options.ttl || 3600; // 1 hour default

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      console.log('Redis Client Disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
    }
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  // Basic cache operations
  async get<T = any>(key: string): Promise<T | null> {
    const value = await this.client.get(this.getKey(key));
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    const finalTTL = ttl || this.defaultTTL;

    await this.client.setEx(this.getKey(key), finalTTL, serialized);
  }

  async del(key: string): Promise<void> {
    await this.client.del(this.getKey(key));
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(this.getKey(key));
    return result === 1;
  }

  async expire(key: string, ttl: number): Promise<void> {
    await this.client.expire(this.getKey(key), ttl);
  }

  // Hash operations (for structured data)
  async hSet(key: string, field: string, value: any): Promise<void> {
    await this.client.hSet(this.getKey(key), field, JSON.stringify(value));
  }

  async hGet<T = any>(key: string, field: string): Promise<T | null> {
    const value = await this.client.hGet(this.getKey(key), field);
    return value ? JSON.parse(value) : null;
  }

  async hGetAll<T = any>(key: string): Promise<Record<string, T>> {
    const data = await this.client.hGetAll(this.getKey(key));
    const result: Record<string, T> = {};

    for (const [field, value] of Object.entries(data)) {
      result[field] = JSON.parse(value);
    }

    return result;
  }

  async hDel(key: string, field: string): Promise<void> {
    await this.client.hDel(this.getKey(key), field);
  }

  // List operations (for queues)
  async lPush(key: string, ...values: any[]): Promise<void> {
    const serialized = values.map(v => JSON.stringify(v));
    await this.client.lPush(this.getKey(key), serialized);
  }

  async rPush(key: string, ...values: any[]): Promise<void> {
    const serialized = values.map(v => JSON.stringify(v));
    await this.client.rPush(this.getKey(key), serialized);
  }

  async lPop<T = any>(key: string): Promise<T | null> {
    const value = await this.client.lPop(this.getKey(key));
    return value ? JSON.parse(value) : null;
  }

  async rPop<T = any>(key: string): Promise<T | null> {
    const value = await this.client.rPop(this.getKey(key));
    return value ? JSON.parse(value) : null;
  }

  async lRange<T = any>(key: string, start: number, stop: number): Promise<T[]> {
    const values = await this.client.lRange(this.getKey(key), start, stop);
    return values.map(v => JSON.parse(v));
  }

  async lLen(key: string): Promise<number> {
    return await this.client.lLen(this.getKey(key));
  }

  // Set operations (for unique collections)
  async sAdd(key: string, ...members: any[]): Promise<void> {
    const serialized = members.map(m => JSON.stringify(m));
    await this.client.sAdd(this.getKey(key), serialized);
  }

  async sMembers<T = any>(key: string): Promise<T[]> {
    const members = await this.client.sMembers(this.getKey(key));
    return members.map(m => JSON.parse(m));
  }

  async sIsMember(key: string, member: any): Promise<boolean> {
    const serialized = JSON.stringify(member);
    return await this.client.sIsMember(this.getKey(key), serialized);
  }

  async sRem(key: string, ...members: any[]): Promise<void> {
    const serialized = members.map(m => JSON.stringify(m));
    await this.client.sRem(this.getKey(key), serialized);
  }

  // Sorted set operations (for leaderboards, priority queues)
  async zAdd(key: string, score: number, member: any): Promise<void> {
    await this.client.zAdd(this.getKey(key), {
      score,
      value: JSON.stringify(member),
    });
  }

  async zRange<T = any>(key: string, start: number, stop: number): Promise<T[]> {
    const members = await this.client.zRange(this.getKey(key), start, stop);
    return members.map(m => JSON.parse(m));
  }

  async zRangeByScore<T = any>(
    key: string,
    min: number,
    max: number
  ): Promise<T[]> {
    const members = await this.client.zRangeByScore(this.getKey(key), min, max);
    return members.map(m => JSON.parse(m));
  }

  async zRem(key: string, member: any): Promise<void> {
    await this.client.zRem(this.getKey(key), JSON.stringify(member));
  }

  // Pub/Sub operations
  async publish(channel: string, message: any): Promise<void> {
    await this.client.publish(
      this.getKey(channel),
      JSON.stringify(message)
    );
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.connect();

    await subscriber.subscribe(this.getKey(channel), (message) => {
      callback(JSON.parse(message));
    });
  }

  // Distributed lock (for preventing race conditions)
  async acquireLock(
    lockKey: string,
    ttl: number = 10
  ): Promise<string | null> {
    const lockId = Math.random().toString(36).substring(7);
    const acquired = await this.client.set(
      this.getKey(`lock:${lockKey}`),
      lockId,
      {
        NX: true, // Only set if not exists
        EX: ttl,  // Expire after TTL seconds
      }
    );

    return acquired ? lockId : null;
  }

  async releaseLock(lockKey: string, lockId: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.client.eval(script, {
      keys: [this.getKey(`lock:${lockKey}`)],
      arguments: [lockId],
    });

    return result === 1;
  }

  // Atomic counter operations
  async incr(key: string): Promise<number> {
    return await this.client.incr(this.getKey(key));
  }

  async incrBy(key: string, increment: number): Promise<number> {
    return await this.client.incrBy(this.getKey(key), increment);
  }

  async decr(key: string): Promise<number> {
    return await this.client.decr(this.getKey(key));
  }

  async decrBy(key: string, decrement: number): Promise<number> {
    return await this.client.decrBy(this.getKey(key), decrement);
  }

  // Utility methods
  async flushAll(): Promise<void> {
    await this.client.flushAll();
  }

  async keys(pattern: string): Promise<string[]> {
    const keys = await this.client.keys(this.getKey(pattern));
    return keys.map(k => k.replace(this.keyPrefix, ''));
  }

  async ttl(key: string): Promise<number> {
    return await this.client.ttl(this.getKey(key));
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  // Cache patterns
  async memoize<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const result = await fn();
    await this.set(key, result, ttl);
    return result;
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.keys(pattern);
    if (keys.length > 0) {
      await Promise.all(keys.map(k => this.del(k)));
    }
  }
}

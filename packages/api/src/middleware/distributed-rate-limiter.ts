/**
 * Distributed Rate Limiter - Redis-backed rate limiting for multi-instance deployments
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import Redis from 'ioredis';

export interface RateLimiterOptions {
  points: number; // Number of requests
  duration: number; // Per duration in seconds
  blockDuration?: number; // Block duration in seconds
  keyPrefix?: string;
  redis?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  };
}

export class DistributedRateLimiter {
  private limiters: Map<string, RateLimiterRedis> = new Map();
  private redisClient: Redis;

  constructor(
    redisOptions: {
      host?: string;
      port?: number;
      password?: string;
      db?: number;
    } = {}
  ) {
    this.redisClient = new Redis({
      host: redisOptions.host || process.env.REDIS_HOST || 'localhost',
      port: redisOptions.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: redisOptions.password || process.env.REDIS_PASSWORD,
      db: redisOptions.db || 0,
      enableOfflineQueue: false,
    });

    this.redisClient.on('error', (err) => {
      console.error('Redis rate limiter error:', err);
    });
  }

  /**
   * Create or get a rate limiter for a specific key
   */
  private getLimiter(name: string, options: RateLimiterOptions): RateLimiterRedis {
    if (!this.limiters.has(name)) {
      const limiter = new RateLimiterRedis({
        storeClient: this.redisClient,
        points: options.points,
        duration: options.duration,
        blockDuration: options.blockDuration || 0,
        keyPrefix: options.keyPrefix || `rl:${name}:`,
      });

      this.limiters.set(name, limiter);
    }

    return this.limiters.get(name)!;
  }

  /**
   * Create Express middleware for IP-based rate limiting
   */
  middleware(name: string, options: RateLimiterOptions) {
    const limiter = this.getLimiter(name, options);

    return async (req: Request, res: Response, next: NextFunction) => {
      const key = this.getClientKey(req);

      try {
        const result = await limiter.consume(key, 1);

        // Add rate limit headers
        res.set({
          'X-RateLimit-Limit': options.points.toString(),
          'X-RateLimit-Remaining': result.remainingPoints.toString(),
          'X-RateLimit-Reset': new Date(Date.now() + result.msBeforeNext).toISOString(),
        });

        next();
      } catch (error) {
        if (error instanceof Error) {
          res.status(500).json({
            error: 'Rate limiter error',
            message: error.message,
          });
        } else {
          // Rate limit exceeded
          const rateLimitError = error as RateLimiterRes;

          res.set({
            'X-RateLimit-Limit': options.points.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(Date.now() + rateLimitError.msBeforeNext).toISOString(),
            'Retry-After': Math.ceil(rateLimitError.msBeforeNext / 1000).toString(),
          });

          res.status(429).json({
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil(rateLimitError.msBeforeNext / 1000)} seconds.`,
            retryAfter: Math.ceil(rateLimitError.msBeforeNext / 1000),
          });
        }
      }
    };
  }

  /**
   * Create middleware for user-based rate limiting (requires auth)
   */
  userMiddleware(name: string, options: RateLimiterOptions) {
    const limiter = this.getLimiter(name, options);

    return async (req: Request, res: Response, next: NextFunction) => {
      // Assumes req.user is set by auth middleware
      const userId = (req as any).user?.id || this.getClientKey(req);

      try {
        const result = await limiter.consume(userId, 1);

        res.set({
          'X-RateLimit-Limit': options.points.toString(),
          'X-RateLimit-Remaining': result.remainingPoints.toString(),
          'X-RateLimit-Reset': new Date(Date.now() + result.msBeforeNext).toISOString(),
        });

        next();
      } catch (error) {
        if (error instanceof Error) {
          res.status(500).json({
            error: 'Rate limiter error',
            message: error.message,
          });
        } else {
          const rateLimitError = error as RateLimiterRes;

          res.set({
            'Retry-After': Math.ceil(rateLimitError.msBeforeNext / 1000).toString(),
          });

          res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded',
            retryAfter: Math.ceil(rateLimitError.msBeforeNext / 1000),
          });
        }
      }
    };
  }

  /**
   * Consume points for a specific key
   */
  async consume(
    limiterName: string,
    key: string,
    points: number = 1,
    options: RateLimiterOptions
  ): Promise<RateLimiterRes> {
    const limiter = this.getLimiter(limiterName, options);
    return await limiter.consume(key, points);
  }

  /**
   * Get remaining points for a key
   */
  async get(
    limiterName: string,
    key: string,
    options: RateLimiterOptions
  ): Promise<RateLimiterRes | null> {
    const limiter = this.getLimiter(limiterName, options);
    return await limiter.get(key);
  }

  /**
   * Delete rate limit record for a key
   */
  async delete(
    limiterName: string,
    key: string,
    options: RateLimiterOptions
  ): Promise<boolean> {
    const limiter = this.getLimiter(limiterName, options);
    return await limiter.delete(key);
  }

  /**
   * Block a key for a specific duration
   */
  async block(
    limiterName: string,
    key: string,
    durationSeconds: number,
    options: RateLimiterOptions
  ): Promise<RateLimiterRes> {
    const limiter = this.getLimiter(limiterName, options);
    return await limiter.block(key, durationSeconds);
  }

  /**
   * Penalty - consume more points for suspicious behavior
   */
  async penalty(
    limiterName: string,
    key: string,
    points: number,
    options: RateLimiterOptions
  ): Promise<RateLimiterRes> {
    const limiter = this.getLimiter(limiterName, options);
    return await limiter.penalty(key, points);
  }

  /**
   * Reward - reduce consumed points for good behavior
   */
  async reward(
    limiterName: string,
    key: string,
    points: number,
    options: RateLimiterOptions
  ): Promise<RateLimiterRes> {
    const limiter = this.getLimiter(limiterName, options);
    return await limiter.reward(key, points);
  }

  /**
   * Get client key from request (IP, user agent, etc.)
   */
  private getClientKey(req: Request): string {
    // Check for real IP behind proxy
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded
      ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
      : req.ip || req.socket.remoteAddress || 'unknown';

    return ip;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redisClient.quit();
  }
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const createDefaultRateLimiters = (redisOptions?: any) => {
  const limiter = new DistributedRateLimiter(redisOptions);

  return {
    // Global API rate limit: 100 requests per 15 minutes
    api: limiter.middleware('api', {
      points: 100,
      duration: 900, // 15 minutes
    }),

    // Strict rate limit for expensive operations: 10 requests per minute
    strict: limiter.middleware('strict', {
      points: 10,
      duration: 60,
      blockDuration: 300, // Block for 5 minutes if exceeded
    }),

    // Flow execution: 30 executions per minute
    execution: limiter.middleware('execution', {
      points: 30,
      duration: 60,
    }),

    // Webhook endpoints: 100 requests per minute
    webhook: limiter.middleware('webhook', {
      points: 100,
      duration: 60,
    }),

    // Authentication: 5 attempts per 15 minutes
    auth: limiter.middleware('auth', {
      points: 5,
      duration: 900,
      blockDuration: 1800, // Block for 30 minutes
    }),

    // User-based rate limiting: 1000 requests per hour
    user: limiter.userMiddleware('user', {
      points: 1000,
      duration: 3600,
    }),

    // The limiter instance for custom use
    limiter,
  };
};

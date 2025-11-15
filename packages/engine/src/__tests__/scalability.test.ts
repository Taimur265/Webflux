/**
 * Scalability Integration Tests
 * Tests for distributed systems, caching, queuing, and horizontal scaling
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { RedisCache } from '../../../storage/src/redis-cache';
import { PostgresStorage } from '../../../storage/src/postgres-storage';
import { JobQueue } from '../job-queue';
import { ConnectionPool } from '../../../connectors/src/connection-pool';
import { FlowExecutor } from '../executor';
import { connectorRegistry } from '@uwg/connectors';
import type { Flow } from '@uwg/schema';

// Skip these tests if Redis/Postgres aren't available
const REDIS_AVAILABLE = process.env.REDIS_HOST !== undefined;
const POSTGRES_AVAILABLE = process.env.POSTGRES_HOST !== undefined;

describe('Scalability Tests', () => {
  describe('Redis Cache', () => {
    let cache: RedisCache;

    beforeAll(async () => {
      if (!REDIS_AVAILABLE) return;

      cache = new RedisCache({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        keyPrefix: 'test:',
      });

      await cache.connect();
    });

    afterAll(async () => {
      if (!REDIS_AVAILABLE) return;
      await cache.flushAll();
      await cache.disconnect();
    });

    test('should set and get values', async () => {
      if (!REDIS_AVAILABLE) {
        console.log('Skipping Redis test - Redis not available');
        return;
      }

      await cache.set('test-key', { foo: 'bar' }, 60);
      const value = await cache.get('test-key');

      expect(value).toEqual({ foo: 'bar' });
    });

    test('should handle expiration', async () => {
      if (!REDIS_AVAILABLE) return;

      await cache.set('expires', 'value', 1);
      await new Promise(resolve => setTimeout(resolve, 1100));

      const value = await cache.get('expires');
      expect(value).toBeNull();
    });

    test('should support hash operations', async () => {
      if (!REDIS_AVAILABLE) return;

      await cache.hSet('user:1', 'name', 'John');
      await cache.hSet('user:1', 'email', 'john@example.com');

      const name = await cache.hGet('user:1', 'name');
      const all = await cache.hGetAll('user:1');

      expect(name).toBe('John');
      expect(all).toEqual({
        name: 'John',
        email: 'john@example.com',
      });
    });

    test('should support list operations (queue)', async () => {
      if (!REDIS_AVAILABLE) return;

      await cache.rPush('queue', { id: 1 }, { id: 2 }, { id: 3 });

      const length = await cache.lLen('queue');
      expect(length).toBe(3);

      const item = await cache.lPop('queue');
      expect(item).toEqual({ id: 1 });

      const remaining = await cache.lLen('queue');
      expect(remaining).toBe(2);
    });

    test('should support distributed locks', async () => {
      if (!REDIS_AVAILABLE) return;

      const lockId = await cache.acquireLock('resource-1', 5);
      expect(lockId).not.toBeNull();

      // Try to acquire again (should fail)
      const lockId2 = await cache.acquireLock('resource-1', 5);
      expect(lockId2).toBeNull();

      // Release and try again
      const released = await cache.releaseLock('resource-1', lockId!);
      expect(released).toBe(true);

      const lockId3 = await cache.acquireLock('resource-1', 5);
      expect(lockId3).not.toBeNull();
    });

    test('should support atomic counters', async () => {
      if (!REDIS_AVAILABLE) return;

      const val1 = await cache.incr('counter');
      const val2 = await cache.incr('counter');
      const val3 = await cache.incrBy('counter', 5);

      expect(val1).toBe(1);
      expect(val2).toBe(2);
      expect(val3).toBe(7);
    });

    test('should support memoization pattern', async () => {
      if (!REDIS_AVAILABLE) return;

      let callCount = 0;
      const expensiveFunction = async () => {
        callCount++;
        return { result: 'computed', timestamp: Date.now() };
      };

      // First call - should execute function
      const result1 = await cache.memoize('expensive-key', expensiveFunction, 60);
      expect(callCount).toBe(1);

      // Second call - should return cached value
      const result2 = await cache.memoize('expensive-key', expensiveFunction, 60);
      expect(callCount).toBe(1);
      expect(result2).toEqual(result1);
    });
  });

  describe('PostgreSQL Storage', () => {
    let storage: PostgresStorage;

    beforeAll(async () => {
      if (!POSTGRES_AVAILABLE) return;

      storage = new PostgresStorage({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: 'uwg_test',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD,
      });

      await storage.initialize();
    });

    afterAll(async () => {
      if (!POSTGRES_AVAILABLE) return;
      await storage.close();
    });

    test('should save and load flows', async () => {
      if (!POSTGRES_AVAILABLE) {
        console.log('Skipping Postgres test - Postgres not available');
        return;
      }

      const flow: Flow = {
        flow_id: null,
        name: 'Test Flow',
        description: 'Scalability test flow',
        version: 1,
        graph: {
          nodes: [],
          edges: [],
        },
        metadata: {
          owner: 'test-user',
          created_at: new Date().toISOString(),
          tags: ['test'],
        },
      };

      const flowId = await storage.saveFlow(flow);
      expect(flowId).toBeTruthy();

      const loaded = await storage.loadFlow(flowId);
      expect(loaded).toBeTruthy();
      expect(loaded!.name).toBe('Test Flow');
    });

    test('should handle concurrent writes', async () => {
      if (!POSTGRES_AVAILABLE) return;

      const flows = Array.from({ length: 10 }, (_, i) => ({
        flow_id: null,
        name: `Concurrent Flow ${i}`,
        description: 'Test',
        version: 1,
        graph: { nodes: [], edges: [] },
        metadata: {
          owner: 'test-user',
          created_at: new Date().toISOString(),
          tags: ['concurrent'],
        },
      }));

      const promises = flows.map(flow => storage.saveFlow(flow));
      const flowIds = await Promise.all(promises);

      expect(flowIds).toHaveLength(10);
      expect(new Set(flowIds).size).toBe(10); // All unique
    });

    test('should support connection pooling', async () => {
      if (!POSTGRES_AVAILABLE) return;

      const status = await storage.getPoolStatus();

      expect(status.total).toBeGreaterThan(0);
      expect(status.idle).toBeGreaterThanOrEqual(0);
      expect(status.waiting).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Job Queue', () => {
    let queue: JobQueue;
    let executor: FlowExecutor;

    beforeAll(async () => {
      if (!REDIS_AVAILABLE) return;

      executor = new FlowExecutor(connectorRegistry);
      queue = new JobQueue(executor, {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
        queueName: 'test-queue',
      });
    });

    afterAll(async () => {
      if (!REDIS_AVAILABLE) return;
      await queue.drain();
      await queue.close();
    });

    test('should add jobs to queue', async () => {
      if (!REDIS_AVAILABLE) {
        console.log('Skipping Job Queue test - Redis not available');
        return;
      }

      const flow: Flow = {
        flow_id: 'test-flow',
        name: 'Test Flow',
        description: 'Test',
        version: 1,
        graph: {
          nodes: [
            {
              id: 'node1',
              category: 'trigger',
              type: 'manual',
              name: 'Manual Trigger',
              connector: null,
              operation: null,
              params: {},
              inputs: [],
              outputs: ['result'],
              ui_hints: { x: 0, y: 0, color: '#4CAF50' },
            },
          ],
          edges: [],
        },
        metadata: {
          owner: 'test-user',
          created_at: new Date().toISOString(),
          tags: [],
        },
      };

      const job = await queue.addJob({ flow });
      expect(job.id).toBeTruthy();

      const state = await queue.getJobState(job.id!);
      expect(['waiting', 'delayed', 'active']).toContain(state);
    });

    test('should process jobs when worker starts', async () => {
      if (!REDIS_AVAILABLE) return;

      const flow: Flow = {
        flow_id: 'test-flow-2',
        name: 'Test Flow 2',
        description: 'Test',
        version: 1,
        graph: {
          nodes: [
            {
              id: 'node1',
              category: 'trigger',
              type: 'manual',
              name: 'Manual Trigger',
              connector: null,
              operation: null,
              params: {},
              inputs: [],
              outputs: ['result'],
              ui_hints: { x: 0, y: 0, color: '#4CAF50' },
            },
          ],
          edges: [],
        },
        metadata: {
          owner: 'test-user',
          created_at: new Date().toISOString(),
          tags: [],
        },
      };

      const job = await queue.addJob({ flow });

      // Start worker
      await queue.startWorker(1);

      // Wait for job to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      const finalJob = await queue.getJob(job.id!);
      const state = await finalJob?.getState();

      expect(['completed', 'failed']).toContain(state);

      await queue.stopWorker();
    });

    test('should handle job priorities', async () => {
      if (!REDIS_AVAILABLE) return;

      const flow: Flow = {
        flow_id: 'priority-flow',
        name: 'Priority Flow',
        description: 'Test',
        version: 1,
        graph: { nodes: [], edges: [] },
        metadata: {
          owner: 'test-user',
          created_at: new Date().toISOString(),
          tags: [],
        },
      };

      const lowPriorityJob = await queue.addJob({ flow, priority: 10 });
      const highPriorityJob = await queue.addJob({ flow, priority: 1 });

      expect(lowPriorityJob.id).toBeTruthy();
      expect(highPriorityJob.id).toBeTruthy();
    });
  });

  describe('Connection Pool', () => {
    test('should create and manage connection pool', async () => {
      let createCount = 0;
      let destroyCount = 0;

      const pool = new ConnectionPool<{ id: number }>(
        {
          create: async () => {
            createCount++;
            return { id: createCount };
          },
          destroy: async (resource) => {
            destroyCount++;
          },
          validate: async (resource) => {
            return resource.id > 0;
          },
        },
        {
          min: 2,
          max: 5,
          acquireTimeoutMillis: 5000,
          idleTimeoutMillis: 10000,
        }
      );

      await pool.initialize();

      const stats = pool.getStats();
      expect(stats.total).toBe(2); // Initialized with min
      expect(stats.available).toBe(2);

      // Acquire connections
      const conn1 = await pool.acquire();
      const conn2 = await pool.acquire();

      const stats2 = pool.getStats();
      expect(stats2.inUse).toBe(2);
      expect(stats2.available).toBe(0);

      // Release connections
      await pool.release(conn1);
      await pool.release(conn2);

      const stats3 = pool.getStats();
      expect(stats3.inUse).toBe(0);
      expect(stats3.available).toBe(2);

      await pool.drain();
      expect(destroyCount).toBeGreaterThan(0);
    });

    test('should handle concurrent acquisitions', async () => {
      const pool = new ConnectionPool<number>(
        {
          create: async () => Math.random(),
          destroy: async () => {},
        },
        { min: 0, max: 5 }
      );

      await pool.initialize();

      const promises = Array.from({ length: 10 }, () =>
        pool.use(async (conn) => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return conn;
        })
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);

      await pool.drain();
    });
  });

  describe('Load Testing', () => {
    test('should handle concurrent flow executions', async () => {
      const executor = new FlowExecutor(connectorRegistry);

      const flow: Flow = {
        flow_id: 'load-test-flow',
        name: 'Load Test Flow',
        description: 'Test',
        version: 1,
        graph: {
          nodes: [
            {
              id: 'trigger',
              category: 'trigger',
              type: 'manual',
              name: 'Trigger',
              connector: null,
              operation: null,
              params: {},
              inputs: [],
              outputs: ['data'],
              ui_hints: { x: 0, y: 0, color: '#4CAF50' },
            },
            {
              id: 'transform',
              category: 'transform',
              type: 'template',
              name: 'Transform',
              connector: null,
              operation: null,
              params: {
                template: 'Processed: {{trigger.data}}',
              },
              inputs: [{ from: 'trigger', field: 'data' }],
              outputs: ['result'],
              ui_hints: { x: 200, y: 0, color: '#2196F3' },
            },
          ],
          edges: [
            { from: 'trigger', to: 'transform' },
          ],
        },
        metadata: {
          owner: 'test-user',
          created_at: new Date().toISOString(),
          tags: ['load-test'],
        },
      };

      const concurrentExecutions = 50;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentExecutions }, (_, i) =>
        executor.execute(flow, { parallelism: 2 }, { data: `test-${i}` })
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(concurrentExecutions);
      expect(results.every(r => r.status === 'completed')).toBe(true);

      const duration = (endTime - startTime) / 1000;
      console.log(`Executed ${concurrentExecutions} flows in ${duration.toFixed(2)}s`);
      console.log(`Throughput: ${(concurrentExecutions / duration).toFixed(2)} flows/sec`);
    }, 60000); // 60 second timeout
  });
});

/**
 * Production Setup Example
 * Shows how to use all scalability features together
 */

import { FlowExecutor } from '@uwg/engine';
import { JobQueue } from '@uwg/engine';
import { WorkerPool } from '@uwg/engine';
import { connectorRegistry, registerDefaultConnectors } from '@uwg/connectors';
import { createStorage, RedisCache } from '@uwg/storage';
import { metricsCollector } from '@uwg/api/middleware/metrics';
import type { Flow } from '@uwg/schema';

// ============================================
// 1. Initialize Storage (PostgreSQL)
// ============================================

const storage = createStorage({
  type: 'postgres',
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: 5432,
    database: 'uwg',
    user: 'uwg',
    password: process.env.POSTGRES_PASSWORD,
    max: 20, // Connection pool size
  },
});

await storage.initialize();
console.log('✅ PostgreSQL storage initialized');

// ============================================
// 2. Initialize Redis Cache
// ============================================

const cache = new RedisCache({
  host: process.env.REDIS_HOST || 'localhost',
  port: 6379,
  keyPrefix: 'uwg:',
  ttl: 3600, // 1 hour default
});

await cache.connect();
console.log('✅ Redis cache connected');

// ============================================
// 3. Register Connectors
// ============================================

registerDefaultConnectors();
console.log('✅ Connectors registered:', connectorRegistry.list().length);

// ============================================
// 4. Setup Job Queue
// ============================================

const executor = new FlowExecutor(connectorRegistry);

const queue = new JobQueue(executor, {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: 6379,
  },
  queueName: 'uwg:flows',
  concurrency: 5,
});

console.log('✅ Job queue initialized');

// ============================================
// 5. Example: Execute Flow with Caching
// ============================================

async function executeFlowWithCache(flowId: string, triggerData: any) {
  // Try to get from cache first
  const cacheKey = `flow:execution:${flowId}:${JSON.stringify(triggerData)}`;
  const cached = await cache.get(cacheKey);

  if (cached) {
    console.log('✅ Cache hit - returning cached result');
    metricsCollector.recordCacheHit('redis', 'flow');
    return cached;
  }

  metricsCollector.recordCacheMiss('redis', 'flow');

  // Load flow from storage
  const flow = await storage.loadFlow(flowId);

  if (!flow) {
    throw new Error(`Flow ${flowId} not found`);
  }

  // Add to job queue for async execution
  const job = await queue.addJob({
    flow,
    triggerData,
    priority: 1,
  });

  console.log(`✅ Job queued: ${job.id}`);

  // Wait for completion (in production, use webhooks/polling instead)
  const result = await job.waitUntilFinished();

  // Cache the result
  await cache.set(cacheKey, result, 300); // 5 minutes

  return result;
}

// ============================================
// 6. Example: Distributed Locking
// ============================================

async function executeOnce(flowId: string) {
  const lockKey = `flow:${flowId}:execution`;
  const lockId = await cache.acquireLock(lockKey, 60); // 60 second lock

  if (!lockId) {
    console.log('⚠️  Flow already executing, skipping...');
    return null;
  }

  try {
    console.log('✅ Lock acquired, executing flow...');

    const flow = await storage.loadFlow(flowId);
    if (!flow) throw new Error('Flow not found');

    const report = await executor.execute(flow);

    await storage.saveExecution(report);

    return report;
  } finally {
    // Always release the lock
    await cache.releaseLock(lockKey, lockId);
    console.log('✅ Lock released');
  }
}

// ============================================
// 7. Example: Worker Pool (Multi-Process)
// ============================================

import cluster from 'cluster';

if (cluster.isPrimary) {
  // Master process - manages workers
  const pool = new WorkerPool({
    workerCount: 4, // 4 worker processes
    autoRestart: true,
    maxRestarts: 5,
  });

  await pool.initialize();
  console.log('✅ Worker pool initialized with 4 workers');

  // Execute flows on workers
  const flow = await storage.loadFlow('flow_123');
  if (flow) {
    const report = await pool.execute(flow, { userId: '456' });
    console.log('✅ Flow executed on worker:', report.status);
  }

  // Scale workers dynamically
  await pool.scale(8); // Scale to 8 workers
  console.log('✅ Scaled to 8 workers');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await pool.shutdown();
    process.exit(0);
  });
} else {
  // Worker process - execute flows
  const { Worker } = require('@uwg/engine');
  const worker = new Worker(executor);
  await worker.initialize();
}

// ============================================
// 8. Example: Scheduled Jobs
// ============================================

async function scheduleRecurringFlow(flowId: string) {
  const flow = await storage.loadFlow(flowId);

  if (!flow) {
    throw new Error(`Flow ${flowId} not found`);
  }

  // Schedule to run every 6 hours
  const job = await queue.scheduleRecurring(
    { flow },
    '0 */6 * * *' // Cron expression
  );

  console.log('✅ Recurring job scheduled:', job.id);

  return job;
}

// ============================================
// 9. Example: Metrics Tracking
// ============================================

async function executeFlowWithMetrics(flowId: string, flowName: string) {
  const startTime = Date.now();

  try {
    // Increment active flow counter
    metricsCollector.incrementActiveFlowExecution(flowId, flowName);

    const flow = await storage.loadFlow(flowId);
    if (!flow) throw new Error('Flow not found');

    const report = await executor.execute(flow);

    const duration = (Date.now() - startTime) / 1000;

    // Record metrics
    metricsCollector.recordFlowExecution(flowId, flowName, report.status, duration);

    return report;
  } finally {
    metricsCollector.decrementActiveFlowExecution(flowId, flowName);
  }
}

// ============================================
// 10. Example: Batch Processing
// ============================================

async function batchExecuteFlows(flowIds: string[]) {
  console.log(`🚀 Batch executing ${flowIds.length} flows...`);

  // Load all flows in parallel
  const flows = await Promise.all(
    flowIds.map(id => storage.loadFlow(id))
  );

  // Add all jobs to queue in bulk
  const jobs = await queue.addBulk(
    flows
      .filter((f): f is Flow => f !== null)
      .map(flow => ({
        flow,
        priority: 5,
        attempts: 3,
      }))
  );

  console.log(`✅ ${jobs.length} jobs queued for batch execution`);

  return jobs;
}

// ============================================
// 11. Example: Connection Pool Usage
// ============================================

import { ConnectionPool } from '@uwg/connectors';
import axios from 'axios';

const httpPool = new ConnectionPool<typeof axios>(
  {
    create: async () => {
      return axios.create({
        timeout: 30000,
        headers: {
          'User-Agent': 'UWG-Engine/1.0',
        },
      });
    },
    destroy: async (client) => {
      // Cleanup if needed
    },
    validate: async (client) => {
      return true;
    },
  },
  {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 5000,
  }
);

await httpPool.initialize();

// Use pooled connection
const response = await httpPool.use(async (client) => {
  return await client.get('https://api.example.com/data');
});

console.log('✅ HTTP request via connection pool:', response.status);

// ============================================
// 12. Example: Health Monitoring
// ============================================

async function monitorHealth() {
  setInterval(async () => {
    // Queue metrics
    const queueMetrics = await queue.getMetrics();
    console.log('📊 Queue:', queueMetrics.counts);

    // Cache health
    const cacheHealthy = await cache.ping();
    console.log('📊 Cache:', cacheHealthy ? 'healthy' : 'unhealthy');

    // Storage health (if PostgreSQL)
    if ('getPoolStatus' in storage) {
      const poolStatus = await (storage as any).getPoolStatus();
      console.log('📊 DB Pool:', poolStatus);
    }

    // Update business metrics
    const activeFlows = await storage.listFlows({ limit: 1000 });
    metricsCollector.setActiveFlows(activeFlows.length);
  }, 30000); // Every 30 seconds
}

// Start health monitoring
monitorHealth();

// ============================================
// 13. Cleanup & Graceful Shutdown
// ============================================

async function shutdown() {
  console.log('🛑 Shutting down...');

  await queue.stopWorker();
  await queue.close();
  await cache.disconnect();
  await storage.close();

  if (httpPool) {
    await httpPool.drain();
  }

  console.log('✅ Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ============================================
// Export for use in other modules
// ============================================

export {
  storage,
  cache,
  queue,
  executor,
  executeFlowWithCache,
  executeOnce,
  scheduleRecurringFlow,
  executeFlowWithMetrics,
  batchExecuteFlows,
  monitorHealth,
};

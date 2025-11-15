/**
 * Quickstart Example - Scalable UWG Engine
 * Simple example showing basic scalability features
 */

import { FlowExecutor, JobQueue } from '@uwg/engine';
import { connectorRegistry, registerDefaultConnectors } from '@uwg/connectors';
import { createStorage, RedisCache } from '@uwg/storage';

// 1. Initialize components
registerDefaultConnectors();

const storage = createStorage(); // Auto-selects based on STORAGE_TYPE env var
await storage.initialize();

const cache = new RedisCache();
await cache.connect();

const executor = new FlowExecutor(connectorRegistry);

const queue = new JobQueue(executor, {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
  },
});

// 2. Load a flow
const flow = await storage.loadFlow('my-flow-id');

if (!flow) {
  console.error('Flow not found');
  process.exit(1);
}

// 3. Execute async via job queue
const job = await queue.addJob({
  flow,
  triggerData: { userId: '123' },
  priority: 1,
});

console.log(`Job queued: ${job.id}`);

// 4. Start a worker to process jobs
await queue.startWorker(5); // 5 concurrent jobs

// 5. Monitor progress
setInterval(async () => {
  const counts = await queue.getJobCounts();
  console.log(`Queue: ${counts.waiting} waiting, ${counts.active} active`);
}, 5000);

// 6. Graceful shutdown
process.on('SIGTERM', async () => {
  await queue.stopWorker();
  await queue.close();
  await cache.disconnect();
  await storage.close();
  process.exit(0);
});

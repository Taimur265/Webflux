/**
 * Worker Entry Point - Bootstrap file for background workers
 * This file starts a BullMQ worker that processes flow execution jobs
 */

import { JobQueue } from './job-queue';
import { FlowExecutor } from './executor';
import { connectorRegistry, registerDefaultConnectors } from '@uwg/connectors';

// Initialize connectors
registerDefaultConnectors();

// Create executor
const executor = new FlowExecutor(connectorRegistry);

// Create job queue
const queue = new JobQueue(executor, {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  queueName: process.env.QUEUE_NAME || 'uwg:flows',
});

// Get worker configuration
const workerId = process.env.WORKER_ID || `worker_${process.pid}`;
const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5');

// Start worker
async function startWorker() {
  try {
    console.log(`Starting worker ${workerId} with concurrency ${concurrency}...`);

    await queue.startWorker(concurrency);

    console.log(`✅ Worker ${workerId} started successfully`);
    console.log(`📊 Concurrency: ${concurrency}`);
    console.log(`🔗 Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`);
    console.log(`📋 Queue: ${process.env.QUEUE_NAME || 'uwg:flows'}`);

    // Monitor queue metrics periodically
    setInterval(async () => {
      const metrics = await queue.getMetrics();
      console.log(`📈 Queue Metrics: Waiting=${metrics.counts.waiting}, Active=${metrics.counts.active}, Completed=${metrics.counts.completed}, Failed=${metrics.counts.failed}`);
    }, 60000); // Every minute

  } catch (error) {
    console.error('Failed to start worker:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down worker...');

  try {
    await queue.stopWorker();
    await queue.close();
    console.log('Worker shut down gracefully');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the worker
startWorker().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

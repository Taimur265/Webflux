/**
 * Job Queue - Distributed async flow execution with Bull/BullMQ
 */

import { Queue, Worker, Job, QueueEvents, JobsOptions } from 'bullmq';
import { RedisOptions } from 'ioredis';
import type { Flow, ExecutionReport } from '@uwg/schema';
import type { FlowExecutor, ExecutorOptions } from './executor';

export interface JobQueueOptions {
  redis?: RedisOptions;
  queueName?: string;
  defaultJobOptions?: JobsOptions;
  concurrency?: number;
}

export interface FlowExecutionJob {
  flow: Flow;
  triggerData?: any;
  executorOptions?: ExecutorOptions;
  priority?: number;
  delay?: number;
  attempts?: number;
}

export interface FlowExecutionResult {
  report: ExecutionReport;
  completed: boolean;
  error?: string;
}

export class JobQueue {
  private queue: Queue<FlowExecutionJob, FlowExecutionResult>;
  private worker: Worker<FlowExecutionJob, FlowExecutionResult> | null = null;
  private queueEvents: QueueEvents;
  private executor: FlowExecutor;

  constructor(executor: FlowExecutor, options: JobQueueOptions = {}) {
    this.executor = executor;

    const redisOptions: RedisOptions = options.redis || {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    };

    const queueName = options.queueName || 'uwg:flows';

    // Create queue
    this.queue = new Queue<FlowExecutionJob, FlowExecutionResult>(queueName, {
      connection: redisOptions,
      defaultJobOptions: options.defaultJobOptions || {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // Keep for 1 hour
          count: 1000, // Keep last 1000 jobs
        },
        removeOnFail: {
          age: 86400, // Keep for 24 hours
        },
      },
    });

    // Create queue events for monitoring
    this.queueEvents = new QueueEvents(queueName, {
      connection: redisOptions,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      console.log(`Job ${jobId} completed successfully`);
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`Job ${jobId} failed:`, failedReason);
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      console.log(`Job ${jobId} progress:`, data);
    });

    this.queueEvents.on('stalled', ({ jobId }) => {
      console.warn(`Job ${jobId} has stalled`);
    });
  }

  /**
   * Add a flow execution job to the queue
   */
  async addJob(
    jobData: FlowExecutionJob,
    options?: JobsOptions
  ): Promise<Job<FlowExecutionJob, FlowExecutionResult>> {
    const jobOptions: JobsOptions = {
      ...options,
      priority: jobData.priority,
      delay: jobData.delay,
      attempts: jobData.attempts || 3,
    };

    const job = await this.queue.add(
      `flow:${jobData.flow.flow_id || 'unknown'}`,
      jobData,
      jobOptions
    );

    return job;
  }

  /**
   * Add multiple jobs in bulk
   */
  async addBulk(jobs: FlowExecutionJob[]): Promise<Job<FlowExecutionJob, FlowExecutionResult>[]> {
    const bulkJobs = jobs.map(jobData => ({
      name: `flow:${jobData.flow.flow_id || 'unknown'}`,
      data: jobData,
      opts: {
        priority: jobData.priority,
        delay: jobData.delay,
        attempts: jobData.attempts || 3,
      },
    }));

    return await this.queue.addBulk(bulkJobs);
  }

  /**
   * Start processing jobs
   */
  async startWorker(concurrency: number = 5): Promise<void> {
    if (this.worker) {
      throw new Error('Worker already started');
    }

    this.worker = new Worker<FlowExecutionJob, FlowExecutionResult>(
      this.queue.name,
      async (job: Job<FlowExecutionJob, FlowExecutionResult>) => {
        console.log(`Processing job ${job.id} for flow ${job.data.flow.flow_id}`);

        try {
          // Update job progress
          await job.updateProgress(10);

          // Execute the flow
          const report = await this.executor.execute(
            job.data.flow,
            job.data.executorOptions,
            job.data.triggerData
          );

          await job.updateProgress(100);

          return {
            report,
            completed: true,
          };
        } catch (error: any) {
          console.error(`Job ${job.id} execution failed:`, error);

          return {
            report: {
              run_id: `run_failed_${Date.now()}`,
              flow_id: job.data.flow.flow_id || 'unknown',
              status: 'failed',
              started_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              outputs: {},
              logs: [],
              metadata: {},
            },
            completed: false,
            error: error.message,
          };
        }
      },
      {
        connection: this.queue.opts.connection,
        concurrency,
        limiter: {
          max: 100, // Max 100 jobs per duration
          duration: 60000, // Per minute
        },
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`Worker completed job ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Worker failed job ${job?.id}:`, err);
    });

    this.worker.on('error', (err) => {
      console.error('Worker error:', err);
    });

    console.log(`Worker started with concurrency: ${concurrency}`);
  }

  /**
   * Stop processing jobs
   */
  async stopWorker(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      console.log('Worker stopped');
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job<FlowExecutionJob, FlowExecutionResult> | undefined> {
    return await this.queue.getJob(jobId);
  }

  /**
   * Get job state
   */
  async getJobState(jobId: string): Promise<string | 'unknown'> {
    const job = await this.getJob(jobId);
    return job ? await job.getState() : 'unknown';
  }

  /**
   * Get job counts
   */
  async getJobCounts(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    return await this.queue.getJobCounts();
  }

  /**
   * Get queue metrics
   */
  async getMetrics(): Promise<{
    counts: any;
    isPaused: boolean;
    workers: number;
  }> {
    const counts = await this.getJobCounts();
    const isPaused = await this.queue.isPaused();

    return {
      counts,
      isPaused,
      workers: this.worker ? 1 : 0,
    };
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    console.log('Queue paused');
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    console.log('Queue resumed');
  }

  /**
   * Drain the queue (remove all waiting jobs)
   */
  async drain(): Promise<void> {
    await this.queue.drain();
    console.log('Queue drained');
  }

  /**
   * Clean old jobs
   */
  async clean(grace: number = 3600000, status: 'completed' | 'failed' = 'completed'): Promise<void> {
    await this.queue.clean(grace, 1000, status);
    console.log(`Cleaned ${status} jobs older than ${grace}ms`);
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      await job.retry();
      console.log(`Job ${jobId} queued for retry`);
    }
  }

  /**
   * Remove a job
   */
  async removeJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      await job.remove();
      console.log(`Job ${jobId} removed`);
    }
  }

  /**
   * Get waiting jobs
   */
  async getWaitingJobs(start: number = 0, end: number = 10): Promise<Job<FlowExecutionJob, FlowExecutionResult>[]> {
    return await this.queue.getWaiting(start, end);
  }

  /**
   * Get active jobs
   */
  async getActiveJobs(start: number = 0, end: number = 10): Promise<Job<FlowExecutionJob, FlowExecutionResult>[]> {
    return await this.queue.getActive(start, end);
  }

  /**
   * Get completed jobs
   */
  async getCompletedJobs(start: number = 0, end: number = 10): Promise<Job<FlowExecutionJob, FlowExecutionResult>[]> {
    return await this.queue.getCompleted(start, end);
  }

  /**
   * Get failed jobs
   */
  async getFailedJobs(start: number = 0, end: number = 10): Promise<Job<FlowExecutionJob, FlowExecutionResult>[]> {
    return await this.queue.getFailed(start, end);
  }

  /**
   * Schedule a recurring flow execution
   */
  async scheduleRecurring(
    jobData: FlowExecutionJob,
    pattern: string // Cron pattern
  ): Promise<Job<FlowExecutionJob, FlowExecutionResult>> {
    return await this.queue.add(
      `scheduled:${jobData.flow.flow_id}`,
      jobData,
      {
        repeat: {
          pattern,
        },
      }
    );
  }

  /**
   * Remove a recurring job
   */
  async removeRecurring(jobKey: string): Promise<void> {
    await this.queue.removeRepeatableByKey(jobKey);
  }

  /**
   * Get all repeatable jobs
   */
  async getRepeatableJobs(): Promise<any[]> {
    return await this.queue.getRepeatableJobs();
  }

  /**
   * Close the queue and clean up
   */
  async close(): Promise<void> {
    await this.stopWorker();
    await this.queueEvents.close();
    await this.queue.close();
    console.log('Job queue closed');
  }

  /**
   * Obliterate - completely remove the queue (USE WITH CAUTION)
   */
  async obliterate(): Promise<void> {
    await this.queue.obliterate();
    console.log('Queue obliterated');
  }
}

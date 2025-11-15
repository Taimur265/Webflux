/**
 * Worker Pool - Horizontal scaling with multi-process execution
 */

import cluster from 'cluster';
import os from 'os';
import { EventEmitter } from 'events';
import type { Flow, ExecutionReport } from '@uwg/schema';
import type { ExecutorOptions } from './executor';

export interface WorkerPoolOptions {
  workerCount?: number;
  autoRestart?: boolean;
  maxRestarts?: number;
  restartDelay?: number;
  healthCheckInterval?: number;
  executorOptions?: ExecutorOptions;
}

export interface WorkerMessage {
  type: 'execute' | 'status' | 'shutdown' | 'healthcheck';
  id?: string;
  payload?: any;
}

export interface WorkerResponse {
  type: 'result' | 'error' | 'status' | 'ready' | 'pong';
  id?: string;
  data?: any;
  error?: string;
}

export class WorkerPool extends EventEmitter {
  private workers: Map<number, cluster.Worker> = new Map();
  private pendingJobs: Map<string, {
    resolve: (result: ExecutionReport) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  private workerRestarts: Map<number, number> = new Map();
  private options: Required<WorkerPoolOptions>;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;

  constructor(options: WorkerPoolOptions = {}) {
    super();

    this.options = {
      workerCount: options.workerCount || os.cpus().length,
      autoRestart: options.autoRestart !== false,
      maxRestarts: options.maxRestarts || 5,
      restartDelay: options.restartDelay || 1000,
      healthCheckInterval: options.healthCheckInterval || 30000,
      executorOptions: options.executorOptions || {},
    };
  }

  /**
   * Initialize the worker pool (call from master process)
   */
  async initialize(): Promise<void> {
    if (!cluster.isPrimary) {
      throw new Error('WorkerPool.initialize() must be called from primary process');
    }

    // Fork workers
    for (let i = 0; i < this.options.workerCount; i++) {
      await this.forkWorker();
    }

    // Set up cluster event handlers
    cluster.on('exit', (worker, code, signal) => {
      this.handleWorkerExit(worker, code, signal);
    });

    cluster.on('message', (worker, message: WorkerResponse) => {
      this.handleWorkerMessage(worker, message);
    });

    // Start health checks
    this.startHealthChecks();

    this.emit('initialized', this.workers.size);
    console.log(`Worker pool initialized with ${this.workers.size} workers`);
  }

  /**
   * Fork a new worker process
   */
  private async forkWorker(): Promise<cluster.Worker> {
    const worker = cluster.fork();

    this.workers.set(worker.id, worker);
    this.workerRestarts.set(worker.id, 0);

    // Wait for worker to be ready
    return new Promise((resolve) => {
      const readyHandler = (message: WorkerResponse) => {
        if (message.type === 'ready') {
          worker.off('message', readyHandler);
          this.emit('workerReady', worker.id);
          resolve(worker);
        }
      };

      worker.on('message', readyHandler);
    });
  }

  /**
   * Handle worker exit
   */
  private async handleWorkerExit(worker: cluster.Worker, code: number, signal: string): Promise<void> {
    console.log(`Worker ${worker.id} died (${signal || code}). Restarting...`);

    this.workers.delete(worker.id);

    // Fail pending jobs for this worker
    for (const [jobId, job] of this.pendingJobs.entries()) {
      clearTimeout(job.timeout);
      job.reject(new Error(`Worker ${worker.id} died`));
      this.pendingJobs.delete(jobId);
    }

    // Auto-restart if enabled
    if (this.options.autoRestart && !this.isShuttingDown) {
      const restarts = this.workerRestarts.get(worker.id) || 0;

      if (restarts < this.options.maxRestarts) {
        this.workerRestarts.set(worker.id, restarts + 1);

        setTimeout(async () => {
          await this.forkWorker();
          this.emit('workerRestarted', worker.id);
        }, this.options.restartDelay);
      } else {
        console.error(`Worker ${worker.id} exceeded max restarts (${this.options.maxRestarts})`);
        this.emit('workerMaxRestarts', worker.id);
      }
    }
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(worker: cluster.Worker, message: WorkerResponse): void {
    if (message.type === 'result' && message.id) {
      const job = this.pendingJobs.get(message.id);
      if (job) {
        clearTimeout(job.timeout);
        job.resolve(message.data);
        this.pendingJobs.delete(message.id);
      }
    } else if (message.type === 'error' && message.id) {
      const job = this.pendingJobs.get(message.id);
      if (job) {
        clearTimeout(job.timeout);
        job.reject(new Error(message.error));
        this.pendingJobs.delete(message.id);
      }
    } else if (message.type === 'status') {
      this.emit('workerStatus', worker.id, message.data);
    } else if (message.type === 'pong') {
      this.emit('workerHealthy', worker.id);
    }
  }

  /**
   * Execute a flow on an available worker
   */
  async execute(
    flow: Flow,
    triggerData?: any,
    executorOptions?: ExecutorOptions
  ): Promise<ExecutionReport> {
    if (this.isShuttingDown) {
      throw new Error('Worker pool is shutting down');
    }

    const worker = this.getAvailableWorker();
    if (!worker) {
      throw new Error('No available workers');
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      // Set timeout for job execution
      const timeout = setTimeout(() => {
        this.pendingJobs.delete(jobId);
        reject(new Error(`Job ${jobId} timed out`));
      }, (executorOptions?.max_execution_time || 600000) + 5000); // Add 5s buffer

      this.pendingJobs.set(jobId, { resolve, reject, timeout });

      // Send execution request to worker
      const message: WorkerMessage = {
        type: 'execute',
        id: jobId,
        payload: {
          flow,
          triggerData,
          executorOptions: executorOptions || this.options.executorOptions,
        },
      };

      worker.send(message);
      this.emit('jobDispatched', jobId, worker.id);
    });
  }

  /**
   * Get an available worker (round-robin)
   */
  private getAvailableWorker(): cluster.Worker | null {
    const workers = Array.from(this.workers.values());
    if (workers.length === 0) {
      return null;
    }

    // Simple round-robin
    return workers[Math.floor(Math.random() * workers.length)];
  }

  /**
   * Start health checks for all workers
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      for (const worker of this.workers.values()) {
        const message: WorkerMessage = {
          type: 'healthcheck',
        };
        worker.send(message);
      }
    }, this.options.healthCheckInterval);
  }

  /**
   * Get pool status
   */
  getStatus(): {
    workerCount: number;
    activeWorkers: number;
    pendingJobs: number;
    totalRestarts: number;
  } {
    return {
      workerCount: this.options.workerCount,
      activeWorkers: this.workers.size,
      pendingJobs: this.pendingJobs.size,
      totalRestarts: Array.from(this.workerRestarts.values()).reduce((a, b) => a + b, 0),
    };
  }

  /**
   * Gracefully shutdown the worker pool
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    console.log('Shutting down worker pool...');

    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Send shutdown message to all workers
    for (const worker of this.workers.values()) {
      const message: WorkerMessage = {
        type: 'shutdown',
      };
      worker.send(message);
    }

    // Wait for pending jobs to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const start = Date.now();

    while (this.pendingJobs.size > 0 && (Date.now() - start) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Force kill remaining workers
    for (const worker of this.workers.values()) {
      worker.kill();
    }

    this.workers.clear();
    this.pendingJobs.clear();

    this.emit('shutdown');
    console.log('Worker pool shut down');
  }

  /**
   * Scale the worker pool up or down
   */
  async scale(newWorkerCount: number): Promise<void> {
    const currentCount = this.workers.size;

    if (newWorkerCount > currentCount) {
      // Scale up
      const toAdd = newWorkerCount - currentCount;
      for (let i = 0; i < toAdd; i++) {
        await this.forkWorker();
      }
      console.log(`Scaled up to ${newWorkerCount} workers`);
    } else if (newWorkerCount < currentCount) {
      // Scale down
      const toRemove = currentCount - newWorkerCount;
      const workers = Array.from(this.workers.values());

      for (let i = 0; i < toRemove; i++) {
        const worker = workers[i];
        worker.kill();
        this.workers.delete(worker.id);
      }

      console.log(`Scaled down to ${newWorkerCount} workers`);
    }

    this.options.workerCount = newWorkerCount;
    this.emit('scaled', newWorkerCount);
  }
}

/**
 * Worker process implementation
 */
export class Worker {
  private executor: any; // FlowExecutor instance

  constructor(executor: any) {
    this.executor = executor;
  }

  /**
   * Initialize worker process
   */
  async initialize(): Promise<void> {
    if (!cluster.isWorker) {
      throw new Error('Worker.initialize() must be called from worker process');
    }

    // Handle messages from master
    process.on('message', async (message: WorkerMessage) => {
      await this.handleMessage(message);
    });

    // Signal ready
    const response: WorkerResponse = {
      type: 'ready',
    };
    process.send!(response);

    console.log(`Worker ${process.pid} initialized`);
  }

  /**
   * Handle messages from master
   */
  private async handleMessage(message: WorkerMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'execute':
          await this.handleExecute(message);
          break;

        case 'healthcheck':
          this.handleHealthCheck();
          break;

        case 'shutdown':
          await this.handleShutdown();
          break;

        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error: any) {
      console.error('Worker error:', error);

      if (message.id) {
        const response: WorkerResponse = {
          type: 'error',
          id: message.id,
          error: error.message,
        };
        process.send!(response);
      }
    }
  }

  /**
   * Handle flow execution request
   */
  private async handleExecute(message: WorkerMessage): Promise<void> {
    const { flow, triggerData, executorOptions } = message.payload;

    try {
      const report = await this.executor.execute(flow, executorOptions, triggerData);

      const response: WorkerResponse = {
        type: 'result',
        id: message.id,
        data: report,
      };

      process.send!(response);
    } catch (error: any) {
      const response: WorkerResponse = {
        type: 'error',
        id: message.id,
        error: error.message,
      };

      process.send!(response);
    }
  }

  /**
   * Handle health check
   */
  private handleHealthCheck(): void {
    const response: WorkerResponse = {
      type: 'pong',
    };

    process.send!(response);
  }

  /**
   * Handle shutdown request
   */
  private async handleShutdown(): Promise<void> {
    console.log(`Worker ${process.pid} shutting down...`);
    process.exit(0);
  }
}

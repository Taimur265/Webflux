/**
 * Prometheus Metrics - Production monitoring and observability
 */

import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

// Create a Registry
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'uwg_',
});

// HTTP Metrics
const httpRequestDuration = new client.Histogram({
  name: 'uwg_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
  registers: [register],
});

const httpRequestTotal = new client.Counter({
  name: 'uwg_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestSize = new client.Histogram({
  name: 'uwg_http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

const httpResponseSize = new client.Histogram({
  name: 'uwg_http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

const httpActiveConnections = new client.Gauge({
  name: 'uwg_http_active_connections',
  help: 'Number of active HTTP connections',
  registers: [register],
});

// Flow Execution Metrics
const flowExecutionDuration = new client.Histogram({
  name: 'uwg_flow_execution_duration_seconds',
  help: 'Duration of flow executions in seconds',
  labelNames: ['flow_id', 'flow_name', 'status'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  registers: [register],
});

const flowExecutionTotal = new client.Counter({
  name: 'uwg_flow_executions_total',
  help: 'Total number of flow executions',
  labelNames: ['flow_id', 'flow_name', 'status'],
  registers: [register],
});

const flowExecutionActive = new client.Gauge({
  name: 'uwg_flow_executions_active',
  help: 'Number of currently executing flows',
  labelNames: ['flow_id', 'flow_name'],
  registers: [register],
});

const flowExecutionNodesTotal = new client.Counter({
  name: 'uwg_flow_execution_nodes_total',
  help: 'Total number of nodes executed',
  labelNames: ['flow_id', 'node_type', 'status'],
  registers: [register],
});

const flowExecutionNodeDuration = new client.Histogram({
  name: 'uwg_flow_execution_node_duration_seconds',
  help: 'Duration of individual node executions',
  labelNames: ['flow_id', 'node_type', 'connector'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

// Connector Metrics
const connectorRequestTotal = new client.Counter({
  name: 'uwg_connector_requests_total',
  help: 'Total number of connector requests',
  labelNames: ['connector', 'operation', 'status'],
  registers: [register],
});

const connectorRequestDuration = new client.Histogram({
  name: 'uwg_connector_request_duration_seconds',
  help: 'Duration of connector requests',
  labelNames: ['connector', 'operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

const connectorRateLimitHits = new client.Counter({
  name: 'uwg_connector_rate_limit_hits_total',
  help: 'Number of times connector rate limits were hit',
  labelNames: ['connector'],
  registers: [register],
});

const connectorRetries = new client.Counter({
  name: 'uwg_connector_retries_total',
  help: 'Number of connector request retries',
  labelNames: ['connector', 'operation', 'retry_reason'],
  registers: [register],
});

// Queue Metrics
const queueJobsTotal = new client.Counter({
  name: 'uwg_queue_jobs_total',
  help: 'Total number of queue jobs',
  labelNames: ['queue', 'status'],
  registers: [register],
});

const queueJobDuration = new client.Histogram({
  name: 'uwg_queue_job_duration_seconds',
  help: 'Duration of queue job processing',
  labelNames: ['queue', 'job_type'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [register],
});

const queueJobsWaiting = new client.Gauge({
  name: 'uwg_queue_jobs_waiting',
  help: 'Number of jobs waiting in queue',
  labelNames: ['queue'],
  registers: [register],
});

const queueJobsActive = new client.Gauge({
  name: 'uwg_queue_jobs_active',
  help: 'Number of jobs currently being processed',
  labelNames: ['queue'],
  registers: [register],
});

const queueWorkers = new client.Gauge({
  name: 'uwg_queue_workers',
  help: 'Number of active queue workers',
  labelNames: ['queue'],
  registers: [register],
});

// Storage Metrics
const storageOperationDuration = new client.Histogram({
  name: 'uwg_storage_operation_duration_seconds',
  help: 'Duration of storage operations',
  labelNames: ['operation', 'storage_type'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 5],
  registers: [register],
});

const storageOperationTotal = new client.Counter({
  name: 'uwg_storage_operations_total',
  help: 'Total number of storage operations',
  labelNames: ['operation', 'storage_type', 'status'],
  registers: [register],
});

const storageConnectionPoolSize = new client.Gauge({
  name: 'uwg_storage_connection_pool_size',
  help: 'Current size of storage connection pool',
  labelNames: ['storage_type', 'state'],
  registers: [register],
});

// Cache Metrics
const cacheHitTotal = new client.Counter({
  name: 'uwg_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type', 'key_prefix'],
  registers: [register],
});

const cacheMissTotal = new client.Counter({
  name: 'uwg_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type', 'key_prefix'],
  registers: [register],
});

const cacheOperationDuration = new client.Histogram({
  name: 'uwg_cache_operation_duration_seconds',
  help: 'Duration of cache operations',
  labelNames: ['operation', 'cache_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
  registers: [register],
});

// Business Metrics
const activeFlowsTotal = new client.Gauge({
  name: 'uwg_active_flows_total',
  help: 'Total number of active flows',
  registers: [register],
});

const activeUsersTotal = new client.Gauge({
  name: 'uwg_active_users_total',
  help: 'Total number of active users',
  registers: [register],
});

const flowCreatedTotal = new client.Counter({
  name: 'uwg_flows_created_total',
  help: 'Total number of flows created',
  registers: [register],
});

const flowDeletedTotal = new client.Counter({
  name: 'uwg_flows_deleted_total',
  help: 'Total number of flows deleted',
  registers: [register],
});

/**
 * Metrics collection class
 */
export class MetricsCollector {
  // HTTP Metrics
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number, reqSize?: number, resSize?: number) {
    httpRequestDuration.labels(method, route, statusCode.toString()).observe(duration);
    httpRequestTotal.labels(method, route, statusCode.toString()).inc();

    if (reqSize) {
      httpRequestSize.labels(method, route).observe(reqSize);
    }
    if (resSize) {
      httpResponseSize.labels(method, route).observe(resSize);
    }
  }

  incrementActiveConnections() {
    httpActiveConnections.inc();
  }

  decrementActiveConnections() {
    httpActiveConnections.dec();
  }

  // Flow Execution Metrics
  recordFlowExecution(flowId: string, flowName: string, status: string, duration: number) {
    flowExecutionDuration.labels(flowId, flowName, status).observe(duration);
    flowExecutionTotal.labels(flowId, flowName, status).inc();
  }

  setActiveFlowExecutions(flowId: string, flowName: string, count: number) {
    flowExecutionActive.labels(flowId, flowName).set(count);
  }

  incrementActiveFlowExecution(flowId: string, flowName: string) {
    flowExecutionActive.labels(flowId, flowName).inc();
  }

  decrementActiveFlowExecution(flowId: string, flowName: string) {
    flowExecutionActive.labels(flowId, flowName).dec();
  }

  recordNodeExecution(flowId: string, nodeType: string, status: string) {
    flowExecutionNodesTotal.labels(flowId, nodeType, status).inc();
  }

  recordNodeDuration(flowId: string, nodeType: string, connector: string, duration: number) {
    flowExecutionNodeDuration.labels(flowId, nodeType, connector).observe(duration);
  }

  // Connector Metrics
  recordConnectorRequest(connector: string, operation: string, status: string, duration: number) {
    connectorRequestTotal.labels(connector, operation, status).inc();
    connectorRequestDuration.labels(connector, operation).observe(duration);
  }

  recordConnectorRateLimitHit(connector: string) {
    connectorRateLimitHits.labels(connector).inc();
  }

  recordConnectorRetry(connector: string, operation: string, reason: string) {
    connectorRetries.labels(connector, operation, reason).inc();
  }

  // Queue Metrics
  recordQueueJob(queue: string, status: string, duration?: number, jobType?: string) {
    queueJobsTotal.labels(queue, status).inc();
    if (duration && jobType) {
      queueJobDuration.labels(queue, jobType).observe(duration);
    }
  }

  setQueueJobsWaiting(queue: string, count: number) {
    queueJobsWaiting.labels(queue).set(count);
  }

  setQueueJobsActive(queue: string, count: number) {
    queueJobsActive.labels(queue).set(count);
  }

  setQueueWorkers(queue: string, count: number) {
    queueWorkers.labels(queue).set(count);
  }

  // Storage Metrics
  recordStorageOperation(operation: string, storageType: string, status: string, duration: number) {
    storageOperationDuration.labels(operation, storageType).observe(duration);
    storageOperationTotal.labels(operation, storageType, status).inc();
  }

  setStoragePoolSize(storageType: string, total: number, idle: number, active: number) {
    storageConnectionPoolSize.labels(storageType, 'total').set(total);
    storageConnectionPoolSize.labels(storageType, 'idle').set(idle);
    storageConnectionPoolSize.labels(storageType, 'active').set(active);
  }

  // Cache Metrics
  recordCacheHit(cacheType: string, keyPrefix: string) {
    cacheHitTotal.labels(cacheType, keyPrefix).inc();
  }

  recordCacheMiss(cacheType: string, keyPrefix: string) {
    cacheMissTotal.labels(cacheType, keyPrefix).inc();
  }

  recordCacheOperation(operation: string, cacheType: string, duration: number) {
    cacheOperationDuration.labels(operation, cacheType).observe(duration);
  }

  // Business Metrics
  setActiveFlows(count: number) {
    activeFlowsTotal.set(count);
  }

  setActiveUsers(count: number) {
    activeUsersTotal.set(count);
  }

  incrementFlowsCreated() {
    flowCreatedTotal.inc();
  }

  incrementFlowsDeleted() {
    flowDeletedTotal.inc();
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();

/**
 * Express middleware to track HTTP metrics
 */
export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    metricsCollector.incrementActiveConnections();

    // Capture response finish
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = (req.route?.path || req.path).replace(/\/\d+/g, '/:id');

      metricsCollector.recordHttpRequest(
        req.method,
        route,
        res.statusCode,
        duration,
        parseInt(req.get('content-length') || '0'),
        parseInt(res.get('content-length') || '0')
      );

      metricsCollector.decrementActiveConnections();
    });

    next();
  };
}

/**
 * Metrics endpoint handler
 */
export async function metricsHandler(req: Request, res: Response) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

/**
 * Health check with metrics
 */
export function healthCheckHandler(req: Request, res: Response) {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '0.1.0',
  });
}

export { register };

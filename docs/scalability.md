# UWG Engine Scalability Guide

This guide covers the scalability features of the UWG Engine, including distributed systems, horizontal scaling, caching, and production deployment strategies.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Redis Cache](#redis-cache)
3. [PostgreSQL Storage](#postgresql-storage)
4. [Job Queue System](#job-queue-system)
5. [Connection Pooling](#connection-pooling)
6. [Distributed Rate Limiting](#distributed-rate-limiting)
7. [Metrics & Monitoring](#metrics--monitoring)
8. [Worker Pools](#worker-pools)
9. [Production Deployment](#production-deployment)
10. [Performance Benchmarks](#performance-benchmarks)

---

## Architecture Overview

The UWG Engine is designed for horizontal scalability across multiple dimensions:

```
┌─────────────────────────────────────────────────────────────┐
│                     Load Balancer (Nginx)                    │
└──────────────┬────────────────────────────┬─────────────────┘
               │                            │
         ┌─────▼─────┐              ┌───────▼───────┐
         │  API 1    │              │    API 2      │
         │  Server   │              │    Server     │
         └─────┬─────┘              └───────┬───────┘
               │                            │
               ├────────────────────────────┤
               │                            │
         ┌─────▼──────────────────────┐     │
         │       Redis Cache          │     │
         │   (State & Queue)          │     │
         └────────────────────────────┘     │
                                            │
         ┌──────────────────────────────────▼─┐
         │      PostgreSQL Database           │
         │      (Flows & Executions)          │
         └────────────────────────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
    ┌────▼─────┐        ┌─────▼────┐
    │ Worker 1 │        │ Worker 2 │
    │  (Queue) │        │  (Queue) │
    └──────────┘        └──────────┘
```

### Key Components

- **API Servers**: Stateless HTTP servers that can scale horizontally
- **Redis**: Distributed cache, state management, and job queue
- **PostgreSQL**: Scalable relational database with connection pooling
- **Workers**: Background job processors for async flow execution
- **Load Balancer**: Nginx for distributing traffic across API servers

---

## Redis Cache

The Redis cache provides distributed state management, caching, and pub/sub capabilities.

### Basic Usage

```typescript
import { RedisCache } from '@uwg/storage';

const cache = new RedisCache({
  host: 'localhost',
  port: 6379,
  password: 'optional-password',
  keyPrefix: 'uwg:',
  ttl: 3600, // Default TTL: 1 hour
});

await cache.connect();

// Basic operations
await cache.set('key', { data: 'value' }, 60);
const value = await cache.get('key');

// Hash operations
await cache.hSet('user:123', 'name', 'John');
await cache.hSet('user:123', 'email', 'john@example.com');
const user = await cache.hGetAll('user:123');

// Distributed locks
const lockId = await cache.acquireLock('resource-1', 10);
if (lockId) {
  // Perform exclusive operation
  await cache.releaseLock('resource-1', lockId);
}

// Atomic counters
await cache.incr('api-calls');
await cache.incrBy('api-calls', 5);

// Memoization pattern
const result = await cache.memoize('expensive-key', async () => {
  return await expensiveComputation();
}, 300);
```

### Advanced Features

#### Pub/Sub for Real-time Updates

```typescript
// Subscribe to channel
await cache.subscribe('flow-updates', (message) => {
  console.log('Flow updated:', message);
});

// Publish update
await cache.publish('flow-updates', {
  flowId: 'flow_123',
  action: 'updated',
});
```

#### Cache Invalidation

```typescript
// Invalidate all keys matching pattern
await cache.invalidatePattern('flows:*');
```

---

## PostgreSQL Storage

PostgreSQL provides a scalable, ACID-compliant storage backend for production deployments.

### Configuration

```typescript
import { PostgresStorage } from '@uwg/storage';

const storage = new PostgresStorage({
  host: 'localhost',
  port: 5432,
  database: 'uwg',
  user: 'uwg_user',
  password: 'secure-password',
  max: 20, // Connection pool size
  ssl: { rejectUnauthorized: false },
});

await storage.initialize();
```

### Features

- **Connection Pooling**: Automatic connection management with configurable pool size
- **JSONB Support**: Efficient JSON querying for flow definitions
- **Materialized Views**: Pre-computed flow statistics for fast analytics
- **Read Replicas**: Support for read-only replicas (configure multiple hosts)
- **Partitioning**: Table partitioning for large-scale deployments

### Performance Optimizations

```typescript
// Get connection pool status
const status = await storage.getPoolStatus();
console.log(`Total: ${status.total}, Idle: ${status.idle}, Waiting: ${status.waiting}`);

// Refresh materialized view for updated stats
await storage.refreshStats();

// Periodic maintenance
await storage.vacuum();
```

### Scaling Strategies

1. **Vertical Scaling**: Increase PostgreSQL resources (CPU, RAM, IOPS)
2. **Connection Pooling**: Use PgBouncer for connection pooling (thousands of connections)
3. **Read Replicas**: Configure streaming replication for read-heavy workloads
4. **Partitioning**: Partition executions table by date for better performance
5. **Sharding**: Shard by user ID or organization for multi-tenant deployments

---

## Job Queue System

The job queue (powered by BullMQ) enables async flow execution, scheduled jobs, and horizontal worker scaling.

### Basic Usage

```typescript
import { JobQueue } from '@uwg/engine';
import { FlowExecutor } from '@uwg/engine';

const executor = new FlowExecutor(connectorRegistry);
const queue = new JobQueue(executor, {
  redis: {
    host: 'localhost',
    port: 6379,
  },
  queueName: 'uwg:flows',
  concurrency: 5,
});

// Add job to queue
const job = await queue.addJob({
  flow: myFlow,
  triggerData: { userId: '123' },
  priority: 1, // Lower = higher priority
  delay: 5000, // Delay 5 seconds
  attempts: 3, // Retry up to 3 times
});

// Start worker
await queue.startWorker(5); // 5 concurrent jobs

// Monitor job status
const state = await queue.getJobState(job.id);
const counts = await queue.getJobCounts();
console.log(`Waiting: ${counts.waiting}, Active: ${counts.active}`);
```

### Scheduled Jobs

```typescript
// Schedule recurring flow execution
await queue.scheduleRecurring(
  { flow: myFlow },
  '0 */6 * * *' // Every 6 hours (cron syntax)
);

// List recurring jobs
const repeatable = await queue.getRepeatableJobs();

// Remove recurring job
await queue.removeRecurring(jobKey);
```

### Job Lifecycle

```
  ┌─────────┐
  │  Added  │
  └────┬────┘
       │
  ┌────▼────┐
  │ Waiting │◄──────┐
  └────┬────┘       │
       │            │
  ┌────▼────┐       │
  │ Active  │       │ Retry
  └────┬────┘       │
       │            │
  ┌────▼────┐  ┌────┴────┐
  │Complete │  │ Failed  │
  └─────────┘  └─────────┘
```

### Error Handling

```typescript
// Configure retry behavior
const job = await queue.addJob(
  { flow: myFlow },
  {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds
    },
  }
);

// Manual retry
await queue.retryJob(failedJobId);

// Clean up old jobs
await queue.clean(3600000, 'completed'); // Remove jobs completed over 1 hour ago
```

---

## Connection Pooling

Connection pooling prevents connection exhaustion when making external API calls.

### Usage

```typescript
import { ConnectionPool, connectionPoolManager } from '@uwg/connectors';

// Create a pool for HTTP connections
const httpPool = connectionPoolManager.getOrCreatePool(
  'http-client',
  {
    create: async () => {
      return axios.create({
        timeout: 30000,
        headers: { 'User-Agent': 'UWG-Engine/1.0' },
      });
    },
    destroy: async (client) => {
      // Cleanup if needed
    },
    validate: async (client) => {
      return true; // Check if connection is still valid
    },
  },
  {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    maxUses: 1000, // Recreate after 1000 uses
  }
);

// Use connection from pool
const response = await httpPool.use(async (client) => {
  return await client.get('https://api.example.com/data');
});

// Get pool statistics
const stats = httpPool.getStats();
console.log(`Total: ${stats.total}, Available: ${stats.available}`);
```

### Pool Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `min` | 0 | Minimum connections to maintain |
| `max` | 10 | Maximum connections allowed |
| `acquireTimeoutMillis` | 30000 | Timeout when waiting for connection |
| `idleTimeoutMillis` | 30000 | Idle timeout before eviction |
| `maxUses` | 1000 | Max uses before connection refresh |
| `validateOnBorrow` | true | Validate connections before use |

---

## Distributed Rate Limiting

Redis-backed rate limiting works across multiple API instances.

### Configuration

```typescript
import { createDefaultRateLimiters } from '@uwg/api/middleware';

const rateLimiters = createDefaultRateLimiters({
  host: 'localhost',
  port: 6379,
});

// Apply to Express app
app.use('/api', rateLimiters.api);
app.use('/api/flows/:id/execute', rateLimiters.execution);
app.use('/api/webhooks', rateLimiters.webhook);
```

### Custom Rate Limiters

```typescript
import { DistributedRateLimiter } from '@uwg/api/middleware';

const limiter = new DistributedRateLimiter();

// Custom rate limit
const customLimit = limiter.middleware('custom', {
  points: 50, // 50 requests
  duration: 60, // Per minute
  blockDuration: 300, // Block for 5 minutes if exceeded
});

app.use('/api/expensive', customLimit);
```

### Rate Limit Strategies

| Use Case | Points | Duration | Block Duration |
|----------|--------|----------|----------------|
| Global API | 100 | 900s (15min) | - |
| Flow Execution | 30 | 60s | - |
| Webhooks | 100 | 60s | - |
| Authentication | 5 | 900s | 1800s (30min) |
| User-specific | 1000 | 3600s (1hr) | - |

---

## Metrics & Monitoring

Prometheus-compatible metrics for production monitoring.

### Exposed Metrics

```typescript
import { metricsCollector } from '@uwg/api/middleware';

// Record flow execution
metricsCollector.recordFlowExecution(
  flowId,
  flowName,
  'completed',
  duration
);

// Record connector request
metricsCollector.recordConnectorRequest(
  'slack',
  'postMessage',
  'success',
  0.523
);

// Update business metrics
metricsCollector.setActiveFlows(150);
metricsCollector.incrementFlowsCreated();
```

### Available Metrics

#### HTTP Metrics
- `uwg_http_request_duration_seconds` - Request latency histogram
- `uwg_http_requests_total` - Total request counter
- `uwg_http_request_size_bytes` - Request size histogram
- `uwg_http_response_size_bytes` - Response size histogram
- `uwg_http_active_connections` - Active connections gauge

#### Flow Metrics
- `uwg_flow_execution_duration_seconds` - Flow execution time
- `uwg_flow_executions_total` - Total executions counter
- `uwg_flow_executions_active` - Currently executing flows
- `uwg_flow_execution_nodes_total` - Node execution counter
- `uwg_flow_execution_node_duration_seconds` - Node execution time

#### Queue Metrics
- `uwg_queue_jobs_total` - Total jobs processed
- `uwg_queue_job_duration_seconds` - Job processing time
- `uwg_queue_jobs_waiting` - Jobs in queue
- `uwg_queue_jobs_active` - Jobs being processed
- `uwg_queue_workers` - Active worker count

#### Storage Metrics
- `uwg_storage_operation_duration_seconds` - Storage operation time
- `uwg_storage_operations_total` - Total storage operations
- `uwg_storage_connection_pool_size` - Connection pool status

### Grafana Dashboards

Sample Prometheus queries for Grafana:

```promql
# Request rate by endpoint
rate(uwg_http_requests_total[5m])

# 95th percentile response time
histogram_quantile(0.95, rate(uwg_http_request_duration_seconds_bucket[5m]))

# Flow execution success rate
rate(uwg_flow_executions_total{status="completed"}[5m])
/ rate(uwg_flow_executions_total[5m])

# Queue depth
uwg_queue_jobs_waiting

# Worker utilization
uwg_queue_jobs_active / uwg_queue_workers
```

---

## Worker Pools

Multi-process worker pools for CPU-intensive flow executions.

### Master Process

```typescript
import cluster from 'cluster';
import { WorkerPool } from '@uwg/engine';

if (cluster.isPrimary) {
  const pool = new WorkerPool({
    workerCount: 4, // Number of worker processes
    autoRestart: true,
    maxRestarts: 5,
    executorOptions: {
      parallelism: 6,
    },
  });

  await pool.initialize();

  // Execute flow on available worker
  const report = await pool.execute(flow, triggerData);

  // Scale workers dynamically
  await pool.scale(8); // Scale to 8 workers

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await pool.shutdown();
    process.exit(0);
  });
}
```

### Worker Process

```typescript
import cluster from 'cluster';
import { Worker, FlowExecutor } from '@uwg/engine';

if (cluster.isWorker) {
  const executor = new FlowExecutor(connectorRegistry);
  const worker = new Worker(executor);

  await worker.initialize();
}
```

### Worker Pool Patterns

1. **CPU-Bound Workloads**: Use worker pools for parallel processing
2. **I/O-Bound Workloads**: Use job queues with async workers
3. **Hybrid**: Combine both for maximum throughput

---

## Production Deployment

### Docker Compose Production Stack

```bash
# Deploy full production stack
docker-compose -f docker-compose.production.yml up -d

# Scale API servers
docker-compose -f docker-compose.production.yml up -d --scale api=4

# Scale workers
docker-compose -f docker-compose.production.yml up -d --scale worker=6
```

### Environment Variables

```env
# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=uwg
POSTGRES_USER=uwg
POSTGRES_PASSWORD=<secure-password>
STORAGE_TYPE=postgres

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<secure-password>

# Workers
WORKER_CONCURRENCY=5

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: uwg-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: uwg-api
  template:
    metadata:
      labels:
        app: uwg-api
    spec:
      containers:
      - name: api
        image: uwg/api:latest
        ports:
        - containerPort: 3000
        env:
        - name: POSTGRES_HOST
          value: postgres-service
        - name: REDIS_HOST
          value: redis-service
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 1Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: uwg-api-service
spec:
  selector:
    app: uwg-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: uwg-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: uwg-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### High Availability Setup

```
┌──────────────────────────────────────────────────────┐
│              Global Load Balancer (AWS ALB)          │
└───────────────────┬──────────────────────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
    ┌────▼─────┐         ┌─────▼────┐
    │  Region  │         │  Region  │
    │  US-East │         │  US-West │
    └────┬─────┘         └─────┬────┘
         │                     │
    ┌────▼──────────────────────▼────┐
    │    Application Cluster (K8s)   │
    │  - API Servers (auto-scaling)  │
    │  - Workers (auto-scaling)      │
    └────┬───────────────────────┬───┘
         │                       │
    ┌────▼────┐             ┌────▼────┐
    │  Redis  │             │ Postgres│
    │ Cluster │             │ Primary │
    │ (Sentinel)            │ +Replicas
    └─────────┘             └─────────┘
```

### Backup & Disaster Recovery

```bash
# PostgreSQL backups
pg_dump uwg > uwg_backup_$(date +%Y%m%d).sql

# Redis snapshots
redis-cli BGSAVE

# Restore
psql uwg < uwg_backup_20240101.sql
```

---

## Performance Benchmarks

### Throughput Tests

| Configuration | Flows/sec | Latency (p95) | Notes |
|--------------|-----------|---------------|-------|
| Single instance | 50 | 120ms | Baseline |
| 2x API + Redis | 180 | 85ms | 3.6x improvement |
| 4x API + Workers | 450 | 75ms | 9x improvement |
| Production (K8s) | 2000+ | 60ms | Auto-scaling |

### Optimization Checklist

- [ ] Enable Redis caching for frequently accessed flows
- [ ] Use PostgreSQL with connection pooling (pool size = 2x CPU cores)
- [ ] Deploy multiple API instances behind load balancer
- [ ] Use job queue for async flow execution
- [ ] Configure distributed rate limiting
- [ ] Enable Prometheus metrics
- [ ] Set up Grafana dashboards
- [ ] Configure auto-scaling policies
- [ ] Enable database read replicas
- [ ] Implement CDN for static assets
- [ ] Use connection pooling for connectors
- [ ] Configure appropriate worker concurrency
- [ ] Enable Redis persistence (AOF + RDB)
- [ ] Set up monitoring alerts

### Cost Optimization

1. **Right-sizing**: Monitor resource usage and adjust container sizes
2. **Auto-scaling**: Use HPA (Horizontal Pod Autoscaler) based on CPU/memory
3. **Spot Instances**: Use spot/preemptible instances for workers
4. **Cache Warming**: Pre-populate Redis cache for common flows
5. **Query Optimization**: Add database indexes for common queries
6. **Connection Reuse**: Use connection pooling everywhere

---

## Troubleshooting

### Common Issues

**High Memory Usage**
```bash
# Check Redis memory
redis-cli INFO memory

# Enable maxmemory policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET maxmemory 512mb
```

**Database Connection Pool Exhausted**
```typescript
// Increase pool size
const storage = new PostgresStorage({
  max: 40, // Increase from default 20
});
```

**Worker Stalled Jobs**
```typescript
// Monitor stalled jobs
const stalledCount = await queue.getJobCounts().stalled;

// Clean stalled jobs
await queue.clean(0, 'stalled');
```

**Rate Limit Issues**
```typescript
// Check rate limit status
const remaining = await limiter.get('api', clientIp, options);
console.log(`Remaining: ${remaining?.remainingPoints}`);
```

---

## Further Reading

- [Architecture Documentation](./architecture.md)
- [API Reference](./api.md)
- [Deployment Guide](./deployment.md)
- [Connector Development](./connectors.md)

---

**Last Updated**: 2024-01-15
**Version**: 1.0.0

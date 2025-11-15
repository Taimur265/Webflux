# UWG Engine - Examples

This directory contains examples demonstrating various features of the UWG Engine, including scalability features.

## Examples

### Basic Usage

1. **`simple-flow.json`** - Simple 2-node flow example
2. **`github-automation-flow.json`** - GitHub PR automation with Slack notifications

### Scalability Features

3. **`quickstart-scalable.ts`** - Quick start with job queue and Redis cache
4. **`production-setup.ts`** - Comprehensive production setup example

### Innovation Features

5. **`innovation-features.ts`** - Cutting-edge features beyond standard workflow automation
   - AI-powered flow generation from natural language
   - Time-travel debugging with record/replay
   - Real-time collaboration with WebSocket
   - Resilience patterns (circuit breaker, bulkhead)
   - Multi-tenancy with RBAC
   - Comprehensive flow testing framework

## Running Examples

### Prerequisites

```bash
# Install dependencies
npm install

# Build packages
npm run build

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Run Quickstart Example

```bash
# Make sure Redis is running
docker run -d -p 6379:6379 redis:7-alpine

# Run the example
ts-node examples/quickstart-scalable.ts
```

### Run Production Setup

```bash
# Start full production stack
docker-compose -f docker-compose.production.yml up -d

# Run the example
ts-node examples/production-setup.ts
```

## Features Demonstrated

### quickstart-scalable.ts

- ✅ Dynamic storage selection (SQLite/PostgreSQL)
- ✅ Redis caching
- ✅ Job queue with BullMQ
- ✅ Async flow execution
- ✅ Worker management

### production-setup.ts

- ✅ PostgreSQL storage with connection pooling
- ✅ Redis cache with distributed locking
- ✅ Job queue with priorities and scheduling
- ✅ Worker pool (multi-process)
- ✅ Connection pooling for HTTP requests
- ✅ Prometheus metrics tracking
- ✅ Batch job processing
- ✅ Health monitoring
- ✅ Graceful shutdown

### innovation-features.ts

- ✅ AI-powered flow generation (natural language → executable workflow)
- ✅ Flow optimization and auto-fix suggestions
- ✅ Time-travel debugging (record/replay with breakpoints)
- ✅ Timeline analysis and session comparison
- ✅ Real-time multi-user collaboration
- ✅ Conflict resolution and edit history
- ✅ Circuit breaker pattern (failure isolation)
- ✅ Bulkhead pattern (resource isolation)
- ✅ Multi-tenancy with tenant isolation
- ✅ Role-based access control (RBAC)
- ✅ Flow testing with assertions and mocking
- ✅ Code coverage tracking

### Run Innovation Features

```bash
# Set up API keys for AI features
export ANTHROPIC_API_KEY=your-api-key

# Make sure Redis is running
docker run -d -p 6379:6379 redis:7-alpine

# Run specific examples
ts-node examples/innovation-features.ts
```

Each example can be run individually by uncommenting the desired example in the `main()` function.

## Environment Variables

### Required for Scalable Features

```env
# Storage
STORAGE_TYPE=postgres  # or 'sqlite'
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=uwg
POSTGRES_USER=uwg
POSTGRES_PASSWORD=your-password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Workers
WORKER_CONCURRENCY=5

# AI Features
ANTHROPIC_API_KEY=your-api-key

# Collaboration
WEBSOCKET_PORT=8080
```

See `.env.example` for complete configuration.

## Docker Deployment

### Development (SQLite + Redis)

```bash
docker-compose up -d
```

### Production (PostgreSQL + Redis + Workers)

```bash
docker-compose -f docker-compose.production.yml up -d

# Scale API servers
docker-compose -f docker-compose.production.yml up -d --scale api=4

# Scale workers
docker-compose -f docker-compose.production.yml up -d --scale worker=8
```

## Monitoring

Access monitoring dashboards:

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3002 (admin/admin)
- **API Metrics**: http://localhost:3000/metrics
- **Health Check**: http://localhost:3000/health

## Performance

### Single Instance (SQLite)

- **Throughput**: ~50 flows/sec
- **Latency**: ~120ms (p95)
- **Concurrent**: 6 flows

### Production (PostgreSQL + Redis + Workers)

- **Throughput**: 2000+ flows/sec
- **Latency**: ~60ms (p95)
- **Concurrent**: 1000+ flows
- **Scalability**: Unlimited horizontal scaling

## Innovation Features Deep Dive

### 1. AI Flow Generation

Generate executable workflows from natural language descriptions using Claude AI:

```typescript
const generator = new AIFlowGenerator({ apiKey: process.env.ANTHROPIC_API_KEY });
const result = await generator.generateFlow({
  description: "Monitor GitHub PRs and send analysis to Slack",
  connectors: ['github', 'ai-claude', 'slack'],
});
```

### 2. Time-Travel Debugging

Record and replay flow executions with breakpoints and timeline analysis:

```typescript
const debugger = new TimeTravelDebugger(storage);
const sessionId = await debugger.startSession(flow, triggerData);
await debugger.replay(sessionId, { stepMode: true });
```

### 3. Real-Time Collaboration

Enable multiple users to edit flows simultaneously with conflict resolution:

```typescript
const collaboration = new RealtimeCollaboration({ server, cache });
// Users connect via WebSocket and see each other's edits in real-time
```

### 4. Resilience Patterns

Protect your flows with circuit breakers and bulkheads:

```typescript
const resilience = new ResilienceManager({
  circuitBreaker: { threshold: 5, timeout: 30000 },
  bulkhead: { maxConcurrent: 5 },
});
await resilience.execute(unstableOperation);
```

### 5. Multi-Tenancy

Isolate tenants with role-based access control:

```typescript
const multiTenancy = new MultiTenancyManager(cache);
const tenant = await multiTenancy.createTenant('Acme Corp', 'enterprise');
await multiTenancy.addUser(tenant.tenantId, { role: 'developer' });
```

### 6. Flow Testing

Write comprehensive tests with assertions and mocking:

```typescript
const testFramework = new FlowTestingFramework(connectorRegistry);
const results = await testFramework.runSuite({
  flow,
  tests: [/* test cases */],
});
```

## Next Steps

1. Review the examples
2. Try the innovation features
3. Customize for your use case
4. Deploy to production
5. Monitor with Grafana
6. Scale as needed

For more information, see:
- [Scalability Guide](../docs/scalability.md)
- [Architecture Documentation](../docs/architecture.md)
- [API Reference](../docs/api.md)

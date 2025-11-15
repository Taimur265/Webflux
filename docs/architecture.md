# UWG Engine Architecture

## Overview

The Unified Website Graph (UWG) Engine is a next-generation automation platform that combines website building, AI content generation, and workflow automation in a single unified graph.

## Core Principles

### 1. Everything is a Node

Unlike traditional automation platforms where pages and automations are separate, UWG treats everything as nodes in a single graph:

- **Pages** are nodes
- **Components** are nodes
- **AI generation** steps are nodes
- **Automation** actions are nodes
- **Inspections** are nodes
- **Deployments** are nodes

### 2. Unified Execution Model

The engine executes flows using a sophisticated dependency-based execution model:

```
Trigger → Action1 → Action2 → AI Generate → Component → Publish
              ↓
            Action3 → Notify
```

## Architecture Layers

### Layer 1: Schema (`@uwg/schema`)

Defines the core data structures:

- **Flow JSON Schema**: The complete specification for flows
- **Node Types**: All available node types and their parameters
- **Validation**: Comprehensive validation including cycle detection

Key files:
- `types.ts` - Core type definitions
- `node-types.ts` - Node type catalog
- `validation.ts` - Validation logic using Zod

### Layer 2: Connectors (`@uwg/connectors`)

Implements the connector system:

- **Base Connector**: Abstract base class with retry logic
- **Connector Registry**: Centralized connector management
- **Built-in Connectors**: Webflow, Slack, Claude AI, etc.

Features:
- Automatic retry with exponential backoff
- Authentication management
- Rate limiting support
- Type-safe parameter validation

### Layer 3: Engine (`@uwg/engine`)

The runtime execution engine:

- **FlowExecutor**: Orchestrates parallel execution with retry
- **DependencyGraph**: Manages node dependencies
- **TemplateEngine**: Handles variable substitution
- **NodeRunner**: Executes individual nodes

Features:
- Parallel execution (configurable workers)
- Automatic retry with backoff strategies
- Template variable resolution
- Timeout handling
- Execution logging

## Execution Flow

1. **Parse Flow**: Load and validate flow JSON
2. **Build Graph**: Construct dependency graph from connections
3. **Initialize State**: Create execution state tracker
4. **Execute**:
   - Identify ready nodes (dependencies satisfied)
   - Execute nodes in parallel (up to max workers)
   - Render templates with current outputs
   - Call appropriate connectors
   - Update state and outputs
   - Repeat until all nodes complete or fail

## Data Flow

### Template Variables

Nodes can reference outputs from previous nodes using mustache-style templates:

```json
{
  "params": {
    "text": "New lead: {{n1.result.name}} - {{n1.result.email}}"
  }
}
```

The TemplateEngine resolves these at runtime using the execution state.

### Outputs

Each node produces outputs that become available to downstream nodes:

```typescript
state.outputs = {
  "trigger_1": { body: { name: "Alice", email: "alice@example.com" } },
  "n1": { id: "123", url: "https://...", fields: {...} },
  "n2": { message_id: "msg_456" }
}
```

## Error Handling

### Retry Strategies

Nodes can specify retry behavior:

```json
{
  "retry": {
    "max_attempts": 3,
    "strategy": "exponential"
  }
}
```

Supported strategies:
- **exponential**: 2^n seconds (1s, 2s, 4s, 8s, ...)
- **linear**: n * 2 seconds
- **fixed**: Constant 2 seconds

### Failure Propagation

When a node fails after all retries:
1. Node is marked as `failed`
2. All downstream nodes are marked as `skipped`
3. Other independent branches continue execution
4. Final status reflects failure

## Parallelism

The engine executes independent nodes in parallel:

```
     ┌─→ Node A ─┐
Trigger           └─→ Node D
     └─→ Node B ───→ Node C
```

In this flow:
- Trigger completes first
- Node A and Node B execute in parallel
- Node C waits for Node B
- Node D waits for both A and C

Maximum parallelism is configurable via `ExecutorOptions.parallelism`.

## Idempotency

For production workflows, nodes can specify idempotency keys:

```typescript
const idempotencyKey = `${node.id}:${hashInputs(inputs)}`;
```

This prevents duplicate operations on retries for operations like:
- Creating CMS items
- Sending notifications
- Publishing deployments

## Security

### Secrets Management

Never store secrets in flow JSON. Use secret references:

```json
{
  "build_hook": "vault://netlify_build_hook_ref"
}
```

The connector system resolves these at runtime from a secure vault.

### Production Guards

Destructive operations require explicit confirmation:

```json
{
  "type": "deploy.production",
  "params": {
    "confirm": true  // Required for production deploys
  }
}
```

## Performance Characteristics

### Throughput

- **Parallel Execution**: Up to N nodes concurrently (default: 6)
- **Connector Pooling**: Reuse HTTP connections
- **Template Caching**: Parsed templates cached per execution

### Latency

- **Node Startup**: < 10ms (in-memory)
- **Connector Calls**: Depends on external API (typically 100-500ms)
- **AI Generation**: 2-10 seconds per call
- **Template Rendering**: < 1ms per node

### Scalability

- **Flow Size**: Tested up to 1000 nodes
- **Execution Time**: Max 10 minutes per flow (configurable)
- **Concurrent Flows**: Limited by system resources

## Extension Points

### Custom Connectors

Implement `IConnector` interface:

```typescript
class MyConnector extends BaseConnector {
  protected async setupAuth(): Promise<void> { ... }
  protected async verifyAuth(): Promise<boolean> { ... }
  async call(operation, params, options): Promise<ConnectorCallResult> { ... }
}
```

Register:

```typescript
connectorRegistry.register(new MyConnector());
```

### Custom Node Types

Add to `node-types.ts`:

```typescript
export interface CustomNodeTypes {
  'custom.operation': {
    params: { ... };
    outputs: { ... };
  };
}
```

Implement in `NodeRunner.run()`.

## Monitoring

### Execution Logs

Every execution produces detailed logs:

```typescript
{
  node_id: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  started_at?: string;
  completed_at?: string;
  error?: string;
  attempts?: number;
}
```

### Metrics

Track:
- Execution duration per node
- Retry counts
- Failure rates
- AI token usage
- Connector call counts

## Best Practices

1. **Keep Flows Focused**: One flow per logical workflow
2. **Use Retries**: Always configure retry for network operations
3. **Set Timeouts**: Prevent hanging on slow APIs
4. **Validate Early**: Use comprehensive validation before execution
5. **Monitor Costs**: Track AI usage and API calls
6. **Test Incrementally**: Build and test flows node by node
7. **Use Templates**: Keep flows DRY with template variables
8. **Handle Failures**: Design flows to gracefully handle errors

## Future Enhancements

- [ ] Loop nodes for iteration
- [ ] Conditional branching
- [ ] Sub-flows / flow composition
- [ ] Real-time execution streaming
- [ ] Distributed execution
- [ ] Flow versioning and rollback
- [ ] A/B testing for AI prompts
- [ ] Cost optimization recommendations

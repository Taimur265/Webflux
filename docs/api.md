# UWG Engine API Reference

Complete API documentation for the UWG Engine REST API.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently the API does not require authentication. In production, implement token-based auth.

## Endpoints

### Flows

#### List Flows

```http
GET /api/flows
```

Query Parameters:
- `owner` (optional) - Filter by owner
- `tags` (optional) - Comma-separated tags
- `limit` (optional) - Max results (default: all)
- `offset` (optional) - Pagination offset

Response:
```json
{
  "flows": [...],
  "count": 10
}
```

#### Create Flow

```http
POST /api/flows
```

Body (JSON):
```json
{
  "flow": { ... }
}
```

Or with DSL:
```json
{
  "dsl": "flow \"My Flow\" { ... }",
  "owner": "user@example.com"
}
```

Response:
```json
{
  "flow_id": "flow_abc123",
  "message": "Flow created successfully"
}
```

#### Get Flow

```http
GET /api/flows/:id
```

Response:
```json
{
  "flow": { ... }
}
```

#### Update Flow

```http
PUT /api/flows/:id
```

Body:
```json
{
  "flow": { ... }
}
```

#### Delete Flow

```http
DELETE /api/flows/:id
```

#### Execute Flow

```http
POST /api/flows/:id/execute
```

Body (optional):
```json
{
  "trigger_data": {
    "custom": "data"
  }
}
```

Response:
```json
{
  "message": "Flow execution started",
  "note": "Check execution status via /api/executions/:run_id"
}
```

#### Get Flow Execution History

```http
GET /api/flows/:id/executions?limit=20&offset=0
```

#### Get Flow Version History

```http
GET /api/flows/:id/history
```

### Executions

#### Get Execution

```http
GET /api/executions/:id
```

Response:
```json
{
  "execution": {
    "run_id": "run_xyz",
    "flow_id": "flow_abc",
    "status": "completed",
    "started_at": "2025-11-15T10:00:00Z",
    "completed_at": "2025-11-15T10:00:05Z",
    "outputs": { ... },
    "logs": [ ... ]
  }
}
```

### Connectors

#### List Connectors

```http
GET /api/connectors
```

Response:
```json
{
  "connectors": [
    {
      "name": "webflow",
      "display_name": "Webflow",
      "category": "cms",
      "operations": [ ... ]
    }
  ]
}
```

#### Get Connector Details

```http
GET /api/connectors/:name
```

#### Get Connector Status

```http
GET /api/connectors/:name/status
```

Response:
```json
{
  "status": {
    "name": "slack",
    "authenticated": true,
    "capabilities": ["postMessage", "uploadFile"]
  }
}
```

### Webhooks

#### Trigger Flow via Webhook

```http
POST /api/webhooks/:flow_id
```

Body: Any JSON (passed as trigger data)

Response:
```json
{
  "message": "Webhook received, flow execution started"
}
```

## Error Responses

All errors return:

```json
{
  "error": "Error message",
  "stack": "..." // Only in development
}
```

Common status codes:
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error

## Rate Limiting

- 100 requests per 15 minutes per IP
- Applies to all `/api/*` endpoints

## WebSocket Support (Future)

Real-time execution streaming coming soon:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws/executions/:run_id');
ws.onmessage = (event) => {
  const log = JSON.parse(event.data);
  console.log('Node update:', log);
};
```

## CLI Integration

The CLI uses the same API:

```bash
# Internally calls POST /api/flows/:id/execute
uwg run my-flow.json

# Internally calls GET /api/flows
uwg list
```

## SDK (Future)

```typescript
import { UWGClient } from '@uwg/sdk';

const client = new UWGClient('http://localhost:3000');

// Create flow
const flowId = await client.flows.create(flowJson);

// Execute
const execution = await client.flows.execute(flowId, triggerData);

// Watch execution
client.executions.watch(execution.run_id, (log) => {
  console.log(log);
});
```

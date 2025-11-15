# UWG Engine - Quick Start Guide

## Installation

```bash
# Clone the repository
git clone https://github.com/yourorg/uwg-engine.git
cd uwg-engine

# Install dependencies
npm install

# Build all packages
npm run build
```

## Your First Flow

Let's create a simple flow that captures leads and notifies your team.

### Step 1: Create Flow JSON

Create `my-first-flow.json`:

```json
{
  "flow_id": null,
  "name": "Lead Capture",
  "description": "Simple lead capture with Slack notification",
  "version": 1,
  "graph": {
    "pages": [],
    "nodes": [
      {
        "id": "trigger_1",
        "category": "trigger",
        "type": "http.webhook",
        "name": "Form Submit",
        "connector": null,
        "operation": null,
        "params": {
          "path": "/hooks/lead",
          "method": "POST"
        },
        "inputs": [],
        "outputs": ["body"],
        "ui_hints": { "x": 100, "y": 100, "summary": "Webhook trigger" }
      },
      {
        "id": "notify",
        "category": "action",
        "type": "slack.postMessage",
        "name": "Notify Team",
        "connector": "slack",
        "operation": "postMessage",
        "params": {
          "channel": "#leads",
          "text": "New lead: {{trigger_1.body.email}}"
        },
        "inputs": [{ "from": "trigger_1", "port": "body" }],
        "outputs": ["message"],
        "ui_hints": { "x": 300, "y": 100, "summary": "Post to Slack" }
      }
    ],
    "connections": [
      { "from": "trigger_1", "to": "notify" }
    ],
    "triggers": [
      { "id": "t1", "type": "http.webhook", "config": {}, "to_node": "notify" }
    ]
  },
  "metadata": {
    "owner": "you@example.com",
    "created_at": "2025-11-15T00:00:00Z",
    "tags": ["demo"]
  }
}
```

### Step 2: Validate the Flow

```typescript
import { validateFlowComprehensive } from '@uwg/schema';
import * as fs from 'fs';

const flow = JSON.parse(fs.readFileSync('my-first-flow.json', 'utf-8'));
const result = validateFlowComprehensive(flow);

if (!result.valid) {
  console.error('Validation errors:', result.errors);
} else {
  console.log('✓ Flow is valid!');
}
```

### Step 3: Set Up Connectors

```typescript
import { connectorRegistry, SlackConnector } from '@uwg/connectors';

// Initialize Slack connector
const slackConnector = new SlackConnector();
await slackConnector.initialize({
  bot_token: process.env.SLACK_BOT_TOKEN!
});

connectorRegistry.register(slackConnector);
```

### Step 4: Execute the Flow

```typescript
import { FlowExecutor } from '@uwg/engine';
import { connectorRegistry } from '@uwg/connectors';

const executor = new FlowExecutor(connectorRegistry);

// Simulate webhook trigger
const triggerData = {
  body: {
    email: 'alice@example.com',
    name: 'Alice Smith'
  }
};

const report = await executor.execute(flow, {}, triggerData);

console.log('Execution Report:', report);
```

## Using the CLI

Create a simple CLI runner:

```typescript
#!/usr/bin/env node
import { FlowExecutor } from '@uwg/engine';
import { connectorRegistry, registerDefaultConnectors } from '@uwg/connectors';
import { validateFlowComprehensive } from '@uwg/schema';
import * as fs from 'fs';

// Register all built-in connectors
registerDefaultConnectors();

// Initialize connectors with env vars
const slackConnector = connectorRegistry.get('slack');
if (slackConnector) {
  await slackConnector.initialize({
    bot_token: process.env.SLACK_BOT_TOKEN!
  });
}

const aiConnector = connectorRegistry.get('ai');
if (aiConnector) {
  await aiConnector.initialize({
    api_key: process.env.ANTHROPIC_API_KEY!
  });
}

// Load and validate flow
const flowPath = process.argv[2];
if (!flowPath) {
  console.error('Usage: uwg-run <flow.json>');
  process.exit(1);
}

const flow = JSON.parse(fs.readFileSync(flowPath, 'utf-8'));

const validation = validateFlowComprehensive(flow);
if (!validation.valid) {
  console.error('❌ Flow validation failed:');
  validation.errors?.forEach(err => {
    console.error(`  ${err.path}: ${err.message}`);
  });
  process.exit(1);
}

console.log('✓ Flow validated successfully');

// Execute
const executor = new FlowExecutor(connectorRegistry);
const report = await executor.execute(flow);

console.log(`\n📊 Execution ${report.status}`);
console.log(`Duration: ${Date.parse(report.completed_at!) - Date.parse(report.started_at)}ms`);
console.log(`\nLogs:`);
report.logs.forEach(log => {
  const icon = log.status === 'success' ? '✓' : log.status === 'failed' ? '✗' : '○';
  console.log(`  ${icon} ${log.node_id}: ${log.status}`);
  if (log.error) {
    console.log(`    Error: ${log.error}`);
  }
});

process.exit(report.status === 'completed' ? 0 : 1);
```

## Environment Variables

Create `.env`:

```bash
# Slack
SLACK_BOT_TOKEN=xoxb-your-token

# Claude AI
ANTHROPIC_API_KEY=sk-ant-your-key

# Webflow
WEBFLOW_API_KEY=your-webflow-key

# Netlify
NETLIFY_SITE_ID=your-site-id
```

## Common Patterns

### Pattern 1: Form → CMS → Notify

```
Webhook → Create CMS Item → Slack Message
```

### Pattern 2: AI Content Generation

```
Trigger → AI Generate → Create CMS → Publish
```

### Pattern 3: Scheduled Site Maintenance

```
Cron Trigger → Inspect Site → AI Fix Issues → Deploy
```

### Pattern 4: Multi-step Automation

```
Webhook → AI Process → Branch:
              ├→ Create Item → Email
              └→ Slack Notify → Deploy
```

## Debugging

Enable detailed logging:

```typescript
const report = await executor.execute(flow, {
  parallelism: 1,  // Sequential execution for debugging
  default_timeout: 60  // Longer timeout
});

// Inspect each node's output
report.logs.forEach(log => {
  console.log(`Node ${log.node_id}:`);
  console.log('  Output:', report.outputs[log.node_id]);
});
```

## Next Steps

- [Architecture Guide](./architecture.md) - Deep dive into system design
- [Connector Development](./connectors.md) - Build custom connectors
- [Flow Schema Reference](./schema.md) - Complete schema documentation
- [DSL Guide](./dsl.md) - Write flows in DSL instead of JSON

## Example Flows

Check the `/examples` directory for complete flow examples:

- `lead-capture-flow.json` - Form capture with notifications
- `ai-content-generation-flow.json` - AI blog post generation
- `site-maintenance-flow.json` - Automated site health checks

## Getting Help

- GitHub Issues: https://github.com/yourorg/uwg-engine/issues
- Documentation: https://docs.uwg-engine.dev
- Discord: https://discord.gg/uwg-engine

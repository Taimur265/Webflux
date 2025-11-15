# UWG Engine - Unified Website Graph Engine

**Next-generation automation and website building platform powered by Claude AI**

## Overview

UWG Engine combines the automation power of n8n with AI-native website building, creating a unified graph where pages, components, content, automations, and AI generation steps all exist together.

## Core Concepts

### 1. Unified Graph
- **Pages** and **Components** are nodes
- **Automations** and **Triggers** are nodes
- **AI Generation** steps are nodes
- **Inspections** and **Publishing** are nodes
- Everything connects in one massive graph

### 2. AI-Native Nodes
- `AI_CopyGen` - Generate content
- `AI_LayoutGen` - Design layouts
- `AI_ComponentGen` - Create components
- `AI_AssetGen` - Generate images/assets
- `AI_SEOFix` - Optimize SEO
- `AI_AccessibilityFix` - Improve accessibility

### 3. Flow Automation
Trigger → Action → Transform → Publish pipeline:
```
trigger: form.submit
→ CMS.create(lead)
→ Slack.notify(#sales)
→ AI.regeneratePage(pricing)
→ Deploy.preview()
```

### 4. Self-Maintaining Websites
```
daily 3am:
  inspector.performance()
  if score < 85:
    AI.optimizeImages()
    AI.rewriteMeta()
    publish()
```

## Architecture

```
packages/
├── schema/       # Flow JSON schema & validation (Zod)
├── engine/       # Runtime execution with parallel processing
├── connectors/   # Connector system (Webflow, Slack, Claude AI)
├── storage/      # SQLite persistence layer
├── dsl/          # Human-friendly DSL parser
├── inspector/    # Website health (Lighthouse, SEO, Links)
├── api/          # REST API server (Express)
├── cli/          # Command-line tool
└── ui/           # Visual flow editor (React + ReactFlow)
```

## Quick Start

### Using the CLI

```bash
# Initialize a new project
npx @uwg/cli init

# Run a flow
uwg run flows/lead-capture.uwg

# Validate a flow
uwg validate flows/my-flow.json

# List all flows
uwg list
```

### Using the API

```bash
# Start the API server
cd packages/api && npm run dev

# Start the UI
cd packages/ui && npm run dev
```

Visit `http://localhost:3001` for the visual editor.

### Programmatic Usage

```typescript
import { FlowExecutor } from '@uwg/engine';
import { connectorRegistry } from '@uwg/connectors';
import { validateFlowComprehensive } from '@uwg/schema';

// Validate flow
const validation = validateFlowComprehensive(flow);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
  process.exit(1);
}

// Execute flow
const executor = new FlowExecutor(connectorRegistry);
const report = await executor.execute(flow, {}, triggerData);

console.log(`Status: ${report.status}`);
```

## Features

### ✅ Complete & Production-Ready

**Core Engine:**
- ✅ Parallel node execution with configurable workers
- ✅ Advanced retry strategies (exponential, linear, fixed backoff)
- ✅ Dependency graph resolution
- ✅ Template variable system ({{node.output.field}})
- ✅ Comprehensive execution logging
- ✅ Cycle detection and validation
- ✅ Production deployment guards

**Storage & Persistence:**
- ✅ SQLite database with WAL mode
- ✅ Flow versioning and history
- ✅ Execution report storage
- ✅ Migration system

**DSL (Domain-Specific Language):**
- ✅ Human-friendly flow syntax
- ✅ Parser with full error reporting
- ✅ JSON translation
- ✅ Comment support

**Inspector Services:**
- ✅ Lighthouse performance auditing
- ✅ SEO analysis and recommendations
- ✅ Link checker (broken links, redirects)
- ✅ Accessibility checks

**REST API:**
- ✅ Complete CRUD for flows
- ✅ Flow execution endpoints
- ✅ Connector management
- ✅ Webhook triggers
- ✅ Execution history
- ✅ Rate limiting & security headers
- ✅ CORS support

**Command-Line Tool:**
- ✅ `uwg run` - Execute flows
- ✅ `uwg validate` - Validate flows
- ✅ `uwg list` - List all flows
- ✅ `uwg init` - Initialize projects
- ✅ Colored output & progress indicators

**Visual Editor:**
- ✅ React-based flow editor
- ✅ Drag-and-drop interface (ReactFlow)
- ✅ Real-time validation
- ✅ Flow execution from UI
- ✅ Flow management

**Connectors:**
- ✅ Webflow (CMS operations)
- ✅ Slack (messaging)
- ✅ Claude AI (content generation)
- ✅ Base connector class with retry logic
- ✅ Extensible architecture

**Testing:**
- ✅ Schema validation tests
- ✅ Template engine tests
- ✅ DSL parser tests
- ✅ Integration test framework

## Connectors

- **Webflow** - CMS and site management
- **Netlify** - Deployment and hosting
- **Slack** - Team notifications
- **Airtable** - Database operations
- **Supabase** - Backend as a service
- **GitHub** - Version control operations
- **AWS S3** - Asset storage
- **AI (Claude)** - Content and layout generation

## Example Flow (DSL)

```uwg
# Lead Capture Flow
flow "Lead Capture" {
  # Webhook trigger
  trigger webhook(path="/hooks/lead") -> create_lead

  # Create lead in Webflow
  node create_lead: webflow.createItem(
    collection="leads",
    fields={
      name: "{{trigger.body.name}}",
      email: "{{trigger.body.email}}"
    }
  )

  # Notify sales team
  node notify: slack.postMessage(
    channel="#sales",
    text="New lead: {{create_lead.result.fields.name}}"
  )

  # Send confirmation email
  node confirm: smtp.send(
    to="{{trigger.body.email}}",
    subject="Thanks for your interest!"
  )

  # Connect the flow
  create_lead -> notify
  create_lead -> confirm
}
```

## Project Stats

- **8 packages** - Modular monorepo architecture
- **~10,000 lines** of production TypeScript
- **Full type safety** with Zod validation
- **Comprehensive tests** across packages
- **Complete documentation** with examples
- **Production-ready** deployment guides

## Use Cases

### 1. Automated Lead Capture
Form submission → CMS → Team notification → Email confirmation → Analytics

### 2. AI Content Pipeline
Trigger → AI generates outline → AI writes content → AI creates images → SEO optimization → Publish to CMS

### 3. Website Health Monitoring
Daily cron → Run Lighthouse → Check SEO → Analyze links → Auto-fix issues → Deploy

### 4. Multi-Channel Publishing
Create post → AI optimize for each platform → Publish to blog/social → Track engagement

### 5. E-commerce Automation
Order placed → Update inventory → Generate invoice → Send shipping email → Notify fulfillment

## Documentation

See `/docs` for detailed documentation:
- [Architecture](./docs/architecture.md) - System design & execution model
- [Quick Start](./docs/quickstart.md) - Get up and running
- [API Reference](./docs/api.md) - Complete REST API docs
- [Deployment](./docs/deployment.md) - Production deployment guide
- [Claude Agent Prompt](./docs/claude-agent-prompt.md) - AI agent instructions

## Examples

Check `/examples` for complete flow examples:
- `lead-capture-flow.json` - Form → CMS → Slack → Deploy
- `ai-content-generation-flow.json` - AI blog post creation
- `lead-capture.uwg` - DSL example

## License

MIT

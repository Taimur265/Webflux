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
├── engine/       # Core runtime execution engine
├── schema/       # Flow JSON schema & validation
├── connectors/   # Connector implementations
├── dsl/          # DSL parser & translator
├── api/          # Backend API server
├── ui/           # Visual flow editor (React)
└── inspector/    # Website health services
```

## Quick Start

```bash
# Install dependencies
npm install

# Start development servers
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Features

✓ Unified graph for pages + automations
✓ AI-native nodes: layout, content, images, components
✓ Intent → Flow compiler
✓ Flow-based page builder
✓ Smart website health nodes
✓ Multi-agent flow execution
✓ DSL for flows
✓ Flow-as-component reuse
✓ Real-time collaboration
✓ Flow auto-complete + auto-fix
✓ Website CI/CD automation
✓ Live debugging
✓ Connector ecosystem for web platforms

## Connectors

- **Webflow** - CMS and site management
- **Netlify** - Deployment and hosting
- **Slack** - Team notifications
- **Airtable** - Database operations
- **Supabase** - Backend as a service
- **GitHub** - Version control operations
- **AWS S3** - Asset storage
- **AI (Claude)** - Content and layout generation

## Documentation

See `/docs` for detailed documentation:
- [Architecture](./docs/architecture.md)
- [Flow Schema](./docs/schema.md)
- [Connector Development](./docs/connectors.md)
- [DSL Reference](./docs/dsl.md)
- [API Reference](./docs/api.md)

## License

MIT

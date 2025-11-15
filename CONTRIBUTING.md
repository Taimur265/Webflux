# Contributing to UWG Engine

Thank you for your interest in contributing to the Unified Website Graph Engine!

## Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/yourusername/uwg-engine.git
cd uwg-engine
```

2. **Install dependencies**

```bash
npm install
```

3. **Build all packages**

```bash
npm run build
```

4. **Run tests**

```bash
npm test
```

## Project Structure

```
uwg-engine/
├── packages/
│   ├── schema/       # Core type definitions and validation
│   ├── connectors/   # Connector system and implementations
│   ├── engine/       # Runtime execution engine
│   ├── dsl/          # DSL parser and translator
│   ├── api/          # Backend API server
│   ├── ui/           # Visual flow editor (React)
│   └── inspector/    # Site inspection services
├── docs/             # Documentation
├── examples/         # Example flows
└── README.md
```

## Making Changes

### Adding a New Connector

1. Create a new file in `packages/connectors/src/connectors/`:

```typescript
import { BaseConnector } from '../base-connector';
import type { ConnectorDefinition, ConnectorCallOptions, ConnectorCallResult } from '../types';

export class MyConnector extends BaseConnector {
  constructor() {
    super({
      name: 'my-connector',
      display_name: 'My Service',
      description: 'Integration with My Service',
      category: 'other',
      auth: {
        type: 'api_key',
        instructions: 'Get your API key from...',
      },
      base_url: 'https://api.myservice.com',
      operations: [
        {
          name: 'doSomething',
          description: 'Perform an action',
          required_params: ['param1'],
          param_schema: {
            param1: { type: 'string', description: 'Description', required: true },
          },
          output_schema: {
            result: { type: 'string', description: 'Result' },
          },
        },
      ],
    } as ConnectorDefinition);
  }

  protected async setupAuth(): Promise<void> {
    // Configure authentication
  }

  protected async verifyAuth(): Promise<boolean> {
    // Verify auth works
    return true;
  }

  async call(
    operation: string,
    params: Record<string, any>,
    options?: ConnectorCallOptions
  ): Promise<ConnectorCallResult> {
    // Implement operations
    return { success: true, data: {} };
  }
}
```

2. Register in `packages/connectors/src/index.ts`:

```typescript
export { MyConnector } from './connectors/my-connector';

export function registerDefaultConnectors(): void {
  // ... existing
  connectorRegistry.register(new MyConnector());
}
```

3. Add tests in `packages/connectors/src/connectors/__tests__/my-connector.test.ts`

### Adding a New Node Type

1. Define the type in `packages/schema/src/node-types.ts`:

```typescript
export interface CustomNodeTypes {
  'custom.operation': {
    params: {
      input: string;
    };
    outputs: {
      result: string;
    };
  };
}
```

2. Implement in `packages/engine/src/node-runner.ts`:

```typescript
switch (node.category) {
  case 'custom':
    return this.runCustom(node, renderedParams);
  // ... existing cases
}
```

### Improving the Engine

Areas for contribution:

- **Performance**: Optimize parallel execution
- **Error handling**: Better retry strategies
- **Validation**: More comprehensive checks
- **Observability**: Enhanced logging and metrics

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run tests for specific package
cd packages/schema && npm test

# Run with coverage
npm test -- --coverage
```

### Integration Tests

```bash
# Test full flow execution
cd packages/engine && npm run test:integration
```

### Manual Testing

Create a test flow and run it:

```bash
node scripts/run-flow.js examples/lead-capture-flow.json
```

## Code Style

We use TypeScript with strict mode enabled.

- **Formatting**: Prettier (automatic on commit)
- **Linting**: ESLint
- **Type checking**: TypeScript strict mode

Run checks:

```bash
npm run lint
npm run type-check
```

## Documentation

- Add JSDoc comments to all public APIs
- Update `/docs` for architectural changes
- Add examples for new features
- Update README.md if adding major features

## Commit Messages

Use conventional commits:

```
feat: add Airtable connector
fix: handle null values in template engine
docs: update quickstart guide
test: add integration tests for executor
chore: upgrade dependencies
```

## Pull Request Process

1. **Create a branch** from `main`:

```bash
git checkout -b feature/my-feature
```

2. **Make your changes** and commit them

3. **Push to your fork**:

```bash
git push origin feature/my-feature
```

4. **Open a pull request** with:
   - Clear description of the change
   - Link to any related issues
   - Screenshots/demos if UI changes
   - Test results

5. **Address review feedback**

6. **Squash commits** if requested

## Areas Needing Help

Current priorities:

- [ ] Additional connectors (Notion, Airtable, Stripe, etc.)
- [ ] DSL parser implementation
- [ ] Visual flow editor UI
- [ ] Inspector service implementations (Lighthouse, SEO)
- [ ] API server with REST endpoints
- [ ] Webhook management system
- [ ] Flow versioning and history
- [ ] Real-time execution streaming
- [ ] Performance benchmarks
- [ ] Comprehensive test coverage

## Questions?

- Open a Discussion on GitHub
- Join our Discord server
- Email: maintainers@uwg-engine.dev

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to build something great together.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

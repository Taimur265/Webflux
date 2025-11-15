/**
 * UWG Engine - Innovation Features Examples
 * Demonstrates cutting-edge capabilities beyond standard workflow automation
 */

import {
  FlowExecutor,
  AIFlowGenerator,
  TimeTravelDebugger,
  FlowTestingFramework,
} from '@uwg/engine';
import {
  RealtimeCollaboration,
  MultiTenancyManager,
} from '@uwg/api';
import {
  connectorRegistry,
  registerDefaultConnectors,
  CircuitBreaker,
  Bulkhead,
  ResilienceManager,
} from '@uwg/connectors';
import { createStorage, RedisCache } from '@uwg/storage';
import type { Flow } from '@uwg/schema';

// ============================================================================
// Example 1: AI-Powered Flow Generation
// ============================================================================

async function example1_AIFlowGeneration() {
  console.log('\n📝 Example 1: AI-Powered Flow Generation\n');

  const generator = new AIFlowGenerator({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  // Generate a flow from natural language
  const result = await generator.generateFlow({
    description: `
      Create a flow that monitors GitHub PRs:
      1. When a new PR is created, fetch the PR details
      2. Run code analysis using Claude AI
      3. Post review comments to the PR
      4. Send a summary to Slack
    `,
    connectors: ['github', 'ai-claude', 'slack'],
    complexity: 'medium',
  });

  console.log('✅ Generated flow:', result.flow.name);
  console.log('📊 Confidence:', result.confidence);
  console.log('💡 Suggestions:', result.suggestions);

  // Optimize an existing flow
  const optimized = await generator.optimizeFlow(result.flow);
  console.log('\n🚀 Optimizations applied:', optimized.improvements.length);
  optimized.improvements.forEach(imp => {
    console.log(`  - ${imp.type}: ${imp.description}`);
  });

  // Auto-fix a failed flow
  const errorLog = {
    nodeId: 'node_1',
    error: 'Authentication failed: Invalid API key',
  };

  const fixes = await generator.suggestFixes(result.flow, errorLog);
  console.log('\n🔧 Suggested fixes:', fixes.suggestions.length);
  fixes.suggestions.forEach(fix => {
    console.log(`  - ${fix.description}`);
  });

  // Explain a flow
  const explanation = await generator.explainFlow(result.flow);
  console.log('\n📖 Flow explanation:');
  console.log('  Purpose:', explanation.purpose);
  console.log('  Steps:', explanation.steps.length);
  console.log('  Potential issues:', explanation.potentialIssues.length);
}

// ============================================================================
// Example 2: Time-Travel Debugging
// ============================================================================

async function example2_TimeTravelDebugging() {
  console.log('\n🕐 Example 2: Time-Travel Debugging\n');

  registerDefaultConnectors();
  const storage = createStorage();
  await storage.initialize();

  const flow = await storage.loadFlow('my-flow-id');
  if (!flow) return;

  const debugger = new TimeTravelDebugger(storage);

  // Start a debug session
  const sessionId = await debugger.startSession(flow, { userId: '123' });
  console.log('🎬 Debug session started:', sessionId);

  // Set breakpoints
  await debugger.setBreakpoint(sessionId, {
    nodeId: 'node_2',
    condition: 'inputs.status === "error"',
  });

  // Record execution with snapshots
  const executor = new FlowExecutor(connectorRegistry);

  // Hook into executor to record snapshots
  const originalRun = executor.execute.bind(executor);
  executor.execute = async (flow, options, triggerData) => {
    const report = await originalRun(flow, options, triggerData);

    // Record each node execution
    for (const log of report.logs) {
      if (log.node_id) {
        await debugger.recordSnapshot(sessionId, {
          id: log.node_id,
          type: 'connector',
          connector_type: 'github',
          name: 'GitHub Action',
        }, log.data || {}, {}, {});
      }
    }

    return report;
  };

  // Execute flow
  await executor.execute(flow, {}, { userId: '123' });

  // Replay the session
  console.log('\n⏪ Replaying session...');
  await debugger.replay(sessionId, {
    stepMode: false,
    onSnapshot: async (snapshot, index) => {
      console.log(`  Step ${index + 1}: ${snapshot.nodeId}`);
    },
  });

  // Analyze timeline
  const timeline = await debugger.analyzeTimeline(sessionId);
  console.log('\n📊 Timeline Analysis:');
  console.log(`  Total execution time: ${timeline.totalDuration}ms`);
  console.log(`  Slowest node: ${timeline.slowestNodes[0]?.nodeId} (${timeline.slowestNodes[0]?.duration}ms)`);
  console.log(`  Bottlenecks: ${timeline.bottlenecks.length}`);

  // Export session for sharing
  const exported = await debugger.exportSession(sessionId);
  console.log('\n💾 Session exported for sharing');

  await storage.close();
}

// ============================================================================
// Example 3: Real-Time Collaboration
// ============================================================================

async function example3_RealtimeCollaboration() {
  console.log('\n👥 Example 3: Real-Time Collaboration\n');

  const cache = new RedisCache();
  await cache.connect();

  const collaboration = new RealtimeCollaboration({
    server: require('http').createServer(),
    cache,
  });

  // Simulate user connections
  console.log('🔌 Starting WebSocket server on port 8080...');

  // User joins a flow
  const userId1 = 'user-1';
  const flowId = 'flow-123';

  // This would normally happen via WebSocket, but we'll simulate it
  await collaboration['handleJoin'](userId1, flowId);
  console.log(`✅ User ${userId1} joined flow ${flowId}`);

  // User makes an edit
  await collaboration['handleEdit'](userId1, flowId, {
    type: 'update_node',
    nodeId: 'node_1',
    changes: {
      name: 'Updated Node Name',
    },
  });
  console.log('📝 Edit applied and broadcasted to collaborators');

  // User moves cursor
  await collaboration['handleCursor'](userId1, flowId, {
    x: 100,
    y: 200,
    nodeId: 'node_1',
  });
  console.log('🖱️  Cursor position updated');

  // Get edit history
  const session = await collaboration['getSession'](flowId);
  if (session) {
    console.log(`\n📜 Edit history: ${session.edits.length} edits`);
    session.edits.slice(0, 3).forEach(edit => {
      console.log(`  - ${edit.userId} ${edit.edit.type} at ${new Date(edit.timestamp).toLocaleTimeString()}`);
    });
  }

  await cache.disconnect();
}

// ============================================================================
// Example 4: Resilience Patterns
// ============================================================================

async function example4_ResiliencePatterns() {
  console.log('\n🛡️  Example 4: Resilience Patterns\n');

  // Circuit Breaker
  const circuitBreaker = new CircuitBreaker({
    threshold: 5,        // Open after 5 failures
    timeout: 30000,      // Try again after 30s
    monitoringPeriod: 60000,
  });

  console.log('⚡ Circuit Breaker initialized');

  // Simulate API calls
  const unstableAPI = async () => {
    if (Math.random() > 0.7) throw new Error('API Error');
    return { data: 'Success' };
  };

  const fallback = async () => {
    return { data: 'Fallback response' };
  };

  for (let i = 0; i < 10; i++) {
    try {
      const result = await circuitBreaker.execute(unstableAPI, fallback);
      console.log(`  Request ${i + 1}: ${result.data}`);
    } catch (error: any) {
      console.log(`  Request ${i + 1}: ${error.message}`);
    }
  }

  const cbStats = circuitBreaker.getStats();
  console.log(`\n📊 Circuit Breaker Stats:`);
  console.log(`  State: ${cbStats.state}`);
  console.log(`  Successes: ${cbStats.successes}`);
  console.log(`  Failures: ${cbStats.failures}`);

  // Bulkhead Pattern
  const bulkhead = new Bulkhead({
    maxConcurrent: 3,
    maxQueue: 5,
  });

  console.log('\n🚧 Bulkhead initialized (max 3 concurrent)');

  const slowTask = async (id: number) => {
    console.log(`  Task ${id} started`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`  Task ${id} completed`);
    return id;
  };

  // Launch 10 tasks
  const tasks = Array.from({ length: 10 }, (_, i) =>
    bulkhead.execute(() => slowTask(i + 1))
  );

  await Promise.all(tasks);

  const bhStats = bulkhead.getStats();
  console.log(`\n📊 Bulkhead Stats:`);
  console.log(`  Total executed: ${bhStats.totalExecuted}`);
  console.log(`  Current queue: ${bhStats.queueSize}`);

  // Combined Resilience Manager
  const resilience = new ResilienceManager({
    circuitBreaker: { threshold: 5, timeout: 30000 },
    bulkhead: { maxConcurrent: 5, maxQueue: 10 },
    retry: { maxAttempts: 3, backoff: 'exponential' },
    timeout: 5000,
  });

  console.log('\n🎯 Combined Resilience Manager initialized');

  const protectedAPI = async () => {
    if (Math.random() > 0.8) throw new Error('Temporary failure');
    return { status: 'ok' };
  };

  try {
    const result = await resilience.execute(protectedAPI);
    console.log('✅ Protected API call succeeded:', result);
  } catch (error: any) {
    console.log('❌ Protected API call failed:', error.message);
  }
}

// ============================================================================
// Example 5: Multi-Tenancy with RBAC
// ============================================================================

async function example5_MultiTenancy() {
  console.log('\n🏢 Example 5: Multi-Tenancy with RBAC\n');

  const cache = new RedisCache();
  await cache.connect();

  const multiTenancy = new MultiTenancyManager(cache);

  // Create a tenant
  const tenant = await multiTenancy.createTenant('Acme Corp', 'enterprise', 'owner-1');
  console.log(`✅ Created tenant: ${tenant.name} (${tenant.plan})`);
  console.log(`  Limits: ${tenant.limits.maxFlows} flows, ${tenant.limits.maxExecutionsPerDay} executions/day`);

  // Add users with different roles
  await multiTenancy.addUser(tenant.tenantId, {
    userId: 'user-2',
    email: 'developer@acme.com',
    name: 'Developer User',
    role: 'developer',
  });

  await multiTenancy.addUser(tenant.tenantId, {
    userId: 'user-3',
    email: 'viewer@acme.com',
    name: 'Viewer User',
    role: 'viewer',
  });

  console.log('\n👥 Added users with roles');

  // Check permissions
  const canEdit = await multiTenancy.hasPermission(tenant.tenantId, 'user-2', 'flow:edit');
  const canView = await multiTenancy.hasPermission(tenant.tenantId, 'user-3', 'flow:view');
  const canDelete = await multiTenancy.hasPermission(tenant.tenantId, 'user-3', 'flow:delete');

  console.log(`\n🔐 Permission checks:`);
  console.log(`  Developer can edit: ${canEdit}`);
  console.log(`  Viewer can view: ${canView}`);
  console.log(`  Viewer can delete: ${canDelete}`);

  // Track resource usage
  await multiTenancy.trackUsage(tenant.tenantId, {
    flows: 15,
    executions: 1250,
    storageBytes: 5_000_000,
  });

  const usage = await multiTenancy.getUsage(tenant.tenantId);
  console.log(`\n📊 Resource usage:`);
  console.log(`  Flows: ${usage.flows}/${tenant.limits.maxFlows}`);
  console.log(`  Executions: ${usage.executions}/${tenant.limits.maxExecutionsPerDay}`);
  console.log(`  Storage: ${(usage.storageBytes / 1024 / 1024).toFixed(2)} MB`);

  // Check limits
  const canCreateFlow = await multiTenancy.checkLimit(tenant.tenantId, 'maxFlows', 1);
  console.log(`\n✅ Can create new flow: ${canCreateFlow}`);

  // Audit logging
  await multiTenancy.logAudit({
    tenantId: tenant.tenantId,
    userId: 'user-2',
    action: 'flow:create',
    resourceType: 'flow',
    resourceId: 'flow-123',
    details: { name: 'New Flow' },
  });

  const auditLogs = await multiTenancy.getAuditLogs(tenant.tenantId, { limit: 5 });
  console.log(`\n📜 Audit logs: ${auditLogs.length} recent entries`);
  auditLogs.forEach(log => {
    console.log(`  - ${log.userId} performed ${log.action} on ${log.resourceType}`);
  });

  await cache.disconnect();
}

// ============================================================================
// Example 6: Flow Testing Framework
// ============================================================================

async function example6_FlowTesting() {
  console.log('\n🧪 Example 6: Flow Testing Framework\n');

  registerDefaultConnectors();
  const storage = createStorage();
  await storage.initialize();

  const testFramework = new FlowTestingFramework(connectorRegistry);

  // Define a test suite
  const flow: Flow = {
    flow_id: 'test-flow',
    name: 'Test Flow',
    description: 'A flow for testing',
    version: '1.0.0',
    graph: {
      nodes: [
        {
          id: 'node_1',
          type: 'trigger',
          connector_type: 'webhook',
          name: 'Webhook Trigger',
        },
        {
          id: 'node_2',
          type: 'connector',
          connector_type: 'ai-claude',
          name: 'AI Processing',
          config: {
            apiKey: '${secrets.ANTHROPIC_API_KEY}',
            operation: 'analyze',
          },
        },
      ],
      edges: [
        { from: 'node_1', to: 'node_2' },
      ],
    },
  };

  const testSuite = {
    name: 'AI Flow Test Suite',
    description: 'Tests for AI-powered flow',
    flow,
    tests: [
      {
        name: 'Valid input produces analysis',
        description: 'Test that valid input produces AI analysis',
        input: { text: 'Analyze this text' },
        assertions: [
          {
            type: 'exists' as const,
            path: 'node_2',
            message: 'AI node should produce output',
          },
          {
            type: 'contains' as const,
            path: 'node_2.response',
            expected: 'analysis',
            message: 'Response should contain analysis',
          },
        ],
        mock: {
          'ai-claude': {
            analyze: async (params: any) => ({
              response: 'Here is my analysis of the text',
              confidence: 0.95,
            }),
          },
        },
      },
      {
        name: 'Empty input returns error',
        description: 'Test that empty input is handled gracefully',
        input: { text: '' },
        assertions: [
          {
            type: 'custom' as const,
            path: 'node_2',
            customFn: (actual: any) => actual?.error !== undefined,
            message: 'Should return an error for empty input',
          },
        ],
        mock: {
          'ai-claude': {
            analyze: async (params: any) => {
              if (!params.text) {
                throw new Error('Text is required');
              }
              return { response: 'analysis' };
            },
          },
        },
      },
    ],
  };

  // Run the test suite
  const results = await testFramework.runSuite(testSuite);

  console.log('\n📊 Test Results Summary:');
  console.log(`  Total: ${results.total}`);
  console.log(`  Passed: ${results.passed}`);
  console.log(`  Failed: ${results.failed}`);
  console.log(`  Duration: ${results.duration}ms`);

  if (results.coverage) {
    console.log(`  Coverage: ${results.coverage.coveragePercentage.toFixed(2)}%`);
  }

  // Generate detailed report
  const report = testFramework.generateReport([results]);
  console.log(report);

  await storage.close();
}

// ============================================================================
// Main: Run All Examples
// ============================================================================

async function main() {
  console.log('🚀 UWG Engine - Innovation Features Examples');
  console.log('='.repeat(60));

  try {
    // Uncomment the examples you want to run

    // await example1_AIFlowGeneration();
    // await example2_TimeTravelDebugging();
    // await example3_RealtimeCollaboration();
    await example4_ResiliencePatterns();
    // await example5_MultiTenancy();
    // await example6_FlowTesting();

    console.log('\n✅ All examples completed successfully!\n');
  } catch (error: any) {
    console.error('\n❌ Error running examples:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  main();
}

export {
  example1_AIFlowGeneration,
  example2_TimeTravelDebugging,
  example3_RealtimeCollaboration,
  example4_ResiliencePatterns,
  example5_MultiTenancy,
  example6_FlowTesting,
};

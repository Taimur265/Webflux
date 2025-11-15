/**
 * Validation tests
 */

import { validateFlow, validateConnections, detectCycles } from '../validation';

describe('Flow Validation', () => {
  test('validates a simple valid flow', () => {
    const flow = {
      flow_id: 'test-1',
      name: 'Test Flow',
      description: 'A test flow',
      version: 1,
      graph: {
        pages: [],
        nodes: [
          {
            id: 'node1',
            category: 'trigger',
            type: 'manual',
            name: 'Start',
            connector: null,
            operation: null,
            params: {},
            inputs: [],
            outputs: ['result'],
            ui_hints: { x: 0, y: 0, summary: 'test' },
          },
        ],
        connections: [],
        triggers: [],
      },
      metadata: {
        owner: 'test@example.com',
        created_at: new Date().toISOString(),
        tags: [],
      },
    };

    const result = validateFlow(flow);
    expect(result.valid).toBe(true);
  });

  test('rejects flow with invalid node ID', () => {
    const flow = {
      flow_id: 'test-1',
      name: 'Test Flow',
      description: '',
      version: 1,
      graph: {
        pages: [],
        nodes: [
          {
            id: 'invalid node id!', // Invalid characters
            category: 'trigger',
            type: 'manual',
            name: 'Start',
            connector: null,
            operation: null,
            params: {},
            inputs: [],
            outputs: ['result'],
            ui_hints: { x: 0, y: 0, summary: 'test' },
          },
        ],
        connections: [],
        triggers: [],
      },
      metadata: {
        owner: 'test@example.com',
        created_at: new Date().toISOString(),
        tags: [],
      },
    };

    const result = validateFlow(flow);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });
});

describe('Connection Validation', () => {
  test('detects dangling connection references', () => {
    const flow: any = {
      flow_id: 'test',
      name: 'Test',
      version: 1,
      graph: {
        nodes: [{ id: 'node1' }],
        connections: [
          { from: 'node1', to: 'nonexistent' },
        ],
      },
    };

    const result = validateConnections(flow);
    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.message.includes('nonexistent'))).toBe(true);
  });
});

describe('Cycle Detection', () => {
  test('detects simple cycle', () => {
    const flow: any = {
      graph: {
        nodes: [
          { id: 'a', category: 'action' },
          { id: 'b', category: 'action' },
        ],
        connections: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'a' },
        ],
      },
    };

    const result = detectCycles(flow);
    expect(result.valid).toBe(false);
  });

  test('allows DAG (no cycles)', () => {
    const flow: any = {
      graph: {
        nodes: [
          { id: 'a', category: 'action' },
          { id: 'b', category: 'action' },
          { id: 'c', category: 'action' },
        ],
        connections: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
        ],
      },
    };

    const result = detectCycles(flow);
    expect(result.valid).toBe(true);
  });
});

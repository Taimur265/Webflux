/**
 * Zod validation schemas for UWG Flow JSON
 */

import { z } from 'zod';

// Base schemas
export const RetryConfigSchema = z.object({
  max_attempts: z.number().int().min(0).max(10),
  strategy: z.enum(['exponential', 'fixed', 'linear']),
  initial_delay_ms: z.number().int().positive().optional(),
  max_delay_ms: z.number().int().positive().optional(),
});

export const UIHintsSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  color: z.string().optional(),
  summary: z.string().min(1),
  icon: z.string().optional(),
});

export const PreviewSchema = z.object({
  request_preview: z.record(z.any()).nullable().optional(),
  expected_result_schema: z.record(z.any()).nullable().optional(),
});

export const NodeInputSchema = z.object({
  from: z.string().min(1),
  port: z.string().min(1),
});

export const NodeSchema = z.object({
  id: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/, 'Node ID must be alphanumeric with _ or -'),
  category: z.enum(['trigger', 'ai', 'action', 'component', 'inspector', 'publish', 'transform', 'loop']),
  type: z.string().min(1),
  name: z.string().min(1),
  connector: z.string().nullable(),
  operation: z.string().nullable(),
  params: z.record(z.any()),
  inputs: z.array(NodeInputSchema),
  outputs: z.array(z.string()),
  retry: RetryConfigSchema.nullable().optional(),
  timeout_seconds: z.number().int().positive().max(600).nullable().optional(),
  ui_hints: UIHintsSchema,
  preview: PreviewSchema.optional(),
});

export const ConnectionSchema = z.object({
  from: z.string().min(1),
  from_port: z.string().nullable().optional(),
  to: z.string().min(1),
  to_port: z.string().nullable().optional(),
  condition: z.string().nullable().optional(),
});

export const TriggerSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  config: z.record(z.any()),
  to_node: z.string().min(1),
});

export const PageSchema = z.object({
  id: z.string().min(1),
  path: z.string().regex(/^\//, 'Page path must start with /'),
  title: z.string().min(1),
  nodes: z.array(z.string()),
  meta: z.object({
    description: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    og_image: z.string().optional(),
  }).optional(),
});

export const GraphSchema = z.object({
  pages: z.array(PageSchema),
  nodes: z.array(NodeSchema),
  connections: z.array(ConnectionSchema),
  triggers: z.array(TriggerSchema),
});

export const FlowMetadataSchema = z.object({
  owner: z.string().min(1),
  created_at: z.string().datetime(),
  modified_at: z.string().datetime().nullable().optional(),
  tags: z.array(z.string()),
  version_history: z.array(z.object({
    version: z.number().int().positive(),
    timestamp: z.string().datetime(),
    author: z.string(),
    changes: z.string(),
  })).optional(),
});

export const FlowSchema = z.object({
  flow_id: z.string().nullable(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  version: z.number().int().positive(),
  graph: GraphSchema,
  metadata: FlowMetadataSchema,
});

// Validation result types
export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  warnings?: Array<{
    path: string;
    message: string;
  }>;
}

/**
 * Validates a flow against the schema
 */
export function validateFlow(flow: unknown): ValidationResult {
  try {
    FlowSchema.parse(flow);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          severity: 'error' as const,
        })),
      };
    }
    return {
      valid: false,
      errors: [{
        path: 'unknown',
        message: String(error),
        severity: 'error' as const,
      }],
    };
  }
}

/**
 * Validates connections - ensures no dangling references
 */
export function validateConnections(flow: z.infer<typeof FlowSchema>): ValidationResult {
  const nodeIds = new Set(flow.graph.nodes.map(n => n.id));
  const errors: ValidationResult['errors'] = [];

  // Check all connections reference valid nodes
  flow.graph.connections.forEach((conn, idx) => {
    if (!nodeIds.has(conn.from)) {
      errors!.push({
        path: `graph.connections[${idx}].from`,
        message: `Connection references non-existent node: ${conn.from}`,
        severity: 'error',
      });
    }
    if (!nodeIds.has(conn.to)) {
      errors!.push({
        path: `graph.connections[${idx}].to`,
        message: `Connection references non-existent node: ${conn.to}`,
        severity: 'error',
      });
    }
  });

  // Check triggers reference valid nodes
  flow.graph.triggers.forEach((trigger, idx) => {
    if (!nodeIds.has(trigger.to_node)) {
      errors!.push({
        path: `graph.triggers[${idx}].to_node`,
        message: `Trigger references non-existent node: ${trigger.to_node}`,
        severity: 'error',
      });
    }
  });

  // Check node inputs reference valid nodes
  flow.graph.nodes.forEach((node, idx) => {
    node.inputs.forEach((input, inputIdx) => {
      if (!nodeIds.has(input.from)) {
        errors!.push({
          path: `graph.nodes[${idx}].inputs[${inputIdx}].from`,
          message: `Node input references non-existent node: ${input.from}`,
          severity: 'error',
        });
      }
    });
  });

  return {
    valid: errors!.length === 0,
    errors: errors!.length > 0 ? errors : undefined,
  };
}

/**
 * Detects cycles in the action/ai/publish subgraph
 */
export function detectCycles(flow: z.infer<typeof FlowSchema>): ValidationResult {
  const actionNodes = new Set(
    flow.graph.nodes
      .filter(n => ['action', 'ai', 'publish', 'transform'].includes(n.category))
      .map(n => n.id)
  );

  const graph = new Map<string, Set<string>>();
  flow.graph.connections.forEach(conn => {
    if (actionNodes.has(conn.from) && actionNodes.has(conn.to)) {
      if (!graph.has(conn.from)) {
        graph.set(conn.from, new Set());
      }
      graph.get(conn.from)!.add(conn.to);
    }
  });

  const visited = new Set<string>();
  const recStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): boolean {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, path)) {
          return true;
        }
      } else if (recStack.has(neighbor)) {
        // Found cycle
        const cycleStart = path.indexOf(neighbor);
        cycles.push([...path.slice(cycleStart), neighbor]);
        return true;
      }
    }

    path.pop();
    recStack.delete(node);
    return false;
  }

  for (const node of actionNodes) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  if (cycles.length > 0) {
    return {
      valid: false,
      errors: cycles.map(cycle => ({
        path: 'graph.connections',
        message: `Cycle detected: ${cycle.join(' → ')}`,
        severity: 'error' as const,
      })),
    };
  }

  return { valid: true };
}

/**
 * Comprehensive flow validation
 */
export function validateFlowComprehensive(flow: unknown): ValidationResult {
  // First, validate schema
  const schemaResult = validateFlow(flow);
  if (!schemaResult.valid) {
    return schemaResult;
  }

  const typedFlow = flow as z.infer<typeof FlowSchema>;

  // Validate connections
  const connectionResult = validateConnections(typedFlow);
  if (!connectionResult.valid) {
    return connectionResult;
  }

  // Check for cycles
  const cycleResult = detectCycles(typedFlow);
  if (!cycleResult.valid) {
    return cycleResult;
  }

  return { valid: true };
}

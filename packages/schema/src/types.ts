/**
 * Core type definitions for UWG Engine
 * Unified Website Graph - Flow JSON Schema
 */

export type NodeCategory =
  | 'trigger'
  | 'ai'
  | 'action'
  | 'component'
  | 'inspector'
  | 'publish'
  | 'transform'
  | 'loop';

export type RetryStrategy = 'exponential' | 'fixed' | 'linear';

export interface RetryConfig {
  max_attempts: number;
  strategy: RetryStrategy;
  initial_delay_ms?: number;
  max_delay_ms?: number;
}

export interface UIHints {
  x: number;
  y: number;
  color?: string;
  summary: string;
  icon?: string;
}

export interface Preview {
  request_preview?: Record<string, any> | null;
  expected_result_schema?: Record<string, any> | null;
}

export interface NodeInput {
  from: string;  // node_id
  port: string;  // output name from source node
}

export interface Node {
  id: string;
  category: NodeCategory;
  type: string;
  name: string;
  connector: string | null;
  operation: string | null;
  params: Record<string, any>;
  inputs: NodeInput[];
  outputs: string[];
  retry?: RetryConfig | null;
  timeout_seconds?: number | null;
  ui_hints: UIHints;
  preview?: Preview;
}

export interface Connection {
  from: string;  // node_id
  from_port?: string | null;
  to: string;    // node_id
  to_port?: string | null;
  condition?: string | null;  // template expression
}

export interface Trigger {
  id: string;
  type: string;
  config: Record<string, any>;
  to_node: string;
}

export interface Page {
  id: string;
  path: string;
  title: string;
  nodes: string[];  // node IDs in order
  meta?: {
    description?: string;
    keywords?: string[];
    og_image?: string;
  };
}

export interface Graph {
  pages: Page[];
  nodes: Node[];
  connections: Connection[];
  triggers: Trigger[];
}

export interface FlowMetadata {
  owner: string;
  created_at: string;  // ISO8601
  modified_at?: string | null;
  tags: string[];
  version_history?: Array<{
    version: number;
    timestamp: string;
    author: string;
    changes: string;
  }>;
}

export interface Flow {
  flow_id: string | null;
  name: string;
  description: string;
  version: number;
  graph: Graph;
  metadata: FlowMetadata;
}

// Execution types
export interface ExecutionLog {
  node_id: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  started_at?: string;
  completed_at?: string;
  error?: string;
  result_preview?: any;
  attempts?: number;
}

export interface ExecutionReport {
  run_id: string;
  flow_id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  outputs: Record<string, any>;  // node_id -> output
  logs: ExecutionLog[];
  metadata: {
    trigger_type?: string;
    trigger_data?: any;
    cost_estimate?: {
      ai_tokens?: number;
      api_calls?: number;
      estimated_cost_usd?: number;
    };
  };
}

// Validation types
export interface ValidationError {
  type: 'validation_error';
  flow_id?: string;
  details: Array<{
    node_id?: string;
    field?: string;
    message: string;
    severity: 'error' | 'warning';
    advice?: string;
  }>;
  remediation?: string;
}

// Task call for runtime execution
export interface TaskCall {
  type: 'task_call';
  tool: string;
  params: Record<string, any>;
  secret_refs?: Record<string, string>;
  expected_result_schema?: Record<string, any>;
  idempotency_key?: string;
}

// Response envelope
export type UWGResponse =
  | { type: 'flow'; flow_json: Flow; human_summary: string; next_actions: string[] }
  | { type: 'validation_error'; error: ValidationError }
  | { type: 'execution_report'; report: ExecutionReport }
  | TaskCall;

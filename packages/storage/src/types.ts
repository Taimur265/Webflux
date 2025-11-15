/**
 * Storage layer types
 */

import type { Flow, ExecutionReport } from '@uwg/schema';

export interface FlowRecord {
  flow_id: string;
  name: string;
  description: string;
  version: number;
  flow_json: string; // JSON stringified
  owner: string;
  created_at: string;
  modified_at?: string;
  tags: string; // JSON array stringified
}

export interface ExecutionRecord {
  exec_id: string;
  flow_id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  trigger_type?: string;
  trigger_data?: string; // JSON stringified
  outputs: string; // JSON stringified
  logs: string; // JSON stringified
  error?: string;
}

export interface StorageOptions {
  database_path?: string;
  in_memory?: boolean;
}

export interface IStorage {
  /**
   * Initialize the storage (create tables, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Save a flow
   */
  saveFlow(flow: Flow): Promise<string>;

  /**
   * Load a flow by ID
   */
  loadFlow(flowId: string): Promise<Flow | null>;

  /**
   * List all flows
   */
  listFlows(options?: {
    owner?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Flow[]>;

  /**
   * Delete a flow
   */
  deleteFlow(flowId: string): Promise<boolean>;

  /**
   * Save execution report
   */
  saveExecution(report: ExecutionReport): Promise<string>;

  /**
   * Load execution report
   */
  loadExecution(execId: string): Promise<ExecutionReport | null>;

  /**
   * List executions for a flow
   */
  listExecutions(flowId: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<ExecutionReport[]>;

  /**
   * Get flow version history
   */
  getFlowHistory(flowId: string): Promise<Flow[]>;

  /**
   * Close database connection
   */
  close(): Promise<void>;
}

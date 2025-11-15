/**
 * PostgreSQL storage implementation - Scalable production storage
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import type { Flow, ExecutionReport } from '@uwg/schema';
import type { IStorage, StorageOptions, FlowRecord, ExecutionRecord } from './types';

export interface PostgresStorageOptions extends StorageOptions {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  max?: number; // Connection pool size
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

export class PostgresStorage implements IStorage {
  private pool: Pool;
  private connected: boolean = false;

  constructor(options: PostgresStorageOptions = {}) {
    const poolConfig: PoolConfig = {
      host: options.host || process.env.POSTGRES_HOST || 'localhost',
      port: options.port || parseInt(process.env.POSTGRES_PORT || '5432'),
      database: options.database || process.env.POSTGRES_DB || 'uwg',
      user: options.user || process.env.POSTGRES_USER || 'postgres',
      password: options.password || process.env.POSTGRES_PASSWORD,
      max: options.max || 20, // Maximum pool size
      idleTimeoutMillis: options.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: options.connectionTimeoutMillis || 2000,
    };

    // SSL configuration for production
    if (options.ssl !== undefined) {
      poolConfig.ssl = options.ssl;
    } else if (process.env.POSTGRES_SSL === 'true') {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    this.pool = new Pool(poolConfig);

    this.pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err);
    });

    this.pool.on('connect', () => {
      this.connected = true;
    });
  }

  async initialize(): Promise<void> {
    const client = await this.pool.connect();

    try {
      // Create flows table with JSONB for efficient querying
      await client.query(`
        CREATE TABLE IF NOT EXISTS flows (
          flow_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          version INTEGER NOT NULL,
          flow_json JSONB NOT NULL,
          owner TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          modified_at TIMESTAMPTZ,
          tags JSONB DEFAULT '[]'::jsonb,
          is_active BOOLEAN DEFAULT true
        )
      `);

      // Create executions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS executions (
          exec_id TEXT PRIMARY KEY,
          flow_id TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TIMESTAMPTZ NOT NULL,
          completed_at TIMESTAMPTZ,
          trigger_type TEXT,
          trigger_data JSONB,
          outputs JSONB,
          logs JSONB,
          error TEXT,
          duration_ms INTEGER,
          FOREIGN KEY (flow_id) REFERENCES flows(flow_id) ON DELETE CASCADE
        )
      `);

      // Create flow versions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS flow_versions (
          version_id TEXT PRIMARY KEY,
          flow_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          flow_json JSONB NOT NULL,
          author TEXT NOT NULL,
          changes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          FOREIGN KEY (flow_id) REFERENCES flows(flow_id) ON DELETE CASCADE
        )
      `);

      // Create indexes for efficient queries
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_flows_owner ON flows(owner);
        CREATE INDEX IF NOT EXISTS idx_flows_tags ON flows USING GIN(tags);
        CREATE INDEX IF NOT EXISTS idx_flows_active ON flows(is_active) WHERE is_active = true;
        CREATE INDEX IF NOT EXISTS idx_flows_created_at ON flows(created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_executions_flow_id ON executions(flow_id);
        CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
        CREATE INDEX IF NOT EXISTS idx_executions_started_at ON executions(started_at DESC);
        CREATE INDEX IF NOT EXISTS idx_executions_flow_status ON executions(flow_id, status);

        CREATE INDEX IF NOT EXISTS idx_flow_versions_flow_id ON flow_versions(flow_id, version DESC);
      `);

      // Create materialized view for flow statistics
      await client.query(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS flow_stats AS
        SELECT
          f.flow_id,
          f.name,
          COUNT(e.exec_id) as total_executions,
          COUNT(CASE WHEN e.status = 'completed' THEN 1 END) as successful_executions,
          COUNT(CASE WHEN e.status = 'failed' THEN 1 END) as failed_executions,
          AVG(e.duration_ms) as avg_duration_ms,
          MAX(e.started_at) as last_execution_at
        FROM flows f
        LEFT JOIN executions e ON f.flow_id = e.flow_id
        WHERE f.is_active = true
        GROUP BY f.flow_id, f.name;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_flow_stats_flow_id ON flow_stats(flow_id);
      `);

      console.log('PostgreSQL schema initialized successfully');
    } finally {
      client.release();
    }
  }

  async saveFlow(flow: Flow): Promise<string> {
    const flowId = flow.flow_id || `flow_${uuidv4()}`;
    const now = new Date().toISOString();

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Check if flow exists
      const existingResult = await client.query(
        'SELECT flow_id, version, flow_json FROM flows WHERE flow_id = $1',
        [flowId]
      );

      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];

        // Save current version to history
        await client.query(
          `INSERT INTO flow_versions (version_id, flow_id, version, flow_json, author, changes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            `version_${uuidv4()}`,
            flowId,
            existing.version,
            existing.flow_json,
            flow.metadata.owner,
            `Updated to version ${flow.version}`,
            now,
          ]
        );

        // Update flow
        await client.query(
          `UPDATE flows
           SET name = $1, description = $2, version = $3, flow_json = $4,
               modified_at = $5, tags = $6
           WHERE flow_id = $7`,
          [
            flow.name,
            flow.description,
            flow.version,
            JSON.stringify(flow),
            now,
            JSON.stringify(flow.metadata.tags),
            flowId,
          ]
        );
      } else {
        // Insert new flow
        await client.query(
          `INSERT INTO flows (flow_id, name, description, version, flow_json, owner, created_at, tags)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            flowId,
            flow.name,
            flow.description,
            flow.version,
            JSON.stringify(flow),
            flow.metadata.owner,
            flow.metadata.created_at,
            JSON.stringify(flow.metadata.tags),
          ]
        );
      }

      await client.query('COMMIT');
      return flowId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async loadFlow(flowId: string): Promise<Flow | null> {
    const result = await this.pool.query(
      'SELECT flow_json FROM flows WHERE flow_id = $1 AND is_active = true',
      [flowId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].flow_json;
  }

  async listFlows(options: {
    owner?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  } = {}): Promise<Flow[]> {
    let query = 'SELECT flow_json FROM flows WHERE is_active = true';
    const params: any[] = [];
    let paramIndex = 1;

    if (options.owner) {
      query += ` AND owner = $${paramIndex++}`;
      params.push(options.owner);
    }

    if (options.tags && options.tags.length > 0) {
      // Use JSONB operators for efficient tag matching
      query += ` AND tags ?| $${paramIndex++}`;
      params.push(options.tags);
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }

    if (options.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(options.offset);
    }

    const result = await this.pool.query(query, params);
    return result.rows.map(row => row.flow_json);
  }

  async deleteFlow(flowId: string): Promise<boolean> {
    // Soft delete
    const result = await this.pool.query(
      'UPDATE flows SET is_active = false WHERE flow_id = $1',
      [flowId]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  async saveExecution(report: ExecutionReport): Promise<string> {
    const execId = report.run_id;
    const durationMs = report.completed_at
      ? new Date(report.completed_at).getTime() - new Date(report.started_at).getTime()
      : null;

    await this.pool.query(
      `INSERT INTO executions
       (exec_id, flow_id, status, started_at, completed_at, trigger_type, trigger_data, outputs, logs, error, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (exec_id) DO UPDATE SET
         status = EXCLUDED.status,
         completed_at = EXCLUDED.completed_at,
         outputs = EXCLUDED.outputs,
         logs = EXCLUDED.logs,
         error = EXCLUDED.error,
         duration_ms = EXCLUDED.duration_ms`,
      [
        execId,
        report.flow_id,
        report.status,
        report.started_at,
        report.completed_at || null,
        report.metadata.trigger_type || null,
        report.metadata.trigger_data ? JSON.stringify(report.metadata.trigger_data) : null,
        JSON.stringify(report.outputs),
        JSON.stringify(report.logs),
        null,
        durationMs,
      ]
    );

    return execId;
  }

  async loadExecution(execId: string): Promise<ExecutionReport | null> {
    const result = await this.pool.query(
      'SELECT * FROM executions WHERE exec_id = $1',
      [execId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const record = result.rows[0];

    return {
      run_id: record.exec_id,
      flow_id: record.flow_id,
      status: record.status,
      started_at: record.started_at,
      completed_at: record.completed_at,
      outputs: record.outputs,
      logs: record.logs,
      metadata: {
        trigger_type: record.trigger_type,
        trigger_data: record.trigger_data,
      },
    };
  }

  async listExecutions(flowId: string, options: {
    limit?: number;
    offset?: number;
    status?: string;
  } = {}): Promise<ExecutionReport[]> {
    let query = 'SELECT * FROM executions WHERE flow_id = $1';
    const params: any[] = [flowId];
    let paramIndex = 2;

    if (options.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(options.status);
    }

    query += ' ORDER BY started_at DESC';

    if (options.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }

    if (options.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(options.offset);
    }

    const result = await this.pool.query(query, params);

    return result.rows.map(record => ({
      run_id: record.exec_id,
      flow_id: record.flow_id,
      status: record.status,
      started_at: record.started_at,
      completed_at: record.completed_at,
      outputs: record.outputs,
      logs: record.logs,
      metadata: {
        trigger_type: record.trigger_type,
        trigger_data: record.trigger_data,
      },
    }));
  }

  async getFlowHistory(flowId: string): Promise<Flow[]> {
    const result = await this.pool.query(
      `SELECT flow_json FROM flow_versions
       WHERE flow_id = $1
       ORDER BY version DESC`,
      [flowId]
    );

    return result.rows.map(row => row.flow_json);
  }

  async getFlowStats(flowId: string): Promise<any> {
    const result = await this.pool.query(
      'SELECT * FROM flow_stats WHERE flow_id = $1',
      [flowId]
    );

    return result.rows[0] || null;
  }

  async refreshStats(): Promise<void> {
    await this.pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY flow_stats');
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.connected = false;
  }

  // Additional PostgreSQL-specific optimizations
  async vacuum(): Promise<void> {
    await this.pool.query('VACUUM ANALYZE flows, executions, flow_versions');
  }

  async getPoolStatus(): Promise<{
    total: number;
    idle: number;
    waiting: number;
  }> {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }
}

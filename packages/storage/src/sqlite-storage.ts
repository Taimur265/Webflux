/**
 * SQLite storage implementation
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { Flow, ExecutionReport } from '@uwg/schema';
import type { IStorage, StorageOptions, FlowRecord, ExecutionRecord } from './types';

export class SQLiteStorage implements IStorage {
  private db: Database.Database;

  constructor(options: StorageOptions = {}) {
    const dbPath = options.in_memory ? ':memory:' : (options.database_path || './uwg.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
  }

  async initialize(): Promise<void> {
    // Create flows table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS flows (
        flow_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        version INTEGER NOT NULL,
        flow_json TEXT NOT NULL,
        owner TEXT NOT NULL,
        created_at TEXT NOT NULL,
        modified_at TEXT,
        tags TEXT
      )
    `);

    // Create executions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS executions (
        exec_id TEXT PRIMARY KEY,
        flow_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        trigger_type TEXT,
        trigger_data TEXT,
        outputs TEXT,
        logs TEXT,
        error TEXT,
        FOREIGN KEY (flow_id) REFERENCES flows(flow_id) ON DELETE CASCADE
      )
    `);

    // Create flow versions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS flow_versions (
        version_id TEXT PRIMARY KEY,
        flow_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        flow_json TEXT NOT NULL,
        author TEXT NOT NULL,
        changes TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (flow_id) REFERENCES flows(flow_id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_flows_owner ON flows(owner);
      CREATE INDEX IF NOT EXISTS idx_executions_flow_id ON executions(flow_id);
      CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
      CREATE INDEX IF NOT EXISTS idx_flow_versions_flow_id ON flow_versions(flow_id);
    `);
  }

  async saveFlow(flow: Flow): Promise<string> {
    const flowId = flow.flow_id || `flow_${uuidv4()}`;
    const now = new Date().toISOString();

    // Check if flow exists
    const existing = this.db.prepare('SELECT flow_id, version FROM flows WHERE flow_id = ?').get(flowId) as any;

    if (existing) {
      // Save current version to history
      const currentFlow = this.db.prepare('SELECT * FROM flows WHERE flow_id = ?').get(flowId) as FlowRecord;

      this.db.prepare(`
        INSERT INTO flow_versions (version_id, flow_id, version, flow_json, author, changes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `version_${uuidv4()}`,
        flowId,
        currentFlow.version,
        currentFlow.flow_json,
        currentFlow.owner,
        `Updated to version ${flow.version}`,
        now
      );

      // Update flow
      this.db.prepare(`
        UPDATE flows
        SET name = ?, description = ?, version = ?, flow_json = ?, modified_at = ?, tags = ?
        WHERE flow_id = ?
      `).run(
        flow.name,
        flow.description,
        flow.version,
        JSON.stringify(flow),
        now,
        JSON.stringify(flow.metadata.tags),
        flowId
      );
    } else {
      // Insert new flow
      this.db.prepare(`
        INSERT INTO flows (flow_id, name, description, version, flow_json, owner, created_at, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        flowId,
        flow.name,
        flow.description,
        flow.version,
        JSON.stringify(flow),
        flow.metadata.owner,
        flow.metadata.created_at,
        JSON.stringify(flow.metadata.tags)
      );
    }

    return flowId;
  }

  async loadFlow(flowId: string): Promise<Flow | null> {
    const record = this.db.prepare('SELECT flow_json FROM flows WHERE flow_id = ?').get(flowId) as FlowRecord | undefined;

    if (!record) {
      return null;
    }

    return JSON.parse(record.flow_json);
  }

  async listFlows(options: {
    owner?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  } = {}): Promise<Flow[]> {
    let query = 'SELECT flow_json FROM flows WHERE 1=1';
    const params: any[] = [];

    if (options.owner) {
      query += ' AND owner = ?';
      params.push(options.owner);
    }

    if (options.tags && options.tags.length > 0) {
      // Simple tag matching - in production, consider full-text search
      const tagConditions = options.tags.map(() => 'tags LIKE ?').join(' OR ');
      query += ` AND (${tagConditions})`;
      options.tags.forEach(tag => params.push(`%"${tag}"%`));
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const records = this.db.prepare(query).all(...params) as FlowRecord[];
    return records.map(r => JSON.parse(r.flow_json));
  }

  async deleteFlow(flowId: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM flows WHERE flow_id = ?').run(flowId);
    return result.changes > 0;
  }

  async saveExecution(report: ExecutionReport): Promise<string> {
    const execId = report.run_id;

    this.db.prepare(`
      INSERT OR REPLACE INTO executions
      (exec_id, flow_id, status, started_at, completed_at, trigger_type, trigger_data, outputs, logs, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      execId,
      report.flow_id,
      report.status,
      report.started_at,
      report.completed_at || null,
      report.metadata.trigger_type || null,
      report.metadata.trigger_data ? JSON.stringify(report.metadata.trigger_data) : null,
      JSON.stringify(report.outputs),
      JSON.stringify(report.logs),
      null
    );

    return execId;
  }

  async loadExecution(execId: string): Promise<ExecutionReport | null> {
    const record = this.db.prepare('SELECT * FROM executions WHERE exec_id = ?').get(execId) as ExecutionRecord | undefined;

    if (!record) {
      return null;
    }

    return {
      run_id: record.exec_id,
      flow_id: record.flow_id,
      status: record.status,
      started_at: record.started_at,
      completed_at: record.completed_at,
      outputs: JSON.parse(record.outputs),
      logs: JSON.parse(record.logs),
      metadata: {
        trigger_type: record.trigger_type,
        trigger_data: record.trigger_data ? JSON.parse(record.trigger_data) : undefined,
      },
    };
  }

  async listExecutions(flowId: string, options: {
    limit?: number;
    offset?: number;
  } = {}): Promise<ExecutionReport[]> {
    let query = 'SELECT * FROM executions WHERE flow_id = ? ORDER BY started_at DESC';
    const params: any[] = [flowId];

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const records = this.db.prepare(query).all(...params) as ExecutionRecord[];

    return records.map(record => ({
      run_id: record.exec_id,
      flow_id: record.flow_id,
      status: record.status,
      started_at: record.started_at,
      completed_at: record.completed_at,
      outputs: JSON.parse(record.outputs),
      logs: JSON.parse(record.logs),
      metadata: {
        trigger_type: record.trigger_type,
        trigger_data: record.trigger_data ? JSON.parse(record.trigger_data) : undefined,
      },
    }));
  }

  async getFlowHistory(flowId: string): Promise<Flow[]> {
    const records = this.db.prepare(`
      SELECT flow_json FROM flow_versions
      WHERE flow_id = ?
      ORDER BY version DESC
    `).all(flowId) as Array<{ flow_json: string }>;

    return records.map(r => JSON.parse(r.flow_json));
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

/**
 * Time-Travel Debugger
 * Record and replay flow executions with step-by-step debugging
 */

import type { Flow, ExecutionReport, Node } from '@uwg/schema';
import { RedisCache } from '../../storage/src/redis-cache';

export interface DebugSnapshot {
  timestamp: number;
  nodeId: string;
  nodeName: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  state: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
  stackTrace?: string[];
  memoryUsage?: NodeJS.MemoryUsage;
}

export interface DebugSession {
  sessionId: string;
  flowId: string;
  flowName: string;
  startedAt: string;
  completedAt?: string;
  snapshots: DebugSnapshot[];
  breakpoints: string[]; // Node IDs
  variables: Record<string, any>;
  status: 'recording' | 'paused' | 'completed' | 'failed';
}

export interface ReplayOptions {
  speed?: number; // 1.0 = normal, 0.5 = half speed, 2.0 = double speed
  breakpoints?: string[]; // Node IDs to pause at
  stopAtError?: boolean;
  stepMode?: boolean; // Pause after each node
}

export class TimeTravelDebugger {
  private cache: RedisCache;
  private sessions: Map<string, DebugSession> = new Map();

  constructor(cache?: RedisCache) {
    this.cache = cache || new RedisCache({
      keyPrefix: 'uwg:debug:',
      ttl: 86400, // 24 hours
    });
  }

  async initialize(): Promise<void> {
    await this.cache.connect();
  }

  /**
   * Start a debug session
   */
  async startSession(flow: Flow): Promise<string> {
    const sessionId = `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session: DebugSession = {
      sessionId,
      flowId: flow.flow_id || 'unknown',
      flowName: flow.name,
      startedAt: new Date().toISOString(),
      snapshots: [],
      breakpoints: [],
      variables: {},
      status: 'recording',
    };

    this.sessions.set(sessionId, session);
    await this.cache.set(`session:${sessionId}`, session, 86400);

    console.log(`🐛 Debug session started: ${sessionId}`);
    return sessionId;
  }

  /**
   * Record a snapshot during execution
   */
  async recordSnapshot(
    sessionId: string,
    node: Node,
    inputs: Record<string, any>,
    outputs: Record<string, any>,
    state: DebugSnapshot['state'],
    error?: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    const snapshot: DebugSnapshot = {
      timestamp: Date.now(),
      nodeId: node.id,
      nodeName: node.name,
      inputs,
      outputs,
      state,
      error,
      memoryUsage: process.memoryUsage(),
    };

    // Calculate duration if previous snapshot exists
    const previousSnapshot = session.snapshots[session.snapshots.length - 1];
    if (previousSnapshot && state === 'success') {
      snapshot.duration = snapshot.timestamp - previousSnapshot.timestamp;
    }

    session.snapshots.push(snapshot);

    // Save to cache
    await this.cache.set(`session:${sessionId}`, session, 86400);

    // Check for breakpoints
    if (session.breakpoints.includes(node.id)) {
      session.status = 'paused';
      console.log(`⏸️  Breakpoint hit at node: ${node.name}`);
    }
  }

  /**
   * End a debug session
   */
  async endSession(sessionId: string, status: 'completed' | 'failed'): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.completedAt = new Date().toISOString();
    session.status = status;

    await this.cache.set(`session:${sessionId}`, session, 86400);

    console.log(`🛑 Debug session ended: ${sessionId} (${status})`);
  }

  /**
   * Replay a debug session
   */
  async replay(
    sessionId: string,
    options: ReplayOptions = {},
    onSnapshot?: (snapshot: DebugSnapshot, index: number) => Promise<void>
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    const speed = options.speed || 1.0;
    const breakpoints = new Set(options.breakpoints || []);

    console.log(`▶️  Replaying session: ${sessionId} (${session.snapshots.length} snapshots)`);

    for (let i = 0; i < session.snapshots.length; i++) {
      const snapshot = session.snapshots[i];
      const nextSnapshot = session.snapshots[i + 1];

      // Execute snapshot callback
      if (onSnapshot) {
        await onSnapshot(snapshot, i);
      }

      // Log snapshot
      this.logSnapshot(snapshot, i);

      // Stop at error if requested
      if (options.stopAtError && snapshot.state === 'failed') {
        console.log(`🛑 Stopped at error in node: ${snapshot.nodeName}`);
        break;
      }

      // Pause at breakpoint
      if (breakpoints.has(snapshot.nodeId)) {
        console.log(`⏸️  Paused at breakpoint: ${snapshot.nodeName}`);
        await this.waitForContinue();
      }

      // Pause in step mode
      if (options.stepMode) {
        await this.waitForContinue();
      }

      // Wait for next snapshot (time-delayed replay)
      if (nextSnapshot && !options.stepMode) {
        const delay = (nextSnapshot.timestamp - snapshot.timestamp) / speed;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.log(`✅ Replay completed`);
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<DebugSession | null> {
    // Try memory first
    let session = this.sessions.get(sessionId);
    if (session) return session;

    // Try cache
    session = await this.cache.get(`session:${sessionId}`);
    if (session) {
      this.sessions.set(sessionId, session);
    }

    return session;
  }

  /**
   * List all debug sessions
   */
  async listSessions(flowId?: string): Promise<DebugSession[]> {
    const keys = await this.cache.keys('session:*');
    const sessions: DebugSession[] = [];

    for (const key of keys) {
      const session = await this.cache.get<DebugSession>(key);
      if (session && (!flowId || session.flowId === flowId)) {
        sessions.push(session);
      }
    }

    return sessions.sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  /**
   * Add breakpoint
   */
  async addBreakpoint(sessionId: string, nodeId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    if (!session.breakpoints.includes(nodeId)) {
      session.breakpoints.push(nodeId);
      await this.cache.set(`session:${sessionId}`, session, 86400);
      console.log(`🔴 Breakpoint added at node: ${nodeId}`);
    }
  }

  /**
   * Remove breakpoint
   */
  async removeBreakpoint(sessionId: string, nodeId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.breakpoints = session.breakpoints.filter(id => id !== nodeId);
    await this.cache.set(`session:${sessionId}`, session, 86400);
    console.log(`⚪ Breakpoint removed from node: ${nodeId}`);
  }

  /**
   * Get snapshot at specific point in time
   */
  async getSnapshotAtTime(sessionId: string, timestamp: number): Promise<DebugSnapshot | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    // Find snapshot closest to timestamp
    let closest: DebugSnapshot | null = null;
    let minDiff = Infinity;

    for (const snapshot of session.snapshots) {
      const diff = Math.abs(snapshot.timestamp - timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closest = snapshot;
      }
    }

    return closest;
  }

  /**
   * Get execution timeline
   */
  async getTimeline(sessionId: string): Promise<{
    totalDuration: number;
    nodeTimings: Array<{
      nodeId: string;
      nodeName: string;
      startTime: number;
      endTime: number;
      duration: number;
      percentage: number;
    }>;
  }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    const snapshots = session.snapshots;
    if (snapshots.length === 0) {
      return { totalDuration: 0, nodeTimings: [] };
    }

    const startTime = snapshots[0].timestamp;
    const endTime = snapshots[snapshots.length - 1].timestamp;
    const totalDuration = endTime - startTime;

    const nodeTimings = snapshots
      .filter(s => s.duration)
      .map(s => ({
        nodeId: s.nodeId,
        nodeName: s.nodeName,
        startTime: s.timestamp - startTime,
        endTime: s.timestamp - startTime + (s.duration || 0),
        duration: s.duration || 0,
        percentage: ((s.duration || 0) / totalDuration) * 100,
      }));

    return { totalDuration, nodeTimings };
  }

  /**
   * Compare two debug sessions
   */
  async compareSessions(sessionId1: string, sessionId2: string): Promise<{
    differences: Array<{
      nodeId: string;
      property: string;
      session1Value: any;
      session2Value: any;
    }>;
    performanceDiff: {
      session1Duration: number;
      session2Duration: number;
      improvement: number;
    };
  }> {
    const session1 = await this.getSession(sessionId1);
    const session2 = await this.getSession(sessionId2);

    if (!session1 || !session2) {
      throw new Error('One or both sessions not found');
    }

    const differences: any[] = [];

    // Compare snapshots
    const maxLength = Math.max(session1.snapshots.length, session2.snapshots.length);

    for (let i = 0; i < maxLength; i++) {
      const snap1 = session1.snapshots[i];
      const snap2 = session2.snapshots[i];

      if (!snap1 || !snap2) {
        differences.push({
          nodeId: snap1?.nodeId || snap2?.nodeId,
          property: 'existence',
          session1Value: !!snap1,
          session2Value: !!snap2,
        });
        continue;
      }

      // Compare outputs
      if (JSON.stringify(snap1.outputs) !== JSON.stringify(snap2.outputs)) {
        differences.push({
          nodeId: snap1.nodeId,
          property: 'outputs',
          session1Value: snap1.outputs,
          session2Value: snap2.outputs,
        });
      }

      // Compare duration
      if (snap1.duration !== snap2.duration) {
        differences.push({
          nodeId: snap1.nodeId,
          property: 'duration',
          session1Value: snap1.duration,
          session2Value: snap2.duration,
        });
      }
    }

    // Calculate performance difference
    const timeline1 = await this.getTimeline(sessionId1);
    const timeline2 = await this.getTimeline(sessionId2);

    const performanceDiff = {
      session1Duration: timeline1.totalDuration,
      session2Duration: timeline2.totalDuration,
      improvement: ((timeline1.totalDuration - timeline2.totalDuration) / timeline1.totalDuration) * 100,
    };

    return { differences, performanceDiff };
  }

  /**
   * Export debug session for analysis
   */
  async exportSession(sessionId: string): Promise<string> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    const timeline = await this.getTimeline(sessionId);

    return JSON.stringify({
      session,
      timeline,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  /**
   * Delete debug session
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    await this.cache.del(`session:${sessionId}`);
    console.log(`🗑️  Debug session deleted: ${sessionId}`);
  }

  /**
   * Log snapshot to console
   */
  private logSnapshot(snapshot: DebugSnapshot, index: number): void {
    const icon = snapshot.state === 'success' ? '✅' :
                 snapshot.state === 'failed' ? '❌' :
                 snapshot.state === 'running' ? '⏳' : '⏸️';

    console.log(`${icon} [${index}] ${snapshot.nodeName} (${snapshot.duration || 0}ms)`);

    if (snapshot.error) {
      console.error(`   Error: ${snapshot.error}`);
    }

    if (snapshot.memoryUsage) {
      const heapMB = (snapshot.memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
      console.log(`   Memory: ${heapMB} MB`);
    }
  }

  /**
   * Wait for user to continue (interactive debugging)
   */
  private async waitForContinue(): Promise<void> {
    // In a real implementation, this would wait for user input
    // For now, just a small delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Clean up old sessions
   */
  async cleanup(olderThanHours: number = 24): Promise<number> {
    const cutoff = Date.now() - (olderThanHours * 60 * 60 * 1000);
    const sessions = await this.listSessions();
    let deleted = 0;

    for (const session of sessions) {
      const sessionTime = new Date(session.startedAt).getTime();
      if (sessionTime < cutoff) {
        await this.deleteSession(session.sessionId);
        deleted++;
      }
    }

    console.log(`🧹 Cleaned up ${deleted} old debug sessions`);
    return deleted;
  }
}

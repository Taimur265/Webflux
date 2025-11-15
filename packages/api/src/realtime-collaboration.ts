/**
 * Real-Time Collaboration
 * WebSocket-based multi-user flow editing with conflict resolution
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import type { Flow, Node } from '@uwg/schema';
import { RedisCache } from '../../storage/src/redis-cache';

export interface CollaborationUser {
  userId: string;
  username: string;
  color: string;
  cursor?: { x: number; y: number };
  selectedNodes?: string[];
}

export interface FlowEdit {
  editId: string;
  userId: string;
  timestamp: number;
  type: 'node:add' | 'node:update' | 'node:delete' | 'edge:add' | 'edge:delete' | 'flow:update';
  payload: any;
  flowId: string;
}

export interface CollaborationSession {
  flowId: string;
  users: Map<string, CollaborationUser>;
  edits: FlowEdit[];
  locks: Map<string, string>; // nodeId -> userId
  version: number;
}

export class RealtimeCollaboration {
  private wss: WebSocketServer;
  private sessions: Map<string, CollaborationSession> = new Map();
  private connections: Map<string, WebSocket> = new Map(); // userId -> WebSocket
  private cache: RedisCache;

  constructor(server: any, cache?: RedisCache) {
    this.wss = new WebSocketServer({ server });
    this.cache = cache || new RedisCache({
      keyPrefix: 'uwg:collab:',
    });

    this.setupWebSocket();
  }

  async initialize(): Promise<void> {
    await this.cache.connect();
    console.log('🔌 Real-time collaboration initialized');
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket, request) => {
      const userId = this.extractUserId(request);

      console.log(`👤 User connected: ${userId}`);

      // Handle messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(userId, message, ws);
        } catch (error) {
          console.error('WebSocket message error:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        this.handleDisconnect(userId);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for user ${userId}:`, error);
      });
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(userId: string, message: any, ws: WebSocket): Promise<void> {
    switch (message.type) {
      case 'join':
        await this.handleJoin(userId, message.flowId, message.user, ws);
        break;

      case 'leave':
        await this.handleLeave(userId, message.flowId);
        break;

      case 'edit':
        await this.handleEdit(userId, message.flowId, message.edit);
        break;

      case 'cursor':
        await this.handleCursorMove(userId, message.flowId, message.position);
        break;

      case 'lock':
        await this.handleLock(userId, message.flowId, message.nodeId);
        break;

      case 'unlock':
        await this.handleUnlock(userId, message.flowId, message.nodeId);
        break;

      case 'ping':
        this.send(ws, { type: 'pong', timestamp: Date.now() });
        break;

      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle user joining a flow session
   */
  private async handleJoin(
    userId: string,
    flowId: string,
    user: CollaborationUser,
    ws: WebSocket
  ): Promise<void> {
    // Get or create session
    let session = this.sessions.get(flowId);

    if (!session) {
      session = {
        flowId,
        users: new Map(),
        edits: [],
        locks: new Map(),
        version: 0,
      };
      this.sessions.set(flowId, session);
    }

    // Add user to session
    session.users.set(userId, { ...user, userId });
    this.connections.set(userId, ws);

    // Load session from cache if exists
    const cachedSession = await this.cache.get<CollaborationSession>(`session:${flowId}`);
    if (cachedSession) {
      session.version = cachedSession.version;
      session.edits = cachedSession.edits;
    }

    // Send current state to new user
    this.send(ws, {
      type: 'joined',
      flowId,
      users: Array.from(session.users.values()),
      locks: Object.fromEntries(session.locks),
      version: session.version,
    });

    // Notify other users
    this.broadcast(flowId, {
      type: 'user:joined',
      user: session.users.get(userId),
    }, userId);

    console.log(`👤 User ${user.username} joined flow ${flowId}`);
  }

  /**
   * Handle user leaving a flow session
   */
  private async handleLeave(userId: string, flowId: string): Promise<void> {
    const session = this.sessions.get(flowId);
    if (!session) return;

    // Release all locks held by user
    for (const [nodeId, lockUserId] of session.locks.entries()) {
      if (lockUserId === userId) {
        session.locks.delete(nodeId);
      }
    }

    // Remove user from session
    session.users.delete(userId);
    this.connections.delete(userId);

    // Notify other users
    this.broadcast(flowId, {
      type: 'user:left',
      userId,
    });

    // Clean up empty sessions
    if (session.users.size === 0) {
      await this.cache.set(`session:${flowId}`, session, 3600);
      this.sessions.delete(flowId);
    }

    console.log(`👋 User ${userId} left flow ${flowId}`);
  }

  /**
   * Handle flow edit
   */
  private async handleEdit(userId: string, flowId: string, edit: Partial<FlowEdit>): Promise<void> {
    const session = this.sessions.get(flowId);
    if (!session) {
      return;
    }

    // Create full edit object
    const fullEdit: FlowEdit = {
      editId: `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      timestamp: Date.now(),
      type: edit.type as FlowEdit['type'],
      payload: edit.payload,
      flowId,
    };

    // Check for conflicts
    const conflict = await this.checkConflict(session, fullEdit);
    if (conflict) {
      // Send conflict notification to user
      const ws = this.connections.get(userId);
      if (ws) {
        this.send(ws, {
          type: 'conflict',
          edit: fullEdit,
          conflict,
        });
      }
      return;
    }

    // Apply edit
    session.edits.push(fullEdit);
    session.version++;

    // Save to cache
    await this.cache.set(`session:${flowId}`, session, 3600);

    // Broadcast to all users
    this.broadcast(flowId, {
      type: 'edit',
      edit: fullEdit,
      version: session.version,
    });

    // Publish to Redis for cross-server sync
    await this.cache.publish(`flow:${flowId}:edits`, fullEdit);
  }

  /**
   * Handle cursor movement
   */
  private async handleCursorMove(
    userId: string,
    flowId: string,
    position: { x: number; y: number }
  ): Promise<void> {
    const session = this.sessions.get(flowId);
    if (!session) return;

    const user = session.users.get(userId);
    if (!user) return;

    user.cursor = position;

    // Broadcast cursor position (throttled)
    this.broadcast(flowId, {
      type: 'cursor:move',
      userId,
      position,
    }, userId);
  }

  /**
   * Handle node lock request
   */
  private async handleLock(userId: string, flowId: string, nodeId: string): Promise<void> {
    const session = this.sessions.get(flowId);
    if (!session) return;

    const currentLock = session.locks.get(nodeId);

    if (currentLock && currentLock !== userId) {
      // Node is locked by someone else
      const ws = this.connections.get(userId);
      if (ws) {
        this.send(ws, {
          type: 'lock:denied',
          nodeId,
          lockedBy: currentLock,
        });
      }
      return;
    }

    // Grant lock
    session.locks.set(nodeId, userId);

    // Notify all users
    this.broadcast(flowId, {
      type: 'lock:acquired',
      nodeId,
      userId,
    });
  }

  /**
   * Handle node unlock request
   */
  private async handleUnlock(userId: string, flowId: string, nodeId: string): Promise<void> {
    const session = this.sessions.get(flowId);
    if (!session) return;

    const currentLock = session.locks.get(nodeId);

    if (currentLock === userId) {
      session.locks.delete(nodeId);

      // Notify all users
      this.broadcast(flowId, {
        type: 'lock:released',
        nodeId,
        userId,
      });
    }
  }

  /**
   * Handle user disconnect
   */
  private handleDisconnect(userId: string): void {
    console.log(`🔌 User disconnected: ${userId}`);

    // Find and remove user from all sessions
    for (const [flowId, session] of this.sessions.entries()) {
      if (session.users.has(userId)) {
        this.handleLeave(userId, flowId);
      }
    }

    this.connections.delete(userId);
  }

  /**
   * Check for edit conflicts
   */
  private async checkConflict(
    session: CollaborationSession,
    edit: FlowEdit
  ): Promise<string | null> {
    // Check if node is locked by someone else
    if (edit.type.startsWith('node:') && edit.payload.nodeId) {
      const lock = session.locks.get(edit.payload.nodeId);
      if (lock && lock !== edit.userId) {
        return `Node is locked by another user`;
      }
    }

    // Check for simultaneous edits to same node
    const recentEdits = session.edits.filter(
      e => e.timestamp > Date.now() - 1000 && // Last 1 second
           e.type === edit.type &&
           e.payload.nodeId === edit.payload.nodeId &&
           e.userId !== edit.userId
    );

    if (recentEdits.length > 0) {
      return `Concurrent edit detected`;
    }

    return null;
  }

  /**
   * Broadcast message to all users in a session
   */
  private broadcast(flowId: string, message: any, excludeUserId?: string): void {
    const session = this.sessions.get(flowId);
    if (!session) return;

    for (const userId of session.users.keys()) {
      if (userId === excludeUserId) continue;

      const ws = this.connections.get(userId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        this.send(ws, message);
      }
    }
  }

  /**
   * Send message to specific WebSocket
   */
  private send(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message
   */
  private sendError(ws: WebSocket, error: string): void {
    this.send(ws, {
      type: 'error',
      error,
    });
  }

  /**
   * Extract user ID from request
   */
  private extractUserId(request: any): string {
    // In production, extract from JWT or session
    const url = new URL(request.url || '', 'http://localhost');
    return url.searchParams.get('userId') || `user_${Date.now()}`;
  }

  /**
   * Get active users for a flow
   */
  getActiveUsers(flowId: string): CollaborationUser[] {
    const session = this.sessions.get(flowId);
    return session ? Array.from(session.users.values()) : [];
  }

  /**
   * Get edit history for a flow
   */
  async getEditHistory(flowId: string, limit: number = 100): Promise<FlowEdit[]> {
    const session = this.sessions.get(flowId);
    if (session) {
      return session.edits.slice(-limit);
    }

    // Load from cache
    const cachedSession = await this.cache.get<CollaborationSession>(`session:${flowId}`);
    return cachedSession ? cachedSession.edits.slice(-limit) : [];
  }

  /**
   * Rollback to specific version
   */
  async rollback(flowId: string, version: number): Promise<Flow | null> {
    const session = this.sessions.get(flowId);
    if (!session) return null;

    // Get edits up to version
    const edits = session.edits.slice(0, version);

    // Rebuild flow from edits
    // This would require the original flow and applying each edit
    // Implementation depends on your flow merging strategy

    return null; // Placeholder
  }

  /**
   * Close collaboration server
   */
  async close(): Promise<void> {
    // Save all sessions to cache
    for (const [flowId, session] of this.sessions.entries()) {
      await this.cache.set(`session:${flowId}`, session, 3600);
    }

    // Close all WebSocket connections
    this.wss.clients.forEach(client => {
      client.close();
    });

    this.wss.close();
    await this.cache.disconnect();

    console.log('🔌 Real-time collaboration closed');
  }
}

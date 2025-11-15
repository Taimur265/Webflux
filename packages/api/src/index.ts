/**
 * UWG API Package
 * Export server and utilities
 */

export { default as app } from './server';
export * from './routes/flows';
export * from './routes/executions';
export * from './routes/connectors';
export * from './routes/webhooks';

// Middleware
export { metricsMiddleware, metricsHandler } from './middleware/metrics';
export { createDefaultRateLimiters } from './middleware/distributed-rate-limiter';

// Innovation features
export { RealtimeCollaboration } from './realtime-collaboration';
export { MultiTenancyManager } from './multi-tenancy';

export type {
  CollaborationMessage,
  FlowEdit,
  UserCursor,
  CollaborationSession,
} from './realtime-collaboration';
export type {
  Tenant,
  TenantUser,
  UserRole,
  Permission,
  TenantPlan,
  AuditLog,
  ResourceUsage,
} from './multi-tenancy';

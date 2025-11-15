/**
 * UWG Schema Package
 * Export all types and validators
 */

export * from './types';
export * from './node-types';
export * from './validation';

// Re-export commonly used types
export type {
  Flow,
  Node,
  Graph,
  Connection,
  Trigger,
  Page,
  ExecutionReport,
  ValidationError,
  TaskCall,
  UWGResponse,
} from './types';

export type {
  AllNodeTypes,
  NodeTypeName,
  TriggerNodeTypes,
  AINodeTypes,
  ActionNodeTypes,
  ComponentNodeTypes,
  InspectorNodeTypes,
  PublishNodeTypes,
} from './node-types';

export {
  FlowSchema,
  validateFlow,
  validateFlowComprehensive,
  validateConnections,
  detectCycles,
} from './validation';

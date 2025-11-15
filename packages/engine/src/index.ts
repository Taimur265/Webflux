/**
 * UWG Engine Package
 * Export runtime execution components
 */

export { FlowExecutor } from './executor';
export { DependencyGraph } from './dependency-graph';
export { TemplateEngine } from './template-engine';
export { NodeRunner } from './node-runner';
export { JobQueue } from './job-queue';
export { WorkerPool, Worker } from './worker-pool';

// Innovation features
export { AIFlowGenerator } from './ai-flow-generator';
export { TimeTravelDebugger } from './time-travel-debugger';
export { FlowTestingFramework } from './flow-testing-framework';

export type { ExecutorOptions, ExecutionState } from './executor';
export type { NodeRunOptions } from './node-runner';
export type { JobQueueOptions, FlowExecutionJob, FlowExecutionResult } from './job-queue';
export type { WorkerPoolOptions, WorkerMessage, WorkerResponse } from './worker-pool';

// Innovation feature types
export type {
  FlowGenerationOptions,
  FlowGenerationResult,
  FlowOptimizationResult,
  FlowExplanation,
} from './ai-flow-generator';
export type {
  DebugSession,
  DebugSnapshot,
  Breakpoint,
  ReplayOptions,
  TimelineAnalysis,
  SessionComparison,
} from './time-travel-debugger';
export type {
  TestCase,
  Assertion,
  TestResult,
  TestSuite,
  TestSuiteResult,
  CoverageReport,
} from './flow-testing-framework';

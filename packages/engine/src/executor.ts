/**
 * Flow Executor - Orchestrates flow execution with parallelism and retry logic
 */

import { v4 as uuidv4 } from 'uuid';
import type { Flow, Node, ExecutionReport, ExecutionLog } from '@uwg/schema';
import type { ConnectorRegistry } from '@uwg/connectors';
import { DependencyGraph } from './dependency-graph';
import { TemplateEngine } from './template-engine';
import { NodeRunner } from './node-runner';

export interface ExecutorOptions {
  parallelism?: number;
  default_timeout?: number;
  max_execution_time?: number;
  idempotency?: boolean;
}

export interface ExecutionState {
  run_id: string;
  outputs: Record<string, any>;
  logs: ExecutionLog[];
  node_states: Map<string, {
    status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
    attempts: number;
    blocked_by?: string;
  }>;
}

export class FlowExecutor {
  private connectorRegistry: ConnectorRegistry;

  constructor(connectorRegistry: ConnectorRegistry) {
    this.connectorRegistry = connectorRegistry;
  }

  async execute(
    flow: Flow,
    options: ExecutorOptions = {},
    triggerData?: any
  ): Promise<ExecutionReport> {
    const run_id = `run_${uuidv4()}`;
    const started_at = new Date().toISOString();

    // Build dependency graph
    const graph = new DependencyGraph(flow);

    // Initialize execution state
    const state: ExecutionState = {
      run_id,
      outputs: {},
      logs: [],
      node_states: new Map(),
    };

    // Initialize all nodes as pending
    flow.graph.nodes.forEach(node => {
      state.node_states.set(node.id, { status: 'pending', attempts: 0 });
    });

    // Add trigger data to state if provided
    if (triggerData) {
      state.outputs['trigger'] = triggerData;
    }

    const templateEngine = new TemplateEngine();
    const nodeRunner = new NodeRunner(this.connectorRegistry, templateEngine);

    const maxWorkers = options.parallelism || 6;
    const maxExecutionTime = options.max_execution_time || 600000; // 10 minutes
    const executionStart = Date.now();

    try {
      // Get initial ready nodes (nodes with no dependencies or only trigger inputs)
      let readyNodes = graph.getReadyNodes(state.outputs);

      while (readyNodes.length > 0 || this.hasRunningNodes(state)) {
        // Check timeout
        if (Date.now() - executionStart > maxExecutionTime) {
          throw new Error('Flow execution timeout');
        }

        // Execute ready nodes in parallel (up to maxWorkers)
        const batch = readyNodes.splice(0, maxWorkers);

        const promises = batch.map(async (node) => {
          const nodeState = state.node_states.get(node.id)!;
          nodeState.status = 'running';

          this.addLog(state, {
            node_id: node.id,
            status: 'running',
            started_at: new Date().toISOString(),
          });

          try {
            const result = await nodeRunner.run(node, state.outputs, {
              timeout: node.timeout_seconds || options.default_timeout || 30,
              retry: node.retry,
              attempt: nodeState.attempts,
            });

            nodeState.status = 'success';
            state.outputs[node.id] = result;

            this.addLog(state, {
              node_id: node.id,
              status: 'success',
              completed_at: new Date().toISOString(),
              result_preview: this.previewResult(result),
              attempts: nodeState.attempts + 1,
            });

            nodeState.attempts++;
          } catch (error: any) {
            const shouldRetry = this.shouldRetryNode(node, nodeState.attempts);

            if (shouldRetry) {
              nodeState.attempts++;
              await this.backoff(nodeState.attempts, node.retry?.strategy || 'exponential');
              readyNodes.push(node); // Re-queue for retry
            } else {
              nodeState.status = 'failed';

              this.addLog(state, {
                node_id: node.id,
                status: 'failed',
                completed_at: new Date().toISOString(),
                error: error.message || String(error),
                attempts: nodeState.attempts + 1,
              });

              // Mark downstream nodes as blocked
              graph.getDownstreamNodes(node.id).forEach(downstream => {
                const downstreamState = state.node_states.get(downstream.id);
                if (downstreamState) {
                  downstreamState.status = 'skipped';
                  downstreamState.blocked_by = node.id;

                  this.addLog(state, {
                    node_id: downstream.id,
                    status: 'skipped',
                  });
                }
              });
            }
          }
        });

        await Promise.all(promises);

        // Get next batch of ready nodes
        readyNodes = graph.getReadyNodes(state.outputs);
      }

      const completed_at = new Date().toISOString();
      const finalStatus = this.hasFailedNodes(state) ? 'failed' : 'completed';

      return {
        run_id,
        flow_id: flow.flow_id || 'unknown',
        status: finalStatus,
        started_at,
        completed_at,
        outputs: state.outputs,
        logs: state.logs,
        metadata: {
          trigger_data: triggerData,
          cost_estimate: this.calculateCostEstimate(state.logs),
        },
      };
    } catch (error: any) {
      return {
        run_id,
        flow_id: flow.flow_id || 'unknown',
        status: 'failed',
        started_at,
        completed_at: new Date().toISOString(),
        outputs: state.outputs,
        logs: state.logs,
        metadata: {
          trigger_data: triggerData,
        },
      };
    }
  }

  private addLog(state: ExecutionState, log: Partial<ExecutionLog>): void {
    const existing = state.logs.find(l => l.node_id === log.node_id && !l.completed_at);

    if (existing && log.completed_at) {
      // Update existing log with completion data
      Object.assign(existing, log);
    } else {
      // Add new log entry
      state.logs.push({
        node_id: log.node_id!,
        status: log.status || 'pending',
        ...log,
      });
    }
  }

  private hasRunningNodes(state: ExecutionState): boolean {
    return Array.from(state.node_states.values()).some(s => s.status === 'running');
  }

  private hasFailedNodes(state: ExecutionState): boolean {
    return Array.from(state.node_states.values()).some(s => s.status === 'failed');
  }

  private shouldRetryNode(node: Node, attempts: number): boolean {
    if (!node.retry) return false;
    return attempts < node.retry.max_attempts;
  }

  private async backoff(attempts: number, strategy: string): Promise<void> {
    let delayMs: number;

    switch (strategy) {
      case 'exponential':
        delayMs = Math.min(60000, Math.pow(2, attempts) * 1000);
        break;
      case 'linear':
        delayMs = attempts * 2000;
        break;
      case 'fixed':
        delayMs = 2000;
        break;
      default:
        delayMs = 1000;
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  private previewResult(result: any): any {
    // Truncate large results for preview
    const str = JSON.stringify(result);
    return str.length > 500 ? str.substring(0, 500) + '...' : result;
  }

  private calculateCostEstimate(logs: ExecutionLog[]): {
    ai_tokens?: number;
    api_calls?: number;
    estimated_cost_usd?: number;
  } {
    // TODO: Implement cost calculation based on AI usage
    return {
      api_calls: logs.filter(l => l.status === 'success').length,
    };
  }
}

/**
 * DSL Translator - Converts AST to Flow JSON
 */

import { v4 as uuidv4 } from 'uuid';
import type { Flow, Node, Connection, Trigger } from '@uwg/schema';
import type { FlowAST, NodeAST, ConnectionAST, TriggerAST } from './parser';

export class DSLTranslator {
  translate(ast: FlowAST, owner: string = 'unknown'): Flow {
    const now = new Date().toISOString();

    const nodes: Node[] = ast.nodes.map((nodeAst, idx) => this.translateNode(nodeAst, idx));
    const connections: Connection[] = ast.connections.map(conn => this.translateConnection(conn));
    const triggers: Trigger[] = ast.triggers.map((trig, idx) => this.translateTrigger(trig, idx));

    // Add trigger nodes
    const triggerNodes: Node[] = triggers.map((trig, idx) => ({
      id: trig.id,
      category: 'trigger' as const,
      type: this.mapTriggerType(trig.type),
      name: `Trigger ${idx + 1}`,
      connector: null,
      operation: null,
      params: trig.config,
      inputs: [],
      outputs: this.getTriggerOutputs(trig.type),
      ui_hints: {
        x: 100,
        y: 100 + idx * 100,
        summary: `${trig.type} trigger`,
      },
    }));

    return {
      flow_id: null,
      name: ast.name,
      description: ast.description || '',
      version: 1,
      graph: {
        pages: [],
        nodes: [...triggerNodes, ...nodes],
        connections,
        triggers,
      },
      metadata: {
        owner,
        created_at: now,
        tags: [],
      },
    };
  }

  private translateNode(nodeAst: NodeAST, index: number): Node {
    const [connector, operation] = this.parseNodeType(nodeAst.nodeType);

    return {
      id: nodeAst.id,
      category: this.inferCategory(nodeAst.nodeType),
      type: nodeAst.nodeType,
      name: nodeAst.id,
      connector,
      operation,
      params: nodeAst.params,
      inputs: [],
      outputs: nodeAst.outputs || ['result'],
      ui_hints: {
        x: 300 + index * 200,
        y: 100,
        summary: `${nodeAst.nodeType} node`,
      },
    };
  }

  private translateConnection(connAst: ConnectionAST): Connection {
    return {
      from: connAst.from,
      to: connAst.to,
    };
  }

  private translateTrigger(trigAst: TriggerAST, index: number): Trigger {
    return {
      id: `trigger_${index + 1}`,
      type: this.mapTriggerType(trigAst.triggerType),
      config: trigAst.params,
      to_node: trigAst.targetNode,
    };
  }

  private parseNodeType(nodeType: string): [string | null, string | null] {
    if (nodeType.includes('.')) {
      const [connector, operation] = nodeType.split('.');
      return [connector, operation];
    }

    // AI nodes
    if (nodeType.startsWith('AI_')) {
      return ['ai', nodeType];
    }

    return [null, null];
  }

  private inferCategory(nodeType: string): Node['category'] {
    if (nodeType.startsWith('AI_')) return 'ai';
    if (nodeType.includes('.')) {
      const connector = nodeType.split('.')[0];
      if (['webflow', 'slack', 'smtp', 'airtable', 'supabase', 'github'].includes(connector)) {
        return 'action';
      }
      if (connector === 'deploy' || connector === 'cdn') {
        return 'publish';
      }
      if (connector === 'inspector') {
        return 'inspector';
      }
    }
    return 'action';
  }

  private mapTriggerType(dslType: string): string {
    const mapping: Record<string, string> = {
      webhook: 'http.webhook',
      cron: 'cron.schedule',
      manual: 'manual',
    };

    return mapping[dslType] || dslType;
  }

  private getTriggerOutputs(triggerType: string): string[] {
    if (triggerType === 'webhook' || triggerType === 'http.webhook') {
      return ['body', 'headers'];
    }
    if (triggerType === 'cron' || triggerType === 'cron.schedule') {
      return ['timestamp'];
    }
    return ['trigger_data'];
  }
}

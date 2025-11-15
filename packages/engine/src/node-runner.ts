/**
 * Node Runner - Executes individual nodes
 */

import type { Node, RetryConfig } from '@uwg/schema';
import type { ConnectorRegistry } from '@uwg/connectors';
import { TemplateEngine } from './template-engine';

export interface NodeRunOptions {
  timeout: number;
  retry?: RetryConfig | null;
  attempt: number;
}

export class NodeRunner {
  constructor(
    private connectorRegistry: ConnectorRegistry,
    private templateEngine: TemplateEngine
  ) {}

  async run(
    node: Node,
    outputs: Record<string, any>,
    options: NodeRunOptions
  ): Promise<any> {
    // Render params with template engine
    const renderedParams = this.templateEngine.render(node.params, outputs);

    // Execute node based on category
    switch (node.category) {
      case 'trigger':
        return this.runTrigger(node, renderedParams);

      case 'action':
        return this.runAction(node, renderedParams, options);

      case 'ai':
        return this.runAI(node, renderedParams, options);

      case 'component':
        return this.runComponent(node, renderedParams);

      case 'inspector':
        return this.runInspector(node, renderedParams);

      case 'publish':
        return this.runPublish(node, renderedParams, options);

      case 'transform':
        return this.runTransform(node, renderedParams);

      default:
        throw new Error(`Unknown node category: ${node.category}`);
    }
  }

  private async runTrigger(node: Node, params: Record<string, any>): Promise<any> {
    // Triggers are typically handled externally
    // This is just a placeholder
    return { type: node.type, params };
  }

  private async runAction(
    node: Node,
    params: Record<string, any>,
    options: NodeRunOptions
  ): Promise<any> {
    if (!node.connector) {
      throw new Error(`No connector specified for action node: ${node.id}`);
    }

    const connector = this.connectorRegistry.get(node.connector);
    if (!connector) {
      throw new Error(`Connector not found: ${node.connector}`);
    }

    const result = await connector.call(
      node.operation!,
      params,
      {
        timeout: options.timeout * 1000, // Convert to milliseconds
        retry_attempts: options.retry?.max_attempts || 0,
      }
    );

    if (!result.success) {
      throw new Error(result.error || 'Connector call failed');
    }

    return result.data;
  }

  private async runAI(
    node: Node,
    params: Record<string, any>,
    options: NodeRunOptions
  ): Promise<any> {
    const aiConnector = this.connectorRegistry.get('ai');
    if (!aiConnector) {
      throw new Error('AI connector not available');
    }

    // Map node type to AI operation
    let operation = 'generate';
    const aiParams: Record<string, any> = {
      prompt_template: params.prompt_template,
      max_tokens: params.max_tokens || 1024,
      temperature: params.temperature,
    };

    switch (node.type) {
      case 'AI_LayoutGen':
      case 'AI_SectionGen':
        operation = 'generateStructured';
        aiParams.schema = {
          html: 'string',
          component_json: 'object',
        };
        break;

      case 'AI_SEOFix':
        operation = 'generateStructured';
        aiParams.schema = {
          title: 'string',
          description: 'string',
          keywords: 'array',
          suggestions: 'array',
        };
        break;
    }

    const result = await aiConnector.call(operation, aiParams, {
      timeout: options.timeout * 1000,
    });

    if (!result.success) {
      throw new Error(result.error || 'AI generation failed');
    }

    return result.data;
  }

  private async runComponent(
    node: Node,
    params: Record<string, any>
  ): Promise<any> {
    // Component rendering logic
    // For now, return structured data that UI can render
    return {
      html: `<!-- ${node.type} -->`,
      component_json: {
        type: node.type,
        props: params,
      },
    };
  }

  private async runInspector(
    node: Node,
    params: Record<string, any>
  ): Promise<any> {
    // Inspector operations would call actual tools
    // Placeholder implementation
    return {
      type: node.type,
      url: params.url,
      results: {},
    };
  }

  private async runPublish(
    node: Node,
    params: Record<string, any>,
    options: NodeRunOptions
  ): Promise<any> {
    // Check for production deploy confirmation
    if (node.type === 'deploy.production' && !params.confirm) {
      throw new Error('Production deployment requires explicit confirmation');
    }

    // Delegate to appropriate connector (e.g., Netlify)
    if (node.connector) {
      const connector = this.connectorRegistry.get(node.connector);
      if (!connector) {
        throw new Error(`Connector not found: ${node.connector}`);
      }

      const result = await connector.call(node.operation!, params, {
        timeout: options.timeout * 1000,
      });

      if (!result.success) {
        throw new Error(result.error || 'Publish failed');
      }

      return result.data;
    }

    return { status: 'published' };
  }

  private async runTransform(
    node: Node,
    params: Record<string, any>
  ): Promise<any> {
    // Transform operations
    switch (node.type) {
      case 'json.parse':
        return JSON.parse(params.input);

      case 'json.stringify':
        return JSON.stringify(params.input);

      default:
        return params;
    }
  }
}

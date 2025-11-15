/**
 * Claude AI Connector
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  IConnector,
  ConnectorDefinition,
  ConnectorStatus,
  ConnectorCallOptions,
  ConnectorCallResult,
} from '../types';

export class ClaudeAIConnector implements IConnector {
  private client: Anthropic | null = null;
  private authenticated = false;

  public definition: ConnectorDefinition = {
    name: 'ai',
    display_name: 'Claude AI',
    description: 'Anthropic Claude AI for content and layout generation',
    category: 'ai',
    icon: 'anthropic',
    auth: {
      type: 'api_key',
      instructions: 'Get your API key from console.anthropic.com',
    },
    operations: [
      {
        name: 'generate',
        description: 'Generate content using Claude',
        required_params: ['prompt_template'],
        optional_params: ['max_tokens', 'temperature'],
        param_schema: {
          prompt_template: { type: 'string', description: 'Prompt for Claude', required: true },
          max_tokens: { type: 'number', description: 'Max tokens to generate', default: 1024 },
          temperature: { type: 'number', description: 'Temperature (0-1)', default: 1.0 },
        },
        output_schema: {
          text: { type: 'string', description: 'Generated text' },
          usage: { type: 'object', description: 'Token usage stats' },
        },
      },
      {
        name: 'generateStructured',
        description: 'Generate structured JSON using Claude',
        required_params: ['prompt_template', 'schema'],
        param_schema: {
          prompt_template: { type: 'string', description: 'Prompt', required: true },
          schema: { type: 'object', description: 'Expected JSON schema', required: true },
          max_tokens: { type: 'number', description: 'Max tokens', default: 2048 },
        },
        output_schema: {
          data: { type: 'object', description: 'Generated structured data' },
          usage: { type: 'object', description: 'Token usage' },
        },
      },
    ],
  };

  async initialize(credentials: Record<string, string>): Promise<void> {
    if (!credentials.api_key) {
      throw new Error('Claude API key is required');
    }

    this.client = new Anthropic({
      apiKey: credentials.api_key,
    });

    this.authenticated = true;
  }

  async isAuthenticated(): Promise<boolean> {
    return this.authenticated;
  }

  async call(
    operation: string,
    params: Record<string, any>,
    options?: ConnectorCallOptions
  ): Promise<ConnectorCallResult> {
    if (!this.client) {
      throw new Error('Claude AI connector not initialized');
    }

    try {
      let result: any;

      switch (operation) {
        case 'generate':
          result = await this.generate(params);
          break;
        case 'generateStructured':
          result = await this.generateStructured(params);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      return {
        success: true,
        data: result,
        metadata: {
          cost_estimate: this.estimateCost(result.usage),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  }

  async getStatus(): Promise<ConnectorStatus> {
    return {
      name: this.definition.name,
      authenticated: this.authenticated,
      capabilities: this.definition.operations.map(op => op.name),
    };
  }

  private async generate(params: {
    prompt_template: string;
    max_tokens?: number;
    temperature?: number;
  }) {
    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: params.max_tokens || 1024,
      temperature: params.temperature ?? 1.0,
      messages: [
        {
          role: 'user',
          content: params.prompt_template,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    return {
      text,
      language: 'en',
      word_count: text.split(/\s+/).length,
      usage: response.usage,
    };
  }

  private async generateStructured(params: {
    prompt_template: string;
    schema: Record<string, any>;
    max_tokens?: number;
  }) {
    const systemPrompt = `You must respond with valid JSON matching this schema:\n${JSON.stringify(params.schema, null, 2)}\n\nRespond with ONLY the JSON, no other text.`;

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: params.max_tokens || 2048,
      messages: [
        {
          role: 'user',
          content: `${systemPrompt}\n\n${params.prompt_template}`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

    return {
      data: JSON.parse(jsonStr),
      usage: response.usage,
    };
  }

  private estimateCost(usage: any): number {
    // Rough estimate: $3 per million input tokens, $15 per million output tokens
    const inputCost = (usage.input_tokens / 1_000_000) * 3;
    const outputCost = (usage.output_tokens / 1_000_000) * 15;
    return inputCost + outputCost;
  }
}

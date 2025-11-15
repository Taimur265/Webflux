/**
 * AI-Powered Flow Generator
 * Converts natural language descriptions into executable flows using Claude AI
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Flow, Node, Edge } from '@uwg/schema';
import { v4 as uuidv4 } from 'uuid';

export interface FlowGenerationOptions {
  description: string;
  context?: string;
  constraints?: {
    maxNodes?: number;
    allowedConnectors?: string[];
    requireApproval?: boolean;
  };
}

export interface FlowGenerationResult {
  flow: Flow;
  confidence: number;
  explanation: string;
  suggestions?: string[];
  warnings?: string[];
}

export class AIFlowGenerator {
  private anthropic: Anthropic;
  private model: string = 'claude-3-5-sonnet-20241022';

  constructor(apiKey?: string) {
    this.anthropic = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Generate a flow from natural language description
   */
  async generateFlow(options: FlowGenerationOptions): Promise<FlowGenerationResult> {
    const prompt = this.buildPrompt(options);

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from AI');
    }

    const result = this.parseAIResponse(content.text);

    // Validate and enhance the generated flow
    const validatedFlow = await this.validateAndEnhance(result.flow, options);

    return {
      ...result,
      flow: validatedFlow,
    };
  }

  /**
   * Optimize an existing flow using AI
   */
  async optimizeFlow(flow: Flow): Promise<{
    optimizedFlow: Flow;
    improvements: string[];
    performanceGain: string;
  }> {
    const prompt = `
Analyze and optimize this workflow:

${JSON.stringify(flow, null, 2)}

Provide optimizations for:
1. Reduce execution time
2. Minimize API calls
3. Improve error handling
4. Add caching where appropriate
5. Parallelize where possible

Return JSON with:
{
  "optimizedFlow": {...},
  "improvements": ["list of improvements"],
  "performanceGain": "estimated performance improvement"
}
`;

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    return JSON.parse(this.extractJSON(content.text));
  }

  /**
   * Suggest fixes for failed flow executions
   */
  async suggestFixes(flow: Flow, errorLog: any): Promise<{
    suggestions: Array<{
      nodeId: string;
      issue: string;
      fix: string;
      confidence: number;
    }>;
    autoFixable: boolean;
  }> {
    const prompt = `
A workflow execution failed. Analyze the error and suggest fixes:

Flow:
${JSON.stringify(flow, null, 2)}

Error Log:
${JSON.stringify(errorLog, null, 2)}

Provide detailed suggestions for fixing each error.
Return JSON with:
{
  "suggestions": [
    {
      "nodeId": "node_id",
      "issue": "description of issue",
      "fix": "how to fix it",
      "confidence": 0.95
    }
  ],
  "autoFixable": true/false
}
`;

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    return JSON.parse(this.extractJSON(content.text));
  }

  /**
   * Generate test cases for a flow
   */
  async generateTests(flow: Flow): Promise<Array<{
    name: string;
    description: string;
    input: any;
    expectedOutput: any;
    assertions: string[];
  }>> {
    const prompt = `
Generate comprehensive test cases for this workflow:

${JSON.stringify(flow, null, 2)}

Create test cases covering:
1. Happy path
2. Edge cases
3. Error scenarios
4. Performance scenarios

Return JSON array of test cases.
`;

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    return JSON.parse(this.extractJSON(content.text));
  }

  /**
   * Build the prompt for flow generation
   */
  private buildPrompt(options: FlowGenerationOptions): string {
    const { description, context, constraints } = options;

    return `
You are an expert workflow automation engineer. Generate a complete, executable workflow based on the following description.

Description: ${description}

${context ? `Additional Context: ${context}` : ''}

${constraints?.allowedConnectors ? `Available Connectors: ${constraints.allowedConnectors.join(', ')}` : ''}
${constraints?.maxNodes ? `Maximum Nodes: ${constraints.maxNodes}` : ''}

Generate a workflow that:
1. Accomplishes the described goal
2. Follows best practices
3. Includes proper error handling
4. Uses appropriate retry strategies
5. Is production-ready

Return ONLY valid JSON in this exact format:
{
  "flow": {
    "name": "workflow name",
    "description": "detailed description",
    "version": 1,
    "graph": {
      "nodes": [
        {
          "id": "node_1",
          "category": "trigger|action|ai|transform|publish",
          "type": "specific_type",
          "name": "Human Readable Name",
          "connector": "connector_name or null",
          "operation": "operation_name or null",
          "params": {},
          "inputs": [],
          "outputs": ["output_field"],
          "retry": {
            "max_attempts": 3,
            "strategy": "exponential",
            "initial_delay_ms": 1000
          },
          "timeout_seconds": 30,
          "ui_hints": {
            "x": 0,
            "y": 0,
            "color": "#4CAF50"
          }
        }
      ],
      "edges": [
        {
          "from": "node_1",
          "to": "node_2",
          "condition": null
        }
      ]
    },
    "metadata": {
      "owner": "ai-generated",
      "created_at": "${new Date().toISOString()}",
      "tags": ["ai-generated", "automated"]
    }
  },
  "confidence": 0.95,
  "explanation": "Why this flow design was chosen",
  "suggestions": ["Optional improvement suggestions"],
  "warnings": ["Potential issues to be aware of"]
}
`;
  }

  /**
   * Parse AI response and extract flow
   */
  private parseAIResponse(text: string): FlowGenerationResult {
    const json = this.extractJSON(text);
    const parsed = JSON.parse(json);

    return {
      flow: parsed.flow,
      confidence: parsed.confidence || 0.8,
      explanation: parsed.explanation || 'AI-generated flow',
      suggestions: parsed.suggestions || [],
      warnings: parsed.warnings || [],
    };
  }

  /**
   * Extract JSON from AI response (handles markdown code blocks)
   */
  private extractJSON(text: string): string {
    // Remove markdown code blocks if present
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                      text.match(/```\s*([\s\S]*?)\s*```/) ||
                      [null, text];

    return jsonMatch[1] || text;
  }

  /**
   * Validate and enhance generated flow
   */
  private async validateAndEnhance(flow: Flow, options: FlowGenerationOptions): Promise<Flow> {
    // Ensure all nodes have unique IDs
    flow.graph.nodes.forEach((node, index) => {
      if (!node.id || !node.id.startsWith('node_')) {
        node.id = `node_${uuidv4()}`;
      }
    });

    // Ensure flow has an ID
    if (!flow.flow_id) {
      flow.flow_id = `flow_${uuidv4()}`;
    }

    // Add default metadata if missing
    if (!flow.metadata) {
      flow.metadata = {
        owner: 'ai-generated',
        created_at: new Date().toISOString(),
        tags: ['ai-generated'],
      };
    }

    // Validate connector availability
    if (options.constraints?.allowedConnectors) {
      const allowedSet = new Set(options.constraints.allowedConnectors);
      flow.graph.nodes.forEach(node => {
        if (node.connector && !allowedSet.has(node.connector)) {
          throw new Error(`Connector ${node.connector} not allowed`);
        }
      });
    }

    // Validate max nodes constraint
    if (options.constraints?.maxNodes &&
        flow.graph.nodes.length > options.constraints.maxNodes) {
      throw new Error(`Flow exceeds maximum nodes: ${options.constraints.maxNodes}`);
    }

    return flow;
  }

  /**
   * Generate flow from template with AI customization
   */
  async customizeTemplate(
    templateFlow: Flow,
    customization: string
  ): Promise<Flow> {
    const prompt = `
Customize this workflow template based on the requirements:

Template:
${JSON.stringify(templateFlow, null, 2)}

Customization Requirements:
${customization}

Return the customized flow as JSON.
`;

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const json = this.extractJSON(content.text);
    return JSON.parse(json);
  }

  /**
   * Explain a flow in natural language
   */
  async explainFlow(flow: Flow): Promise<{
    summary: string;
    stepByStep: string[];
    dataFlow: string;
    potentialIssues: string[];
  }> {
    const prompt = `
Explain this workflow in simple, non-technical language:

${JSON.stringify(flow, null, 2)}

Provide:
1. A summary (2-3 sentences)
2. Step-by-step explanation
3. How data flows through the system
4. Potential issues or bottlenecks

Return as JSON.
`;

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    return JSON.parse(this.extractJSON(content.text));
  }
}

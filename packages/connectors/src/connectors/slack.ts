/**
 * Slack Connector
 */

import { BaseConnector } from '../base-connector';
import type { ConnectorDefinition, ConnectorCallOptions, ConnectorCallResult } from '../types';

export class SlackConnector extends BaseConnector {
  constructor() {
    super({
      name: 'slack',
      display_name: 'Slack',
      description: 'Slack messaging and collaboration',
      category: 'communication',
      icon: 'slack',
      auth: {
        type: 'bearer',
        required_scopes: ['chat:write', 'files:write'],
        instructions: 'Create a Slack app and install it to your workspace',
      },
      base_url: 'https://slack.com/api',
      operations: [
        {
          name: 'postMessage',
          description: 'Post a message to a channel',
          required_params: ['channel', 'text'],
          optional_params: ['blocks'],
          param_schema: {
            channel: { type: 'string', description: 'Channel ID or name', required: true },
            text: { type: 'string', description: 'Message text', required: true },
            blocks: { type: 'array', description: 'Block kit blocks' },
          },
          output_schema: {
            message_id: { type: 'string', description: 'Message ID' },
            timestamp: { type: 'string', description: 'Message timestamp' },
          },
          rate_limit: {
            max_requests: 1,
            window_seconds: 1,
          },
        },
        {
          name: 'uploadFile',
          description: 'Upload a file to Slack',
          required_params: ['channels', 'file'],
          optional_params: ['title'],
          param_schema: {
            channels: { type: 'array', description: 'Channel IDs', required: true },
            file: { type: 'string', description: 'File path or URL', required: true },
            title: { type: 'string', description: 'File title' },
          },
          output_schema: {
            file_id: { type: 'string', description: 'File ID' },
          },
        },
      ],
    } as ConnectorDefinition);
  }

  protected async setupAuth(): Promise<void> {
    if (!this.credentials.bot_token) {
      throw new Error('Slack bot token is required');
    }

    this.client.defaults.headers.common['Authorization'] = `Bearer ${this.credentials.bot_token}`;
  }

  protected async verifyAuth(): Promise<boolean> {
    try {
      const response: any = await this.client.post('/auth.test');
      return response.ok === true;
    } catch {
      return false;
    }
  }

  async call(
    operation: string,
    params: Record<string, any>,
    options?: ConnectorCallOptions
  ): Promise<ConnectorCallResult> {
    this.validateParams(operation, params);

    try {
      let result: any;

      switch (operation) {
        case 'postMessage':
          result = await this.postMessage(params, options);
          break;
        case 'uploadFile':
          result = await this.uploadFile(params, options);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  }

  private async postMessage(
    params: { channel: string; text: string; blocks?: any[] },
    options?: ConnectorCallOptions
  ) {
    const data: any = await this.request({
      method: 'POST',
      url: '/chat.postMessage',
      data: {
        channel: params.channel,
        text: params.text,
        blocks: params.blocks,
      },
    }, options);

    if (!data.ok) {
      throw new Error(data.error || 'Failed to post message');
    }

    return {
      message_id: data.message.ts,
      timestamp: data.ts,
    };
  }

  private async uploadFile(
    params: { channels: string[]; file: string; title?: string },
    options?: ConnectorCallOptions
  ) {
    const data: any = await this.request({
      method: 'POST',
      url: '/files.upload',
      data: {
        channels: params.channels.join(','),
        file: params.file,
        title: params.title,
      },
    }, options);

    if (!data.ok) {
      throw new Error(data.error || 'Failed to upload file');
    }

    return {
      file_id: data.file.id,
    };
  }
}

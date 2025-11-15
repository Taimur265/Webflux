/**
 * Webflow Connector
 */

import { BaseConnector } from '../base-connector';
import type { ConnectorDefinition, ConnectorCallOptions, ConnectorCallResult } from '../types';

export class WebflowConnector extends BaseConnector {
  constructor() {
    super({
      name: 'webflow',
      display_name: 'Webflow',
      description: 'Webflow CMS and site management',
      category: 'cms',
      icon: 'webflow',
      auth: {
        type: 'api_key',
        required_scopes: ['sites:read', 'sites:write', 'cms:read', 'cms:write'],
        instructions: 'Get your API key from Webflow Dashboard → Account Settings → API Access',
      },
      base_url: 'https://api.webflow.com',
      operations: [
        {
          name: 'createItem',
          description: 'Create a new CMS item',
          required_params: ['collection', 'fields'],
          param_schema: {
            collection: { type: 'string', description: 'Collection ID', required: true },
            fields: { type: 'object', description: 'Item fields', required: true },
          },
          output_schema: {
            id: { type: 'string', description: 'Item ID' },
            url: { type: 'string', description: 'Item URL' },
            created_at: { type: 'string', description: 'Creation timestamp' },
            fields: { type: 'object', description: 'Item fields' },
          },
        },
        {
          name: 'updateItem',
          description: 'Update a CMS item',
          required_params: ['collection', 'item_id', 'fields'],
          param_schema: {
            collection: { type: 'string', description: 'Collection ID', required: true },
            item_id: { type: 'string', description: 'Item ID', required: true },
            fields: { type: 'object', description: 'Updated fields', required: true },
          },
          output_schema: {
            id: { type: 'string', description: 'Item ID' },
            updated_at: { type: 'string', description: 'Update timestamp' },
            fields: { type: 'object', description: 'Updated fields' },
          },
        },
        {
          name: 'publishSite',
          description: 'Publish a Webflow site',
          required_params: ['site_id'],
          optional_params: ['domains'],
          param_schema: {
            site_id: { type: 'string', description: 'Site ID', required: true },
            domains: { type: 'array', description: 'Domains to publish to' },
          },
          output_schema: {
            publish_id: { type: 'string', description: 'Publish job ID' },
            status: { type: 'string', description: 'Publish status' },
          },
        },
      ],
    } as ConnectorDefinition);
  }

  protected async setupAuth(): Promise<void> {
    if (!this.credentials.api_key) {
      throw new Error('Webflow API key is required');
    }

    this.client.defaults.headers.common['Authorization'] = `Bearer ${this.credentials.api_key}`;
    this.client.defaults.headers.common['accept-version'] = '1.0.0';
  }

  protected async verifyAuth(): Promise<boolean> {
    try {
      await this.client.get('/v1/user');
      return true;
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
        case 'createItem':
          result = await this.createItem(params, options);
          break;
        case 'updateItem':
          result = await this.updateItem(params, options);
          break;
        case 'publishSite':
          result = await this.publishSite(params, options);
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

  private async createItem(
    params: { collection: string; fields: Record<string, any> },
    options?: ConnectorCallOptions
  ) {
    const data = await this.request({
      method: 'POST',
      url: `/v1/collections/${params.collection}/items`,
      data: { fields: params.fields },
    }, options);

    return {
      id: data._id,
      url: data.url,
      created_at: data.createdOn,
      fields: data.fields,
    };
  }

  private async updateItem(
    params: { collection: string; item_id: string; fields: Record<string, any> },
    options?: ConnectorCallOptions
  ) {
    const data = await this.request({
      method: 'PATCH',
      url: `/v1/collections/${params.collection}/items/${params.item_id}`,
      data: { fields: params.fields },
    }, options);

    return {
      id: data._id,
      updated_at: data.updatedOn,
      fields: data.fields,
    };
  }

  private async publishSite(
    params: { site_id: string; domains?: string[] },
    options?: ConnectorCallOptions
  ) {
    const data = await this.request({
      method: 'POST',
      url: `/v1/sites/${params.site_id}/publish`,
      data: params.domains ? { domains: params.domains } : {},
    }, options);

    return {
      publish_id: data.queued,
      status: 'queued',
    };
  }
}

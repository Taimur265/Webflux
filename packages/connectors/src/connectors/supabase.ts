/**
 * Supabase Connector
 */

import { BaseConnector } from '../base-connector';
import type { ConnectorDefinition, ConnectorCallOptions, ConnectorCallResult } from '../types';

export class SupabaseConnector extends BaseConnector {
  constructor() {
    super({
      name: 'supabase',
      display_name: 'Supabase',
      description: 'Supabase backend operations',
      category: 'database',
      icon: 'supabase',
      auth: {
        type: 'api_key',
        instructions: 'Get your project URL and anon key from Supabase Dashboard → Settings → API',
      },
      base_url: '', // Will be set during initialization
      operations: [
        {
          name: 'insert',
          description: 'Insert a record',
          required_params: ['table', 'record'],
          param_schema: {
            table: { type: 'string', description: 'Table name', required: true },
            record: { type: 'object', description: 'Record data', required: true },
          },
          output_schema: {
            data: { type: 'object', description: 'Inserted record' },
          },
        },
        {
          name: 'update',
          description: 'Update records',
          required_params: ['table', 'record', 'match'],
          param_schema: {
            table: { type: 'string', description: 'Table name', required: true },
            record: { type: 'object', description: 'Updated data', required: true },
            match: { type: 'object', description: 'Match criteria', required: true },
          },
          output_schema: {
            data: { type: 'object', description: 'Updated records' },
          },
        },
        {
          name: 'select',
          description: 'Select records',
          required_params: ['table'],
          param_schema: {
            table: { type: 'string', description: 'Table name', required: true },
            match: { type: 'object', description: 'Match criteria' },
            limit: { type: 'number', description: 'Max records' },
          },
          output_schema: {
            data: { type: 'array', description: 'Selected records' },
          },
        },
      ],
    } as ConnectorDefinition);
  }

  protected async setupAuth(): Promise<void> {
    if (!this.credentials.project_url || !this.credentials.anon_key) {
      throw new Error('Supabase project URL and anon key are required');
    }

    this.client.defaults.baseURL = `${this.credentials.project_url}/rest/v1`;
    this.client.defaults.headers.common['apikey'] = this.credentials.anon_key;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${this.credentials.anon_key}`;
  }

  protected async verifyAuth(): Promise<boolean> {
    try {
      // Try to access the API
      await this.client.get('/');
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
        case 'insert':
          result = await this.insert(params, options);
          break;
        case 'update':
          result = await this.update(params, options);
          break;
        case 'select':
          result = await this.select(params, options);
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

  private async insert(
    params: { table: string; record: Record<string, any> },
    options?: ConnectorCallOptions
  ) {
    const data = await this.request({
      method: 'POST',
      url: `/${params.table}`,
      data: params.record,
      headers: {
        'Prefer': 'return=representation',
      },
    }, options);

    return { data: Array.isArray(data) ? data[0] : data };
  }

  private async update(
    params: { table: string; record: Record<string, any>; match: Record<string, any> },
    options?: ConnectorCallOptions
  ) {
    // Build query string for match criteria
    const matchQuery = Object.entries(params.match)
      .map(([key, value]) => `${key}=eq.${value}`)
      .join('&');

    const data = await this.request({
      method: 'PATCH',
      url: `/${params.table}?${matchQuery}`,
      data: params.record,
      headers: {
        'Prefer': 'return=representation',
      },
    }, options);

    return { data };
  }

  private async select(
    params: { table: string; match?: Record<string, any>; limit?: number },
    options?: ConnectorCallOptions
  ) {
    let query = '';

    if (params.match) {
      const matchQuery = Object.entries(params.match)
        .map(([key, value]) => `${key}=eq.${value}`)
        .join('&');
      query += matchQuery;
    }

    if (params.limit) {
      query += (query ? '&' : '') + `limit=${params.limit}`;
    }

    const data = await this.request({
      method: 'GET',
      url: `/${params.table}${query ? '?' + query : ''}`,
    }, options);

    return { data };
  }
}

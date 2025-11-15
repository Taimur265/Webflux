/**
 * Airtable Connector
 */

import { BaseConnector } from '../base-connector';
import type { ConnectorDefinition, ConnectorCallOptions, ConnectorCallResult } from '../types';

export class AirtableConnector extends BaseConnector {
  constructor() {
    super({
      name: 'airtable',
      display_name: 'Airtable',
      description: 'Airtable database operations',
      category: 'database',
      icon: 'airtable',
      auth: {
        type: 'api_key',
        instructions: 'Get your API key from Airtable Account → Generate API key',
      },
      base_url: 'https://api.airtable.com/v0',
      operations: [
        {
          name: 'createRecord',
          description: 'Create a new record',
          required_params: ['base_id', 'table', 'fields'],
          param_schema: {
            base_id: { type: 'string', description: 'Base ID', required: true },
            table: { type: 'string', description: 'Table name', required: true },
            fields: { type: 'object', description: 'Record fields', required: true },
          },
          output_schema: {
            id: { type: 'string', description: 'Record ID' },
            created_time: { type: 'string', description: 'Creation timestamp' },
            fields: { type: 'object', description: 'Record fields' },
          },
        },
        {
          name: 'updateRecord',
          description: 'Update an existing record',
          required_params: ['base_id', 'table', 'record_id', 'fields'],
          param_schema: {
            base_id: { type: 'string', description: 'Base ID', required: true },
            table: { type: 'string', description: 'Table name', required: true },
            record_id: { type: 'string', description: 'Record ID', required: true },
            fields: { type: 'object', description: 'Updated fields', required: true },
          },
          output_schema: {
            id: { type: 'string', description: 'Record ID' },
            fields: { type: 'object', description: 'Updated fields' },
          },
        },
        {
          name: 'listRecords',
          description: 'List records from a table',
          required_params: ['base_id', 'table'],
          param_schema: {
            base_id: { type: 'string', description: 'Base ID', required: true },
            table: { type: 'string', description: 'Table name', required: true },
            max_records: { type: 'number', description: 'Max records to return' },
          },
          output_schema: {
            records: { type: 'array', description: 'Array of records' },
          },
        },
      ],
    } as ConnectorDefinition);
  }

  protected async setupAuth(): Promise<void> {
    if (!this.credentials.api_key) {
      throw new Error('Airtable API key is required');
    }

    this.client.defaults.headers.common['Authorization'] = `Bearer ${this.credentials.api_key}`;
  }

  protected async verifyAuth(): Promise<boolean> {
    try {
      // Airtable doesn't have a dedicated auth check endpoint
      // We'll assume it's valid if the key is present
      return !!this.credentials.api_key;
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
        case 'createRecord':
          result = await this.createRecord(params, options);
          break;
        case 'updateRecord':
          result = await this.updateRecord(params, options);
          break;
        case 'listRecords':
          result = await this.listRecords(params, options);
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

  private async createRecord(
    params: { base_id: string; table: string; fields: Record<string, any> },
    options?: ConnectorCallOptions
  ) {
    const data = await this.request({
      method: 'POST',
      url: `/${params.base_id}/${encodeURIComponent(params.table)}`,
      data: { fields: params.fields },
    }, options);

    return {
      id: data.id,
      created_time: data.createdTime,
      fields: data.fields,
    };
  }

  private async updateRecord(
    params: { base_id: string; table: string; record_id: string; fields: Record<string, any> },
    options?: ConnectorCallOptions
  ) {
    const data = await this.request({
      method: 'PATCH',
      url: `/${params.base_id}/${encodeURIComponent(params.table)}/${params.record_id}`,
      data: { fields: params.fields },
    }, options);

    return {
      id: data.id,
      fields: data.fields,
    };
  }

  private async listRecords(
    params: { base_id: string; table: string; max_records?: number },
    options?: ConnectorCallOptions
  ) {
    const queryParams = params.max_records ? `?maxRecords=${params.max_records}` : '';

    const data = await this.request({
      method: 'GET',
      url: `/${params.base_id}/${encodeURIComponent(params.table)}${queryParams}`,
    }, options);

    return {
      records: data.records.map((record: any) => ({
        id: record.id,
        fields: record.fields,
        created_time: record.createdTime,
      })),
    };
  }
}

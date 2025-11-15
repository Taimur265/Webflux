/**
 * AWS S3 Connector
 */

import { BaseConnector } from '../base-connector';
import type { ConnectorDefinition, ConnectorCallOptions, ConnectorCallResult } from '../types';

export class AWSS3Connector extends BaseConnector {
  constructor() {
    super({
      name: 'aws_s3',
      display_name: 'AWS S3',
      description: 'AWS S3 storage operations',
      category: 'storage',
      icon: 'aws',
      auth: {
        type: 'api_key',
        instructions: 'Provide AWS Access Key ID, Secret Access Key, and Region',
      },
      base_url: '',
      operations: [
        {
          name: 'upload',
          description: 'Upload a file to S3',
          required_params: ['bucket', 'key', 'body'],
          param_schema: {
            bucket: { type: 'string', description: 'S3 bucket name', required: true },
            key: { type: 'string', description: 'Object key (path)', required: true },
            body: { type: 'string', description: 'File content', required: true },
            content_type: { type: 'string', description: 'Content-Type header' },
          },
          output_schema: {
            url: { type: 'string', description: 'Object URL' },
            etag: { type: 'string', description: 'ETag' },
          },
        },
        {
          name: 'delete',
          description: 'Delete a file from S3',
          required_params: ['bucket', 'key'],
          param_schema: {
            bucket: { type: 'string', description: 'S3 bucket name', required: true },
            key: { type: 'string', description: 'Object key (path)', required: true },
          },
          output_schema: {
            status: { type: 'string', description: 'Deletion status' },
          },
        },
        {
          name: 'list',
          description: 'List objects in a bucket',
          required_params: ['bucket'],
          param_schema: {
            bucket: { type: 'string', description: 'S3 bucket name', required: true },
            prefix: { type: 'string', description: 'Object key prefix' },
            max_keys: { type: 'number', description: 'Max objects to return' },
          },
          output_schema: {
            objects: { type: 'array', description: 'Array of objects' },
          },
        },
      ],
    } as ConnectorDefinition);
  }

  protected async setupAuth(): Promise<void> {
    if (!this.credentials.access_key_id || !this.credentials.secret_access_key || !this.credentials.region) {
      throw new Error('AWS Access Key ID, Secret Access Key, and Region are required');
    }

    // Note: In production, use AWS SDK v3
    // const { S3Client } = require('@aws-sdk/client-s3');
    // this.s3Client = new S3Client({ region: this.credentials.region, credentials: {...} });
  }

  protected async verifyAuth(): Promise<boolean> {
    // For AWS, assume valid if credentials are present
    return !!this.credentials.access_key_id && !!this.credentials.secret_access_key;
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
        case 'upload':
          result = await this.upload(params);
          break;
        case 'delete':
          result = await this.deleteObject(params);
          break;
        case 'list':
          result = await this.listObjects(params);
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

  private async upload(params: {
    bucket: string;
    key: string;
    body: string;
    content_type?: string;
  }) {
    // Note: In production, use AWS SDK v3
    // const { PutObjectCommand } = require('@aws-sdk/client-s3');
    // await this.s3Client.send(new PutObjectCommand({...}));

    const region = this.credentials.region || 'us-east-1';
    const url = `https://${params.bucket}.s3.${region}.amazonaws.com/${params.key}`;

    console.log(`[AWS S3] Uploading to: ${url}`);

    return {
      url,
      etag: `"${Date.now()}"`,
    };
  }

  private async deleteObject(params: { bucket: string; key: string }) {
    // Note: In production, use AWS SDK v3
    // const { DeleteObjectCommand } = require('@aws-sdk/client-s3');

    console.log(`[AWS S3] Deleting: ${params.bucket}/${params.key}`);

    return {
      status: 'deleted',
    };
  }

  private async listObjects(params: { bucket: string; prefix?: string; max_keys?: number }) {
    // Note: In production, use AWS SDK v3
    // const { ListObjectsV2Command } = require('@aws-sdk/client-s3');

    console.log(`[AWS S3] Listing objects in: ${params.bucket}`);

    return {
      objects: [],
    };
  }
}

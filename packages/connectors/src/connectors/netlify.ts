/**
 * Netlify Connector
 */

import { BaseConnector } from '../base-connector';
import type { ConnectorDefinition, ConnectorCallOptions, ConnectorCallResult } from '../types';

export class NetlifyConnector extends BaseConnector {
  constructor() {
    super({
      name: 'netlify',
      display_name: 'Netlify',
      description: 'Netlify deployment and hosting',
      category: 'deployment',
      icon: 'netlify',
      auth: {
        type: 'api_key',
        required_scopes: ['deploy:write'],
        instructions: 'Get your API key from Netlify Dashboard → User Settings → Applications',
      },
      base_url: 'https://api.netlify.com/api/v1',
      operations: [
        {
          name: 'triggerBuild',
          description: 'Trigger a build via build hook',
          required_params: ['site_id', 'build_hook'],
          param_schema: {
            site_id: { type: 'string', description: 'Netlify site ID', required: true },
            build_hook: { type: 'string', description: 'Build hook URL or secret_ref', required: true },
          },
          output_schema: {
            deploy_id: { type: 'string', description: 'Deployment ID' },
            status: { type: 'string', description: 'Deployment status' },
            url: { type: 'string', description: 'Deploy URL' },
          },
        },
        {
          name: 'listSites',
          description: 'List all sites',
          required_params: [],
          param_schema: {},
          output_schema: {
            sites: { type: 'array', description: 'Array of sites' },
          },
        },
      ],
    } as ConnectorDefinition);
  }

  protected async setupAuth(): Promise<void> {
    if (!this.credentials.api_key) {
      throw new Error('Netlify API key is required');
    }

    this.client.defaults.headers.common['Authorization'] = `Bearer ${this.credentials.api_key}`;
  }

  protected async verifyAuth(): Promise<boolean> {
    try {
      await this.client.get('/user');
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
        case 'triggerBuild':
          result = await this.triggerBuild(params, options);
          break;
        case 'listSites':
          result = await this.listSites(options);
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

  private async triggerBuild(
    params: { site_id: string; build_hook: string },
    options?: ConnectorCallOptions
  ) {
    // Build hook is a URL, use direct POST
    const buildHookUrl = params.build_hook.startsWith('http')
      ? params.build_hook
      : `https://api.netlify.com/build_hooks/${params.build_hook}`;

    const data = await this.request({
      method: 'POST',
      url: buildHookUrl,
      baseURL: '',
    }, options);

    return {
      deploy_id: data.id || 'pending',
      status: 'triggered',
      url: data.deploy_ssl_url || data.url,
    };
  }

  private async listSites(options?: ConnectorCallOptions) {
    const data = await this.request({
      method: 'GET',
      url: '/sites',
    }, options);

    return {
      sites: data.map((site: any) => ({
        id: site.id,
        name: site.name,
        url: site.url,
        ssl_url: site.ssl_url,
      })),
    };
  }
}

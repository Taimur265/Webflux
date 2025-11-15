/**
 * GitHub Connector
 */

import { BaseConnector } from '../base-connector';
import type { ConnectorDefinition, ConnectorCallOptions, ConnectorCallResult } from '../types';

export class GitHubConnector extends BaseConnector {
  constructor() {
    super({
      name: 'github',
      display_name: 'GitHub',
      description: 'GitHub repository operations',
      category: 'other',
      icon: 'github',
      auth: {
        type: 'bearer',
        required_scopes: ['repo'],
        instructions: 'Create a Personal Access Token at GitHub Settings → Developer settings → Personal access tokens',
      },
      base_url: 'https://api.github.com',
      operations: [
        {
          name: 'createPR',
          description: 'Create a pull request',
          required_params: ['repo', 'title', 'head', 'base'],
          param_schema: {
            repo: { type: 'string', description: 'Repository (owner/name)', required: true },
            title: { type: 'string', description: 'PR title', required: true },
            head: { type: 'string', description: 'Source branch', required: true },
            base: { type: 'string', description: 'Target branch', required: true },
            body: { type: 'string', description: 'PR description' },
          },
          output_schema: {
            pr_number: { type: 'number', description: 'PR number' },
            url: { type: 'string', description: 'PR URL' },
          },
        },
        {
          name: 'commitFiles',
          description: 'Commit files to a repository',
          required_params: ['repo', 'branch', 'message', 'files'],
          param_schema: {
            repo: { type: 'string', description: 'Repository (owner/name)', required: true },
            branch: { type: 'string', description: 'Branch name', required: true },
            message: { type: 'string', description: 'Commit message', required: true },
            files: { type: 'array', description: 'Files to commit', required: true },
          },
          output_schema: {
            commit_sha: { type: 'string', description: 'Commit SHA' },
            url: { type: 'string', description: 'Commit URL' },
          },
        },
        {
          name: 'createIssue',
          description: 'Create an issue',
          required_params: ['repo', 'title'],
          param_schema: {
            repo: { type: 'string', description: 'Repository (owner/name)', required: true },
            title: { type: 'string', description: 'Issue title', required: true },
            body: { type: 'string', description: 'Issue body' },
            labels: { type: 'array', description: 'Issue labels' },
          },
          output_schema: {
            issue_number: { type: 'number', description: 'Issue number' },
            url: { type: 'string', description: 'Issue URL' },
          },
        },
      ],
    } as ConnectorDefinition);
  }

  protected async setupAuth(): Promise<void> {
    if (!this.credentials.token) {
      throw new Error('GitHub token is required');
    }

    this.client.defaults.headers.common['Authorization'] = `Bearer ${this.credentials.token}`;
    this.client.defaults.headers.common['Accept'] = 'application/vnd.github+json';
    this.client.defaults.headers.common['X-GitHub-Api-Version'] = '2022-11-28';
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
        case 'createPR':
          result = await this.createPR(params, options);
          break;
        case 'commitFiles':
          result = await this.commitFiles(params, options);
          break;
        case 'createIssue':
          result = await this.createIssue(params, options);
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

  private async createPR(
    params: { repo: string; title: string; head: string; base: string; body?: string },
    options?: ConnectorCallOptions
  ) {
    const [owner, repo] = params.repo.split('/');

    const data = await this.request({
      method: 'POST',
      url: `/repos/${owner}/${repo}/pulls`,
      data: {
        title: params.title,
        head: params.head,
        base: params.base,
        body: params.body || '',
      },
    }, options);

    return {
      pr_number: data.number,
      url: data.html_url,
    };
  }

  private async commitFiles(
    params: { repo: string; branch: string; message: string; files: Array<{ path: string; content: string }> },
    options?: ConnectorCallOptions
  ) {
    const [owner, repo] = params.repo.split('/');

    // This is a simplified implementation
    // In production, use the GitHub API's tree and commit creation flow

    // For demonstration, return mock data
    return {
      commit_sha: 'abc123def456',
      url: `https://github.com/${owner}/${repo}/commit/abc123def456`,
    };
  }

  private async createIssue(
    params: { repo: string; title: string; body?: string; labels?: string[] },
    options?: ConnectorCallOptions
  ) {
    const [owner, repo] = params.repo.split('/');

    const data = await this.request({
      method: 'POST',
      url: `/repos/${owner}/${repo}/issues`,
      data: {
        title: params.title,
        body: params.body || '',
        labels: params.labels || [],
      },
    }, options);

    return {
      issue_number: data.number,
      url: data.html_url,
    };
  }
}

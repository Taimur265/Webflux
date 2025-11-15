/**
 * Base Connector Implementation
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import type {
  IConnector,
  ConnectorDefinition,
  ConnectorStatus,
  ConnectorCallOptions,
  ConnectorCallResult,
} from './types';

export abstract class BaseConnector implements IConnector {
  protected client: AxiosInstance;
  protected credentials: Record<string, string> = {};
  protected authenticated = false;

  constructor(public definition: ConnectorDefinition) {
    this.client = axios.create({
      baseURL: definition.base_url,
      timeout: 30000,
    });
  }

  async initialize(credentials: Record<string, string>): Promise<void> {
    this.credentials = credentials;
    await this.setupAuth();
    this.authenticated = await this.verifyAuth();
  }

  async isAuthenticated(): Promise<boolean> {
    return this.authenticated;
  }

  abstract call(
    operation: string,
    params: Record<string, any>,
    options?: ConnectorCallOptions
  ): Promise<ConnectorCallResult>;

  async getStatus(): Promise<ConnectorStatus> {
    return {
      name: this.definition.name,
      authenticated: this.authenticated,
      capabilities: this.definition.operations.map(op => op.name),
    };
  }

  /**
   * Setup authentication for the HTTP client
   */
  protected abstract setupAuth(): Promise<void>;

  /**
   * Verify that authentication is working
   */
  protected abstract verifyAuth(): Promise<boolean>;

  /**
   * Make an HTTP request with retry logic
   */
  protected async request<T = any>(
    config: AxiosRequestConfig,
    options?: ConnectorCallOptions
  ): Promise<T> {
    const maxRetries = options?.retry_attempts ?? 3;
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.client.request<T>({
          ...config,
          timeout: options?.timeout ?? config.timeout,
        });
        return response.data;
      } catch (error: any) {
        lastError = error;

        // Don't retry on client errors (4xx)
        if (error.response?.status && error.response.status < 500) {
          throw error;
        }

        // Exponential backoff
        if (attempt < maxRetries - 1) {
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError;
  }

  /**
   * Helper for delays
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate required parameters
   */
  protected validateParams(
    operation: string,
    params: Record<string, any>
  ): void {
    const op = this.definition.operations.find(o => o.name === operation);
    if (!op) {
      throw new Error(`Unknown operation: ${operation}`);
    }

    for (const required of op.required_params) {
      if (!(required in params)) {
        throw new Error(`Missing required parameter: ${required}`);
      }
    }
  }
}

/**
 * Connector system types
 */

export interface ConnectorAuth {
  type: 'none' | 'api_key' | 'oauth2' | 'bearer' | 'secret_ref';
  required_scopes?: string[];
  oauth_url?: string;
  instructions?: string;
}

export interface ConnectorOperation {
  name: string;
  description: string;
  required_params: string[];
  optional_params?: string[];
  param_schema: Record<string, {
    type: string;
    description: string;
    required?: boolean;
    default?: any;
  }>;
  output_schema: Record<string, {
    type: string;
    description: string;
  }>;
  rate_limit?: {
    max_requests: number;
    window_seconds: number;
  };
}

export interface ConnectorDefinition {
  name: string;
  display_name: string;
  description: string;
  category: 'cms' | 'deployment' | 'communication' | 'database' | 'ai' | 'inspector' | 'storage' | 'other';
  icon?: string;
  auth: ConnectorAuth;
  operations: ConnectorOperation[];
  base_url?: string;
}

export interface ConnectorStatus {
  name: string;
  authenticated: boolean;
  auth_valid_until?: string;
  capabilities: string[];
  last_error?: string;
}

export interface ConnectorCallOptions {
  timeout?: number;
  retry_attempts?: number;
  idempotency_key?: string;
}

export interface ConnectorCallResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    request_id?: string;
    rate_limit_remaining?: number;
    cost_estimate?: number;
  };
}

export interface IConnector {
  definition: ConnectorDefinition;

  /**
   * Initialize the connector with auth credentials
   */
  initialize(credentials: Record<string, string>): Promise<void>;

  /**
   * Check if the connector is properly authenticated
   */
  isAuthenticated(): Promise<boolean>;

  /**
   * Execute an operation
   */
  call(
    operation: string,
    params: Record<string, any>,
    options?: ConnectorCallOptions
  ): Promise<ConnectorCallResult>;

  /**
   * Get the current status
   */
  getStatus(): Promise<ConnectorStatus>;
}

export interface ConnectorRegistry {
  /**
   * Register a connector
   */
  register(connector: IConnector): void;

  /**
   * Get a connector by name
   */
  get(name: string): IConnector | undefined;

  /**
   * List all available connectors
   */
  list(): ConnectorDefinition[];

  /**
   * Get status of a connector
   */
  status(name: string): Promise<ConnectorStatus>;
}

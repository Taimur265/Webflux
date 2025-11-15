/**
 * Connector Registry Implementation
 */

import type {
  IConnector,
  ConnectorRegistry,
  ConnectorDefinition,
  ConnectorStatus,
} from './types';

export class ConnectorRegistryImpl implements ConnectorRegistry {
  private connectors = new Map<string, IConnector>();

  register(connector: IConnector): void {
    this.connectors.set(connector.definition.name, connector);
  }

  get(name: string): IConnector | undefined {
    return this.connectors.get(name);
  }

  list(): ConnectorDefinition[] {
    return Array.from(this.connectors.values()).map(c => c.definition);
  }

  async status(name: string): Promise<ConnectorStatus> {
    const connector = this.get(name);
    if (!connector) {
      throw new Error(`Connector not found: ${name}`);
    }
    return connector.getStatus();
  }
}

// Singleton instance
export const connectorRegistry = new ConnectorRegistryImpl();

/**
 * UWG Connectors Package
 * Export all connector types and implementations
 */

export * from './types';
export * from './registry';
export * from './base-connector';

// Export connector implementations
export { WebflowConnector } from './connectors/webflow';
export { SlackConnector } from './connectors/slack';
export { ClaudeAIConnector } from './connectors/ai-claude';

// Export singleton registry
export { connectorRegistry } from './registry';

// Auto-register default connectors
import { connectorRegistry } from './registry';
import { WebflowConnector } from './connectors/webflow';
import { SlackConnector } from './connectors/slack';
import { ClaudeAIConnector } from './connectors/ai-claude';

// Register all built-in connectors
export function registerDefaultConnectors(): void {
  connectorRegistry.register(new WebflowConnector());
  connectorRegistry.register(new SlackConnector());
  connectorRegistry.register(new ClaudeAIConnector());
}

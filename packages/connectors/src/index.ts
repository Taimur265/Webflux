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
export { NetlifyConnector } from './connectors/netlify';
export { AirtableConnector } from './connectors/airtable';
export { SupabaseConnector } from './connectors/supabase';

// Export singleton registry
export { connectorRegistry } from './registry';

// Auto-register default connectors
import { connectorRegistry } from './registry';
import { WebflowConnector } from './connectors/webflow';
import { SlackConnector } from './connectors/slack';
import { ClaudeAIConnector } from './connectors/ai-claude';
import { NetlifyConnector } from './connectors/netlify';
import { AirtableConnector } from './connectors/airtable';
import { SupabaseConnector } from './connectors/supabase';

// Register all built-in connectors
export function registerDefaultConnectors(): void {
  connectorRegistry.register(new WebflowConnector());
  connectorRegistry.register(new SlackConnector());
  connectorRegistry.register(new ClaudeAIConnector());
  connectorRegistry.register(new NetlifyConnector());
  connectorRegistry.register(new AirtableConnector());
  connectorRegistry.register(new SupabaseConnector());
}

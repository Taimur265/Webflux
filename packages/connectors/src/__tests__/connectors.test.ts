/**
 * Connector tests
 */

import { connectorRegistry, registerDefaultConnectors } from '../index';

describe('Connector Registry', () => {
  beforeAll(() => {
    registerDefaultConnectors();
  });

  test('registers all default connectors', () => {
    const connectors = connectorRegistry.list();

    expect(connectors.length).toBeGreaterThanOrEqual(9);

    const connectorNames = connectors.map(c => c.name);

    // Check all connectors are registered
    expect(connectorNames).toContain('webflow');
    expect(connectorNames).toContain('slack');
    expect(connectorNames).toContain('ai');
    expect(connectorNames).toContain('netlify');
    expect(connectorNames).toContain('airtable');
    expect(connectorNames).toContain('supabase');
    expect(connectorNames).toContain('smtp');
    expect(connectorNames).toContain('github');
    expect(connectorNames).toContain('aws_s3');
  });

  test('can retrieve individual connectors', () => {
    const webflow = connectorRegistry.get('webflow');
    expect(webflow).toBeDefined();
    expect(webflow?.definition.name).toBe('webflow');

    const slack = connectorRegistry.get('slack');
    expect(slack).toBeDefined();
    expect(slack?.definition.name).toBe('slack');
  });

  test('returns undefined for non-existent connector', () => {
    const nonExistent = connectorRegistry.get('does-not-exist');
    expect(nonExistent).toBeUndefined();
  });

  test('connectors have required properties', () => {
    const connectors = connectorRegistry.list();

    connectors.forEach(connector => {
      expect(connector.name).toBeTruthy();
      expect(connector.display_name).toBeTruthy();
      expect(connector.description).toBeTruthy();
      expect(connector.category).toBeTruthy();
      expect(connector.auth).toBeDefined();
      expect(Array.isArray(connector.operations)).toBe(true);
      expect(connector.operations.length).toBeGreaterThan(0);
    });
  });

  test('connector operations have required schema', () => {
    const webflow = connectorRegistry.get('webflow');
    expect(webflow).toBeDefined();

    webflow?.definition.operations.forEach(op => {
      expect(op.name).toBeTruthy();
      expect(op.description).toBeTruthy();
      expect(Array.isArray(op.required_params)).toBe(true);
      expect(op.param_schema).toBeDefined();
      expect(op.output_schema).toBeDefined();
    });
  });
});

describe('Webflow Connector', () => {
  test('has correct operations', () => {
    const webflow = connectorRegistry.get('webflow');
    const opNames = webflow?.definition.operations.map(op => op.name);

    expect(opNames).toContain('createItem');
    expect(opNames).toContain('updateItem');
    expect(opNames).toContain('publishSite');
  });
});

describe('Slack Connector', () => {
  test('has correct operations', () => {
    const slack = connectorRegistry.get('slack');
    const opNames = slack?.definition.operations.map(op => op.name);

    expect(opNames).toContain('postMessage');
    expect(opNames).toContain('uploadFile');
  });
});

describe('Claude AI Connector', () => {
  test('has correct operations', () => {
    const ai = connectorRegistry.get('ai');
    const opNames = ai?.definition.operations.map(op => op.name);

    expect(opNames).toContain('generate');
    expect(opNames).toContain('generateStructured');
  });
});

describe('Netlify Connector', () => {
  test('has correct operations', () => {
    const netlify = connectorRegistry.get('netlify');
    const opNames = netlify?.definition.operations.map(op => op.name);

    expect(opNames).toContain('triggerBuild');
    expect(opNames).toContain('listSites');
  });
});

describe('Airtable Connector', () => {
  test('has correct operations', () => {
    const airtable = connectorRegistry.get('airtable');
    const opNames = airtable?.definition.operations.map(op => op.name);

    expect(opNames).toContain('createRecord');
    expect(opNames).toContain('updateRecord');
    expect(opNames).toContain('listRecords');
  });
});

describe('Supabase Connector', () => {
  test('has correct operations', () => {
    const supabase = connectorRegistry.get('supabase');
    const opNames = supabase?.definition.operations.map(op => op.name);

    expect(opNames).toContain('insert');
    expect(opNames).toContain('update');
    expect(opNames).toContain('select');
  });
});

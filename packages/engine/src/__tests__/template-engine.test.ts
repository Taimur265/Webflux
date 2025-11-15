/**
 * Template Engine tests
 */

import { TemplateEngine } from '../template-engine';

describe('TemplateEngine', () => {
  const engine = new TemplateEngine();

  test('renders simple template', () => {
    const template = 'Hello {{name}}!';
    const outputs = { name: 'World' };

    const result = engine.render(template, outputs);
    expect(result).toBe('Hello World!');
  });

  test('renders nested paths', () => {
    const template = 'User: {{user.name}}, Email: {{user.email}}';
    const outputs = {
      user: {
        name: 'Alice',
        email: 'alice@example.com',
      },
    };

    const result = engine.render(template, outputs);
    expect(result).toBe('User: Alice, Email: alice@example.com');
  });

  test('renders object template', () => {
    const template = {
      greeting: 'Hello {{name}}',
      age: '{{age}}',
    };

    const outputs = {
      name: 'Bob',
      age: 30,
    };

    const result = engine.render(template, outputs);
    expect(result).toEqual({
      greeting: 'Hello Bob',
      age: '30',
    });
  });

  test('extracts variables from template', () => {
    const template = 'Hello {{user.name}}, you have {{count}} messages';

    const vars = engine.extractVariables(template);
    expect(vars).toContain('user.name');
    expect(vars).toContain('count');
  });

  test('validates template variables', () => {
    const template = 'Hello {{user.name}}, {{missing.var}}';
    const availableOutputs = new Set(['user']);

    const validation = engine.validateTemplate(template, availableOutputs);
    expect(validation.valid).toBe(false);
    expect(validation.missing).toContain('missing.var');
  });
});

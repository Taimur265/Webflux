/**
 * DSL Parser tests
 */

import { DSLParser } from '../parser';

describe('DSLParser', () => {
  const parser = new DSLParser();

  test('parses simple flow', () => {
    const dsl = `
      flow "Test Flow" {
        trigger webhook(path="/test") -> start
        node start: manual()
        start -> end
        node end: manual()
      }
    `;

    const ast = parser.parse(dsl);

    expect(ast.name).toBe('Test Flow');
    expect(ast.nodes).toHaveLength(2);
    expect(ast.triggers).toHaveLength(1);
    expect(ast.connections).toHaveLength(1);
  });

  test('parses node with params', () => {
    const dsl = `
      flow "Param Test" {
        node test: slack.postMessage(channel="#general", text="Hello")
      }
    `;

    const ast = parser.parse(dsl);

    expect(ast.nodes[0].params).toEqual({
      channel: '#general',
      text: 'Hello',
    });
  });

  test('handles comments', () => {
    const dsl = `
      # This is a comment
      flow "Comment Test" {
        # Another comment
        node test: manual()
      }
    `;

    const ast = parser.parse(dsl);
    expect(ast.name).toBe('Comment Test');
  });
});

/**
 * UWG DSL Package
 * Export parser and translator
 */

export { DSLParser } from './parser';
export { DSLTranslator } from './translator';

export type { FlowAST, NodeAST, ConnectionAST, TriggerAST } from './parser';

import { DSLParser } from './parser';
import { DSLTranslator } from './translator';
import type { Flow } from '@uwg/schema';

/**
 * Convenience function to parse DSL and translate to Flow JSON
 */
export function dslToFlow(dsl: string, owner?: string): Flow {
  const parser = new DSLParser();
  const translator = new DSLTranslator();

  const ast = parser.parse(dsl);
  const flow = translator.translate(ast, owner);

  return flow;
}

/**
 * DSL Parser - Converts DSL syntax to AST
 */

export interface Token {
  type: 'keyword' | 'identifier' | 'string' | 'number' | 'operator' | 'punctuation' | 'whitespace' | 'comment';
  value: string;
  line: number;
  col: number;
}

export interface ASTNode {
  type: string;
  value?: any;
  children?: ASTNode[];
  metadata?: Record<string, any>;
}

export interface FlowAST {
  type: 'flow';
  name: string;
  description?: string;
  nodes: NodeAST[];
  connections: ConnectionAST[];
  triggers: TriggerAST[];
}

export interface NodeAST {
  type: 'node';
  id: string;
  nodeType: string;
  params: Record<string, any>;
  outputs?: string[];
}

export interface ConnectionAST {
  type: 'connection';
  from: string;
  to: string;
}

export interface TriggerAST {
  type: 'trigger';
  triggerType: string;
  params: Record<string, any>;
  targetNode: string;
}

export class DSLParser {
  private tokens: Token[] = [];
  private current = 0;

  parse(source: string): FlowAST {
    this.tokens = this.tokenize(source);
    this.current = 0;

    return this.parseFlow();
  }

  private tokenize(source: string): Token[] {
    const tokens: Token[] = [];
    let line = 1;
    let col = 1;
    let i = 0;

    while (i < source.length) {
      const char = source[i];

      // Whitespace
      if (/\s/.test(char)) {
        if (char === '\n') {
          line++;
          col = 1;
        } else {
          col++;
        }
        i++;
        continue;
      }

      // Comments
      if (char === '#') {
        let comment = '';
        i++;
        while (i < source.length && source[i] !== '\n') {
          comment += source[i];
          i++;
        }
        tokens.push({ type: 'comment', value: comment, line, col });
        continue;
      }

      // Strings
      if (char === '"' || char === "'") {
        const quote = char;
        let str = '';
        i++;
        col++;
        while (i < source.length && source[i] !== quote) {
          if (source[i] === '\\' && i + 1 < source.length) {
            i++;
            str += source[i];
          } else {
            str += source[i];
          }
          i++;
          col++;
        }
        i++; // skip closing quote
        col++;
        tokens.push({ type: 'string', value: str, line, col });
        continue;
      }

      // Numbers
      if (/\d/.test(char)) {
        let num = '';
        while (i < source.length && /[\d.]/.test(source[i])) {
          num += source[i];
          i++;
          col++;
        }
        tokens.push({ type: 'number', value: num, line, col });
        continue;
      }

      // Operators and punctuation
      if (/[{}():,=\->]/.test(char)) {
        let op = char;
        i++;
        col++;

        // Multi-char operators
        if (char === '-' && i < source.length && source[i] === '>') {
          op += source[i];
          i++;
          col++;
        }

        tokens.push({ type: 'operator', value: op, line, col });
        continue;
      }

      // Identifiers and keywords
      if (/[a-zA-Z_]/.test(char)) {
        let ident = '';
        while (i < source.length && /[a-zA-Z0-9_.]/.test(source[i])) {
          ident += source[i];
          i++;
          col++;
        }

        const keywords = ['flow', 'trigger', 'node', 'on', 'page'];
        const type = keywords.includes(ident) ? 'keyword' : 'identifier';

        tokens.push({ type, value: ident, line, col });
        continue;
      }

      // Unknown character
      throw new Error(`Unexpected character '${char}' at line ${line}, col ${col}`);
    }

    return tokens;
  }

  private parseFlow(): FlowAST {
    this.expect('keyword', 'flow');
    const name = this.expect('string').value;

    this.expect('operator', '{');

    const nodes: NodeAST[] = [];
    const connections: ConnectionAST[] = [];
    const triggers: TriggerAST[] = [];

    while (!this.check('operator', '}')) {
      const token = this.peek();

      if (token.type === 'keyword') {
        if (token.value === 'trigger') {
          triggers.push(this.parseTrigger());
        } else if (token.value === 'node') {
          nodes.push(this.parseNode());
        }
      } else if (token.type === 'identifier') {
        // Could be a connection: node1 -> node2
        const conn = this.parseConnection();
        if (conn) {
          connections.push(conn);
        }
      } else {
        this.advance();
      }
    }

    this.expect('operator', '}');

    return {
      type: 'flow',
      name,
      nodes,
      connections,
      triggers,
    };
  }

  private parseTrigger(): TriggerAST {
    this.expect('keyword', 'trigger');

    const triggerType = this.expect('identifier').value;
    const params = this.parseParams();

    this.expect('operator', '->');

    const targetNode = this.expect('identifier').value;

    return {
      type: 'trigger',
      triggerType,
      params,
      targetNode,
    };
  }

  private parseNode(): NodeAST {
    this.expect('keyword', 'node');

    const id = this.expect('identifier').value;

    this.expect('operator', ':');

    const nodeType = this.expect('identifier').value;

    const params = this.parseParams();

    return {
      type: 'node',
      id,
      nodeType,
      params,
    };
  }

  private parseConnection(): ConnectionAST | null {
    const from = this.expect('identifier').value;

    if (!this.check('operator', '->')) {
      // Not a connection, backtrack
      this.current--;
      return null;
    }

    this.expect('operator', '->');

    const to = this.expect('identifier').value;

    return {
      type: 'connection',
      from,
      to,
    };
  }

  private parseParams(): Record<string, any> {
    if (!this.check('operator', '(')) {
      return {};
    }

    this.expect('operator', '(');

    const params: Record<string, any> = {};

    while (!this.check('operator', ')')) {
      const key = this.expect('identifier').value;
      this.expect('operator', '=');

      const value = this.parseValue();
      params[key] = value;

      if (this.check('operator', ',')) {
        this.advance();
      }
    }

    this.expect('operator', ')');

    return params;
  }

  private parseValue(): any {
    const token = this.peek();

    if (token.type === 'string') {
      this.advance();
      return token.value;
    }

    if (token.type === 'number') {
      this.advance();
      return parseFloat(token.value);
    }

    if (token.type === 'operator' && token.value === '{') {
      return this.parseObject();
    }

    if (token.type === 'identifier') {
      this.advance();
      if (token.value === 'true') return true;
      if (token.value === 'false') return false;
      return token.value;
    }

    throw new Error(`Unexpected value token: ${token.type} ${token.value}`);
  }

  private parseObject(): Record<string, any> {
    this.expect('operator', '{');

    const obj: Record<string, any> = {};

    while (!this.check('operator', '}')) {
      const key = this.expect('identifier').value;
      this.expect('operator', ':');
      const value = this.parseValue();

      obj[key] = value;

      if (this.check('operator', ',')) {
        this.advance();
      }
    }

    this.expect('operator', '}');

    return obj;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private advance(): Token {
    const token = this.tokens[this.current];
    this.current++;
    return token;
  }

  private check(type: string, value?: string): boolean {
    if (this.current >= this.tokens.length) return false;
    const token = this.tokens[this.current];
    if (token.type !== type) return false;
    if (value !== undefined && token.value !== value) return false;
    return true;
  }

  private expect(type: string, value?: string): Token {
    if (!this.check(type, value)) {
      const token = this.peek();
      throw new Error(
        `Expected ${type}${value ? ` '${value}'` : ''} but got ${token?.type} '${token?.value}' at line ${token?.line}`
      );
    }
    return this.advance();
  }
}

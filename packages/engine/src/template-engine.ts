/**
 * Template Engine - Processes template strings with variable substitution
 */

export class TemplateEngine {
  /**
   * Render a template string or object with variables from outputs
   * Supports mustache-style templates: {{node_id.output.field}}
   */
  render(template: any, outputs: Record<string, any>): any {
    if (typeof template === 'string') {
      return this.renderString(template, outputs);
    }

    if (Array.isArray(template)) {
      return template.map(item => this.render(item, outputs));
    }

    if (typeof template === 'object' && template !== null) {
      return this.renderObject(template, outputs);
    }

    return template;
  }

  private renderString(template: string, outputs: Record<string, any>): string {
    // Match {{variable.path.here}}
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getValueByPath(path.trim(), outputs);
      return value !== undefined ? String(value) : match;
    });
  }

  private renderObject(template: Record<string, any>, outputs: Record<string, any>): any {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(template)) {
      result[key] = this.render(value, outputs);
    }

    return result;
  }

  /**
   * Get a value from outputs using dot notation path
   * Examples:
   *   trigger.body.email -> outputs.trigger.body.email
   *   n1.result.id -> outputs.n1.result.id
   */
  private getValueByPath(path: string, outputs: Record<string, any>): any {
    const parts = path.split('.');
    let current: any = outputs;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Extract all template variables from a template
   * Returns array of variable paths
   */
  extractVariables(template: any): string[] {
    const variables = new Set<string>();

    const extract = (value: any): void => {
      if (typeof value === 'string') {
        const matches = value.matchAll(/\{\{([^}]+)\}\}/g);
        for (const match of matches) {
          variables.add(match[1].trim());
        }
      } else if (Array.isArray(value)) {
        value.forEach(extract);
      } else if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(extract);
      }
    };

    extract(template);
    return Array.from(variables);
  }

  /**
   * Validate that all template variables reference existing outputs
   */
  validateTemplate(template: any, availableOutputs: Set<string>): {
    valid: boolean;
    missing: string[];
  } {
    const variables = this.extractVariables(template);
    const missing: string[] = [];

    for (const variable of variables) {
      const nodeId = variable.split('.')[0];
      if (!availableOutputs.has(nodeId)) {
        missing.push(variable);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }
}

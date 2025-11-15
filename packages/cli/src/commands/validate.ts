/**
 * Validate command
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { validateFlowComprehensive } from '@uwg/schema';
import { dslToFlow } from '@uwg/dsl';

export async function validateCommand(flowPath: string, options: any) {
  try {
    // Load flow
    const ext = path.extname(flowPath);
    let flow: any;

    if (ext === '.uwg') {
      const dsl = fs.readFileSync(flowPath, 'utf-8');
      flow = dslToFlow(dsl);
    } else if (ext === '.json') {
      const json = fs.readFileSync(flowPath, 'utf-8');
      flow = JSON.parse(json);
    } else {
      console.error(chalk.red('Unsupported file type. Use .json or .uwg'));
      process.exit(1);
    }

    // Validate
    const validation = validateFlowComprehensive(flow);

    if (!validation.valid) {
      console.log(chalk.red('❌ Flow validation failed\n'));

      console.log(chalk.bold('Errors:'));
      validation.errors?.forEach(err => {
        console.log(chalk.red(`  • ${err.path}: ${err.message}`));
      });

      if (validation.warnings && validation.warnings.length > 0) {
        console.log(chalk.bold('\nWarnings:'));
        validation.warnings.forEach(warn => {
          console.log(chalk.yellow(`  • ${warn.path}: ${warn.message}`));
        });
      }

      process.exit(1);
    }

    console.log(chalk.green('✓ Flow is valid!'));

    // Show flow info
    console.log(chalk.bold('\nFlow Info:'));
    console.log(`  Name: ${flow.name}`);
    console.log(`  Description: ${flow.description || 'N/A'}`);
    console.log(`  Nodes: ${flow.graph.nodes.length}`);
    console.log(`  Connections: ${flow.graph.connections.length}`);
    console.log(`  Triggers: ${flow.graph.triggers.length}`);

    process.exit(0);
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

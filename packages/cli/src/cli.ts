#!/usr/bin/env node

/**
 * UWG CLI
 */

import { Command } from 'commander';
import dotenv from 'dotenv';
import { runCommand } from './commands/run';
import { validateCommand } from './commands/validate';
import { listCommand } from './commands/list';
import { initCommand } from './commands/init';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('uwg')
  .description('Unified Website Graph Engine CLI')
  .version('0.1.0');

// Run command
program
  .command('run <flow>')
  .description('Execute a flow from JSON or DSL file')
  .option('-d, --data <json>', 'Trigger data as JSON string')
  .option('-w, --watch', 'Watch for changes and re-run')
  .action(runCommand);

// Validate command
program
  .command('validate <flow>')
  .description('Validate a flow file')
  .option('--strict', 'Enable strict validation')
  .action(validateCommand);

// List command
program
  .command('list')
  .description('List all flows in storage')
  .option('--owner <owner>', 'Filter by owner')
  .option('--tags <tags>', 'Filter by tags (comma-separated)')
  .action(listCommand);

// Init command
program
  .command('init')
  .description('Initialize a new UWG project')
  .option('-t, --template <name>', 'Use a template (basic, advanced, ai)')
  .action(initCommand);

// Parse arguments
program.parse(process.argv);

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

/**
 * Run command
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { FlowExecutor } from '@uwg/engine';
import { validateFlowComprehensive } from '@uwg/schema';
import { connectorRegistry, registerDefaultConnectors } from '@uwg/connectors';
import { defaultStorage } from '@uwg/storage';
import { dslToFlow } from '@uwg/dsl';

export async function runCommand(flowPath: string, options: any) {
  const spinner = ora('Loading flow...').start();

  try {
    // Initialize storage
    await defaultStorage.initialize();

    // Register connectors
    registerDefaultConnectors();

    // Initialize connectors from env
    await initializeConnectors();

    // Load flow
    const ext = path.extname(flowPath);
    let flow: any;

    if (ext === '.uwg') {
      // DSL file
      const dsl = fs.readFileSync(flowPath, 'utf-8');
      spinner.text = 'Parsing DSL...';
      flow = dslToFlow(dsl);
    } else if (ext === '.json') {
      // JSON file
      const json = fs.readFileSync(flowPath, 'utf-8');
      flow = JSON.parse(json);
    } else {
      spinner.fail('Unsupported file type. Use .json or .uwg');
      process.exit(1);
    }

    // Validate
    spinner.text = 'Validating flow...';
    const validation = validateFlowComprehensive(flow);

    if (!validation.valid) {
      spinner.fail('Flow validation failed');
      console.error(chalk.red('\nValidation errors:'));
      validation.errors?.forEach(err => {
        console.error(chalk.red(`  • ${err.path}: ${err.message}`));
      });
      process.exit(1);
    }

    spinner.succeed('Flow validated successfully');

    // Parse trigger data
    let triggerData = {};
    if (options.data) {
      try {
        triggerData = JSON.parse(options.data);
      } catch (error) {
        console.error(chalk.red('Invalid trigger data JSON'));
        process.exit(1);
      }
    }

    // Execute
    const execSpinner = ora('Executing flow...').start();

    const executor = new FlowExecutor(connectorRegistry);
    const report = await executor.execute(flow, {}, triggerData);

    // Save execution
    await defaultStorage.saveExecution(report);

    execSpinner.stop();

    // Display results
    console.log(chalk.bold(`\n📊 Execution ${report.status === 'completed' ? chalk.green(report.status) : chalk.red(report.status)}`));
    console.log(chalk.gray(`Run ID: ${report.run_id}`));

    const duration = Date.parse(report.completed_at!) - Date.parse(report.started_at);
    console.log(chalk.gray(`Duration: ${duration}ms`));

    console.log(chalk.bold('\n📋 Execution Log:'));
    report.logs.forEach(log => {
      const icon = log.status === 'success' ? chalk.green('✓') :
                   log.status === 'failed' ? chalk.red('✗') :
                   log.status === 'skipped' ? chalk.yellow('○') : '•';

      console.log(`  ${icon} ${log.node_id}: ${log.status}`);

      if (log.error) {
        console.log(chalk.red(`    Error: ${log.error}`));
      }

      if (log.attempts && log.attempts > 1) {
        console.log(chalk.yellow(`    Attempts: ${log.attempts}`));
      }
    });

    // Show cost estimate
    if (report.metadata.cost_estimate) {
      console.log(chalk.bold('\n💰 Cost Estimate:'));
      if (report.metadata.cost_estimate.ai_tokens) {
        console.log(`  AI Tokens: ${report.metadata.cost_estimate.ai_tokens}`);
      }
      if (report.metadata.cost_estimate.api_calls) {
        console.log(`  API Calls: ${report.metadata.cost_estimate.api_calls}`);
      }
      if (report.metadata.cost_estimate.estimated_cost_usd) {
        console.log(`  Estimated Cost: $${report.metadata.cost_estimate.estimated_cost_usd.toFixed(4)}`);
      }
    }

    process.exit(report.status === 'completed' ? 0 : 1);
  } catch (error: any) {
    spinner.fail('Execution failed');
    console.error(chalk.red(`\nError: ${error.message}`));
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function initializeConnectors() {
  const slackConnector = connectorRegistry.get('slack');
  if (slackConnector && process.env.SLACK_BOT_TOKEN) {
    await slackConnector.initialize({
      bot_token: process.env.SLACK_BOT_TOKEN,
    });
  }

  const aiConnector = connectorRegistry.get('ai');
  if (aiConnector && process.env.ANTHROPIC_API_KEY) {
    await aiConnector.initialize({
      api_key: process.env.ANTHROPIC_API_KEY,
    });
  }

  const webflowConnector = connectorRegistry.get('webflow');
  if (webflowConnector && process.env.WEBFLOW_API_KEY) {
    await webflowConnector.initialize({
      api_key: process.env.WEBFLOW_API_KEY,
    });
  }
}

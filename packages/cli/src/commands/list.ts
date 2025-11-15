/**
 * List command
 */

import chalk from 'chalk';
import { defaultStorage } from '@uwg/storage';

export async function listCommand(options: any) {
  try {
    await defaultStorage.initialize();

    const flows = await defaultStorage.listFlows({
      owner: options.owner,
      tags: options.tags ? options.tags.split(',') : undefined,
    });

    if (flows.length === 0) {
      console.log(chalk.yellow('No flows found'));
      return;
    }

    console.log(chalk.bold(`Found ${flows.length} flow(s):\n`));

    flows.forEach((flow, idx) => {
      console.log(chalk.bold(`${idx + 1}. ${flow.name}`));
      console.log(chalk.gray(`   ID: ${flow.flow_id}`));
      console.log(chalk.gray(`   Description: ${flow.description || 'N/A'}`));
      console.log(chalk.gray(`   Owner: ${flow.metadata.owner}`));
      console.log(chalk.gray(`   Created: ${flow.metadata.created_at}`));
      console.log(chalk.gray(`   Nodes: ${flow.graph.nodes.length}`));

      if (flow.metadata.tags && flow.metadata.tags.length > 0) {
        console.log(chalk.gray(`   Tags: ${flow.metadata.tags.join(', ')}`));
      }

      console.log('');
    });

    process.exit(0);
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

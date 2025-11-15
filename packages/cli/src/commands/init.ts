/**
 * Init command
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export async function initCommand(options: any) {
  const template = options.template || 'basic';

  console.log(chalk.bold(`Initializing UWG project with ${template} template...\n`));

  // Create directory structure
  const dirs = [
    'flows',
    'flows/json',
    'flows/dsl',
    'examples',
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(chalk.green(`✓ Created ${dir}/`));
    }
  });

  // Create .env file
  if (!fs.existsSync('.env')) {
    const envContent = `# UWG Engine Configuration

# Slack
SLACK_BOT_TOKEN=

# Claude AI
ANTHROPIC_API_KEY=

# Webflow
WEBFLOW_API_KEY=

# Netlify
NETLIFY_SITE_ID=
NETLIFY_BUILD_HOOK=

# Database
DATABASE_PATH=./uwg.db
`;

    fs.writeFileSync('.env', envContent);
    console.log(chalk.green('✓ Created .env'));
  }

  // Create example flow
  const exampleFlow = {
    flow_id: null,
    name: "Example Flow",
    description: "A simple example flow",
    version: 1,
    graph: {
      pages: [],
      nodes: [
        {
          id: "trigger_1",
          category: "trigger",
          type: "manual",
          name: "Manual Trigger",
          connector: null,
          operation: null,
          params: {},
          inputs: [],
          outputs: ["trigger_data"],
          ui_hints: { x: 100, y: 100, summary: "Start the flow" }
        }
      ],
      connections: [],
      triggers: [
        { id: "t1", type: "manual", config: {}, to_node: "trigger_1" }
      ]
    },
    metadata: {
      owner: "you@example.com",
      created_at: new Date().toISOString(),
      tags: ["example"]
    }
  };

  fs.writeFileSync(
    'flows/json/example.json',
    JSON.stringify(exampleFlow, null, 2)
  );
  console.log(chalk.green('✓ Created flows/json/example.json'));

  // Create README
  const readme = `# UWG Project

This project was initialized with UWG CLI.

## Getting Started

1. Configure your environment variables in \`.env\`
2. Create flows in \`flows/json/\` or \`flows/dsl/\`
3. Run a flow: \`uwg run flows/json/example.json\`
4. Validate a flow: \`uwg validate flows/json/example.json\`

## Directory Structure

- \`flows/json/\` - Flow definitions in JSON format
- \`flows/dsl/\` - Flow definitions in DSL format
- \`examples/\` - Example flows and templates

## Documentation

Visit https://docs.uwg-engine.dev for full documentation.
`;

  fs.writeFileSync('README.md', readme);
  console.log(chalk.green('✓ Created README.md'));

  console.log(chalk.bold('\n✨ Project initialized successfully!'));
  console.log(chalk.gray('\nNext steps:'));
  console.log(chalk.gray('  1. Edit .env with your API keys'));
  console.log(chalk.gray('  2. Run: uwg run flows/json/example.json'));

  process.exit(0);
}

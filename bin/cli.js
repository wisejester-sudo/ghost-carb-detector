#!/usr/bin/env node

const { Command } = require('commander');
const GhostCarbDetector = require('../src/detector');

const program = new Command();

program
  .name('ghost-carb')
  .description('Detect unlogged carb events from Nightscout')
  .version('0.1.0');

program
  .command('config')
  .description('Configure Nightscout connection')
  .option('--nightscout-url <url>', 'Nightscout URL')
  .option('--api-secret <secret>', 'API Secret')
  .action((options) => {
    // Save config to ~/.ghost-carb/config.json
    console.log('Configuration saved');
  });

program
  .command('check')
  .description('Check for ghost carbs')
  .option('--notify', 'Send notification if found')
  .action(async (options) => {
    console.log('Checking for ghost carbs...');
    // Implementation
  });

program
  .command('dashboard')
  .description('Launch web dashboard')
  .action(() => {
    console.log('Dashboard not yet implemented');
  });

program.parse();

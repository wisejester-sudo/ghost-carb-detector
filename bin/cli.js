#!/usr/bin/env node

const { Command } = require('commander');
const GhostCarbDetector = require('../src/detector');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.ghost-carb');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Load config
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  }
  return {};
}

// Save config
function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

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
  .option('--rise-threshold <mg>', 'Glucose rise threshold (mg/dL)', '30')
  .option('--time-window <min>', 'Analysis window (minutes)', '90')
  .action((options) => {
    const config = loadConfig();
    
    if (options.nightscoutUrl) config.nightscoutUrl = options.nightscoutUrl;
    if (options.apiSecret) config.apiSecret = options.apiSecret;
    if (options.riseThreshold) config.riseThreshold = parseInt(options.riseThreshold);
    if (options.timeWindow) config.timeWindow = parseInt(options.timeWindow);
    
    saveConfig(config);
    console.log('✅ Configuration saved');
    console.log(`   Config file: ${CONFIG_FILE}`);
  });

program
  .command('test')
  .description('Test Nightscout connection')
  .action(async () => {
    const config = loadConfig();
    
    if (!config.nightscoutUrl) {
      console.error('❌ Nightscout URL not configured. Run: ghost-carb config --nightscout-url <url>');
      process.exit(1);
    }
    
    console.log('🔄 Testing Nightscout connection...\n');
    console.log(`   URL: ${config.nightscoutUrl}`);
    console.log(`   Auth: ${config.apiSecret ? 'API Secret configured' : 'No auth (open site)'}`);
    console.log('');
    
    try {
      const detector = new GhostCarbDetector(config);
      const glucoseData = await detector.fetchGlucoseData(1);
      const treatments = await detector.fetchTreatments(1);
      
      console.log('\n✅ Connection successful!');
      console.log(`   Retrieved ${glucoseData.length} glucose readings`);
      console.log(`   Retrieved ${treatments.all.length} treatments`);
      console.log('\n📊 Latest glucose:', glucoseData[0]?.glucose || 'N/A', 'mg/dL');
      
    } catch (error) {
      console.error('\n❌ Connection failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Check for ghost carbs')
  .option('--hours <hours>', 'Hours of data to analyze', '4')
  .option('--notify', 'Send notification if found')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const config = loadConfig();
    
    if (!config.nightscoutUrl) {
      console.error('❌ Nightscout URL not configured. Run: ghost-carb config --nightscout-url <url>');
      process.exit(1);
    }
    
    // Update config with CLI options
    config.timeWindow = parseInt(options.hours) * 60;
    
    try {
      const detector = new GhostCarbDetector(config);
      const ghosts = await detector.detect();
      
      if (options.json) {
        console.log(JSON.stringify(ghosts, null, 2));
        return;
      }
      
      console.log('\n' + '='.repeat(60));
      console.log('GHOST CARB DETECTION RESULTS');
      console.log('='.repeat(60) + '\n');
      
      if (ghosts.length === 0) {
        console.log('✅ No ghost carbs detected!');
        console.log('   All glucose rises appear to be accounted for.');
      } else {
        console.log(`🚨 Detected ${ghosts.length} potential ghost carb event(s):\n`);
        
        ghosts.forEach((ghost, i) => {
          const confEmoji = ghost.confidence > 0.8 ? '🔴' : ghost.confidence > 0.6 ? '🟡' : '🟢';
          const confPct = Math.round(ghost.confidence * 100);
          
          console.log(`${i + 1}. ${confEmoji} Ghost Carb #${i + 1} (${confPct}% confidence)`);
          console.log(`   Time: ${ghost.timestamp.toLocaleString()}`);
          console.log(`   Glucose: ${ghost.startGlucose} → ${ghost.peakGlucose} mg/dL (+${ghost.glucoseRise})`);
          console.log(`   Peak at: ${ghost.peakTime.toLocaleTimeString()} (${ghost.duration} min)`);
          console.log(`   Estimated carbs: ~${ghost.estimatedCarbs}g`);
          console.log('');
        });
        
        if (options.notify) {
          console.log('🔔 Notifications not yet implemented');
        }
      }
      
      console.log('='.repeat(60));
      
    } catch (error) {
      console.error('\n❌ Detection failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show configuration status')
  .action(() => {
    const config = loadConfig();
    
    console.log('\n📋 Configuration Status\n');
    console.log(`Config file: ${CONFIG_FILE}`);
    console.log(`Exists: ${fs.existsSync(CONFIG_FILE) ? '✅ Yes' : '❌ No'}\n`);
    
    if (config.nightscoutUrl) {
      console.log(`Nightscout URL: ${config.nightscoutUrl}`);
      console.log(`API Secret: ${config.apiSecret ? '✅ Set' : '❌ Not set (open site)'}`);
      console.log(`Rise Threshold: ${config.riseThreshold || 30} mg/dL`);
      console.log(`Time Window: ${config.timeWindow || 90} minutes`);
    } else {
      console.log('No configuration found. Run: ghost-carb config');
    }
    
    console.log('');
  });

program
  .command('dashboard')
  .description('Launch web dashboard')
  .action(() => {
    console.log('Dashboard not yet implemented');
    console.log('Coming in v0.2.0');
  });

program.parse();

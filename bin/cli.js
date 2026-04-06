#!/usr/bin/env node

const { Command } = require('commander');
const GhostCarbDetector = require('../src/detector');
const NotificationService = require('../src/notifications');
const Dashboard = require('../src/dashboard');
const PersonalML = require('../src/ml');
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
  .version('0.4.0');

program
  .command('config')
  .description('Configure Nightscout connection')
  .option('--nightscout-url <url>', 'Nightscout URL')
  .option('--api-secret <secret>', 'API Secret or token')
  .option('--use-token-auth', 'Use token-based auth (?token=) instead of header')
  .option('--rise-threshold <mg>', 'Glucose rise threshold (mg/dL)', '30')
  .option('--time-window <min>', 'Analysis window (minutes)', '90')
  .action((options) => {
    const config = loadConfig();
    
    if (options.nightscoutUrl) config.nightscoutUrl = options.nightscoutUrl;
    if (options.apiSecret) config.apiSecret = options.apiSecret;
    if (options.useTokenAuth) config.useTokenAuth = true;
    if (options.riseThreshold) config.riseThreshold = parseInt(options.riseThreshold);
    if (options.timeWindow) config.timeWindow = parseInt(options.timeWindow);
    
    saveConfig(config);
    console.log('✅ Configuration saved');
    console.log(`   Config file: ${CONFIG_FILE}`);
    if (config.useTokenAuth) console.log('   Auth method: Token-based (?token=)');
  });

program
  .command('config-notifications')
  .description('Configure notification channels')
  .option('--telegram-token <token>', 'Telegram bot token')
  .option('--telegram-chat <chatId>', 'Telegram chat ID')
  .option('--signal-url <url>', 'Signal CLI REST API URL')
  .option('--signal-phone <phone>', 'Signal phone number')
  .option('--pushover-app <token>', 'Pushover app token')
  .option('--pushover-user <key>', 'Pushover user key')
  .option('--slack-webhook <url>', 'Slack webhook URL')
  .option('--discord-webhook <url>', 'Discord webhook URL')
  .option('--webhook-url <url>', 'Custom webhook URL')
  .option('--remove <channel>', 'Remove a channel (telegram|signal|pushover|slack|discord|webhook)')
  .action((options) => {
    const config = loadConfig();
    
    if (!config.notifications) config.notifications = {};
    
    // Remove channel if requested
    if (options.remove) {
      delete config.notifications[options.remove];
      saveConfig(config);
      console.log(`✅ Removed ${options.remove} notifications`);
      return;
    }
    
    // Configure Telegram
    if (options.telegramToken || options.telegramChat) {
      config.notifications.telegram = config.notifications.telegram || {};
      if (options.telegramToken) config.notifications.telegram.botToken = options.telegramToken;
      if (options.telegramChat) config.notifications.telegram.chatId = options.telegramChat;
      console.log('✅ Telegram configured');
    }
    
    // Configure Signal
    if (options.signalUrl || options.signalPhone) {
      config.notifications.signal = config.notifications.signal || {};
      if (options.signalUrl) config.notifications.signal.apiUrl = options.signalUrl;
      if (options.signalPhone) config.notifications.signal.phoneNumber = options.signalPhone;
      console.log('✅ Signal configured');
    }
    
    // Configure Pushover
    if (options.pushoverApp || options.pushoverUser) {
      config.notifications.pushover = config.notifications.pushover || {};
      if (options.pushoverApp) config.notifications.pushover.appToken = options.pushoverApp;
      if (options.pushoverUser) config.notifications.pushover.userKey = options.pushoverUser;
      console.log('✅ Pushover configured');
    }
    
    // Configure Slack
    if (options.slackWebhook) {
      config.notifications.slack = { webhookUrl: options.slackWebhook };
      console.log('✅ Slack configured');
    }
    
    // Configure Discord
    if (options.discordWebhook) {
      config.notifications.discord = { webhookUrl: options.discordWebhook };
      console.log('✅ Discord configured');
    }
    
    // Configure Webhook
    if (options.webhookUrl) {
      config.notifications.webhook = { url: options.webhookUrl };
      console.log('✅ Webhook configured');
    }
    
    saveConfig(config);
    console.log(`\n   Config file: ${CONFIG_FILE}`);
  });

program
  .command('test')
  .description('Test Nightscout connection and notifications')
  .option('--notifications', 'Test notification channels')
  .action(async (options) => {
    const config = loadConfig();
    
    if (options.notifications) {
      // Test notifications
      const notifier = new NotificationService(config.notifications);
      await notifier.test();
      return;
    }
    
    // Test Nightscout
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
  .option('--quiet', 'Only output if ghosts found')
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
      
      // Quiet mode - only output if ghosts found
      if (options.quiet && ghosts.length === 0) {
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
        
        // Send notifications if requested
        if (options.notify && config.notifications) {
          const notifier = new NotificationService(config.notifications);
          await notifier.notify(ghosts);
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
      console.log('🔌 Nightscout Connection');
      console.log(`   URL: ${config.nightscoutUrl}`);
      console.log(`   Auth: ${config.apiSecret ? '✅ Set' : '❌ Not set (open site)'}`);
      console.log(`   Rise Threshold: ${config.riseThreshold || 30} mg/dL`);
      console.log(`   Time Window: ${config.timeWindow || 90} minutes\n`);
      
      if (config.notifications) {
        const channels = Object.keys(config.notifications);
        console.log(`🔔 Notifications (${channels.length} channels)`);
        channels.forEach(ch => {
          console.log(`   ✅ ${ch.charAt(0).toUpperCase() + ch.slice(1)}`);
        });
      } else {
        console.log('🔔 Notifications: ❌ None configured');
      }
    } else {
      console.log('No configuration found. Run: ghost-carb config');
    }
    
    console.log('');
  });

program
  .command('dashboard')
  .description('Launch web dashboard')
  .option('--port <port>', 'Dashboard port', '3456')
  .action(async (options) => {
    const config = loadConfig();
    
    if (!config.nightscoutUrl) {
      console.error('❌ Nightscout URL not configured. Run: ghost-carb config --nightscout-url <url>');
      process.exit(1);
    }
    
    config.dashboardPort = parseInt(options.port);
    
    console.log('🚀 Starting Ghost Carb Detector Dashboard...\n');
    
    const dashboard = new Dashboard(config);
    await dashboard.start();
    
    // Keep process alive
    process.on('SIGINT', () => {
      console.log('\n\n👋 Shutting down dashboard...');
      dashboard.stop();
      process.exit(0);
    });
  });

program
  .command('demo')
  .description('Send a test notification to all channels')
  .action(async () => {
    const config = loadConfig();
    
    if (!config.notifications) {
      console.error('❌ No notifications configured');
      process.exit(1);
    }
    
    const notifier = new NotificationService(config.notifications);
    
    const testGhost = [{
      timestamp: new Date(),
      peakTime: new Date(Date.now() + 45 * 60000),
      estimatedCarbs: 30,
      confidence: 0.88,
      glucoseRise: 55,
      startGlucose: 95,
      peakGlucose: 150,
      duration: 45
    }];
    
    console.log('🧪 Sending demo notification...');
    await notifier.notify(testGhost);
    console.log('✅ Done!');
  });

// Machine Learning Commands
program
  .command('ml-status')
  .description('Show ML model status')
  .action(() => {
    const PersonalML = require('../src/ml');
    const ml = new PersonalML({});
    const stats = ml.getStats();
    
    console.log('\n🧠 Machine Learning Status\n');
    
    if (!stats.learned) {
      console.log('❌ Model not trained yet');
      console.log(`   Training examples: ${stats.trainingExamples}/5`);
      console.log('\n   Use "ghost-carb ml-learn" to add confirmed treatments');
    } else {
      console.log('✅ Model trained');
      console.log(`   R² Score: ${stats.rSquared}`);
      console.log(`   Training examples: ${stats.sampleSize}`);
      console.log(`   Rise per 15g carbs: ~${stats.avgRisePer15g} mg/dL`);
      console.log(`   Avg peak time: ~${stats.peakTimeAvg} min`);
      console.log(`   Last trained: ${new Date(stats.lastTrained).toLocaleString()}`);
      
      if (stats.timeOfDayPatterns) {
        console.log('\n📊 Time-of-day patterns:');
        Object.entries(stats.timeOfDayPatterns).forEach(([hour, data]) => {
          console.log(`   ${hour}:00 - avg rise ${data.avgRise} mg/dL (${data.count} examples)`);
        });
      }
    }
    
    console.log('');
  });

program
  .command('ml-train')
  .description('Force retrain the ML model')
  .action(() => {
    const PersonalML = require('../src/ml');
    const ml = new PersonalML({});
    
    console.log('\n🧠 Retraining model...\n');
    ml.retrain();
    console.log('✅ Done!\n');
  });

program
  .command('ml-learn')
  .description('Learn from a confirmed treatment')
  .requiredOption('--carbs <g>', 'Actual carbs consumed')
  .option('--insulin <u>', 'Insulin units given', '0')
  .option('--time <iso>', 'Timestamp (ISO 8601)', new Date().toISOString())
  .action((options) => {
    const PersonalML = require('../src/ml');
    const ml = new PersonalML({});
    
    console.log('\n🧠 Learning from confirmed treatment...\n');
    
    // Create mock features (in real use, this would extract from glucose data)
    const features = {
      timestamp: options.time,
      rise: parseInt(options.carbs) * 4, // rough estimate
      timeToPeak: 60,
      duration: 120,
      riseRate: 0.8,
      avgGlucose: 120,
      auc: 14400,
      startGlucose: 100,
      peakGlucose: 140,
      endGlucose: 110,
      readingCount: 24
    };
    
    ml.learnFromTreatment(features, parseInt(options.carbs), parseFloat(options.insulin));
    console.log(`✅ Learned: ${options.carbs}g carbs → ~${features.rise} mg/dL rise`);
    console.log(`   Total examples: ${ml.trainingData.length}\n`);
    
    // Retrain if enough examples
    if (ml.trainingData.length >= 5) {
      ml.retrain();
    }
  });

program
  .command('ml-clear')
  .description('Clear all learned ML data')
  .action(() => {
    const PersonalML = require('../src/ml');
    const ml = new PersonalML({});
    
    console.log('\n🗑️  Clearing all learned data...\n');
    ml.clear();
    console.log('✅ All ML data cleared\n');
  });

program
  .command('ml-export')
  .description('Export training data to JSON')
  .option('--file <path>', 'Output file path')
  .action((options) => {
    const PersonalML = require('../src/ml');
    const ml = new PersonalML({});
    
    const data = ml.exportTrainingData();
    
    const outputPath = options.file || path.join(os.homedir(), '.ghost-carb', 'ml-export.json');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    
    console.log(`\n✅ Exported ${ml.trainingData.length} examples to ${outputPath}\n`);
  });

program
  .command('ml-import')
  .description('Import training data from JSON')
  .requiredOption('--file <path>', 'Input file path')
  .action((options) => {
    const PersonalML = require('../src/ml');
    const ml = new PersonalML({});
    
    if (!fs.existsSync(options.file)) {
      console.error(`\n❌ File not found: ${options.file}\n`);
      process.exit(1);
    }
    
    const data = JSON.parse(fs.readFileSync(options.file, 'utf8'));
    ml.importTrainingData(data);
    
    console.log(`\n✅ Imported ${ml.trainingData.length} examples`);
    console.log(`   Model status: ${ml.patterns.learned ? 'trained' : 'not trained'}\n`);
  });

program.parse();

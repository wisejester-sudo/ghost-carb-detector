/**
 * Notification service for Ghost Carb Detector
 * Supports multiple channels: Telegram, Signal, Pushover, Slack, Discord, webhook
 */

const axios = require('axios');

class NotificationService {
  constructor(config) {
    this.config = config || {};
  }

  /**
   * Send notification for ghost carb detection
   * @param {Array} ghosts - Array of detected ghost carbs
   * @param {Object} stats - Detection statistics
   */
  async notify(ghosts, stats = {}) {
    if (!ghosts || ghosts.length === 0) {
      return; // No ghosts to report
    }

    const enabledChannels = this.getEnabledChannels();
    
    if (enabledChannels.length === 0) {
      console.log('⚠️  No notification channels configured');
      return;
    }

    console.log(`\n📤 Sending notifications to ${enabledChannels.length} channel(s)...`);

    const results = [];
    
    for (const channel of enabledChannels) {
      try {
        await this.sendToChannel(channel, ghosts, stats);
        results.push({ channel: channel.name, success: true });
        console.log(`  ✅ ${channel.name}`);
      } catch (error) {
        results.push({ channel: channel.name, success: false, error: error.message });
        console.log(`  ❌ ${channel.name}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Get list of enabled notification channels
   */
  getEnabledChannels() {
    const channels = [];

    if (this.config.telegram?.botToken && this.config.telegram?.chatId) {
      channels.push({ name: 'Telegram', type: 'telegram' });
    }

    if (this.config.signal?.phoneNumber && this.config.signal?.apiUrl) {
      channels.push({ name: 'Signal', type: 'signal' });
    }

    if (this.config.pushover?.appToken && this.config.pushover?.userKey) {
      channels.push({ name: 'Pushover', type: 'pushover' });
    }

    if (this.config.slack?.webhookUrl) {
      channels.push({ name: 'Slack', type: 'slack' });
    }

    if (this.config.discord?.webhookUrl) {
      channels.push({ name: 'Discord', type: 'discord' });
    }

    if (this.config.webhook?.url) {
      channels.push({ name: 'Webhook', type: 'webhook' });
    }

    return channels;
  }

  /**
   * Send notification to specific channel
   */
  async sendToChannel(channel, ghosts, stats) {
    const message = this.formatMessage(ghosts, stats, channel.type);

    switch (channel.type) {
      case 'telegram':
        return await this.sendTelegram(message, ghosts);
      case 'signal':
        return await this.sendSignal(message);
      case 'pushover':
        return await this.sendPushover(message, ghosts);
      case 'slack':
        return await this.sendSlack(message, ghosts);
      case 'discord':
        return await this.sendDiscord(message, ghosts);
      case 'webhook':
        return await this.sendWebhook(message, ghosts, stats);
      default:
        throw new Error(`Unknown channel type: ${channel.type}`);
    }
  }

  /**
   * Format message for notifications
   */
  formatMessage(ghosts, stats, channelType) {
    const emoji = channelType === 'slack' || channelType === 'discord' ? ':ghost:' : '👻';
    const fireEmoji = channelType === 'slack' || channelType === 'discord' ? ':fire:' : '🔥';
    
    let message = `${fireEmoji} **Ghost Carb Detector Alert** ${fireEmoji}\n\n`;
    message += `Detected ${ghosts.length} unlogged carb event(s):\n\n`;

    ghosts.forEach((ghost, i) => {
      const confPct = Math.round(ghost.confidence * 100);
      const confEmoji = ghost.confidence > 0.8 ? '🔴' : ghost.confidence > 0.6 ? '🟡' : '🟢';
      
      message += `${i + 1}. ${confEmoji} **Ghost Carb #${i + 1}** (${confPct}% confidence)\n`;
      message += `   📅 ${ghost.timestamp.toLocaleString()}\n`;
      message += `   📈 ${ghost.startGlucose} → ${ghost.peakGlucose} mg/dL (+${ghost.glucoseRise})\n`;
      message += `   🍞 ~${ghost.estimatedCarbs}g carbs\n`;
      message += `   ⏱️  Peak at ${ghost.peakTime.toLocaleTimeString()} (${ghost.duration} min)\n\n`;
    });

    message += `Open Nightscout to log these treatments.`;

    return message;
  }

  /**
   * Send Telegram notification
   */
  async sendTelegram(message, ghosts) {
    const { botToken, chatId } = this.config.telegram;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    // Format for Telegram (HTML mode)
    const htmlMessage = message
      .replace(/\*\*/g, '<b>')
      .replace(/🔴/g, '🚨')
      .replace(/🟡/g, '⚠️')
      .replace(/🟢/g, '✅');

    await axios.post(url, {
      chat_id: chatId,
      text: htmlMessage,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
  }

  /**
   * Send Signal notification (via signal-cli-rest-api)
   */
  async sendSignal(message) {
    const { phoneNumber, apiUrl } = this.config.signal;
    
    await axios.post(`${apiUrl}/v2/send`, {
      message,
      number: phoneNumber,
      recipients: [phoneNumber]
    });
  }

  /**
   * Send Pushover notification
   */
  async sendPushover(message, ghosts) {
    const { appToken, userKey } = this.config.pushover;
    
    // Get highest confidence ghost
    const highestConf = ghosts.reduce((max, g) => g.confidence > max.confidence ? g : max);
    
    await axios.post('https://api.pushover.net/1/messages.json', {
      token: appToken,
      user: userKey,
      title: `Ghost Carb Detected (${Math.round(highestConf.confidence * 100)}% confidence)`,
      message: ghosts.map(g => `~${g.estimatedCarbs}g carbs at ${g.timestamp.toLocaleTimeString()}`).join(', '),
      priority: highestConf.confidence > 0.8 ? 1 : 0, // High priority for high confidence
      sound: highestConf.confidence > 0.8 ? 'siren' : 'pushover'
    });
  }

  /**
   * Send Slack notification
   */
  async sendSlack(message, ghosts) {
    const { webhookUrl } = this.config.slack;
    
    // Format blocks for Slack
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '👻 Ghost Carb Detector Alert',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Detected ${ghosts.length} unlogged carb event(s):`
        }
      },
      { type: 'divider' }
    ];

    ghosts.forEach((ghost, i) => {
      const confPct = Math.round(ghost.confidence * 100);
      const emoji = ghost.confidence > 0.8 ? '🚨' : ghost.confidence > 0.6 ? '⚠️' : '✅';
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *Ghost Carb #${i + 1}* (${confPct}% confidence)\n` +
                `📅 ${ghost.timestamp.toLocaleString()}\n` +
                `📈 ${ghost.startGlucose} → ${ghost.peakGlucose} mg/dL (+${ghost.glucoseRise})\n` +
                `🍞 ~${ghost.estimatedCarbs}g carbs\n` +
                `⏱️ Peak at ${ghost.peakTime.toLocaleTimeString()} (${ghost.duration} min)`
        }
      });
    });

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Open Nightscout to log these treatments'
        }
      ]
    });

    await axios.post(webhookUrl, { blocks });
  }

  /**
   * Send Discord notification
   */
  async sendDiscord(message, ghosts) {
    const { webhookUrl } = this.config.discord;
    
    // Format embeds for Discord
    const embeds = ghosts.map((ghost, i) => {
      const confPct = Math.round(ghost.confidence * 100);
      const color = ghost.confidence > 0.8 ? 0xff0000 : ghost.confidence > 0.6 ? 0xffaa00 : 0x00ff00;
      
      return {
        title: `👻 Ghost Carb #${i + 1} (${confPct}% confidence)`,
        color: color,
        fields: [
          {
            name: '📅 Time',
            value: ghost.timestamp.toLocaleString(),
            inline: true
          },
          {
            name: '📈 Glucose Rise',
            value: `${ghost.startGlucose} → ${ghost.peakGlucose} mg/dL (+${ghost.glucoseRise})`,
            inline: true
          },
          {
            name: '🍞 Estimated Carbs',
            value: `~${ghost.estimatedCarbs}g`,
            inline: true
          },
          {
            name: '⏱️ Peak Time',
            value: `${ghost.peakTime.toLocaleTimeString()} (${ghost.duration} min)`,
            inline: true
          }
        ],
        timestamp: ghost.timestamp.toISOString()
      };
    });

    await axios.post(webhookUrl, {
      content: '🔥 **Ghost Carb Detector Alert** 🔥',
      embeds: embeds
    });
  }

  /**
   * Send generic webhook notification
   */
  async sendWebhook(message, ghosts, stats) {
    const { url, method = 'POST', headers = {} } = this.config.webhook;
    
    const payload = {
      event: 'ghost_carb_detected',
      timestamp: new Date().toISOString(),
      count: ghosts.length,
      ghosts: ghosts.map(g => ({
        timestamp: g.timestamp.toISOString(),
        peakTime: g.peakTime.toISOString(),
        estimatedCarbs: g.estimatedCarbs,
        confidence: g.confidence,
        glucoseRise: g.glucoseRise,
        startGlucose: g.startGlucose,
        peakGlucose: g.peakGlucose,
        duration: g.duration
      })),
      message: message
    };

    await axios.request({
      url,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      data: payload
    });
  }

  /**
   * Test all configured notification channels
   */
  async test() {
    const enabledChannels = this.getEnabledChannels();
    
    if (enabledChannels.length === 0) {
      console.log('⚠️  No notification channels configured');
      console.log('Run: ghost-carb config --notifications');
      return;
    }

    console.log(`\n🧪 Testing ${enabledChannels.length} notification channel(s)...\n`);

    const testGhost = [{
      timestamp: new Date(),
      peakTime: new Date(Date.now() + 45 * 60000),
      estimatedCarbs: 25,
      confidence: 0.85,
      glucoseRise: 50,
      startGlucose: 100,
      peakGlucose: 150,
      duration: 45
    }];

    const stats = { totalReadings: 48, analysisTime: '0.3s' };

    for (const channel of enabledChannels) {
      try {
        await this.sendToChannel(channel, testGhost, stats);
        console.log(`  ✅ ${channel.name} — Test message sent`);
      } catch (error) {
        console.log(`  ❌ ${channel.name} — ${error.message}`);
      }
    }
    
    console.log('');
  }
}

module.exports = NotificationService;

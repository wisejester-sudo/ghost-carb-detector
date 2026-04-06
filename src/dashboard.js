/**
 * Web Dashboard for Ghost Carb Detector
 * Express server with real-time glucose visualization
 */

const express = require('express');
const path = require('path');
const GhostCarbDetector = require('./detector');
const NotificationService = require('./notifications');

class Dashboard {
  constructor(config) {
    this.config = config;
    this.app = express();
    this.port = config.dashboardPort || 3456;
    this.setupRoutes();
  }

  setupRoutes() {
    // Static files
    this.app.use(express.static(path.join(__dirname, '../public')));
    this.app.use(express.json());

    // API: Get current glucose data
    this.app.get('/api/glucose', async (req, res) => {
      try {
        const hours = parseInt(req.query.hours) || 4;
        const detector = new GhostCarbDetector(this.config);
        const data = await detector.fetchGlucoseData(hours);
        res.json({ success: true, data });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API: Get treatments
    this.app.get('/api/treatments', async (req, res) => {
      try {
        const hours = parseInt(req.query.hours) || 4;
        const detector = new GhostCarbDetector(this.config);
        const data = await detector.fetchTreatments(hours);
        res.json({ success: true, data });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API: Run ghost carb detection
    this.app.get('/api/detect', async (req, res) => {
      try {
        const hours = parseInt(req.query.hours) || 4;
        const detector = new GhostCarbDetector({
          ...this.config,
          timeWindow: hours * 60
        });
        const ghosts = await detector.detect();
        res.json({ success: true, ghosts });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API: Get config
    this.app.get('/api/config', (req, res) => {
      // Return config without sensitive data
      const safeConfig = {
        nightscoutUrl: this.config.nightscoutUrl,
        riseThreshold: this.config.riseThreshold,
        timeWindow: this.config.timeWindow,
        hasApiSecret: !!this.config.apiSecret,
        notifications: Object.keys(this.config.notifications || {})
      };
      res.json({ success: true, config: safeConfig });
    });

    // API: Update config
    this.app.post('/api/config', (req, res) => {
      // Update config (in-memory only for now)
      if (req.query.riseThreshold) {
        this.config.riseThreshold = parseInt(req.query.riseThreshold);
      }
      if (req.query.timeWindow) {
        this.config.timeWindow = parseInt(req.query.timeWindow);
      }
      res.json({ success: true, config: this.config });
    });

    // API: Send test notification
    this.app.post('/api/test-notification', async (req, res) => {
      try {
        if (!this.config.notifications) {
          return res.status(400).json({ success: false, error: 'No notifications configured' });
        }

        const notifier = new NotificationService(this.config.notifications);
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

        await notifier.notify(testGhost);
        res.json({ success: true, message: 'Test notification sent' });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Serve main page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });
  }

  start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`\n🚀 Dashboard running at http://localhost:${this.port}`);
        console.log(`   Press Ctrl+C to stop\n`);
        resolve();
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
  }
}

module.exports = Dashboard;

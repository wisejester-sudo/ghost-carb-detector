# Ghost Carb Detector

Detect unlogged carb events from Nightscout CGM data using glucose curve analysis.

## The Problem

People forget to log meals all the time. You eat a snack, get distracted, never enter it in Nightscout. Later you're chasing unexplained highs with no data. Nightscout just shows "wtf happened at 3 PM?"

## The Solution

Analyze glucose curves to detect unlogged carb events automatically.

## Installation

```bash
# Clone the repo
git clone https://github.com/wisejester-sudo/ghost-carb-detector.git
cd ghost-carb-detector

# Install dependencies
npm install

# Link for global CLI access
npm link
```

## Configuration

### Step 1: Nightscout Connection

```bash
# Set up your Nightscout connection
ghost-carb config --nightscout-url https://your-nightscout.herokuapp.com --api-secret your-api-secret

# View current config
ghost-carb status
```

### Step 2: Notifications (Optional)

Configure one or more notification channels:

#### Telegram
```bash
ghost-carb config-notifications \
  --telegram-token YOUR_BOT_TOKEN \
  --telegram-chat YOUR_CHAT_ID
```

#### Pushover (iOS/Android)
```bash
ghost-carb config-notifications \
  --pushover-app YOUR_APP_TOKEN \
  --pushover-user YOUR_USER_KEY
```

#### Slack
```bash
ghost-carb config-notifications \
  --slack-webhook https://hooks.slack.com/services/...
```

#### Discord
```bash
ghost-carb config-notifications \
  --discord-webhook https://discord.com/api/webhooks/...
```

## Usage

### Web Dashboard (NEW v0.3.0)

Launch the visual dashboard:

```bash
# Start dashboard on default port (3456)
ghost-carb dashboard

# Use custom port
ghost-carb dashboard --port 8080
```

Then open http://localhost:3456 in your browser.

**Dashboard Features:**
- 📈 **Real-time glucose chart** with Chart.js visualization
- 👻 **Ghost carb detection** with one-click analysis
- 📊 **Statistics** (current glucose, average, readings count)
- 💉 **Recent treatments** list
- ⚙️ **Adjustable parameters** (time range, rise threshold)
- 📤 **Test notifications** from the UI
- 🔄 **Auto-refresh** every 5 minutes

### CLI Commands

```bash
# Test connections
ghost-carb test                          # Test Nightscout
ghost-carb test --notifications          # Test notification channels

# Run detection
ghost-carb check                         # Check last 4 hours
ghost-carb check --hours 8 --notify      # Check 8 hours with notifications
ghost-carb check --quiet                 # Only output if ghosts found (for cron)

# Send demo notification
ghost-carb demo

# View status
ghost-carb status
```

## Automated Monitoring

### Cron Setup

Check every 15 minutes:

```bash
crontab -e

# Add:
*/15 * * * * /usr/local/bin/ghost-carb check --quiet --notify
```

### Run Dashboard as Service (systemd)

Create `/etc/systemd/system/ghost-carb-dashboard.service`:

```ini
[Unit]
Description=Ghost Carb Detector Dashboard
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/your-username/ghost-carb-detector
ExecStart=/usr/bin/node bin/cli.js dashboard
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable ghost-carb-dashboard
sudo systemctl start ghost-carb-dashboard
```

## How It Works

### Detection Logic

1. **Pattern Recognition** — Detects carb signatures:
   - Sharp rise (>30 mg/dL)
   - Peak around 60-90 min post-ingestion
   - Smooth parabolic shape

2. **Insulin-Agnostic Detection** — Compares actual vs expected glucose:
   - Calculates Insulin On Board (IOB)
   - Identifies rises that insulin can't explain

3. **Smart Filtering** — Avoids false positives:
   - Excludes already-logged treatments
   - Filters exercise spikes (different pattern)
   - Ignores sensor noise

4. **Confidence Scoring** — Rates each detection (0-100%)

### Algorithm Details

See [ALGORITHM.md](ALGORITHM.md) for:
- IOB calculation with exponential decay
- Pattern matching parameters
- Confidence scoring formula
- Curve analysis methodology

## Configuration Options

```bash
# Adjust detection sensitivity
ghost-carb config --rise-threshold 40      # Only flag rises >40 mg/dL
ghost-carb config --time-window 120        # Analyze 2-hour windows
```

| Option | Default | Description |
|--------|---------|-------------|
| `rise-threshold` | 30 | Min glucose rise to flag (mg/dL) |
| `time-window` | 90 | Analysis window (minutes) |

## Status

✅ **v0.3.0** — Web Dashboard + Notifications + Core detection

- ✅ Web dashboard with real-time charts
- ✅ Multi-channel notifications (Telegram, Signal, Pushover, Slack, Discord)
- ✅ Fetch glucose data from Nightscout
- ✅ Fetch treatments (insulin/carbs)
- ✅ Calculate IOB
- ✅ Detect carb patterns
- ✅ Filter logged treatments
- ✅ Confidence scoring
- ✅ CLI with config/test/check/status commands
- 🔄 Machine learning for personal patterns (coming v0.4.0)

## Screenshots

**Dashboard Overview:**
- Dark theme optimized for CGM monitoring
- Interactive glucose chart
- Ghost carb detection with confidence badges
- Real-time statistics

## License

MIT

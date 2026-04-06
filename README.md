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

### Step 2: Notifications (Optional but Recommended)

Configure one or more notification channels:

#### Telegram
```bash
# Get bot token from @BotFather, chat ID from @userinfobot
ghost-carb config-notifications \
  --telegram-token YOUR_BOT_TOKEN \
  --telegram-chat YOUR_CHAT_ID
```

#### Pushover (iOS/Android)
```bash
# Get tokens from pushover.net
ghost-carb config-notifications \
  --pushover-app YOUR_APP_TOKEN \
  --pushover-user YOUR_USER_KEY
```

#### Slack
```bash
# Create webhook at https://api.slack.com/messaging/webhooks
ghost-carb config-notifications \
  --slack-webhook https://hooks.slack.com/services/...
```

#### Discord
```bash
# Create webhook in Server Settings > Integrations
ghost-carb config-notifications \
  --discord-webhook https://discord.com/api/webhooks/...
```

#### Signal (requires signal-cli-rest-api)
```bash
ghost-carb config-notifications \
  --signal-url http://localhost:8080 \
  --signal-phone +1234567890
```

#### Custom Webhook
```bash
ghost-carb config-notifications \
  --webhook-url https://your-service.com/webhook
```

### Remove Notification Channel
```bash
ghost-carb config-notifications --remove telegram
```

## Usage

### Test Connection

```bash
# Test Nightscout
ghost-carb test

# Test notifications
ghost-carb test --notifications
```

### Run Detection

```bash
# Check last 4 hours (default)
ghost-carb check

# Check last 8 hours with notifications
ghost-carb check --hours 8 --notify

# Only show output if ghosts found (good for cron)
ghost-carb check --quiet

# Output as JSON
ghost-carb check --json

# Send demo notification
ghost-carb demo
```

### Example Output

```
🔍 Starting ghost carb detection...

Fetching 4h of glucose data...
  ✓ Retrieved 48 glucose readings

Fetching 4h of treatment data...
  ✓ Retrieved 12 treatments (3 insulin, 2 carbs)

💉 Calculating insulin on board...
  ✓ IOB calculated for 48 readings

🎯 Analyzing glucose patterns...
  ✓ Found 3 potential carb events

🧹 Filtering logged treatments...
  ✓ 1 unlogged events detected

============================================================
GHOST CARB DETECTION RESULTS
============================================================

🚨 Detected 1 potential ghost carb event(s):

1. 🔴 Ghost Carb #1 (85% confidence)
   Time: 4/6/2026, 2:47:00 PM
   Glucose: 120 → 165 mg/dL (+45)
   Peak at: 3:32:00 PM (45 min)
   Estimated carbs: ~10g

📤 Sending notifications to 2 channel(s)...
  ✅ Telegram
  ✅ Pushover

============================================================
```

## Automated Monitoring

### Cron Setup (Linux/Mac)

Check every 15 minutes:

```bash
# Edit crontab
crontab -e

# Add line:
*/15 * * * * /usr/local/bin/ghost-carb check --quiet --notify
```

### systemd Timer (Linux)

Create `/etc/systemd/system/ghost-carb.service`:

```ini
[Unit]
Description=Ghost Carb Detector

[Service]
Type=oneshot
ExecStart=/usr/local/bin/ghost-carb check --notify
User=your-username
```

Create `/etc/systemd/system/ghost-carb.timer`:

```ini
[Unit]
Description=Run Ghost Carb Detector every 15 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=15min

[Install]
WantedBy=timers.target
```

Enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable ghost-carb.timer
sudo systemctl start ghost-carb.timer
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

See [ALGORITHM.md](ALGORITHM.md) for technical details on:
- IOB calculation
- Pattern matching
- Confidence scoring
- Curve analysis

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

🚧 **v0.2.0** — Notifications + Core detection

- ✅ Fetch glucose data from Nightscout
- ✅ Fetch treatments (insulin/carbs)
- ✅ Calculate IOB
- ✅ Detect carb patterns
- ✅ Filter logged treatments
- ✅ Confidence scoring
- ✅ Notifications (Telegram, Signal, Pushover, Slack, Discord, Webhook)
- 🔄 Web dashboard (coming v0.3.0)
- 🔄 Machine learning (coming v0.4.0)

## License

MIT

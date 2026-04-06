# Ghost Carb Detector 👻

**Never miss a meal again.**

A smart tool that analyzes your continuous glucose monitor (CGM) data to detect when you've eaten carbs but forgot to log them.

## What is this?

If you use a CGM (like Dexcom, Libre, or Medtronic) with Nightscout, you know the struggle:

- You eat a snack
- Get distracted
- Forget to log it in your app
- Later you're wondering "Why is my glucose high?"

**Ghost Carb Detector** watches your glucose data and spots those "invisible" meals automatically. It learns your personal patterns and gets smarter over time.

## Who is this for?

- **People with diabetes** using Nightscout
- **Caregivers** monitoring loved ones
- **Data geeks** who want insights into their glucose patterns

## Features

### 🔍 **Ghost Carb Detection**
- Analyzes glucose curves for carb signatures
- Detects sharp rises that insulin can't explain
- Filters out exercise spikes and sensor noise

### 🧠 **Machine Learning** (NEW in v0.4.0)
- Learns YOUR personal carb response
- Gets more accurate as you use it
- Predicts carbs based on your history

### 📱 **Notifications**
- Telegram
- Signal  
- Pushover (iOS/Android)
- Slack
- Discord
- Custom webhooks

### 📊 **Web Dashboard**
- Visual glucose charts
- One-click detection
- Real-time monitoring
- Dark theme (easy on the eyes)

### 💻 **CLI Tool**
- Quick command-line checks
- Cron automation
- Export/import data

## Installation

### Requirements
- Node.js 16 or higher
- A Nightscout instance
- (Optional) Notification service accounts

### Step 1: Install

```bash
# Clone the repository
git clone https://github.com/wisejester-sudo/ghost-carb-detector.git

# Go into the folder
cd ghost-carb-detector

# Install dependencies
npm install

# Install globally (so you can run 'ghost-carb' from anywhere)
npm link
```

**Windows users:** You might need to run Command Prompt or PowerShell as Administrator for `npm link` to work.

### Step 2: Verify Installation

```bash
ghost-carb --version
```

You should see `0.4.0`.

## Quick Start

### 1. Configure Nightscout

You need to tell Ghost Carb Detector where your Nightscout data lives:

```bash
ghost-carb config --nightscout-url https://your-nightscout.herokuapp.com
```

If your Nightscout requires authentication:

```bash
ghost-carb config --nightscout-url https://your-nightscout.herokuapp.com --api-secret your-secret-here
```

### 2. Test the Connection

```bash
ghost-carb test
```

You should see:
```
🔄 Testing Nightscout connection...

   URL: https://your-nightscout.herokuapp.com
   Auth: API Secret configured

✅ Connection successful!
   Retrieved 12 glucose readings
   Retrieved 3 treatments

📊 Latest glucose: 142 mg/dL
```

### 3. Run Your First Detection

```bash
ghost-carb check
```

This checks the last 4 hours for unlogged carbs.

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

============================================================
```

**What this means:** At 2:47 PM, your glucose jumped from 120 to 165 mg/dL. That looks like a 10g carb snack that wasn't logged.

## Understanding the Confidence Score

| Emoji | Confidence | Meaning |
|-------|-----------|---------|
| 🔴 | 80-100% | High confidence - likely a real unlogged meal |
| 🟡 | 60-79% | Medium confidence - check if it was exercise |
| 🟢 | <60% | Low confidence - might be a false alarm |

## Setting Up Notifications

Get alerts on your phone when ghost carbs are detected.

### Telegram (Recommended - Free)

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow instructions
3. Save your bot token (looks like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)
4. Message [@userinfobot](https://t.me/userinfobot) to get your chat ID

```bash
ghost-carb config-notifications \
  --telegram-token YOUR_BOT_TOKEN \
  --telegram-chat YOUR_CHAT_ID
```

Test it:
```bash
ghost-carb test --notifications
```

### Pushover (iOS/Android - $5 one-time)

1. Sign up at [pushover.net](https://pushover.net)
2. Create an application to get an app token
3. Get your user key from the dashboard

```bash
ghost-carb config-notifications \
  --pushover-app YOUR_APP_TOKEN \
  --pushover-user YOUR_USER_KEY
```

### Slack

1. Go to your Slack workspace settings
2. Create an incoming webhook
3. Copy the webhook URL

```bash
ghost-carb config-notifications \
  --slack-webhook https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Discord

1. In your Discord server, go to Server Settings → Integrations → Webhooks
2. Create a webhook
3. Copy the URL

```bash
ghost-carb config-notifications \
  --discord-webhook https://discord.com/api/webhooks/...
```

## Using the Web Dashboard

The dashboard gives you a visual interface for monitoring.

### Start the Dashboard

```bash
ghost-carb dashboard
```

Then open [http://localhost:3456](http://localhost:3456) in your browser.

**To use a different port:**
```bash
ghost-carb dashboard --port 8080
```

### Dashboard Features

**📈 Glucose Chart**
- Shows your glucose over time
- Zoomable time ranges (2h to 24h)
- Color-coded by level

**👻 Ghost Detection Button**
- One-click analysis
- See results immediately
- Confidence badges

**📊 Statistics**
- Current glucose
- Average glucose
- Number of readings
- Ghosts detected today

**💉 Recent Treatments**
- Shows last 10 insulin/carbs
- Helps spot missed entries

**⚙️ Adjustable Settings**
- Change time range
- Adjust rise threshold
- Test notifications

### Auto-Refresh

The dashboard updates automatically every 5 minutes. Keep it open in a browser tab to monitor throughout the day.

## Machine Learning (Making it Smarter)

Ghost Carb Detector learns your personal glucose response patterns. The more you use it, the better it gets.

### How It Works

Everyone's body responds differently to carbs:
- You might rise 60 mg/dL from 15g carbs
- Someone else might only rise 40 mg/dL
- The app learns YOUR pattern

### Check ML Status

```bash
ghost-carb ml-status
```

**Before training:**
```
🧠 Machine Learning Status

❌ Model not trained yet
   Training examples: 0/5

   Use "ghost-carb ml-learn" to add confirmed treatments
```

**After training:**
```
🧠 Machine Learning Status

✅ Model trained
   R² Score: 0.87
   Training examples: 23
   Rise per 15g carbs: ~58 mg/dL
   Avg peak time: ~62 min
   Last trained: 4/6/2026, 2:15:00 PM
```

### Teach the App

When the app detects a ghost carb, you can confirm if it's real:

```bash
ghost-carb ml-learn --carbs 30 --insulin 2
```

This tells the app:
- "Yes, I ate 30g carbs"
- "I took 2 units of insulin"
- "Learn from this for next time"

**Tips:**
- Add examples when you're sure what you ate
- Include insulin if you took any
- The app needs at least 5 examples to train

### See Time Patterns

The app learns when you typically eat:

```
📊 Time-of-day patterns:
   7:00 - avg rise 45 mg/dL (12 examples) ← Breakfast
   12:00 - avg rise 62 mg/dL (15 examples) ← Lunch
   19:00 - avg rise 55 mg/dL (14 examples) ← Dinner
   15:00 - avg rise 38 mg/dL (8 examples) ← Afternoon snack
```

### Backup Your Patterns

Export your learned data:

```bash
ghost-carb ml-export --file my-patterns.json
```

Import on another device:

```bash
ghost-carb ml-import --file my-patterns.json
```

### Reset Everything

If you want to start over:

```bash
ghost-carb ml-clear
```

## Automation (Set and Forget)

### Automatic Checking Every 15 Minutes

Add to your system's scheduled tasks:

**Linux/Mac (Cron):**
```bash
# Edit your crontab
crontab -e

# Add this line to check every 15 minutes:
*/15 * * * * /usr/local/bin/ghost-carb check --quiet --notify
```

**Windows (Task Scheduler):**
1. Open Task Scheduler
2. Create Basic Task
3. Name: "Ghost Carb Check"
4. Trigger: Every 15 minutes
5. Action: Start a program
6. Program: `C:\Program Files\nodejs\node.exe`
7. Arguments: `C:\path\to\ghost-carb-detector\bin\cli.js check --notify`

### What `--quiet` Means

Only outputs if ghosts are found. Perfect for automated checks - no spam in logs.

### Running Dashboard as a Service

**Linux (systemd):**

Create file `/etc/systemd/system/ghost-carb.service`:

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
sudo systemctl enable ghost-carb
sudo systemctl start ghost-carb
```

Now the dashboard runs automatically and restarts if it crashes.

## Configuration Options

### Adjust Detection Sensitivity

**More strict (fewer false alarms):**
```bash
ghost-carb config --rise-threshold 40
```
Only flag rises over 40 mg/dL (default is 30)

**Less strict (catches smaller snacks):**
```bash
ghost-carb config --rise-threshold 20
```

**Longer analysis window:**
```bash
ghost-carb config --time-window 120
```
Analyze 2-hour windows (default is 90 minutes)

### View Current Settings

```bash
ghost-carb status
```

Shows:
- Nightscout URL
- Authentication status
- Rise threshold
- Time window
- Notification channels
- ML training status

## Command Reference

### Core Commands

| Command | Description | Example |
|---------|-------------|---------|
| `ghost-carb config` | Set Nightscout URL | `ghost-carb config --nightscout-url https://...` |
| `ghost-carb test` | Test connection | `ghost-carb test` |
| `ghost-carb check` | Run detection | `ghost-carb check --hours 8 --notify` |
| `ghost-carb status` | Show settings | `ghost-carb status` |

### Notification Commands

| Command | Description | Example |
|---------|-------------|---------|
| `ghost-carb config-notifications` | Set up notifications | See examples above |
| `ghost-carb test --notifications` | Test all channels | `ghost-carb test --notifications` |
| `ghost-carb demo` | Send test alert | `ghost-carb demo` |

### ML Commands

| Command | Description | Example |
|---------|-------------|---------|
| `ghost-carb ml-status` | Show ML stats | `ghost-carb ml-status` |
| `ghost-carb ml-learn` | Learn from treatment | `ghost-carb ml-learn --carbs 30` |
| `ghost-carb ml-train` | Force retrain | `ghost-carb ml-train` |
| `ghost-carb ml-export` | Export patterns | `ghost-carb ml-export --file data.json` |
| `ghost-carb ml-import` | Import patterns | `ghost-carb ml-import --file data.json` |
| `ghost-carb ml-clear` | Reset ML data | `ghost-carb ml-clear` |

### Dashboard

| Command | Description | Example |
|---------|-------------|---------|
| `ghost-carb dashboard` | Start dashboard | `ghost-carb dashboard --port 8080` |

## Troubleshooting

### "Connection failed: 401 Unauthorized"

Your API secret is wrong or missing.

**Fix:**
```bash
ghost-carb config --api-secret your-correct-secret
```

### "Connection failed: 404 Not Found"

Your Nightscout URL is wrong.

**Fix:**
```bash
ghost-carb config --nightscout-url https://correct-url.herokuapp.com
```

### "Not enough glucose data"

Need at least 30 minutes of CGM data.

**Fix:** Wait for more data or check a longer time period:
```bash
ghost-carb check --hours 8
```

### Notifications not working

Test each channel:
```bash
ghost-carb test --notifications
```

Check your token/key is correct. For Telegram, make sure you messaged @BotFather and @userinfobot correctly.

### Dashboard won't start

Check if port is in use:
```bash
ghost-carb dashboard --port 8080  # Try different port
```

### "Model not trained yet"

Need at least 5 training examples.

**Fix:** Add confirmed treatments:
```bash
ghost-carb ml-learn --carbs 45
ghost-carb ml-learn --carbs 30
ghost-carb ml-learn --carbs 15
ghost-carb ml-learn --carbs 60
ghost-carb ml-learn --carbs 25
```

Then check status:
```bash
ghost-carb ml-status
```

## FAQ

**Q: Does this work with Dexcom? Libre? Medtronic?**
A: Yes! As long as your CGM uploads to Nightscout, it works.

**Q: Do I need to keep the dashboard running?**
A: No. The CLI tool works independently. Dashboard is optional for visual monitoring.

**Q: How accurate is the carb estimation?**
A: It depends on how well-trained the ML model is. With 20+ examples, it's usually within ±5g.

**Q: Does it work with closed-loop systems (Loop, OpenAPS)?**
A: Yes, but it might be less useful since those systems handle insulin automatically.

**Q: Can I run this on a Raspberry Pi?**
A: Yes! Perfect for 24/7 monitoring. Install Node.js, clone the repo, set up cron.

**Q: Is my data safe?**
A: All data stays on your machine. Nothing is sent to external servers except:
- Your Nightscout (which you control)
- Your chosen notification services

**Q: What's the battery impact on mobile?**
A: Minimal. It only fetches data when you run a check (every 15 min if automated).

**Q: Can I use this without Nightscout?**
A: Currently no. Nightscout is required to get CGM data.

## Tips & Best Practices

1. **Start with manual checks** - Run `ghost-carb check` a few times to see how it works

2. **Add training examples** - The more you teach it, the better it gets

3. **Use the dashboard** - Visual charts help you understand patterns

4. **Set up notifications** - Get alerted when you forget to log

5. **Export regularly** - Backup your learned patterns

6. **Adjust threshold** - If too many false alarms, raise `--rise-threshold`

7. **Check confidence** - Low confidence detections might be exercise, not food

## Technical Details (For Nerds)

### Detection Algorithm

1. **Sliding window analysis** - Looks at 1-hour glucose windows
2. **Rise detection** - Flags windows with >30 mg/dL increase
3. **Shape analysis** - Checks for smooth parabolic curve (carb signature)
4. **IOB calculation** - Exponential decay: IOB = dose × e^(-kt)
5. **Confidence scoring** - Weights rise rate, timing, shape, insulin

### Machine Learning

- **Linear regression** - rise = slope × carbs + intercept
- **R-squared** - Measures how well model fits your data
- **Time-of-day analysis** - Finds patterns by hour
- **Training data** - Stored in `~/.ghost-carb/`

### API Endpoints

The dashboard exposes these REST endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /api/glucose` | Glucose readings |
| `GET /api/treatments` | Insulin/carb treatments |
| `GET /api/detect` | Run detection |
| `GET /api/config` | Current config |
| `POST /api/test-notification` | Test notifications |

## Getting Help

**Found a bug?** Open an issue on GitHub

**Have a question?** Check the FAQ above first

**Want to contribute?** Pull requests welcome!

## License

MIT - Free to use, modify, and distribute.

## Credits

Built with:
- Node.js
- Express
- Chart.js
- Commander.js
- Love ❤️

---

**Remember:** This tool helps you catch missed meals, but always use your best judgment. When in doubt, check your glucose with a fingerstick.
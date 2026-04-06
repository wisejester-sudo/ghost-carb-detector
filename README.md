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

### Part of Something Bigger

This tool is part of **[Mieru Health](https://mieru.health)** - a project I started after reversing my own prediabetes with CGM + GLP-1s. 

I noticed that my CGM data was incredibly valuable, but the tools to understand it were either too complex or didn't exist. So I started building what I wished I had.

Ghost Carb Detector is the first piece. The broader goal is to make CGM data actually useful without requiring a CS degree or medical background.

If you're interested in following along or getting early access to the full platform, you can [join the Mieru Health waitlist](https://mieru.health). No pressure - just building in public.

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

#### ⚠️ Important: Authentication Methods

Nightscout supports two authentication methods. If you get "401 Unauthorized" errors, try the other method:

**Method 1: Header-based (default)**
- Uses `api-secret` HTTP header with SHA1 hash
- Works with most Nightscout installations
- Automatically handles SHA1 hashing

**Method 2: Token-based**  
- Uses `?token=` query parameter
- Required for some Render.com and Heroku deployments
- Use this if Method 1 fails

```bash
# Try token-based auth if header-based fails
ghost-carb config \
  --nightscout-url https://your-nightscout.herokuapp.com \
  --api-secret your-secret-here \
  --use-token-auth
```

**How to determine which to use:**
- If you can read data but get 401 on writes → Use `--use-token-auth`
- If all API calls fail with 401 → Check your API_SECRET is correct
- The API_SECRET is different from your web login password

**Finding your API_SECRET:**
1. Log into Nightscout web interface
2. Go to **Admin Tools** → **Settings**
3. Look for `API_SECRET` environment variable
4. Or check your hosting provider (Render/Heroku) environment variables

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

#### Data Requirements

For best results, Ghost Carb Detector needs:
- **Continuous CGM data** (readings every 5 minutes)
- **At least 30 minutes** of recent data
- **At least 6 glucose readings** in the analysis window

Sparse data (readings every 15+ minutes) may not trigger detection. Real Dexcom/G6 data works best.

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

Ghost Carb Detector learns your personal glucose response patterns using the `ml-regression` library. The more you use it, the better it gets.

### How It Works

The ML system uses **meal-type specific models** because different foods affect glucose differently:

**Fast Carbs** (juice, candy, soda):
- Quick spike, rapid fall
- ~3.6 mg/dL rise per gram of carb

**Medium Carbs** (bread, rice, fruit):
- Standard glucose curve
- ~2.5 mg/dL rise per gram of carb

**Slow Carbs** (pizza, pasta, high-fat meals):
- Extended rise, gradual fall
- ~1.5 mg/dL rise per gram of carb

The app automatically classifies detected meals and learns YOUR personal response for each type.

### Check ML Status

```bash
ghost-carb ml-status
```

**Before training:**
```
🧠 Machine Learning Status

❌ Model not trained yet
   Training examples: 0/10

   Use "ghost-carb ml-learn" to add confirmed treatments
```

**After training:**
```
🧠 Machine Learning Status

✅ Model trained
   Training examples: 23
   
   Meal Type Models:
   Fast:   slope=3.62, r²=0.91 (7 examples)
   Medium: slope=2.48, r²=0.87 (10 examples)
   Slow:   slope=1.53, r²=0.89 (6 examples)
   
   Validation: MAE=12.4 mg/dL, RMSE=15.2 mg/dL
   Last trained: 4/6/2026, 2:15:00 PM
```

### Teach the App

When the app detects a ghost carb, confirm what you actually ate:

```bash
# Format: ml-learn --carbs AMOUNT --meal-type TYPE
ghost-carb ml-learn --carbs 30 --meal-type medium

# With insulin (optional)
ghost-carb ml-learn --carbs 45 --meal-type slow --insulin 3
```

**Meal Types:**
- `fast` - Juice, candy, soda (quick spike)
- `medium` - Bread, rice, fruit (standard)
- `slow` - Pizza, pasta, fatty foods (extended rise)

**Tips:**
- Add examples when you're sure what you ate
- The app needs at least 3 examples per meal type
- Include insulin for better IOB calculation
- The app automatically detects outliers and excludes them

### Outlier Detection

The ML system automatically excludes anomalous readings:

```
Training on 25 examples...
  Removed 2 outliers (Z-score > 2.5)
  Training set: 18, Validation set: 5
  ✅ Model trained with cross-validation
```

This prevents sick days, sensor errors, or unusual circumstances from affecting your model.

### Confidence Intervals

Predictions include 95% confidence intervals:

```
Detected: ~32g carbs [26g - 38g] (87% confidence)
```

This means: "You're 95% confident the actual carbs were between 26-38g, with 32g being the best estimate."

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

Authentication failed. This usually means:

**A. Wrong API Secret**
```bash
ghost-carb config --api-secret your-correct-secret
```

**B. Wrong Authentication Method**
Some Nightscout instances require token-based auth instead of header-based:
```bash
ghost-carb config \
  --nightscout-url https://your-nightscout.herokuapp.com \
  --api-secret your-secret \
  --use-token-auth
```

**C. API Secret vs Web Password**
The API_SECRET (for API access) is different from your web login password. Check your Nightscout environment variables.

**D. SHA1 Hashing (advanced)**
If manually using curl, the API secret must be SHA1 hashed:
```bash
API_SECRET="your-secret"
HASH=$(echo -n "$API_SECRET" | shasum | awk '{print $1}')
curl -H "api-secret: $HASH" https://your-nightscout.herokuapp.com/api/v1/entries.json
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
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

```bash
# Set up your Nightscout connection
ghost-carb config --nightscout-url https://your-nightscout.herokuapp.com --api-secret your-api-secret

# View current config
ghost-carb status
```

## Usage

### Test Connection

```bash
ghost-carb test
```

### Run Detection

```bash
# Check last 4 hours (default)
ghost-carb check

# Check last 8 hours
ghost-carb check --hours 8

# Output as JSON
ghost-carb check --json

# Enable notifications (when implemented)
ghost-carb check --notify
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

============================================================
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

## Cron Setup (Automated Checking)

```bash
# Check every 15 minutes and log results
*/15 * * * * /usr/local/bin/ghost-carb check >> /var/log/ghost-carb.log 2>&1
```

## Status

🚧 **v0.1.0** — Core detection algorithm functional

- ✅ Fetch glucose data from Nightscout
- ✅ Fetch treatments (insulin/carbs)
- ✅ Calculate IOB
- ✅ Detect carb patterns
- ✅ Filter logged treatments
- ✅ Confidence scoring
- 🔄 Notifications (coming soon)
- 🔄 Web dashboard (coming soon)

## License

MIT

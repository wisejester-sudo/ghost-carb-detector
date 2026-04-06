# Ghost Carb Detector

Detect unlogged carb events from Nightscout CGM data using glucose curve analysis.

## The Problem

People forget to log meals all the time. You eat a snack, get distracted, never enter it in Nightscout. Later you're chasing unexplained highs with no data.

## The Solution

Analyze glucose curves to detect unlogged carb events automatically.

## How It Works

1. **Pattern Recognition** — Detects carb signatures (sharp rise >30 mg/dL, peak at 60-90 min)
2. **Insulin-Agnostic Detection** — Compares actual vs expected glucose (IOB + basal)
3. **Smart Filtering** — Avoids false positives (exercise, dawn phenomenon, sensor noise)
4. **Confidence Scoring** — Rates each detection

## Installation

```bash
npm install -g ghost-carb-detector
```

## Usage

```bash
# Configure
ghost-carb config --nightscout-url https://your-nightscout.herokuapp.com --api-secret your-secret

# Check manually
ghost-carb check

# Run with cron every 15 minutes
*/15 * * * * ghost-carb check --notify
```

## Status

🚧 **Work in progress** — Core algorithm in development

## License

MIT

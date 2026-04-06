# Ghost Carb Detector

## Algorithm Overview

### Detection Logic

1. Fetch glucose data from Nightscout (last 4 hours)
2. Fetch insulin data (basal + bolus)
3. Calculate expected glucose curve (insulin impact model)
4. Compare actual vs expected
5. Detect anomalies matching carb signature:
   - Rise rate > 1.5 mg/dL/min for > 15 min
   - Peak shape: Smooth parabola
   - Duration: 60-120 min
6. Score confidence (0-1)
7. Filter known events (logged treatments)

### Pattern Matching

```javascript
const CARB_SIGNATURE = {
  riseRate: { min: 1.5, duration: 15 }, // mg/dL/min
  peakTime: { min: 45, max: 90 },       // minutes
  shape: 'parabola',                     // curve fit
  returnRate: { min: 0.5, max: 2.0 }    // mg/dL/min decline
};
```

### Insulin Model

```javascript
// IOB calculation (simplified)
IOB = bolus_insulin * e^(-0.05 * minutes_since)

// Expected glucose
expected_glucose = baseline - (IOB * ISF)
```

## Confidence Scoring

| Factor | Weight |
|--------|--------|
| Rise rate match | 0.3 |
| Peak timing | 0.2 |
| Shape match | 0.3 |
| No insulin on board | 0.2 |

## Future Enhancements

- [ ] Machine learning model for personal patterns
- [ ] Exercise detection (Apple Health integration)
- [ ] Stress detection (HRV correlation)
- [ ] Meal size estimation from curve area

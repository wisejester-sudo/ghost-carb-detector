/**
 * Machine Learning Module for Ghost Carb Detector
 * Learns user's personal glucose response patterns
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_DIR = path.join(os.homedir(), '.ghost-carb');
const PATTERNS_FILE = path.join(DATA_DIR, 'patterns.json');
const TRAINING_FILE = path.join(DATA_DIR, 'training-data.json');

class PersonalML {
  constructor(config) {
    this.config = config;
    this.patterns = this.loadPatterns();
    this.trainingData = this.loadTrainingData();
  }

  /**
   * Load learned patterns from disk
   */
  loadPatterns() {
    if (fs.existsSync(PATTERNS_FILE)) {
      return JSON.parse(fs.readFileSync(PATTERNS_FILE, 'utf8'));
    }
    return {
      carbRatio: 15,        // grams per unit insulin (default)
      isf: 50,              // mg/dL per unit insulin (default)
      avgRisePer15g: 60,    // mg/dL rise from 15g carbs (default)
      peakTimeAvg: 60,      // average minutes to peak
      learned: false
    };
  }

  /**
   * Load training data from disk
   */
  loadTrainingData() {
    if (fs.existsSync(TRAINING_FILE)) {
      return JSON.parse(fs.readFileSync(TRAINING_FILE, 'utf8'));
    }
    return [];
  }

  /**
   * Save patterns to disk
   */
  savePatterns() {
    fs.writeFileSync(PATTERNS_FILE, JSON.stringify(this.patterns, null, 2));
  }

  /**
   * Save training data to disk
   */
  saveTrainingData() {
    fs.writeFileSync(TRAINING_FILE, JSON.stringify(this.trainingData, null, 2));
  }

  /**
   * Extract features from a glucose event
   * @param {Object} glucoseData - Glucose readings around event
   * @param {Object} treatment - Logged treatment (if known)
   */
  extractFeatures(glucoseData, treatment) {
    if (glucoseData.length < 6) return null;

    // Find peak
    const peak = glucoseData.reduce((max, reading) =>
      reading.glucose > max.glucose ? reading : max
    );

    const start = glucoseData[0];
    const end = glucoseData[glucoseData.length - 1];

    // Calculate features
    const rise = peak.glucose - start.glucose;
    const timeToPeak = (peak.timestamp - start.timestamp) / (1000 * 60); // minutes
    const duration = (end.timestamp - start.timestamp) / (1000 * 60);
    const avgGlucose = glucoseData.reduce((sum, d) => sum + d.glucose, 0) / glucoseData.length;

    // Calculate rise rate
    const riseRate = rise / timeToPeak;

    // Calculate area under curve (simplified)
    const auc = glucoseData.reduce((sum, d, i) => {
      if (i === 0) return sum;
      const prev = glucoseData[i - 1];
      const timeDiff = (d.timestamp - prev.timestamp) / (1000 * 60);
      const avg = (d.glucose + prev.glucose) / 2;
      return sum + (avg * timeDiff);
    }, 0);

    return {
      timestamp: start.timestamp,
      rise,
      timeToPeak,
      duration,
      riseRate,
      avgGlucose,
      auc,
      startGlucose: start.glucose,
      peakGlucose: peak.glucose,
      endGlucose: end.glucose,
      readingCount: glucoseData.length
    };
  }

  /**
   * Learn from a confirmed treatment
   * @param {Object} features - Extracted features
   * @param {number} actualCarbs - Actual carbs consumed
   * @param {number} insulin - Insulin given (if any)
   */
  learnFromTreatment(features, actualCarbs, insulin = 0) {
    // Calculate actual rise per gram of carb
    const risePerGram = features.rise / actualCarbs;

    // Store training example
    const example = {
      ...features,
      actualCarbs,
      insulin,
      risePerGram,
      timestamp: new Date().toISOString()
    };

    this.trainingData.push(example);

    // Keep only last 100 examples
    if (this.trainingData.length > 100) {
      this.trainingData = this.trainingData.slice(-100);
    }

    // Retrain model
    this.retrain();
    this.saveTrainingData();
  }

  /**
   * Retrain the model on all training data
   */
  retrain() {
    if (this.trainingData.length < 5) {
      console.log(`  📊 Need ${5 - this.trainingData.length} more examples to train`);
      return;
    }

    console.log(`  🧠 Training on ${this.trainingData.length} examples...`);

    // Calculate average rise per gram
    const avgRisePerGram = this.trainingData.reduce((sum, ex) =>
      sum + ex.risePerGram, 0) / this.trainingData.length;

    // Calculate average time to peak
    const avgTimeToPeak = this.trainingData.reduce((sum, ex) =>
      sum + ex.timeToPeak, 0) / this.trainingData.length;

    // Simple linear regression for rise prediction
    // rise = slope * carbs + intercept
    const n = this.trainingData.length;
    const sumX = this.trainingData.reduce((sum, ex) => sum + ex.actualCarbs, 0);
    const sumY = this.trainingData.reduce((sum, ex) => sum + ex.rise, 0);
    const sumXY = this.trainingData.reduce((sum, ex) =>
      sum + (ex.actualCarbs * ex.rise), 0);
    const sumX2 = this.trainingData.reduce((sum, ex) =>
      sum + (ex.actualCarbs * ex.actualCarbs), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = this.trainingData.reduce((sum, ex) =>
      sum + Math.pow(ex.rise - yMean, 2), 0);
    const ssResidual = this.trainingData.reduce((sum, ex) => {
      const predicted = slope * ex.actualCarbs + intercept;
      return sum + Math.pow(ex.rise - predicted, 2);
    }, 0);
    const rSquared = 1 - (ssResidual / ssTotal);

    // Update patterns
    this.patterns = {
      carbRatio: Math.round(15 / avgRisePerGram * 15), // grams per unit
      isf: this.patterns.isf, // Keep existing ISF
      avgRisePer15g: Math.round(avgRisePerGram * 15),
      peakTimeAvg: Math.round(avgTimeToPeak),
      slope: Math.round(slope * 100) / 100,
      intercept: Math.round(intercept * 100) / 100,
      rSquared: Math.round(rSquared * 100) / 100,
      sampleSize: n,
      learned: true,
      lastTrained: new Date().toISOString()
    };

    this.savePatterns();

    console.log(`  ✅ Model trained! R² = ${this.patterns.rSquared}`);
    console.log(`     Rise per 15g: ~${this.patterns.avgRisePer15g} mg/dL`);
    console.log(`     Peak time: ~${this.patterns.peakTimeAvg} min`);
  }

  /**
   * Predict carbs from glucose rise
   * @param {number} rise - Glucose rise in mg/dL
   * @returns {Object} - Prediction with confidence
   */
  predictCarbs(rise) {
    if (!this.patterns.learned) {
      // Use default calculation
      const carbs = Math.round(rise * 15 / 60);
      return {
        carbs,
        confidence: 0.5,
        method: 'default',
        note: 'Personal model not trained yet'
      };
    }

    // Use learned slope and intercept
    // rise = slope * carbs + intercept
    // carbs = (rise - intercept) / slope
    const carbs = Math.round((rise - this.patterns.intercept) / this.patterns.slope);

    // Calculate confidence based on R-squared
    let confidence = this.patterns.rSquared;

    // Adjust for edge cases
    if (rise < 20) confidence *= 0.8;
    if (carbs < 5 || carbs > 100) confidence *= 0.7;

    return {
      carbs: Math.max(5, carbs), // Minimum 5g
      confidence: Math.min(confidence, 0.95),
      method: 'personal-ml',
      rSquared: this.patterns.rSquared,
      sampleSize: this.patterns.sampleSize
    };
  }

  /**
   * Analyze time-of-day patterns
   * @returns {Object} - Patterns by hour
   */
  analyzeTimeOfDay() {
    if (this.trainingData.length < 10) return null;

    const byHour = {};

    this.trainingData.forEach(ex => {
      const hour = new Date(ex.timestamp).getHours();
      if (!byHour[hour]) {
        byHour[hour] = { rises: [], count: 0 };
      }
      byHour[hour].rises.push(ex.rise);
      byHour[hour].count++;
    });

    // Calculate average rise per hour
    const patterns = {};
    Object.keys(byHour).forEach(hour => {
      const avgRise = byHour[hour].rises.reduce((a, b) => a + b, 0) / byHour[hour].count;
      patterns[hour] = {
        avgRise: Math.round(avgRise),
        count: byHour[hour].count
      };
    });

    return patterns;
  }

  /**
   * Get pattern statistics
   */
  getStats() {
    return {
      ...this.patterns,
      trainingExamples: this.trainingData.length,
      timeOfDayPatterns: this.analyzeTimeOfDay()
    };
  }

  /**
   * Export training data for analysis
   */
  exportTrainingData() {
    return {
      patterns: this.patterns,
      examples: this.trainingData,
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Import training data
   */
  importTrainingData(data) {
    if (data.patterns) this.patterns = data.patterns;
    if (data.examples) this.trainingData = data.examples;
    this.savePatterns();
    this.saveTrainingData();
  }

  /**
   * Clear all learned data
   */
  clear() {
    this.patterns = {
      carbRatio: 15,
      isf: 50,
      avgRisePer15g: 60,
      peakTimeAvg: 60,
      learned: false
    };
    this.trainingData = [];
    this.savePatterns();
    this.saveTrainingData();
  }
}

module.exports = PersonalML;

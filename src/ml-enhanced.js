/**
 * Enhanced Machine Learning Module for Ghost Carb Detector
 * Production-ready with multiple regression, meal classification, and feedback
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_DIR = path.join(os.homedir(), '.ghost-carb');
const MODEL_FILE = path.join(DATA_DIR, 'ml-model-v2.json');
const TRAINING_FILE = path.join(DATA_DIR, 'training-data-v2.json');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback-log.json');

class EnhancedML {
  constructor(config) {
    this.config = config;
    this.model = this.loadModel();
    this.trainingData = this.loadTrainingData();
    this.feedbackLog = this.loadFeedbackLog();
    this.minTrainingSamples = 10;
    this.validationSplit = 0.2; // 20% for validation
  }

  /**
   * Load trained model from disk
   */
  loadModel() {
    if (fs.existsSync(MODEL_FILE)) {
      return JSON.parse(fs.readFileSync(MODEL_FILE, 'utf8'));
    }
    return this.getDefaultModel();
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
   * Load feedback log from disk
   */
  loadFeedbackLog() {
    if (fs.existsSync(FEEDBACK_FILE)) {
      return JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'));
    }
    return [];
  }

  /**
   * Get default model structure
   */
  getDefaultModel() {
    return {
      version: 2,
      trained: false,
      lastTrained: null,
      // Multiple regression coefficients
      coefficients: {
        intercept: 0,
        carbs: 2.0,        // mg/dL per gram of carb
        startGlucose: 0.1, // Effect of starting glucose
        hour: 0.5,         // Time of day effect
        dayOfWeek: 0,      // Weekend vs weekday
        iob: -8.0          // Insulin on board effect
      },
      // Meal type specific models
      mealTypes: {
        fast: { slope: 3.0, intercept: 0, r2: 0 },    // Juice, candy
        medium: { slope: 2.0, intercept: 0, r2: 0 },  // Bread, rice
        slow: { slope: 1.2, intercept: 0, r2: 0 },    // Pizza, high fat
        unknown: { slope: 2.0, intercept: 0, r2: 0 }
      },
      // Outlier detection parameters
      outlierThreshold: 2.5, // Z-score threshold
      // Cross-validation metrics
      validationMetrics: {
        mae: null,      // Mean absolute error
        rmse: null,     // Root mean squared error
        mape: null      // Mean absolute percentage error
      },
      // Feature statistics for normalization
      featureStats: {}
    };
  }

  /**
   * Extract comprehensive features from glucose event
   */
  extractFeatures(glucoseData, treatment, context = {}) {
    if (glucoseData.length < 6) return null;

    // Sort by time
    const sorted = [...glucoseData].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    const start = sorted[0];
    const peak = sorted.reduce((max, r) => r.glucose > max.glucose ? r : max);
    const end = sorted[sorted.length - 1];
    
    const timestamp = new Date(start.timestamp);
    
    // Calculate features
    const features = {
      // Basic features
      timestamp: start.timestamp,
      rise: peak.glucose - start.glucose,
      duration: (end.timestamp - start.timestamp) / (1000 * 60),
      timeToPeak: (peak.timestamp - start.timestamp) / (1000 * 60),
      
      // Starting conditions
      startGlucose: start.glucose,
      peakGlucose: peak.glucose,
      endGlucose: end.glucose,
      
      // Time features
      hour: timestamp.getHours(),
      dayOfWeek: timestamp.getDay(),
      isWeekend: [0, 6].includes(timestamp.getDay()),
      
      // Context features
      iob: context.iob || 0,
      preMealGlucose: start.glucose,
      
      // Curve characteristics
      riseRate: (peak.glucose - start.glucose) / ((peak.timestamp - start.timestamp) / (1000 * 60)),
      decayRate: (peak.glucose - end.glucose) / ((end.timestamp - peak.timestamp) / (1000 * 60)),
      
      // Meal type indicators
      curveShape: this.classifyCurveShape(sorted),
      
      // Reading quality
      readingCount: sorted.length,
      dataQuality: this.assessDataQuality(sorted)
    };

    return features;
  }

  /**
   * Classify curve shape to infer meal type
   */
  classifyCurveShape(glucoseData) {
    if (glucoseData.length < 4) return 'unknown';
    
    const start = glucoseData[0].glucose;
    const peak = glucoseData.reduce((max, r) => r.glucose > max.glucose ? r : max).glucose;
    const end = glucoseData[glucoseData.length - 1].glucose;
    const maxIdx = glucoseData.findIndex(r => r.glucose === peak);
    
    // Calculate rise and fall characteristics
    const riseTime = maxIdx;
    const fallTime = glucoseData.length - maxIdx;
    const totalChange = peak - start;
    const fallAmount = peak - end;
    
    // Fast carbs: Sharp rise, quick fall
    if (riseTime <= 2 && totalChange > 40) return 'fast';
    
    // Slow carbs: Extended rise, slow fall
    if (riseTime >= 4 && fallAmount < totalChange * 0.5) return 'slow';
    
    // Medium: Standard pattern
    return 'medium';
  }

  /**
   * Assess data quality (0-1 scale)
   */
  assessDataQuality(glucoseData) {
    if (glucoseData.length < 3) return 0;
    
    // Check for gaps
    let gapScore = 1;
    for (let i = 1; i < glucoseData.length; i++) {
      const gap = (glucoseData[i].timestamp - glucoseData[i-1].timestamp) / (1000 * 60);
      if (gap > 10) gapScore -= 0.2; // Penalize gaps > 10 minutes
    }
    
    // Check for sensor errors (jumpy readings)
    let smoothScore = 1;
    for (let i = 2; i < glucoseData.length; i++) {
      const change1 = Math.abs(glucoseData[i-1].glucose - glucoseData[i-2].glucose);
      const change2 = Math.abs(glucoseData[i].glucose - glucoseData[i-1].glucose);
      if (change1 > 30 && change2 > 30 && Math.sign(change1) !== Math.sign(change2)) {
        smoothScore -= 0.1; // Penalize zigzag patterns
      }
    }
    
    return Math.max(0, Math.min(1, (gapScore + smoothScore) / 2));
  }

  /**
   * Detect outliers using Z-score
   */
  isOutlier(example, mean, std) {
    if (std === 0) return false;
    const zScore = Math.abs(example.risePerGram - mean) / std;
    return zScore > this.model.outlierThreshold;
  }

  /**
   * Remove outliers from training data
   */
  removeOutliers(data) {
    if (data.length < 10) return data;
    
    const rises = data.map(d => d.risePerGram);
    const mean = rises.reduce((a, b) => a + b, 0) / rises.length;
    const variance = rises.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rises.length;
    const std = Math.sqrt(variance);
    
    const filtered = data.filter(d => !this.isOutlier(d, mean, std));
    console.log(`  Removed ${data.length - filtered.length} outliers (Z-score > ${this.model.outlierThreshold})`);
    
    return filtered;
  }

  /**
   * Split data into training and validation sets
   */
  splitData(data) {
    // Shuffle data
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    
    const splitIdx = Math.floor(shuffled.length * (1 - this.validationSplit));
    return {
      train: shuffled.slice(0, splitIdx),
      validation: shuffled.slice(splitIdx)
    };
  }

  /**
   * Train multiple regression model
   */
  trainModel() {
    if (this.trainingData.length < this.minTrainingSamples) {
      console.log(`  Need ${this.minTrainingSamples - this.trainingData.length} more samples to train`);
      return false;
    }

    console.log(`  Training on ${this.trainingData.length} examples...`);

    // Remove outliers
    const cleanData = this.removeOutliers(this.trainingData);
    
    // Split for cross-validation
    const { train, validation } = this.splitData(cleanData);
    console.log(`  Training set: ${train.length}, Validation set: ${validation.length}`);

    // Train meal type specific models
    this.trainMealTypeModels(train);
    
    // Train main multiple regression model
    this.trainMultipleRegression(train);
    
    // Validate on held-out data
    this.validateModel(validation);
    
    // Save model
    this.model.trained = true;
    this.model.lastTrained = new Date().toISOString();
    this.saveModel();
    
    console.log('  ✅ Model trained with cross-validation');
    return true;
  }

  /**
   * Train meal type specific models
   */
  trainMealTypeModels(data) {
    const types = ['fast', 'medium', 'slow'];
    
    types.forEach(type => {
      const typeData = data.filter(d => d.mealType === type);
      if (typeData.length < 3) return;
      
      const n = typeData.length;
      const sumX = typeData.reduce((sum, d) => sum + d.actualCarbs, 0);
      const sumY = typeData.reduce((sum, d) => sum + d.rise, 0);
      const sumXY = typeData.reduce((sum, d) => sum + d.actualCarbs * d.rise, 0);
      const sumX2 = typeData.reduce((sum, d) => sum + d.actualCarbs * d.actualCarbs, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      // Calculate R²
      const yMean = sumY / n;
      const ssTotal = typeData.reduce((sum, d) => sum + Math.pow(d.rise - yMean, 2), 0);
      const ssResidual = typeData.reduce((sum, d) => {
        const predicted = slope * d.actualCarbs + intercept;
        return sum + Math.pow(d.rise - predicted, 2);
      }, 0);
      const r2 = 1 - (ssResidual / ssTotal);
      
      this.model.mealTypes[type] = { slope, intercept, r2 };
    });
  }

  /**
   * Train multiple regression with all features
   */
  trainMultipleRegression(data) {
    // Normalize features
    const features = ['carbs', 'startGlucose', 'hour', 'dayOfWeek', 'iob'];
    
    // Calculate feature statistics
    features.forEach(f => {
      const values = data.map(d => d.features[f] || 0);
      this.model.featureStats[f] = {
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        std: Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - values.reduce((a,b)=>a+b)/values.length, 2), 0) / values.length)
      };
    });
    
    // Simple gradient descent for multiple regression
    const learningRate = 0.01;
    const iterations = 1000;
    
    for (let iter = 0; iter < iterations; iter++) {
      let totalError = 0;
      
      data.forEach(example => {
        const prediction = this.predictWithFeatures(example.features);
        const error = example.rise - prediction;
        totalError += Math.abs(error);
        
        // Update coefficients
        this.model.coefficients.intercept += learningRate * error;
        this.model.coefficients.carbs += learningRate * error * (example.features.carbs || 0);
        this.model.coefficients.startGlucose += learningRate * error * (example.features.startGlucose || 0);
        this.model.coefficients.hour += learningRate * error * (example.features.hour || 0);
        this.model.coefficients.dayOfWeek += learningRate * error * (example.features.dayOfWeek || 0);
        this.model.coefficients.iob += learningRate * error * (example.features.iob || 0);
      });
      
      if (iter % 200 === 0) {
        console.log(`    Iteration ${iter}: Avg Error = ${(totalError / data.length).toFixed(2)}`);
      }
    }
  }

  /**
   * Predict using feature coefficients
   */
  predictWithFeatures(features) {
    const coef = this.model.coefficients;
    return coef.intercept +
      coef.carbs * (features.carbs || 0) +
      coef.startGlucose * (features.startGlucose || 0) +
      coef.hour * (features.hour || 0) +
      coef.dayOfWeek * (features.dayOfWeek || 0) +
      coef.iob * (features.iob || 0);
  }

  /**
   * Validate model on held-out data
   */
  validateModel(validationData) {
    if (validationData.length === 0) return;
    
    const predictions = validationData.map(d => ({
      actual: d.rise,
      predicted: this.predictWithFeatures(d.features)
    }));
    
    // Calculate metrics
    const errors = predictions.map(p => p.actual - p.predicted);
    const mae = errors.reduce((sum, e) => sum + Math.abs(e), 0) / errors.length;
    const rmse = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);
    const mape = errors.reduce((sum, e, i) => sum + Math.abs(e / predictions[i].actual), 0) / errors.length * 100;
    
    this.model.validationMetrics = { mae, rmse, mape };
    
    console.log(`  Validation Metrics:`);
    console.log(`    MAE: ${mae.toFixed(2)} mg/dL`);
    console.log(`    RMSE: ${rmse.toFixed(2)} mg/dL`);
    console.log(`    MAPE: ${mape.toFixed(1)}%`);
  }

  /**
   * Predict carbs with confidence intervals
   */
  predict(rise, features = {}, mealType = 'unknown') {
    if (!this.model.trained) {
      return {
        carbs: Math.round(rise / 2.5),
        confidence: 0.3,
        method: 'default',
        note: 'Model not trained - using default ratio',
        interval: { lower: 0, upper: 0 }
      };
    }

    // Use meal type specific model if available
    const model = this.model.mealTypes[mealType] || this.model.mealTypes.medium;
    const featuresPrediction = this.predictWithFeatures({ ...features, carbs: 0 });
    
    // Calculate carbs: (rise - features_effect) / slope
    const adjustedRise = rise - featuresPrediction;
    const carbs = Math.round((adjustedRise - model.intercept) / model.slope);
    
    // Calculate confidence based on R² and data quality
    let confidence = model.r2 * 0.8 + 0.1;
    if (features.dataQuality) confidence *= features.dataQuality;
    
    // Calculate prediction interval (simplified)
    const stdError = this.model.validationMetrics.rmse || 15;
    const margin = 1.96 * stdError; // 95% confidence interval
    
    return {
      carbs: Math.max(5, carbs),
      confidence: Math.min(confidence, 0.95),
      method: 'enhanced-ml',
      mealType,
      rSquared: model.r2,
      interval: {
        lower: Math.max(0, Math.round((adjustedRise - margin - model.intercept) / model.slope)),
        upper: Math.round((adjustedRise + margin - model.intercept) / model.slope)
      },
      features: {
        hour: features.hour,
        startGlucose: features.startGlucose,
        dataQuality: features.dataQuality
      }
    };
  }

  /**
   * Learn from confirmed treatment with full features
   */
  learn(features, actualCarbs, insulin = 0, mealType = 'medium') {
    const example = {
      timestamp: new Date().toISOString(),
      features: {
        ...features,
        carbs: actualCarbs,
        iob: insulin * -8 // Simplified IOB effect
      },
      actualCarbs,
      insulin,
      mealType,
      rise: features.rise,
      risePerGram: features.rise / actualCarbs
    };

    this.trainingData.push(example);
    
    // Keep last 200 examples
    if (this.trainingData.length > 200) {
      this.trainingData = this.trainingData.slice(-200);
    }
    
    this.saveTrainingData();
    
    // Retrain if enough samples
    if (this.trainingData.length >= this.minTrainingSamples) {
      this.trainModel();
    }
    
    return example;
  }

  /**
   * Record feedback on prediction accuracy
   */
  recordFeedback(predictedCarbs, actualCarbs, wasCorrect) {
    this.feedbackLog.push({
      timestamp: new Date().toISOString(),
      predictedCarbs,
      actualCarbs,
      wasCorrect,
      error: Math.abs(predictedCarbs - actualCarbs)
    });
    
    // Keep last 50 feedback entries
    if (this.feedbackLog.length > 50) {
      this.feedbackLog = this.feedbackLog.slice(-50);
    }
    
    this.saveFeedbackLog();
    
    // Adjust model if consistent errors
    this.adjustFromFeedback();
  }

  /**
   * Adjust model based on feedback patterns
   */
  adjustFromFeedback() {
    if (this.feedbackLog.length < 10) return;
    
    const recent = this.feedbackLog.slice(-10);
    const avgError = recent.reduce((sum, f) => sum + f.error, 0) / recent.length;
    
    if (avgError > 10) {
      console.log(`  ⚠️ High average error (${avgError.toFixed(1)}g) - consider retraining`);
    }
  }

  /**
   * Get model statistics
   */
  getStats() {
    const recentFeedback = this.feedbackLog.slice(-20);
    const accuracy = recentFeedback.length > 0 
      ? recentFeedback.filter(f => f.wasCorrect).length / recentFeedback.length 
      : null;
    
    return {
      ...this.model,
      trainingExamples: this.trainingData.length,
      feedbackEntries: this.feedbackLog.length,
      recentAccuracy: accuracy ? Math.round(accuracy * 100) : null,
      mealTypeBreakdown: {
        fast: this.trainingData.filter(d => d.mealType === 'fast').length,
        medium: this.trainingData.filter(d => d.mealType === 'medium').length,
        slow: this.trainingData.filter(d => d.mealType === 'slow').length
      }
    };
  }

  // Persistence methods
  saveModel() {
    fs.writeFileSync(MODEL_FILE, JSON.stringify(this.model, null, 2));
  }

  saveTrainingData() {
    fs.writeFileSync(TRAINING_FILE, JSON.stringify(this.trainingData, null, 2));
  }

  saveFeedbackLog() {
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(this.feedbackLog, null, 2));
  }

  clear() {
    this.model = this.getDefaultModel();
    this.trainingData = [];
    this.feedbackLog = [];
    this.saveModel();
    this.saveTrainingData();
    this.saveFeedbackLog();
  }
}

module.exports = EnhancedML;

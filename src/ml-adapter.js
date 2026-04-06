/**
 * ML Adapter - Allows switching between basic and enhanced ML
 */

const BasicML = require('./ml');
const EnhancedML = require('./ml-enhanced');

class MLAdapter {
  constructor(config, useEnhanced = false) {
    this.useEnhanced = useEnhanced;
    this.ml = useEnhanced ? new EnhancedML(config) : new BasicML(config);
  }

  // Proxy all methods to the underlying ML implementation
  predict(...args) {
    return this.ml.predict(...args);
  }

  learn(...args) {
    return this.ml.learn(...args);
  }

  recordFeedback(...args) {
    if (this.useEnhanced) {
      return this.ml.recordFeedback(...args);
    }
    // Basic ML doesn't support feedback
    return null;
  }

  getStats() {
    return this.ml.getStats();
  }

  trainModel() {
    if (this.useEnhanced) {
      return this.ml.trainModel();
    }
    return false;
  }

  clear() {
    return this.ml.clear();
  }
}

module.exports = MLAdapter;

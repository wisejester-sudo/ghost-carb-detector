/**
 * Ghost Carb Detector
 * Core detection algorithm
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const PersonalML = require('./ml');

class GhostCarbDetector {
  constructor(config) {
    this.nightscoutUrl = config.nightscoutUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiSecret = config.apiSecret;
    this.riseThreshold = config.riseThreshold || 30; // mg/dL
    this.timeWindow = config.timeWindow || 90; // minutes
    this.headers = this.apiSecret ? { 'api-secret': this.apiSecret } : {};
    this.useTokenAuth = config.useTokenAuth || false; // Use ?token= instead of header
    this.ml = new PersonalML(config);
  }

  /**
   * Build URL with authentication
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @returns {string} - Full URL
   */
  buildUrl(endpoint, params = {}) {
    const url = new URL(endpoint, this.nightscoutUrl);
    
    // Add params
    Object.keys(params).forEach(key => {
      url.searchParams.append(key, params[key]);
    });
    
    // Add token auth if enabled
    if (this.useTokenAuth && this.apiSecret) {
      url.searchParams.append('token', this.apiSecret);
    }
    
    return url.toString();
  }

  /**
   * Fetch glucose entries from Nightscout
   * @param {number} hours - How many hours of data to fetch
   * @returns {Promise<Array>} - Array of glucose readings
   */
  async fetchGlucoseData(hours = 4) {
    try {
      // Nightscout API: entries.json returns CGM data
      // count = hours * 12 (assuming 5-minute intervals)
      const count = hours * 12;
      const url = this.buildUrl('/api/v1/entries.json', { count });
      
      console.log(`Fetching ${hours}h of glucose data...`);
      const response = await axios.get(url, { headers: this.useTokenAuth ? {} : this.headers });
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid response from Nightscout');
      }

      // Parse and normalize entries
      const entries = response.data.map(entry => ({
        timestamp: new Date(entry.dateString || entry.date),
        glucose: entry.sgv || entry.mbg, // sgv = sensor glucose value, mbg = manual blood glucose
        direction: entry.direction,
        type: entry.type
      })).filter(e => e.glucose !== null && e.glucose !== undefined);

      // Sort by timestamp (oldest first) for pattern detection
      entries.sort((a, b) => a.timestamp - b.timestamp);

      console.log(`  ✓ Retrieved ${entries.length} glucose readings`);
      return entries;

    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Authentication failed - check your API secret');
      }
      if (error.response?.status === 404) {
        throw new Error('Nightscout URL not found - check your URL');
      }
      throw new Error(`Failed to fetch glucose data: ${error.message}`);
    }
  }

  /**
   * Fetch treatments (insulin, carbs) from Nightscout
   * @param {number} hours - How many hours of data to fetch
   * @returns {Promise<Array>} - Array of treatments
   */
  async fetchTreatments(hours = 4) {
    try {
      // Nightscout API: treatments.json
      // Get treatments from the last N hours
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const url = this.buildUrl('/api/v1/treatments.json', { 
        'find[created_at][$gte]': startTime 
      });
      
      console.log(`Fetching ${hours}h of treatment data...`);
      const response = await axios.get(url, { headers: this.useTokenAuth ? {} : this.headers });
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid response from Nightscout');
      }

      // Parse and normalize treatments
      const treatments = response.data.map(t => ({
        timestamp: new Date(t.created_at || t.date),
        insulin: t.insulin || 0,
        carbs: t.carbs || 0,
        glucose: t.glucose,
        notes: t.notes,
        eventType: t.eventType
      }));

      // Separate insulin and carb treatments for analysis
      const insulinTreatments = treatments.filter(t => t.insulin > 0);
      const carbTreatments = treatments.filter(t => t.carbs > 0);

      console.log(`  ✓ Retrieved ${treatments.length} treatments (${insulinTreatments.length} insulin, ${carbTreatments.length} carbs)`);
      
      return {
        all: treatments,
        insulin: insulinTreatments,
        carbs: carbTreatments
      };

    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Authentication failed - check your API secret');
      }
      throw new Error(`Failed to fetch treatments: ${error.message}`);
    }
  }

  /**
   * Calculate Insulin On Board (IOB) at a specific time
   * Uses simple exponential decay model
   * @param {Array} insulinTreatments - Array of insulin treatments
   * @param {Date} timestamp - Time to calculate IOB for
   * @returns {number} - IOB in units
   */
  calculateIOB(insulinTreatments, timestamp) {
    const DIA = 3.5; // Duration of Insulin Action (hours)
    const decayConstant = Math.log(2) / (DIA / 2); // Half-life based decay
    
    let iob = 0;
    
    for (const treatment of insulinTreatments) {
      const minutesAgo = (timestamp - treatment.timestamp) / (1000 * 60);
      const hoursAgo = minutesAgo / 60;
      
      if (hoursAgo < DIA && hoursAgo >= 0) {
        // Exponential decay: IOB = dose * e^(-kt)
        const remaining = treatment.insulin * Math.exp(-decayConstant * hoursAgo);
        iob += remaining;
      }
    }
    
    return iob;
  }

  /**
   * Detect potential carb patterns in glucose data
   * @param {Array} glucoseData - Array of glucose readings
   * @returns {Array} - Array of detected patterns
   */
  detectCarbPattern(glucoseData) {
    if (glucoseData.length < 6) {
      console.log('  ! Not enough glucose data for analysis');
      return [];
    }

    const candidates = [];
    
    // Analyze in sliding windows
    for (let i = 0; i < glucoseData.length - 6; i++) {
      const window = glucoseData.slice(i, i + 12); // 1 hour window
      
      // Calculate rise
      const startGlucose = window[0].glucose;
      const peak = window.reduce((max, reading) => 
        reading.glucose > max.glucose ? reading : max
      );
      const rise = peak.glucose - startGlucose;
      const timeToPeak = (peak.timestamp - window[0].timestamp) / (1000 * 60); // minutes
      
      // Check for carb-like pattern
      if (rise >= this.riseThreshold && timeToPeak >= 30 && timeToPeak <= 120) {
        // Calculate rise rate
        const riseRate = rise / timeToPeak; // mg/dL per minute
        
        // Check if it's a smooth rise (parabolic shape)
        const isSmooth = this.isSmoothRise(window);
        
        if (isSmooth && riseRate >= 0.5) {
          candidates.push({
            timestamp: window[0].timestamp,
            peakTimestamp: peak.timestamp,
            startGlucose,
            peakGlucose: peak.glucose,
            rise,
            timeToPeak,
            riseRate,
            estimatedCarbs: this.estimateCarbsFromRise(rise).carbs
          });
        }
      }
    }

    // Remove duplicates (overlapping windows)
    return this.deduplicateCandidates(candidates);
  }

  /**
   * Check if glucose rise is smooth (parabolic) vs jagged
   * @param {Array} window - Array of glucose readings
   * @returns {boolean}
   */
  isSmoothRise(window) {
    if (window.length < 4) return false;
    
    // Check if readings are generally increasing
    let increasingCount = 0;
    for (let i = 1; i < window.length; i++) {
      if (window[i].glucose >= window[i-1].glucose - 5) { // Allow small dips
        increasingCount++;
      }
    }
    
    // At least 70% of readings should be increasing
    return increasingCount / (window.length - 1) >= 0.7;
  }

  /**
   * Estimate carbs from glucose rise using ML
   * @param {number} rise - Glucose rise in mg/dL
   * @returns {Object} - Estimated carbs with confidence
   */
  estimateCarbsFromRise(rise) {
    return this.ml.predictCarbs(rise);
  }

  /**
   * Remove overlapping candidate detections
   * @param {Array} candidates - Array of detected patterns
   * @returns {Array} - Deduplicated candidates
   */
  deduplicateCandidates(candidates) {
    if (candidates.length === 0) return [];
    
    const unique = [candidates[0]];
    
    for (let i = 1; i < candidates.length; i++) {
      const current = candidates[i];
      const last = unique[unique.length - 1];
      
      // If current starts within 30 min of last peak, skip it
      const timeDiff = (current.timestamp - last.peakTimestamp) / (1000 * 60);
      
      if (timeDiff > 30) {
        unique.push(current);
      } else if (current.rise > last.rise) {
        // Replace with stronger signal
        unique[unique.length - 1] = current;
      }
    }
    
    return unique;
  }

  /**
   * Check if a candidate matches an already-logged treatment
   * @param {Object} candidate - Detected pattern
   * @param {Object} treatments - Treatment data
   * @returns {boolean}
   */
  matchesLoggedTreatment(candidate, treatments) {
    const { carbs } = treatments;
    
    for (const treatment of carbs) {
      // Check if there's a logged carb entry within 15 minutes
      const timeDiff = Math.abs(candidate.timestamp - treatment.timestamp) / (1000 * 60);
      
      if (timeDiff <= 15) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Calculate confidence score for a detection
   * @param {Object} pattern - Detected pattern
   * @returns {number} - Confidence 0-1
   */
  scoreConfidence(pattern) {
    let score = 0;
    
    // Rise rate factor (optimal: 0.5-1.5 mg/dL/min)
    if (pattern.riseRate >= 0.5 && pattern.riseRate <= 1.5) {
      score += 0.3;
    } else if (pattern.riseRate >= 0.3 && pattern.riseRate <= 2.0) {
      score += 0.2;
    }
    
    // Time to peak factor (optimal: 45-75 min)
    if (pattern.timeToPeak >= 45 && pattern.timeToPeak <= 75) {
      score += 0.3;
    } else if (pattern.timeToPeak >= 30 && pattern.timeToPeak <= 90) {
      score += 0.2;
    }
    
    // Rise magnitude factor
    if (pattern.rise >= 40 && pattern.rise <= 120) {
      score += 0.2;
    } else if (pattern.rise >= 30) {
      score += 0.1;
    }
    
    // Shape factor (already filtered, but adds confidence)
    score += 0.2;
    
    return Math.min(score, 1.0);
  }

  /**
   * Main detection method
   * @returns {Promise<Array>} - Array of ghost carb detections
   */
  async detect() {
    console.log('\n🔍 Starting ghost carb detection...\n');
    
    // Fetch data
    const glucoseData = await this.fetchGlucoseData(4);
    const treatments = await this.fetchTreatments(4);
    
    if (glucoseData.length === 0) {
      console.log('❌ No glucose data available');
      return [];
    }
    
    // Calculate IOB for each glucose reading
    console.log('\n💉 Calculating insulin on board...');
    glucoseData.forEach(reading => {
      reading.iob = this.calculateIOB(treatments.insulin, reading.timestamp);
    });
    console.log(`  ✓ IOB calculated for ${glucoseData.length} readings`);
    
    // Detect carb patterns
    console.log('\n🎯 Analyzing glucose patterns...');
    const candidates = this.detectCarbPattern(glucoseData);
    console.log(`  ✓ Found ${candidates.length} potential carb events`);
    
    // Filter already-logged treatments
    console.log('\n🧹 Filtering logged treatments...');
    const ghosts = candidates.filter(c => 
      !this.matchesLoggedTreatment(c, treatments)
    );
    console.log(`  ✓ ${ghosts.length} unlogged events detected`);
    
    // Score and format results
    const results = ghosts.map(g => ({
      timestamp: g.timestamp,
      peakTime: g.peakTimestamp,
      estimatedCarbs: g.estimatedCarbs,
      confidence: this.scoreConfidence(g),
      glucoseRise: g.rise,
      duration: Math.round(g.timeToPeak),
      startGlucose: g.startGlucose,
      peakGlucose: g.peakGlucose
    }));
    
    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);
    
    // Add ML info if available
    const mlStats = this.ml.getStats();
    if (results.length > 0) {
      results.forEach(r => {
        r.mlTrained = mlStats.learned;
        r.mlConfidence = mlStats.learned ? Math.round(mlStats.rSquared * 100) : 0;
      });
    }
    
    return results;
  }
}

module.exports = GhostCarbDetector;

// Ghost Carb Detector Dashboard
// Frontend JavaScript for real-time visualization

class DashboardApp {
  constructor() {
    this.chart = null;
    this.glucoseData = [];
    this.treatments = [];
    this.ghosts = [];
    this.config = {};
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.initChart();
    this.loadData();
    this.loadConfig();
    
    // Auto-refresh every 5 minutes
    setInterval(() => this.loadData(), 5 * 60 * 1000);
  }

  setupEventListeners() {
    document.getElementById('refreshBtn').addEventListener('click', () => this.loadData());
    document.getElementById('detectBtn').addEventListener('click', () => this.runDetection());
    document.getElementById('testNotifyBtn').addEventListener('click', () => this.testNotification());
    document.getElementById('timeRange').addEventListener('change', () => this.loadData());
    document.getElementById('riseThreshold').addEventListener('input', (e) => {
      document.getElementById('thresholdValue').textContent = e.target.value;
    });
  }

  initChart() {
    const ctx = document.getElementById('glucoseChart').getContext('2d');
    
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Glucose (mg/dL)',
          data: [],
          borderColor: '#00d4aa',
          backgroundColor: 'rgba(0, 212, 170, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            labels: { color: '#e0e0e0' }
          },
          tooltip: {
            backgroundColor: '#1a1a2e',
            titleColor: '#00d4aa',
            bodyColor: '#e0e0e0',
            borderColor: '#2d2d44',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { color: '#2d2d44' },
            ticks: { color: '#888' }
          },
          y: {
            grid: { color: '#2d2d44' },
            ticks: { color: '#888' },
            suggestedMin: 60,
            suggestedMax: 200
          }
        }
      }
    });
  }

  async loadData() {
    this.setStatus('loading', 'Loading data...');
    
    try {
      const hours = document.getElementById('timeRange').value;
      
      // Load glucose data
      const glucoseRes = await fetch(`/api/glucose?hours=${hours}`);
      const glucoseJson = await glucoseRes.json();
      
      if (glucoseJson.success) {
        this.glucoseData = glucoseJson.data;
        this.updateChart();
        this.updateStats();
      }
      
      // Load treatments
      const treatmentsRes = await fetch(`/api/treatments?hours=${hours}`);
      const treatmentsJson = await treatmentsRes.json();
      
      if (treatmentsJson.success) {
        this.treatments = treatmentsJson.data;
        this.updateTreatmentsList();
      }
      
      this.setStatus('connected', 'Connected');
    } catch (error) {
      this.setStatus('error', 'Connection failed');
      console.error('Load error:', error);
    }
  }

  async loadConfig() {
    try {
      const res = await fetch('/api/config');
      const json = await res.json();
      
      if (json.success) {
        this.config = json.config;
        this.updateConfigInfo();
      }
    } catch (error) {
      console.error('Config error:', error);
    }
  }

  updateChart() {
    if (!this.glucoseData.length) return;
    
    // Sort by timestamp
    const sorted = [...this.glucoseData].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    // Format data for chart
    const labels = sorted.map(d => {
      const date = new Date(d.timestamp);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });
    
    const values = sorted.map(d => d.glucose);
    
    this.chart.data.labels = labels;
    this.chart.data.datasets[0].data = values;
    
    // Add ghost markers as annotations
    if (this.ghosts.length > 0) {
      // Could add vertical lines or points for ghosts
    }
    
    this.chart.update();
  }

  updateStats() {
    if (!this.glucoseData.length) return;
    
    const current = this.glucoseData[0].glucose;
    const avg = Math.round(
      this.glucoseData.reduce((sum, d) => sum + d.glucose, 0) / this.glucoseData.length
    );
    
    document.getElementById('currentGlucose').textContent = current;
    document.getElementById('avgGlucose').textContent = avg;
    document.getElementById('readingsCount').textContent = this.glucoseData.length;
    
    // Color code current glucose
    const currentEl = document.getElementById('currentGlucose');
    currentEl.className = '';
    if (current < 70) currentEl.style.color = '#ef4444';
    else if (current > 180) currentEl.style.color = '#f59e0b';
    else currentEl.style.color = '#00d4aa';
  }

  updateTreatmentsList() {
    const container = document.getElementById('treatmentsContainer');
    
    if (!this.treatments.all || this.treatments.all.length === 0) {
      container.innerHTML = '<p class="empty">No treatments found in selected time range</p>';
      return;
    }
    
    // Sort by timestamp (newest first)
    const sorted = [...this.treatments.all].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    container.innerHTML = sorted.slice(0, 10).map(t => {
      const time = new Date(t.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      let icon = '💉';
      let type = 'insulin';
      let value = `${t.insulin}U`;
      
      if (t.carbs > 0) {
        icon = '🍞';
        type = 'carbs';
        value = `${t.carbs}g`;
      }
      
      return `
        <div class="treatment-item">
          <div class="treatment-type ${type}">
            <span>${icon}</span>
            <span>${time}</span>
          </div>
          <span>${value}</span>
        </div>
      `;
    }).join('');
  }

  async runDetection() {
    const btn = document.getElementById('detectBtn');
    btn.textContent = '⏳ Running...';
    btn.disabled = true;
    
    try {
      const hours = document.getElementById('timeRange').value;
      const res = await fetch(`/api/detect?hours=${hours}`);
      const json = await res.json();
      
      if (json.success) {
        this.ghosts = json.ghosts;
        this.updateGhostsList();
        document.getElementById('ghostCount').textContent = this.ghosts.length;
      }
    } catch (error) {
      console.error('Detection error:', error);
      alert('Detection failed: ' + error.message);
    } finally {
      btn.textContent = '🔍 Run Detection';
      btn.disabled = false;
    }
  }

  updateGhostsList() {
    const container = document.getElementById('ghostsContainer');
    
    if (this.ghosts.length === 0) {
      container.innerHTML = '<p class="empty">No ghost carbs detected in selected time range</p>';
      return;
    }
    
    container.innerHTML = this.ghosts.map((ghost, i) => {
      const confPct = Math.round(ghost.confidence * 100);
      const level = ghost.confidence > 0.8 ? 'high' : ghost.confidence > 0.6 ? 'medium' : 'low';
      const icon = ghost.confidence > 0.8 ? '👻' : ghost.confidence > 0.6 ? '⚠️' : '👍';
      
      return `
        <div class="ghost-item ${level}">
          <div class="ghost-icon">${icon}</div>
          <div class="ghost-info">
            <div class="ghost-time">${ghost.timestamp.toLocaleString()}</div>
            <div class="ghost-details">
              Glucose: ${ghost.startGlucose} → ${ghost.peakGlucose} mg/dL (+${ghost.glucoseRise}) • 
              Peak at ${ghost.peakTime.toLocaleTimeString()} • 
              ~${ghost.estimatedCarbs}g carbs
            </div>
          </div>
          <div class="ghost-confidence">
            <span class="confidence-badge ${level}">${confPct}%</span>
          </div>
        </div>
      `;
    }).join('');
  }

  updateConfigInfo() {
    const container = document.getElementById('configInfo');
    
    container.innerHTML = `
      <p><span class="label">Nightscout:</span> ${this.config.nightscoutUrl || 'Not configured'}</p>
      <p><span class="label">Rise Threshold:</span> ${this.config.riseThreshold || 30} mg/dL</p>
      <p><span class="label">Time Window:</span> ${this.config.timeWindow || 90} minutes</p>
      <p><span class="label">Notifications:</span> ${this.config.notifications?.join(', ') || 'None'}</p>
    `;
  }

  async testNotification() {
    const btn = document.getElementById('testNotifyBtn');
    btn.textContent = '⏳ Sending...';
    btn.disabled = true;
    
    try {
      const res = await fetch('/api/test-notification', { method: 'POST' });
      const json = await res.json();
      
      if (json.success) {
        alert('Test notification sent!');
      } else {
        alert('Failed: ' + json.error);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      btn.textContent = '📤 Test Notification';
      btn.disabled = false;
    }
  }

  setStatus(state, text) {
    const dot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    dot.className = 'status-dot';
    if (state === 'connected') dot.classList.add('connected');
    if (state === 'error') dot.classList.add('error');
    
    statusText.textContent = text;
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new DashboardApp();
});

const { BaseAgent } = require('./base-agent');
const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class MonitoringAgent extends BaseAgent {
  constructor(config, logger) {
    super(config, logger);
    this.metrics = config.config.metrics || ['cpu', 'memory', 'disk', 'network'];
    this.alertThresholds = config.config.alertThresholds || {
      cpu: 80,
      memory: 85,
      disk: 90
    };
    this.logLevel = config.config.logLevel || 'info';
    this.retention = config.config.retention || '7d';
    this.monitoringInterval = 30000; // 30 seconds
    this.metricsHistory = [];
    this.alerts = [];
    this.lastMetrics = null;
  }

  async initialize() {
    this.logger.agentInfo(this.name, 'Initializing monitoring agent');
    
    // Setup monitoring directory
    await this.setupMonitoringDirectory();
    
    // Initialize metrics collection
    await this.initializeMetricsCollection();
    
    // Start monitoring loop
    this.startMonitoringLoop();
    
    this.logger.agentInfo(this.name, 'Monitoring agent initialized');
  }

  async setupMonitoringDirectory() {
    const monitoringDir = path.join(process.cwd(), 'monitoring');
    await fs.ensureDir(monitoringDir);
    
    // Create subdirectories
    await fs.ensureDir(path.join(monitoringDir, 'metrics'));
    await fs.ensureDir(path.join(monitoringDir, 'alerts'));
    await fs.ensureDir(path.join(monitoringDir, 'reports'));
    
    this.logger.agentInfo(this.name, 'Monitoring directory setup complete');
  }

  async initializeMetricsCollection() {
    // Check available monitoring tools
    await this.checkMonitoringTools();
    
    // Initialize baseline metrics
    this.lastMetrics = await this.collectMetrics();
    
    this.logger.agentInfo(this.name, 'Metrics collection initialized');
  }

  async startMonitoringLoop() {
    this.interval = setInterval(async () => {
      try {
        await this.collectAndProcessMetrics();
      } catch (error) {
        this.logger.agentError(this.name, 'Error in monitoring loop', { error: error.message });
      }
    }, this.monitoringInterval);
  }

  async collectAndProcessMetrics() {
    const metrics = await this.collectMetrics();
    
    // Store metrics
    this.metricsHistory.push({
      timestamp: Date.now(),
      metrics
    });
    
    // Check for alerts
    await this.checkAlerts(metrics);
    
    // Update last metrics
    this.lastMetrics = metrics;
    
    // Record metrics
    this.recordMetrics(metrics);
    
    // Cleanup old metrics
    await this.cleanupOldMetrics();
  }

  async collectMetrics() {
    const metrics = {
      timestamp: Date.now(),
      system: {},
      application: {},
      custom: {}
    };

    // Collect system metrics
    if (this.metrics.includes('cpu')) {
      metrics.system.cpu = await this.getCpuMetrics();
    }
    
    if (this.metrics.includes('memory')) {
      metrics.system.memory = await this.getMemoryMetrics();
    }
    
    if (this.metrics.includes('disk')) {
      metrics.system.disk = await this.getDiskMetrics();
    }
    
    if (this.metrics.includes('network')) {
      metrics.system.network = await this.getNetworkMetrics();
    }

    // Collect application metrics
    metrics.application = await this.getApplicationMetrics();

    return metrics;
  }

  async getCpuMetrics() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    // Calculate CPU usage
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const cpuUsage = 100 - (100 * idle / total);
    
    return {
      usage: Math.round(cpuUsage * 100) / 100,
      loadAverage: {
        '1min': loadAvg[0],
        '5min': loadAvg[1],
        '15min': loadAvg[2]
      },
      cores: cpus.length,
      model: cpus[0].model
    };
  }

  async getMemoryMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      usage: Math.round((usedMem / totalMem) * 100 * 100) / 100,
      available: freeMem
    };
  }

  async getDiskMetrics() {
    try {
      const { stdout } = await execAsync('df -h /');
      const lines = stdout.trim().split('\n');
      const diskInfo = lines[1].split(/\s+/);
      
      return {
        total: diskInfo[1],
        used: diskInfo[2],
        available: diskInfo[3],
        usage: parseInt(diskInfo[4].replace('%', '')),
        mountPoint: diskInfo[5]
      };
    } catch (error) {
      this.logger.agentWarn(this.name, 'Error getting disk metrics', { error: error.message });
      return null;
    }
  }

  async getNetworkMetrics() {
    try {
      const { stdout } = await execAsync('netstat -i');
      const lines = stdout.trim().split('\n');
      
      // Parse network interface statistics
      const interfaces = {};
      
      lines.slice(1).forEach(line => {
        const parts = line.split(/\s+/);
        if (parts.length >= 4) {
          const interface = parts[0];
          interfaces[interface] = {
            rxBytes: parseInt(parts[3]) || 0,
            txBytes: parseInt(parts[7]) || 0,
            rxPackets: parseInt(parts[2]) || 0,
            txPackets: parseInt(parts[6]) || 0
          };
        }
      });
      
      return interfaces;
    } catch (error) {
      this.logger.agentWarn(this.name, 'Error getting network metrics', { error: error.message });
      return {};
    }
  }

  async getApplicationMetrics() {
    const metrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
      version: process.version,
      platform: process.platform
    };

    // Get process-specific metrics
    try {
      const { stdout } = await execAsync(`ps -p ${process.pid} -o %cpu,%mem,time`);
      const lines = stdout.trim().split('\n');
      if (lines.length > 1) {
        const parts = lines[1].trim().split(/\s+/);
        metrics.processCpu = parseFloat(parts[0]) || 0;
        metrics.processMemory = parseFloat(parts[1]) || 0;
        metrics.processTime = parts[2] || '0:00';
      }
    } catch (error) {
      this.logger.agentWarn(this.name, 'Error getting process metrics', { error: error.message });
    }

    return metrics;
  }

  async checkAlerts(metrics) {
    const alerts = [];

    // Check CPU usage
    if (metrics.system.cpu && metrics.system.cpu.usage > this.alertThresholds.cpu) {
      alerts.push({
        type: 'cpu',
        severity: 'warning',
        message: `High CPU usage: ${metrics.system.cpu.usage}%`,
        threshold: this.alertThresholds.cpu,
        current: metrics.system.cpu.usage,
        timestamp: Date.now()
      });
    }

    // Check memory usage
    if (metrics.system.memory && metrics.system.memory.usage > this.alertThresholds.memory) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: `High memory usage: ${metrics.system.memory.usage}%`,
        threshold: this.alertThresholds.memory,
        current: metrics.system.memory.usage,
        timestamp: Date.now()
      });
    }

    // Check disk usage
    if (metrics.system.disk && metrics.system.disk.usage > this.alertThresholds.disk) {
      alerts.push({
        type: 'disk',
        severity: 'warning',
        message: `High disk usage: ${metrics.system.disk.usage}%`,
        threshold: this.alertThresholds.disk,
        current: metrics.system.disk.usage,
        timestamp: Date.now()
      });
    }

    // Process alerts
    if (alerts.length > 0) {
      await this.processAlerts(alerts);
    }
  }

  async processAlerts(alerts) {
    for (const alert of alerts) {
      this.logger.agentWarn(this.name, alert.message, {
        type: alert.type,
        severity: alert.severity,
        threshold: alert.threshold,
        current: alert.current
      });

      // Store alert
      this.alerts.push(alert);
      
      // Save alert to file
      await this.saveAlert(alert);
      
      // Emit alert event
      this.emit('alert', alert);
    }
  }

  async saveAlert(alert) {
    const alertPath = path.join(process.cwd(), 'monitoring', 'alerts', `alert-${Date.now()}.json`);
    
    try {
      await fs.writeJson(alertPath, alert, { spaces: 2 });
    } catch (error) {
      this.logger.agentError(this.name, 'Error saving alert', { error: error.message });
    }
  }

  recordMetrics(metrics) {
    // Record system metrics
    if (metrics.system.cpu) {
      this.recordMetric('cpu_usage', metrics.system.cpu.usage);
    }
    
    if (metrics.system.memory) {
      this.recordMetric('memory_usage', metrics.system.memory.usage);
    }
    
    if (metrics.system.disk) {
      this.recordMetric('disk_usage', metrics.system.disk.usage);
    }

    // Record application metrics
    if (metrics.application.memory) {
      this.recordMetric('process_memory_rss', metrics.application.memory.rss);
      this.recordMetric('process_memory_heap', metrics.application.memory.heapUsed);
    }
  }

  async cleanupOldMetrics() {
    const retentionMs = this.parseRetention(this.retention);
    const cutoff = Date.now() - retentionMs;
    
    // Remove old metrics from memory
    this.metricsHistory = this.metricsHistory.filter(
      entry => entry.timestamp > cutoff
    );
    
    // Remove old alerts
    this.alerts = this.alerts.filter(
      alert => alert.timestamp > cutoff
    );
  }

  parseRetention(retention) {
    const match = retention.match(/^(\d+)([dhms])$/);
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000; // Default 7 days
    }
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    const multipliers = {
      'd': 24 * 60 * 60 * 1000,
      'h': 60 * 60 * 1000,
      'm': 60 * 1000,
      's': 1000
    };
    
    return value * multipliers[unit];
  }

  async checkMonitoringTools() {
    const tools = ['ps', 'df', 'netstat', 'top', 'htop'];
    
    for (const tool of tools) {
      try {
        await execAsync(`which ${tool}`);
        this.logger.agentInfo(this.name, `Found monitoring tool: ${tool}`);
      } catch (error) {
        this.logger.agentWarn(this.name, `Monitoring tool not found: ${tool}`);
      }
    }
  }

  async generateReport() {
    const report = {
      timestamp: Date.now(),
      summary: {
        totalMetrics: this.metricsHistory.length,
        totalAlerts: this.alerts.length,
        uptime: process.uptime()
      },
      currentMetrics: this.lastMetrics,
      recentAlerts: this.alerts.slice(-10),
      recommendations: await this.generateRecommendations()
    };

    const reportPath = path.join(process.cwd(), 'monitoring', 'reports', `report-${Date.now()}.json`);
    
    try {
      await fs.writeJson(reportPath, report, { spaces: 2 });
      this.logger.agentInfo(this.name, `Monitoring report generated: ${reportPath}`);
      return report;
    } catch (error) {
      this.logger.agentError(this.name, 'Error generating report', { error: error.message });
      return null;
    }
  }

  async generateRecommendations() {
    const recommendations = [];
    
    if (this.lastMetrics) {
      // CPU recommendations
      if (this.lastMetrics.system.cpu && this.lastMetrics.system.cpu.usage > 70) {
        recommendations.push({
          type: 'cpu',
          priority: 'medium',
          message: 'Consider optimizing CPU-intensive operations or scaling horizontally'
        });
      }
      
      // Memory recommendations
      if (this.lastMetrics.system.memory && this.lastMetrics.system.memory.usage > 80) {
        recommendations.push({
          type: 'memory',
          priority: 'high',
          message: 'Memory usage is high. Consider adding more RAM or optimizing memory usage'
        });
      }
      
      // Disk recommendations
      if (this.lastMetrics.system.disk && this.lastMetrics.system.disk.usage > 85) {
        recommendations.push({
          type: 'disk',
          priority: 'high',
          message: 'Disk usage is critical. Consider cleanup or expanding storage'
        });
      }
    }
    
    return recommendations;
  }

  async cleanup() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    
    // Generate final report
    await this.generateReport();
  }

  async checkHealth() {
    const health = await super.checkHealth();
    
    health.metrics = {
      metricsHistoryLength: this.metricsHistory.length,
      alertsCount: this.alerts.length,
      lastMetrics: this.lastMetrics ? {
        timestamp: this.lastMetrics.timestamp,
        hasSystemMetrics: !!this.lastMetrics.system,
        hasApplicationMetrics: !!this.lastMetrics.application
      } : null
    };
    
    return health;
  }

  // Public methods
  async getCurrentMetrics() {
    return this.lastMetrics;
  }

  async getMetricsHistory(limit = 100) {
    return this.metricsHistory.slice(-limit);
  }

  async getAlerts(limit = 50) {
    return this.alerts.slice(-limit);
  }

  async getSystemStatus() {
    return {
      cpu: this.lastMetrics?.system?.cpu,
      memory: this.lastMetrics?.system?.memory,
      disk: this.lastMetrics?.system?.disk,
      uptime: process.uptime(),
      alerts: this.alerts.length
    };
  }
}

module.exports = { MonitoringAgent }; 
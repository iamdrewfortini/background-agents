const { BaseAgent } = require('./base-agent');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs-extra');
const path = require('path');

const execAsync = promisify(exec);

class PerformanceAgent extends BaseAgent {
  constructor(config, logger) {
    super(config, logger);
    this.profiling = config.config.profiling || true;
    this.memoryLeakDetection = config.config.memoryLeakDetection || true;
    this.bundleAnalysis = config.config.bundleAnalysis || true;
    this.lighthouse = config.config.lighthouse || true;
    this.thresholds = config.config.thresholds || {
      firstContentfulPaint: 2000,
      largestContentfulPaint: 4000,
      cumulativeLayoutShift: 0.1
    };
    this.performanceHistory = [];
    this.currentAnalysis = null;
  }

  async initialize() {
    this.logger.agentInfo(this.name, 'Initializing performance agent');
    
    // Setup performance directory
    await this.setupPerformanceDirectory();
    
    // Check performance tools
    await this.checkPerformanceTools();
    
    // Run initial performance analysis
    await this.runPerformanceAnalysis();
    
    this.logger.agentInfo(this.name, 'Performance agent initialized');
  }

  async setupPerformanceDirectory() {
    const performanceDir = path.join(process.cwd(), 'performance');
    await fs.ensureDir(performanceDir);
    
    // Create subdirectories
    await fs.ensureDir(path.join(performanceDir, 'profiles'));
    await fs.ensureDir(path.join(performanceDir, 'reports'));
    await fs.ensureDir(path.join(performanceDir, 'bundles'));
    await fs.ensureDir(path.join(performanceDir, 'lighthouse'));
    
    this.logger.agentInfo(this.name, 'Performance directory setup complete');
  }

  async checkPerformanceTools() {
    const tools = ['node', 'npm', 'webpack', 'lighthouse', 'chrome-devtools'];
    
    for (const tool of tools) {
      try {
        await execAsync(`which ${tool}`);
        this.logger.agentInfo(this.name, `Found performance tool: ${tool}`);
      } catch (error) {
        this.logger.agentWarn(this.name, `Performance tool not found: ${tool}`);
      }
    }
  }

  async runPerformanceAnalysis() {
    this.logger.agentInfo(this.name, 'Starting performance analysis');
    
    const analysis = {
      timestamp: Date.now(),
      profiling: null,
      memoryAnalysis: null,
      bundleAnalysis: null,
      lighthouse: null,
      recommendations: []
    };

    try {
      // Run profiling if enabled
      if (this.profiling) {
        analysis.profiling = await this.runProfiling();
      }

      // Run memory leak detection if enabled
      if (this.memoryLeakDetection) {
        analysis.memoryAnalysis = await this.detectMemoryLeaks();
      }

      // Run bundle analysis if enabled
      if (this.bundleAnalysis) {
        analysis.bundleAnalysis = await this.analyzeBundle();
      }

      // Run Lighthouse if enabled
      if (this.lighthouse) {
        analysis.lighthouse = await this.runLighthouse();
      }

      // Generate recommendations
      analysis.recommendations = await this.generateRecommendations(analysis);

      // Save analysis
      await this.savePerformanceAnalysis(analysis);

      this.currentAnalysis = analysis;
      this.performanceHistory.push(analysis);

      this.logger.agentInfo(this.name, 'Performance analysis completed');
      
      this.recordMetric('performance_analysis_success', 1);
      this.recordEvent('performance_analysis_completed', { analysis });

    } catch (error) {
      this.logger.agentError(this.name, 'Performance analysis failed', { error: error.message });
      this.recordMetric('performance_analysis_failure', 1, { error: error.message });
    }
  }

  async runProfiling() {
    this.logger.agentInfo(this.name, 'Running performance profiling');
    
    try {
      // Use Node.js built-in profiler
      const profilePath = path.join(process.cwd(), 'performance', 'profiles', `profile-${Date.now()}.cpuprofile`);
      
      // Start profiling
      const profiler = require('v8').getHeapProfiler();
      
      // Run a sample workload
      await this.runSampleWorkload();
      
      // Stop profiling and save results
      const profile = profiler.stop();
      
      await fs.writeJson(profilePath, profile, { spaces: 2 });
      
      this.logger.agentInfo(this.name, `Profiling completed: ${profilePath}`);
      
      return {
        profilePath,
        timestamp: Date.now()
      };
      
    } catch (error) {
      this.logger.agentWarn(this.name, 'Profiling failed', { error: error.message });
      return null;
    }
  }

  async runSampleWorkload() {
    // Simulate application workload for profiling
    const iterations = 1000;
    
    for (let i = 0; i < iterations; i++) {
      // Simulate CPU-intensive work
      Math.sqrt(i);
      
      // Simulate memory allocation
      const arr = new Array(1000).fill(i);
      
      // Simulate async operations
      if (i % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
  }

  async detectMemoryLeaks() {
    this.logger.agentInfo(this.name, 'Detecting memory leaks');
    
    try {
      const memoryUsage = process.memoryUsage();
      const heapStats = require('v8').getHeapStatistics();
      
      // Monitor memory usage over time
      const memorySnapshots = [];
      const snapshotCount = 10;
      
      for (let i = 0; i < snapshotCount; i++) {
        memorySnapshots.push({
          timestamp: Date.now(),
          usage: process.memoryUsage(),
          heapStats: require('v8').getHeapStatistics()
        });
        
        // Simulate some work
        await this.runSampleWorkload();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Analyze for memory leaks
      const leakAnalysis = this.analyzeMemorySnapshots(memorySnapshots);
      
      this.logger.agentInfo(this.name, 'Memory leak detection completed');
      
      return {
        snapshots: memorySnapshots,
        analysis: leakAnalysis,
        timestamp: Date.now()
      };
      
    } catch (error) {
      this.logger.agentWarn(this.name, 'Memory leak detection failed', { error: error.message });
      return null;
    }
  }

  analyzeMemorySnapshots(snapshots) {
    const analysis = {
      memoryGrowth: 0,
      potentialLeak: false,
      recommendations: []
    };

    if (snapshots.length < 2) return analysis;

    // Calculate memory growth
    const firstSnapshot = snapshots[0];
    const lastSnapshot = snapshots[snapshots.length - 1];
    
    const memoryGrowth = lastSnapshot.usage.heapUsed - firstSnapshot.usage.heapUsed;
    analysis.memoryGrowth = memoryGrowth;

    // Check for potential memory leak
    if (memoryGrowth > 10 * 1024 * 1024) { // 10MB threshold
      analysis.potentialLeak = true;
      analysis.recommendations.push('Potential memory leak detected. Consider reviewing object lifecycle management.');
    }

    // Check heap fragmentation
    const avgHeapFragmentation = snapshots.reduce((sum, snapshot) => {
      return sum + (snapshot.heapStats.total_available_size / snapshot.heapStats.total_heap_size);
    }, 0) / snapshots.length;

    if (avgHeapFragmentation > 0.3) {
      analysis.recommendations.push('High heap fragmentation detected. Consider optimizing memory allocation patterns.');
    }

    return analysis;
  }

  async analyzeBundle() {
    this.logger.agentInfo(this.name, 'Analyzing bundle size');
    
    try {
      // Check if webpack is available
      const webpackPath = path.join(process.cwd(), 'node_modules', '.bin', 'webpack');
      
      if (!fs.existsSync(webpackPath)) {
        this.logger.agentWarn(this.name, 'Webpack not found, skipping bundle analysis');
        return null;
      }

      // Build with bundle analyzer
      const bundleReportPath = path.join(process.cwd(), 'performance', 'bundles', `bundle-${Date.now()}.json`);
      
      const { stdout, stderr } = await execAsync(`${webpackPath} --mode production --json > ${bundleReportPath}`);
      
      // Parse bundle report
      const bundleReport = await fs.readJson(bundleReportPath);
      const bundleAnalysis = this.analyzeBundleReport(bundleReport);
      
      this.logger.agentInfo(this.name, 'Bundle analysis completed');
      
      return {
        reportPath: bundleReportPath,
        analysis: bundleAnalysis,
        timestamp: Date.now()
      };
      
    } catch (error) {
      this.logger.agentWarn(this.name, 'Bundle analysis failed', { error: error.message });
      return null;
    }
  }

  analyzeBundleReport(bundleReport) {
    const analysis = {
      totalSize: 0,
      chunkCount: 0,
      largeChunks: [],
      recommendations: []
    };

    if (bundleReport.chunks) {
      analysis.chunkCount = bundleReport.chunks.length;
      
      bundleReport.chunks.forEach(chunk => {
        const chunkSize = chunk.size || 0;
        analysis.totalSize += chunkSize;
        
        if (chunkSize > 500 * 1024) { // 500KB threshold
          analysis.largeChunks.push({
            name: chunk.names?.[0] || 'unknown',
            size: chunkSize
          });
        }
      });
    }

    // Generate recommendations
    if (analysis.totalSize > 2 * 1024 * 1024) { // 2MB threshold
      analysis.recommendations.push('Bundle size is large. Consider code splitting and tree shaking.');
    }

    if (analysis.largeChunks.length > 0) {
      analysis.recommendations.push(`Found ${analysis.largeChunks.length} large chunks. Consider splitting them.`);
    }

    return analysis;
  }

  async runLighthouse() {
    this.logger.agentInfo(this.name, 'Running Lighthouse audit');
    
    try {
      // Check if Lighthouse is available
      try {
        await execAsync('which lighthouse');
      } catch (error) {
        this.logger.agentWarn(this.name, 'Lighthouse not found, skipping audit');
        return null;
      }

      const lighthouseReportPath = path.join(process.cwd(), 'performance', 'lighthouse', `lighthouse-${Date.now()}.json`);
      
      // Run Lighthouse audit
      const { stdout, stderr } = await execAsync(`lighthouse --output=json --output-path=${lighthouseReportPath} --chrome-flags="--headless" http://localhost:3000`);
      
      // Parse Lighthouse report
      const lighthouseReport = await fs.readJson(lighthouseReportPath);
      const lighthouseAnalysis = this.analyzeLighthouseReport(lighthouseReport);
      
      this.logger.agentInfo(this.name, 'Lighthouse audit completed');
      
      return {
        reportPath: lighthouseReportPath,
        analysis: lighthouseAnalysis,
        timestamp: Date.now()
      };
      
    } catch (error) {
      this.logger.agentWarn(this.name, 'Lighthouse audit failed', { error: error.message });
      return null;
    }
  }

  analyzeLighthouseReport(report) {
    const analysis = {
      performance: 0,
      accessibility: 0,
      bestPractices: 0,
      seo: 0,
      metrics: {},
      issues: [],
      recommendations: []
    };

    if (report.categories) {
      analysis.performance = report.categories.performance?.score * 100 || 0;
      analysis.accessibility = report.categories.accessibility?.score * 100 || 0;
      analysis.bestPractices = report.categories['best-practices']?.score * 100 || 0;
      analysis.seo = report.categories.seo?.score * 100 || 0;
    }

    if (report.audits) {
      // Extract Core Web Vitals
      const fcp = report.audits['first-contentful-paint'];
      const lcp = report.audits['largest-contentful-paint'];
      const cls = report.audits['cumulative-layout-shift'];
      
      analysis.metrics = {
        firstContentfulPaint: fcp?.numericValue || 0,
        largestContentfulPaint: lcp?.numericValue || 0,
        cumulativeLayoutShift: cls?.numericValue || 0
      };

      // Check against thresholds
      if (analysis.metrics.firstContentfulPaint > this.thresholds.firstContentfulPaint) {
        analysis.issues.push('First Contentful Paint is too slow');
        analysis.recommendations.push('Optimize server response time and critical rendering path');
      }

      if (analysis.metrics.largestContentfulPaint > this.thresholds.largestContentfulPaint) {
        analysis.issues.push('Largest Contentful Paint is too slow');
        analysis.recommendations.push('Optimize image loading and reduce render-blocking resources');
      }

      if (analysis.metrics.cumulativeLayoutShift > this.thresholds.cumulativeLayoutShift) {
        analysis.issues.push('Cumulative Layout Shift is too high');
        analysis.recommendations.push('Set explicit dimensions for images and avoid layout shifts');
      }
    }

    return analysis;
  }

  async generateRecommendations(analysis) {
    const recommendations = [];

    // Profiling recommendations
    if (analysis.profiling) {
      recommendations.push('Review CPU profiling data for optimization opportunities');
    }

    // Memory recommendations
    if (analysis.memoryAnalysis?.analysis?.potentialLeak) {
      recommendations.push('Address potential memory leak detected in analysis');
    }

    // Bundle recommendations
    if (analysis.bundleAnalysis?.analysis?.recommendations) {
      recommendations.push(...analysis.bundleAnalysis.analysis.recommendations);
    }

    // Lighthouse recommendations
    if (analysis.lighthouse?.analysis?.recommendations) {
      recommendations.push(...analysis.lighthouse.analysis.recommendations);
    }

    return recommendations;
  }

  async savePerformanceAnalysis(analysis) {
    const analysisPath = path.join(process.cwd(), 'performance', 'reports', `analysis-${Date.now()}.json`);
    
    try {
      await fs.writeJson(analysisPath, analysis, { spaces: 2 });
      this.logger.agentInfo(this.name, `Performance analysis saved: ${analysisPath}`);
    } catch (error) {
      this.logger.agentError(this.name, 'Error saving performance analysis', { error: error.message });
    }
  }

  async cleanup() {
    this.logger.agentInfo(this.name, 'Cleaning up performance agent');
  }

  async checkHealth() {
    const health = await super.checkHealth();
    
    health.metrics = {
      performanceHistoryLength: this.performanceHistory.length,
      currentAnalysis: this.currentAnalysis ? {
        timestamp: this.currentAnalysis.timestamp,
        hasProfiling: !!this.currentAnalysis.profiling,
        hasMemoryAnalysis: !!this.currentAnalysis.memoryAnalysis,
        hasBundleAnalysis: !!this.currentAnalysis.bundleAnalysis,
        hasLighthouse: !!this.currentAnalysis.lighthouse
      } : null
    };
    
    return health;
  }

  // Public methods
  async getPerformanceReport() {
    return this.currentAnalysis;
  }

  async getPerformanceHistory(limit = 10) {
    return this.performanceHistory.slice(-limit);
  }

  async runAnalysis() {
    return this.runPerformanceAnalysis();
  }
}

module.exports = { PerformanceAgent }; 
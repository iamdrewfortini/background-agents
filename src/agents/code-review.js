const { BaseAgent } = require('./base-agent');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const chokidar = require('chokidar');

const execAsync = promisify(exec);

class CodeReviewAgent extends BaseAgent {
  constructor(config, logger) {
    super(config, logger);
    this.watcher = null;
    this.reviewQueue = [];
    this.isProcessing = false;
    this.reviewRules = config.config.rules || {};
    this.watchPaths = config.config.watchPaths || ['src/'];
    this.excludePaths = config.config.excludePaths || ['node_modules/', 'dist/'];
  }

  async initialize() {
    this.logger.agentInfo(this.name, 'Initializing code review agent');
    
    // Setup file watcher
    await this.setupFileWatcher();
    
    // Load existing code review tools
    await this.checkReviewTools();
    
    this.logger.agentInfo(this.name, 'Code review agent initialized');
  }

  async setupFileWatcher() {
    const watchPatterns = this.watchPaths.map(p => path.resolve(p));
    const ignorePatterns = this.excludePaths.map(p => path.resolve(p));
    
    this.watcher = chokidar.watch(watchPatterns, {
      ignored: ignorePatterns,
      persistent: true,
      ignoreInitial: true
    });

    this.watcher
      .on('add', (filePath) => this.handleFileChange(filePath, 'added'))
      .on('change', (filePath) => this.handleFileChange(filePath, 'modified'))
      .on('unlink', (filePath) => this.handleFileChange(filePath, 'deleted'));

    this.logger.agentInfo(this.name, `Watching paths: ${this.watchPaths.join(', ')}`);
  }

  async handleFileChange(filePath, changeType) {
    if (!this.shouldReviewFile(filePath)) {
      return;
    }

    this.logger.agentInfo(this.name, `File ${changeType}: ${filePath}`);
    
    // Add to review queue
    this.reviewQueue.push({
      filePath,
      changeType,
      timestamp: Date.now()
    });

    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processReviewQueue();
    }
  }

  shouldReviewFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const supportedExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.go', '.rs'];
    
    return supportedExtensions.includes(ext);
  }

  async processReviewQueue() {
    if (this.isProcessing || this.reviewQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.reviewQueue.length > 0) {
        const reviewItem = this.reviewQueue.shift();
        await this.reviewFile(reviewItem);
      }
    } catch (error) {
      this.logger.agentError(this.name, 'Error processing review queue', { error: error.message });
    } finally {
      this.isProcessing = false;
    }
  }

  async reviewFile(reviewItem) {
    const { filePath, changeType } = reviewItem;
    
    try {
      this.logger.agentInfo(this.name, `Reviewing file: ${filePath}`);
      
      const reviewResults = await this.performCodeReview(filePath);
      
      if (reviewResults.issues.length > 0) {
        await this.reportIssues(filePath, reviewResults);
      }
      
      this.recordMetric('files_reviewed', 1, { file: filePath, changeType });
      this.recordEvent('file_reviewed', { filePath, changeType, results: reviewResults });
      
    } catch (error) {
      this.logger.agentError(this.name, `Error reviewing file: ${filePath}`, { error: error.message });
    }
  }

  async performCodeReview(filePath) {
    const results = {
      file: filePath,
      timestamp: Date.now(),
      issues: [],
      suggestions: [],
      metrics: {}
    };

    // Check file size
    const stats = await fs.stat(filePath);
    results.metrics.fileSize = stats.size;

    // Read file content
    const content = await fs.readFile(filePath, 'utf8');
    results.metrics.lines = content.split('\n').length;

    // Run different review checks
    await Promise.all([
      this.checkComplexity(filePath, content, results),
      this.checkSecurity(filePath, content, results),
      this.checkStyle(filePath, content, results),
      this.checkPerformance(filePath, content, results)
    ]);

    return results;
  }

  async checkComplexity(filePath, content, results) {
    if (!this.reviewRules.complexity) return;

    try {
      // Check cyclomatic complexity
      const complexity = this.calculateComplexity(content);
      
      if (complexity > 10) {
        results.issues.push({
          type: 'complexity',
          severity: 'warning',
          message: `High cyclomatic complexity: ${complexity}`,
          line: this.findComplexFunction(content)
        });
      }

      // Check function length
      const longFunctions = this.findLongFunctions(content);
      longFunctions.forEach(func => {
        results.issues.push({
          type: 'complexity',
          severity: 'info',
          message: `Long function: ${func.name} (${func.lines} lines)`,
          line: func.line
        });
      });

    } catch (error) {
      this.logger.agentWarn(this.name, 'Error checking complexity', { file: filePath, error: error.message });
    }
  }

  async checkSecurity(filePath, content, results) {
    if (!this.reviewRules.security) return;

    try {
      const securityPatterns = [
        { pattern: /eval\s*\(/, message: 'Use of eval() is dangerous', severity: 'high' },
        { pattern: /innerHTML\s*=/, message: 'Potential XSS vulnerability with innerHTML', severity: 'medium' },
        { pattern: /password\s*=\s*['"][^'"]*['"]/, message: 'Hardcoded password detected', severity: 'high' },
        { pattern: /console\.log/, message: 'Console.log statements should be removed in production', severity: 'low' }
      ];

      const lines = content.split('\n');
      
      securityPatterns.forEach(({ pattern, message, severity }) => {
        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            results.issues.push({
              type: 'security',
              severity,
              message,
              line: index + 1,
              code: line.trim()
            });
          }
        });
      });

    } catch (error) {
      this.logger.agentWarn(this.name, 'Error checking security', { file: filePath, error: error.message });
    }
  }

  async checkStyle(filePath, content, results) {
    if (!this.reviewRules.style) return;

    try {
      const styleIssues = [];

      // Check for consistent indentation
      const lines = content.split('\n');
      const indentationTypes = new Set();
      
      lines.forEach((line, index) => {
        if (line.trim() && !line.startsWith('//')) {
          const indent = line.match(/^(\s*)/)[1];
          if (indent) {
            indentationTypes.add(indent.length);
          }
        }
      });

      if (indentationTypes.size > 1) {
        styleIssues.push({
          type: 'style',
          severity: 'warning',
          message: 'Inconsistent indentation detected',
          line: 1
        });
      }

      // Check for trailing whitespace
      lines.forEach((line, index) => {
        if (line.endsWith(' ') || line.endsWith('\t')) {
          styleIssues.push({
            type: 'style',
            severity: 'low',
            message: 'Trailing whitespace',
            line: index + 1
          });
        }
      });

      results.issues.push(...styleIssues);

    } catch (error) {
      this.logger.agentWarn(this.name, 'Error checking style', { file: filePath, error: error.message });
    }
  }

  async checkPerformance(filePath, content, results) {
    if (!this.reviewRules.performance) return;

    try {
      const performancePatterns = [
        { pattern: /for\s*\(\s*let\s+i\s*=\s*0\s*;\s*i\s*<\s*array\.length/, message: 'Consider caching array length', severity: 'medium' },
        { pattern: /\.innerHTML\s*\+=/, message: 'String concatenation in loops is inefficient', severity: 'medium' },
        { pattern: /setTimeout\s*\(\s*function\s*\(\s*\)\s*{\s*setTimeout/, message: 'Nested setTimeout detected', severity: 'warning' }
      ];

      const lines = content.split('\n');
      
      performancePatterns.forEach(({ pattern, message, severity }) => {
        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            results.issues.push({
              type: 'performance',
              severity,
              message,
              line: index + 1,
              code: line.trim()
            });
          }
        });
      });

    } catch (error) {
      this.logger.agentWarn(this.name, 'Error checking performance', { file: filePath, error: error.message });
    }
  }

  calculateComplexity(content) {
    // Simple cyclomatic complexity calculation
    const complexityKeywords = ['if', 'else', 'for', 'while', 'case', 'catch', '&&', '||', '?'];
    let complexity = 1; // Base complexity
    
    complexityKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = content.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }

  findComplexFunction(content) {
    // Find the most complex function
    const functions = content.match(/function\s+\w+\s*\(/g) || [];
    return functions.length > 0 ? 1 : null;
  }

  findLongFunctions(content) {
    const functions = [];
    const lines = content.split('\n');
    let inFunction = false;
    let functionStart = 0;
    let functionName = '';
    
    lines.forEach((line, index) => {
      if (line.match(/function\s+\w+\s*\(/)) {
        inFunction = true;
        functionStart = index + 1;
        functionName = line.match(/function\s+(\w+)/)?.[1] || 'anonymous';
      } else if (inFunction && line.match(/^\s*}\s*$/)) {
        const functionLength = index - functionStart + 1;
        if (functionLength > 50) {
          functions.push({
            name: functionName,
            lines: functionLength,
            line: functionStart
          });
        }
        inFunction = false;
      }
    });
    
    return functions;
  }

  async reportIssues(filePath, reviewResults) {
    const issues = reviewResults.issues;
    
    if (issues.length === 0) return;

    this.logger.agentInfo(this.name, `Found ${issues.length} issues in ${filePath}`);
    
    issues.forEach(issue => {
      this.logger.agentWarn(this.name, `${issue.severity.toUpperCase()}: ${issue.message}`, {
        file: filePath,
        line: issue.line,
        type: issue.type
      });
    });

    // Create review report
    await this.createReviewReport(filePath, reviewResults);
  }

  async createReviewReport(filePath, reviewResults) {
    const reportPath = path.join(process.cwd(), 'reviews', `${path.basename(filePath)}.review.json`);
    
    try {
      await fs.ensureDir(path.dirname(reportPath));
      await fs.writeJson(reportPath, reviewResults, { spaces: 2 });
      
      this.logger.agentInfo(this.name, `Review report saved: ${reportPath}`);
    } catch (error) {
      this.logger.agentError(this.name, 'Error saving review report', { error: error.message });
    }
  }

  async checkReviewTools() {
    // Check if common code review tools are available
    const tools = ['eslint', 'prettier', 'sonarqube'];
    
    for (const tool of tools) {
      try {
        await execAsync(`which ${tool}`);
        this.logger.agentInfo(this.name, `Found ${tool}`);
      } catch (error) {
        this.logger.agentWarn(this.name, `${tool} not found`);
      }
    }
  }

  async cleanup() {
    if (this.watcher) {
      await this.watcher.close();
    }
  }

  async checkHealth() {
    const health = await super.checkHealth();
    
    health.metrics = {
      queueLength: this.reviewQueue.length,
      isProcessing: this.isProcessing,
      watchedFiles: this.watcher ? this.watcher.getWatched() : {}
    };
    
    return health;
  }
}

module.exports = { CodeReviewAgent }; 
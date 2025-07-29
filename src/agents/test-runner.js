const { BaseAgent } = require('./base-agent');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');

const execAsync = promisify(exec);

class TestRunnerAgent extends BaseAgent {
  constructor(config, logger) {
    super(config, logger);
    this.watcher = null;
    this.testQueue = [];
    this.isRunningTests = false;
    this.lastTestResults = null;
    this.testCommand = config.config.testCommand || 'npm test';
    this.watchPaths = config.config.watchPaths || ['src/', 'tests/'];
    this.coverageThreshold = config.config.coverageThreshold || 80;
    this.runOnSave = config.config.runOnSave || false;
    this.runOnCommit = config.config.runOnCommit || true;
    this.parallel = config.config.parallel || true;
    this.timeout = config.config.timeout || 30000;
  }

  async initialize() {
    this.logger.agentInfo(this.name, 'Initializing test runner agent');
    
    // Setup file watcher if runOnSave is enabled
    if (this.runOnSave) {
      await this.setupFileWatcher();
    }
    
    // Check test environment
    await this.checkTestEnvironment();
    
    // Run initial test suite
    await this.runFullTestSuite();
    
    this.logger.agentInfo(this.name, 'Test runner agent initialized');
  }

  async setupFileWatcher() {
    const watchPatterns = this.watchPaths.map(p => path.resolve(p));
    
    this.watcher = chokidar.watch(watchPatterns, {
      ignored: ['node_modules/', 'dist/', 'build/', 'coverage/'],
      persistent: true,
      ignoreInitial: true
    });

    this.watcher
      .on('add', (filePath) => this.handleFileChange(filePath, 'added'))
      .on('change', (filePath) => this.handleFileChange(filePath, 'modified'))
      .on('unlink', (filePath) => this.handleFileChange(filePath, 'deleted'));

    this.logger.agentInfo(this.name, `Watching test paths: ${this.watchPaths.join(', ')}`);
  }

  async handleFileChange(filePath, changeType) {
    if (!this.shouldRunTestsForFile(filePath)) {
      return;
    }

    this.logger.agentInfo(this.name, `File ${changeType}: ${filePath}`);
    
    // Add to test queue
    this.testQueue.push({
      filePath,
      changeType,
      timestamp: Date.now()
    });

    // Process queue if not already running tests
    if (!this.isRunningTests) {
      this.processTestQueue();
    }
  }

  shouldRunTestsForFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const testExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java'];
    
    return testExtensions.includes(ext);
  }

  async processTestQueue() {
    if (this.isRunningTests || this.testQueue.length === 0) {
      return;
    }

    this.isRunningTests = true;

    try {
      while (this.testQueue.length > 0) {
        const testItem = this.testQueue.shift();
        await this.runTestsForFile(testItem);
      }
    } catch (error) {
      this.logger.agentError(this.name, 'Error processing test queue', { error: error.message });
    } finally {
      this.isRunningTests = false;
    }
  }

  async runTestsForFile(testItem) {
    const { filePath, changeType } = testItem;
    
    try {
      this.logger.agentInfo(this.name, `Running tests for: ${filePath}`);
      
      const testResults = await this.runTestSuite(filePath);
      
      await this.analyzeTestResults(testResults);
      
      this.recordMetric('tests_run', 1, { file: filePath, changeType });
      this.recordEvent('tests_completed', { filePath, changeType, results: testResults });
      
    } catch (error) {
      this.logger.agentError(this.name, `Error running tests for: ${filePath}`, { error: error.message });
    }
  }

  async runFullTestSuite() {
    try {
      this.logger.agentInfo(this.name, 'Running full test suite');
      
      const testResults = await this.runTestSuite();
      
      await this.analyzeTestResults(testResults);
      
      this.lastTestResults = testResults;
      
      this.logger.agentInfo(this.name, 'Full test suite completed');
      
    } catch (error) {
      this.logger.agentError(this.name, 'Error running full test suite', { error: error.message });
    }
  }

  async runTestSuite(specificFile = null) {
    const startTime = Date.now();
    
    try {
      let command = this.testCommand;
      
      // If a specific file is provided, run tests for that file
      if (specificFile) {
        const testFile = this.findTestFile(specificFile);
        if (testFile) {
          command = `${this.testCommand} ${testFile}`;
        }
      }
      
      this.logger.agentInfo(this.name, `Executing: ${command}`);
      
      const { stdout, stderr } = await this.withTimeout(
        execAsync(command, { 
          cwd: process.cwd(),
          env: { ...process.env, CI: 'true' }
        }),
        this.timeout
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const results = {
        command,
        duration,
        stdout,
        stderr,
        success: true,
        timestamp: Date.now()
      };
      
      // Parse test results
      const parsedResults = this.parseTestOutput(stdout, stderr);
      results.parsed = parsedResults;
      
      this.logger.agentInfo(this.name, `Tests completed in ${duration}ms`, {
        passed: parsedResults.passed,
        failed: parsedResults.failed,
        total: parsedResults.total
      });
      
      return results;
      
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      this.logger.agentError(this.name, 'Test execution failed', { 
        error: error.message,
        duration 
      });
      
      return {
        command: this.testCommand,
        duration,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  parseTestOutput(stdout, stderr) {
    const results = {
      passed: 0,
      failed: 0,
      total: 0,
      coverage: null,
      failures: []
    };
    
    try {
      // Parse Jest output
      if (stdout.includes('Tests:')) {
        const testMatch = stdout.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
        if (testMatch) {
          results.failed = parseInt(testMatch[1]);
          results.passed = parseInt(testMatch[2]);
          results.total = parseInt(testMatch[3]);
        }
      }
      
      // Parse coverage information
      const coverageMatch = stdout.match(/All files\s+\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)/);
      if (coverageMatch) {
        results.coverage = {
          statements: parseFloat(coverageMatch[1]),
          branches: parseFloat(coverageMatch[2]),
          functions: parseFloat(coverageMatch[3])
        };
      }
      
      // Parse test failures
      const failureMatches = stdout.match(/●\s+(.+)/g);
      if (failureMatches) {
        results.failures = failureMatches.map(match => match.replace('● ', ''));
      }
      
    } catch (error) {
      this.logger.agentWarn(this.name, 'Error parsing test output', { error: error.message });
    }
    
    return results;
  }

  findTestFile(sourceFile) {
    const ext = path.extname(sourceFile);
    const baseName = path.basename(sourceFile, ext);
    const dir = path.dirname(sourceFile);
    
    // Common test file patterns
    const testPatterns = [
      `${baseName}.test${ext}`,
      `${baseName}.spec${ext}`,
      `test/${baseName}${ext}`,
      `tests/${baseName}${ext}`,
      `${baseName}.test.js`,
      `${baseName}.spec.js`
    ];
    
    for (const pattern of testPatterns) {
      const testFile = path.join(dir, pattern);
      if (fs.existsSync(testFile)) {
        return testFile;
      }
    }
    
    return null;
  }

  async analyzeTestResults(testResults) {
    if (!testResults.success) {
      this.logger.agentError(this.name, 'Test suite failed', { 
        error: testResults.error,
        stderr: testResults.stderr 
      });
      return;
    }
    
    const parsed = testResults.parsed;
    
    // Check test results
    if (parsed.failed > 0) {
      this.logger.agentWarn(this.name, `${parsed.failed} tests failed`, {
        total: parsed.total,
        passed: parsed.passed,
        failed: parsed.failed
      });
      
      // Log individual failures
      parsed.failures.forEach(failure => {
        this.logger.agentWarn(this.name, `Test failure: ${failure}`);
      });
    } else {
      this.logger.agentInfo(this.name, `All ${parsed.total} tests passed`);
    }
    
    // Check coverage
    if (parsed.coverage) {
      const avgCoverage = (parsed.coverage.statements + parsed.coverage.branches + parsed.coverage.functions) / 3;
      
      if (avgCoverage < this.coverageThreshold) {
        this.logger.agentWarn(this.name, `Coverage below threshold`, {
          current: avgCoverage.toFixed(2),
          threshold: this.coverageThreshold,
          details: parsed.coverage
        });
      } else {
        this.logger.agentInfo(this.name, `Coverage is good`, {
          coverage: avgCoverage.toFixed(2),
          threshold: this.coverageThreshold
        });
      }
    }
    
    // Save test results
    await this.saveTestResults(testResults);
  }

  async saveTestResults(testResults) {
    const resultsPath = path.join(process.cwd(), 'test-results', `test-run-${Date.now()}.json`);
    
    try {
      await fs.ensureDir(path.dirname(resultsPath));
      await fs.writeJson(resultsPath, testResults, { spaces: 2 });
      
      this.logger.agentInfo(this.name, `Test results saved: ${resultsPath}`);
    } catch (error) {
      this.logger.agentError(this.name, 'Error saving test results', { error: error.message });
    }
  }

  async checkTestEnvironment() {
    try {
      // Check if package.json exists
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        throw new Error('package.json not found');
      }
      
      // Check if test script exists
      const packageJson = await fs.readJson(packageJsonPath);
      if (!packageJson.scripts || !packageJson.scripts.test) {
        this.logger.agentWarn(this.name, 'No test script found in package.json');
      }
      
      // Check for test frameworks
      const testFrameworks = ['jest', 'mocha', 'jasmine', 'karma'];
      for (const framework of testFrameworks) {
        try {
          await execAsync(`which ${framework}`);
          this.logger.agentInfo(this.name, `Found test framework: ${framework}`);
        } catch (error) {
          // Framework not found, continue
        }
      }
      
      // Check for coverage tools
      const coverageTools = ['nyc', 'istanbul', 'c8'];
      for (const tool of coverageTools) {
        try {
          await execAsync(`which ${tool}`);
          this.logger.agentInfo(this.name, `Found coverage tool: ${tool}`);
        } catch (error) {
          // Tool not found, continue
        }
      }
      
    } catch (error) {
      this.logger.agentError(this.name, 'Error checking test environment', { error: error.message });
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
      queueLength: this.testQueue.length,
      isRunningTests: this.isRunningTests,
      lastTestResults: this.lastTestResults ? {
        success: this.lastTestResults.success,
        duration: this.lastTestResults.duration,
        timestamp: this.lastTestResults.timestamp
      } : null
    };
    
    return health;
  }

  // Public methods for external use
  async runTests() {
    return this.runFullTestSuite();
  }

  async getTestStatus() {
    return {
      lastRun: this.lastTestResults,
      isRunning: this.isRunningTests,
      queueLength: this.testQueue.length
    };
  }
}

module.exports = { TestRunnerAgent }; 
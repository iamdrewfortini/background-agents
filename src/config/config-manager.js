const fs = require('fs-extra');
const path = require('path');
const { Logger } = require('../utils/logger');

class ConfigManager {
  constructor(configPath = './config/agents.json') {
    this.configPath = configPath;
    this.logger = new Logger();
    this.config = null;
    this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        this.config = fs.readJsonSync(this.configPath);
      } else {
        this.config = this.getDefaultConfig();
        this.saveConfig();
      }
    } catch (error) {
      this.logger.error('Error loading config:', error);
      this.config = this.getDefaultConfig();
    }
  }

  saveConfig() {
    try {
      fs.ensureDirSync(path.dirname(this.configPath));
      fs.writeJsonSync(this.configPath, this.config, { spaces: 2 });
    } catch (error) {
      this.logger.error('Error saving config:', error);
      throw error;
    }
  }

  getDefaultConfig() {
    return {
      version: '1.0.0',
      agents: {
        'code-review': {
          name: 'code-review',
          description: 'Automatically reviews code changes and provides feedback',
          enabled: true,
          type: 'code-review',
          config: {
            watchPaths: ['src/', 'lib/', 'app/'],
            excludePaths: ['node_modules/', 'dist/', 'build/'],
            reviewOnSave: true,
            reviewOnCommit: true,
            maxFileSize: '1MB',
            rules: {
              complexity: true,
              security: true,
              performance: true,
              style: true
            }
          }
        },
        'test-runner': {
          name: 'test-runner',
          description: 'Automatically runs tests and reports results',
          enabled: true,
          type: 'test-runner',
          config: {
            watchPaths: ['src/', 'tests/'],
            testCommand: 'npm test',
            coverageThreshold: 80,
            runOnSave: false,
            runOnCommit: true,
            parallel: true,
            timeout: 30000
          }
        },
        'deployment': {
          name: 'deployment',
          description: 'Manages deployment processes and environments',
          enabled: false,
          type: 'deployment',
          config: {
            environments: ['staging', 'production'],
            autoDeploy: false,
            requireApproval: true,
            rollbackOnFailure: true,
            healthChecks: true
          }
        },
        'monitoring': {
          name: 'monitoring',
          description: 'Monitors application performance and health',
          enabled: true,
          type: 'monitoring',
          config: {
            metrics: ['cpu', 'memory', 'disk', 'network'],
            alertThresholds: {
              cpu: 80,
              memory: 85,
              disk: 90
            },
            logLevel: 'info',
            retention: '7d'
          }
        },
        'git-sync': {
          name: 'git-sync',
          description: 'Synchronizes with Git repositories and manages branches',
          enabled: true,
          type: 'git-sync',
          config: {
            autoCommit: false,
            autoPush: false,
            branchNaming: 'feature/{ticket}',
            commitMessageTemplate: 'feat: {description}',
            syncInterval: 300000 // 5 minutes
          }
        },
        'performance': {
          name: 'performance',
          description: 'Analyzes and optimizes application performance',
          enabled: false,
          type: 'performance',
          config: {
            profiling: true,
            memoryLeakDetection: true,
            bundleAnalysis: true,
            lighthouse: true,
            thresholds: {
              firstContentfulPaint: 2000,
              largestContentfulPaint: 4000,
              cumulativeLayoutShift: 0.1
            }
          }
        },
        'security': {
          name: 'security',
          description: 'Scans for security vulnerabilities and compliance issues',
          enabled: false,
          type: 'security',
          config: {
            vulnerabilityScan: true,
            dependencyCheck: true,
            secretsScan: true,
            complianceCheck: true,
            autoFix: false,
            severityLevels: ['high', 'medium', 'low']
          }
        },
        'documentation': {
          name: 'documentation',
          description: 'Automatically generates and maintains documentation',
          enabled: false,
          type: 'documentation',
          config: {
            autoGenerate: true,
            formats: ['markdown', 'html', 'pdf'],
            includeExamples: true,
            updateOnChange: true,
            templates: {
              api: './templates/api.md',
              readme: './templates/readme.md'
            }
          }
        }
      },
      global: {
        logLevel: 'info',
        maxConcurrentAgents: 5,
        healthCheckInterval: 30000,
        restartOnFailure: true,
        maxRestartAttempts: 3
      }
    };
  }

  getAgentConfig(agentName) {
    return this.config.agents[agentName] || null;
  }

  getAllAgents() {
    return Object.values(this.config.agents);
  }

  getEnabledAgents() {
    return Object.values(this.config.agents).filter(agent => agent.enabled);
  }

  getAvailableAgents() {
    return Object.values(this.config.agents);
  }

  updateAgentConfig(agentName, updates) {
    if (!this.config.agents[agentName]) {
      throw new Error(`Agent '${agentName}' not found`);
    }

    this.config.agents[agentName] = {
      ...this.config.agents[agentName],
      ...updates
    };

    this.saveConfig();
  }

  enableAgent(agentName) {
    this.updateAgentConfig(agentName, { enabled: true });
  }

  disableAgent(agentName) {
    this.updateAgentConfig(agentName, { enabled: false });
  }

  getGlobalConfig() {
    return this.config.global;
  }

  updateGlobalConfig(updates) {
    this.config.global = {
      ...this.config.global,
      ...updates
    };
    this.saveConfig();
  }

  validateConfig() {
    const errors = [];

    for (const [name, agent] of Object.entries(this.config.agents)) {
      if (!agent.name || !agent.type) {
        errors.push(`Agent '${name}' missing required fields`);
      }
    }

    return errors;
  }

  exportConfig() {
    return JSON.stringify(this.config, null, 2);
  }

  importConfig(configData) {
    try {
      const parsed = typeof configData === 'string' ? JSON.parse(configData) : configData;
      this.config = parsed;
      this.saveConfig();
      return true;
    } catch (error) {
      this.logger.error('Error importing config:', error);
      return false;
    }
  }
}

module.exports = { ConfigManager }; 
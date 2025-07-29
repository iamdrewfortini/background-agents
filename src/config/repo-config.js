const path = require('path');
const fs = require('fs-extra');

class RepoConfig {
  constructor() {
    this.repoPath = process.cwd();
    this.repoName = path.basename(this.repoPath);
    this.configPath = path.join(this.repoPath, 'config/agents.json');
    this.cursorConfigPath = path.join(this.repoPath, '.cursor/environment.json');
  }

  // Detect if we're in a Cursor environment
  isCursorEnvironment() {
    return process.env.CURSOR_ENVIRONMENT === 'true' || 
           process.env.CURSOR_WORKSPACE_ID || 
           process.env.CURSOR_SESSION_ID ||
           process.env.TERM_PROGRAM === 'cursor' ||
           this.repoPath.includes('.cursor');
  }

  // Get repository-specific configuration
  getRepoConfig() {
    const config = {
      repoPath: this.repoPath,
      repoName: this.repoName,
      isCursor: this.isCursorEnvironment(),
      hasConfig: fs.existsSync(this.configPath),
      hasCursorConfig: fs.existsSync(this.cursorConfigPath),
      packageJson: this.getPackageJson(),
      gitInfo: this.getGitInfo(),
      nodeModules: this.hasNodeModules(),
      scripts: this.getAvailableScripts()
    };

    return config;
  }

  // Get package.json information
  getPackageJson() {
    const packagePath = path.join(this.repoPath, 'package.json');
    if (fs.existsSync(packagePath)) {
      try {
        return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  // Get Git repository information
  getGitInfo() {
    const gitPath = path.join(this.repoPath, '.git');
    if (fs.existsSync(gitPath)) {
      try {
        const configPath = path.join(gitPath, 'config');
        if (fs.existsSync(configPath)) {
          const config = fs.readFileSync(configPath, 'utf8');
          const remoteMatch = config.match(/\[remote "origin"\][\s\S]*?url = (.+)/);
          if (remoteMatch) {
            return {
              hasGit: true,
              remoteUrl: remoteMatch[1].trim()
            };
          }
        }
        return { hasGit: true, remoteUrl: null };
      } catch (error) {
        return { hasGit: false, remoteUrl: null };
      }
    }
    return { hasGit: false, remoteUrl: null };
  }

  // Check if node_modules exists
  hasNodeModules() {
    return fs.existsSync(path.join(this.repoPath, 'node_modules'));
  }

  // Get available npm scripts
  getAvailableScripts() {
    const packageJson = this.getPackageJson();
    if (packageJson && packageJson.scripts) {
      return Object.keys(packageJson.scripts);
    }
    return [];
  }

  // Generate repository-specific agent configuration
  generateRepoConfig() {
    const repoConfig = this.getRepoConfig();
    const packageJson = repoConfig.packageJson;
    
    // Base configuration
    const config = {
      version: "2.0.0",
      environment: repoConfig.isCursor ? "cursor" : "local",
      repoName: repoConfig.repoName,
      repoPath: repoConfig.repoPath,
      agents: {
        "code-review": {
          name: "code-review",
          description: "Automatically reviews code changes and provides feedback",
          enabled: true,
          type: "code-review",
          config: {
            watchPaths: this.getWatchPaths(),
            excludePaths: [
              "node_modules/",
              "dist/",
              "build/",
              "coverage/",
              ".git/"
            ],
            reviewOnSave: true,
            reviewOnCommit: true,
            maxFileSize: "1MB",
            rules: {
              complexity: true,
              security: true,
              performance: true,
              style: true
            },
            severityLevels: ["error", "warning", "info"],
            autoFix: false,
            reportFormat: "json"
          }
        },
        "test-runner": {
          name: "test-runner",
          description: "Automatically runs tests and reports results",
          enabled: true,
          type: "test-runner",
          config: {
            watchPaths: this.getWatchPaths(),
            testCommand: this.getTestCommand(),
            coverageThreshold: 80,
            runOnSave: false,
            runOnCommit: true,
            parallel: true,
            timeout: 30000,
            retryFailedTests: true,
            maxRetries: 3,
            coverageReport: true,
            testResultsDir: "./test-results"
          }
        },
        "monitoring": {
          name: "monitoring",
          description: "Monitors application performance and health",
          enabled: true,
          type: "monitoring",
          config: {
            metrics: ["cpu", "memory", "disk", "network"],
            alertThresholds: {
              cpu: 80,
              memory: 85,
              disk: 90
            },
            logLevel: "info",
            retention: "7d",
            monitoringInterval: 30000,
            enableAlerts: true,
            enableReports: true,
            reportInterval: 3600000
          }
        },
        "git-sync": {
          name: "git-sync",
          description: "Synchronizes with Git repositories and manages branches",
          enabled: repoConfig.gitInfo.hasGit,
          type: "git-sync",
          config: {
            autoCommit: false,
            autoPush: false,
            branchNaming: "feature/{ticket}",
            commitMessageTemplate: "feat: {description}",
            syncInterval: 300000,
            enableBranchProtection: true,
            requirePullRequest: true,
            autoMerge: false,
            conflictResolution: "manual"
          }
        }
      },
      global: {
        logLevel: "info",
        maxConcurrentAgents: 5,
        healthCheckInterval: 30000,
        restartOnFailure: true,
        maxRestartAttempts: 3,
        enableMetrics: true,
        enableHealthChecks: true,
        logRetention: "30d",
        notificationChannels: ["console", "file"],
        environment: repoConfig.isCursor ? "cursor" : "local",
        repoName: repoConfig.repoName,
        repoPath: repoConfig.repoPath
      }
    };

    return config;
  }

  // Get appropriate watch paths based on repository structure
  getWatchPaths() {
    const commonPaths = ["src/", "lib/", "app/", "components/", "pages/", "utils/"];
    const existingPaths = commonPaths.filter(path => 
      fs.existsSync(path.join(this.repoPath, path))
    );
    
    // If no common paths exist, watch the root
    return existingPaths.length > 0 ? existingPaths : ["./"];
  }

  // Get appropriate test command based on package.json
  getTestCommand() {
    const scripts = this.getAvailableScripts();
    
    // Priority order for test commands
    const testCommands = ['test', 'jest', 'mocha', 'vitest'];
    
    for (const cmd of testCommands) {
      if (scripts.includes(cmd)) {
        return `npm run ${cmd}`;
      }
    }
    
    return "npm test";
  }

  // Save repository-specific configuration
  async saveRepoConfig() {
    const config = this.generateRepoConfig();
    await fs.ensureDir(path.dirname(this.configPath));
    await fs.writeJson(this.configPath, config, { spaces: 2 });
    return config;
  }

  // Load or create repository configuration
  async loadOrCreateConfig() {
    if (fs.existsSync(this.configPath)) {
      try {
        return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      } catch (error) {
        console.warn('Error reading existing config, creating new one');
      }
    }
    
    return await this.saveRepoConfig();
  }
}

module.exports = RepoConfig; 
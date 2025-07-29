#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const chalk = require('chalk');
const ora = require('ora');

const execAsync = promisify(exec);

async function setupEnvironment() {
  const spinner = ora('Setting up background agents environment...').start();
  
  try {
    // Create necessary directories
    await createDirectories();
    
    // Install dependencies
    await installDependencies();
    
    // Setup configuration
    await setupConfiguration();
    
    // Setup git repository if not already initialized
    await setupGitRepository();
    
    // Create initial documentation
    await createInitialDocumentation();
    
    spinner.succeed(chalk.green('Background agents environment setup completed successfully!'));
    
    console.log(chalk.blue('\nNext steps:'));
    console.log(chalk.gray('1. Review and edit config/agents.json to customize agent behavior'));
    console.log(chalk.gray('2. Run "npm run start" to start all agents'));
    console.log(chalk.gray('3. Run "npm run list" to see available agents'));
    console.log(chalk.gray('4. Check logs/ directory for agent logs'));
    
  } catch (error) {
    spinner.fail(chalk.red('Setup failed'));
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

async function createDirectories() {
  const directories = [
    'logs',
    'config',
    'reviews',
    'test-results',
    'monitoring',
    'deployments',
    'security',
    'performance',
    'docs',
    'templates'
  ];
  
  for (const dir of directories) {
    await fs.ensureDir(dir);
  }
  
  console.log(chalk.green('✓ Created directories'));
}

async function installDependencies() {
  try {
    console.log(chalk.blue('Installing dependencies...'));
    await execAsync('npm install');
    console.log(chalk.green('✓ Dependencies installed'));
  } catch (error) {
    console.warn(chalk.yellow('Warning: Failed to install dependencies'), error.message);
  }
}

async function setupConfiguration() {
  try {
    const configPath = path.join(process.cwd(), 'config', 'agents.json');
    
    // Check if config already exists
    if (await fs.pathExists(configPath)) {
      console.log(chalk.blue('✓ Configuration already exists'));
      return;
    }
    
    // Create default configuration
    const defaultConfig = {
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
            syncInterval: 300000
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
    
    await fs.writeJson(configPath, defaultConfig, { spaces: 2 });
    console.log(chalk.green('✓ Configuration created'));
    
  } catch (error) {
    console.error(chalk.red('Error creating configuration:'), error.message);
  }
}

async function setupGitRepository() {
  try {
    // Check if git is already initialized
    const gitDir = path.join(process.cwd(), '.git');
    
    if (await fs.pathExists(gitDir)) {
      console.log(chalk.blue('✓ Git repository already exists'));
      return;
    }
    
    // Initialize git repository
    await execAsync('git init');
    await execAsync('git add .');
    await execAsync('git commit -m "Initial commit: Background agents setup"');
    
    console.log(chalk.green('✓ Git repository initialized'));
    
  } catch (error) {
    console.warn(chalk.yellow('Warning: Failed to setup git repository'), error.message);
  }
}

async function createInitialDocumentation() {
  try {
    const readmePath = path.join(process.cwd(), 'README.md');
    
    // Check if README already exists
    if (await fs.pathExists(readmePath)) {
      console.log(chalk.blue('✓ README already exists'));
      return;
    }
    
    const readmeContent = `# Background Agents

A comprehensive suite of background agents for development automation and monitoring.

## Features

- **Code Review Agent**: Automatic code quality analysis and feedback
- **Test Runner Agent**: Automated testing and coverage reporting
- **Monitoring Agent**: System and application performance monitoring
- **Git Sync Agent**: Automated Git operations and branch management
- **Deployment Agent**: Automated deployment and environment management
- **Security Agent**: Vulnerability scanning and compliance checking
- **Performance Agent**: Performance analysis and optimization
- **Documentation Agent**: Automatic documentation generation

## Quick Start

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Setup the environment:
   \`\`\`bash
   npm run setup
   \`\`\`

3. Start all agents:
   \`\`\`bash
   npm run start
   \`\`\`

4. List available agents:
   \`\`\`bash
   npm run list
   \`\`\`

## Configuration

Edit \`config/agents.json\` to customize agent behavior.

## Documentation

See the \`docs/\` directory for detailed documentation.

## License

MIT
`;

    await fs.writeFile(readmePath, readmeContent);
    console.log(chalk.green('✓ Initial documentation created'));
    
  } catch (error) {
    console.error(chalk.red('Error creating documentation:'), error.message);
  }
}

// Export for use in other modules
module.exports = { setupEnvironment };

// Run setup if this file is executed directly
if (require.main === module) {
  setupEnvironment().catch(error => {
    console.error(chalk.red('Setup failed:'), error.message);
    process.exit(1);
  });
} 
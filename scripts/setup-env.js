#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');

async function setupEnvironment() {
  console.log(chalk.blue('🔧 Background Agents Environment Setup'));
  console.log(chalk.gray('This will help you create a .env file with the necessary environment variables.\n'));

  try {
    // Check if .env already exists
    const envPath = path.join(process.cwd(), '.env');
    if (await fs.pathExists(envPath)) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'A .env file already exists. Do you want to overwrite it?',
          default: false
        }
      ]);

      if (!overwrite) {
        console.log(chalk.yellow('Setup cancelled. Your existing .env file was preserved.'));
        return;
      }
    }

    // Get environment-specific settings
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'environment',
        message: 'What environment are you setting up?',
        choices: [
          { name: 'Development', value: 'development' },
          { name: 'Production', value: 'production' },
          { name: 'Cursor Environment', value: 'cursor' }
        ],
        default: 'development'
      },
      {
        type: 'input',
        name: 'port',
        message: 'What port should the dashboard run on?',
        default: '3000',
        validate: (input) => {
          const port = parseInt(input);
          return port > 0 && port < 65536 ? true : 'Port must be between 1 and 65535';
        }
      },
      {
        type: 'list',
        name: 'logLevel',
        message: 'What log level do you want?',
        choices: [
          { name: 'Debug (most verbose)', value: 'debug' },
          { name: 'Info (recommended)', value: 'info' },
          { name: 'Warn (less verbose)', value: 'warn' },
          { name: 'Error (least verbose)', value: 'error' }
        ],
        default: 'info'
      },
      {
        type: 'input',
        name: 'githubToken',
        message: 'GitHub Personal Access Token (optional - for GitHub integration):',
        default: ''
      },
      {
        type: 'confirm',
        name: 'enableMetrics',
        message: 'Enable metrics collection?',
        default: true
      },
      {
        type: 'confirm',
        name: 'enableHealthChecks',
        message: 'Enable health checks?',
        default: true
      },
      {
        type: 'input',
        name: 'maxConcurrentAgents',
        message: 'Maximum number of concurrent agents:',
        default: '5',
        validate: (input) => {
          const num = parseInt(input);
          return num > 0 && num <= 20 ? true : 'Must be between 1 and 20';
        }
      }
    ]);

    // Generate environment variables based on answers
    const envVars = generateEnvVars(answers);
    
    // Write .env file
    await fs.writeFile(envPath, envVars);
    
    console.log(chalk.green('\n✅ Environment setup completed successfully!'));
    console.log(chalk.blue('\n📁 Created .env file with the following settings:'));
    console.log(chalk.gray(`   Environment: ${answers.environment}`));
    console.log(chalk.gray(`   Port: ${answers.port}`));
    console.log(chalk.gray(`   Log Level: ${answers.logLevel}`));
    console.log(chalk.gray(`   Metrics: ${answers.enableMetrics ? 'Enabled' : 'Disabled'}`));
    console.log(chalk.gray(`   Health Checks: ${answers.enableHealthChecks ? 'Enabled' : 'Disabled'}`));
    console.log(chalk.gray(`   Max Agents: ${answers.maxConcurrentAgents}`));
    
    console.log(chalk.blue('\n🚀 Next steps:'));
    console.log(chalk.gray('1. Review the .env file and adjust any settings'));
    console.log(chalk.gray('2. Run "npm start" to start all agents'));
    console.log(chalk.gray('3. Run "npm run dev" to start the dashboard'));
    console.log(chalk.gray('4. Check ENVIRONMENT_VARIABLES.md for more configuration options'));

  } catch (error) {
    console.error(chalk.red('❌ Setup failed:'), error.message);
    process.exit(1);
  }
}

function generateEnvVars(answers) {
  const isDevelopment = answers.environment === 'development';
  const isCursor = answers.environment === 'cursor';
  
  return `# Background Agents Environment Configuration
# Generated on ${new Date().toISOString()}

# =============================================================================
# APPLICATION SETTINGS
# =============================================================================
NODE_ENV=${answers.environment}
PORT=${answers.port}
HOST=localhost

# =============================================================================
# LOGGING CONFIGURATION
# =============================================================================
LOG_LEVEL=${answers.logLevel}
LOG_DIR=./logs
LOG_MAX_SIZE=10MB
LOG_MAX_FILES=5
LOG_RETENTION_DAYS=30

# =============================================================================
# AGENT CONFIGURATION
# =============================================================================
AGENT_CONFIG_PATH=./config/agents.json
MAX_CONCURRENT_AGENTS=${answers.maxConcurrentAgents}
HEALTH_CHECK_INTERVAL=30000
RESTART_ON_FAILURE=true
MAX_RESTART_ATTEMPTS=3

# =============================================================================
# CURSOR ENVIRONMENT DETECTION
# =============================================================================
CURSOR_ENVIRONMENT=${isCursor ? 'true' : 'false'}
CURSOR_WORKSPACE_ID=
CURSOR_SESSION_ID=

# =============================================================================
# GITHUB INTEGRATION
# =============================================================================
GITHUB_TOKEN=${answers.githubToken || ''}
GITHUB_REPOSITORY=iamdrewfortini/background-agents
GITHUB_BRANCH=main
GITHUB_AUTO_SYNC=true

# =============================================================================
# MONITORING CONFIGURATION
# =============================================================================
MONITORING_INTERVAL=30000
MONITORING_METRICS=cpu,memory,disk,network
MONITORING_ALERT_CPU=80
MONITORING_ALERT_MEMORY=85
MONITORING_ALERT_DISK=90

# =============================================================================
# TESTING CONFIGURATION
# =============================================================================
TEST_COMMAND=npm test
TEST_COVERAGE_THRESHOLD=80
TEST_TIMEOUT=30000
TEST_MAX_RETRIES=3
TEST_PARALLEL=true

# =============================================================================
# DEVELOPMENT SETTINGS
# =============================================================================
DEV_MODE=${isDevelopment ? 'true' : 'false'}
DEBUG=${isDevelopment ? 'true' : 'false'}
VERBOSE_LOGGING=${isDevelopment ? 'true' : 'false'}
ENABLE_METRICS=${answers.enableMetrics}
ENABLE_HEALTH_CHECKS=${answers.enableHealthChecks}

# =============================================================================
# FILE WATCHING SETTINGS
# =============================================================================
WATCH_PATHS=src/,lib/,app/,tests/
EXCLUDE_PATHS=node_modules/,dist/,build/,coverage/,.git/
MAX_FILE_SIZE=1MB

# =============================================================================
# CACHE SETTINGS
# =============================================================================
CACHE_ENABLED=true
CACHE_TTL=3600000
CACHE_MAX_SIZE=100MB

# =============================================================================
# API SETTINGS
# =============================================================================
API_RATE_LIMIT=100
API_TIMEOUT=30000
API_CORS_ORIGIN=*
API_AUTH_REQUIRED=false
`;
}

// Run setup if called directly
if (require.main === module) {
  setupEnvironment();
}

module.exports = { setupEnvironment }; 
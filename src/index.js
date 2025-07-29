#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const { AgentManager } = require('./agents/agent-manager');
const { ConfigManager } = require('./config/config-manager');
const { Logger } = require('./utils/logger');

// Initialize logger
const logger = new Logger();

// CLI setup
program
  .name('warp-background-agents')
  .description('A suite of background agents for Warp terminal development and automation')
  .version('1.0.0');

// Start all agents
program
  .command('start')
  .description('Start all configured background agents')
  .option('-c, --config <path>', 'Path to configuration file', './config/agents.json')
  .action(async (options) => {
    const spinner = ora('Starting background agents...').start();
    
    try {
      const configManager = new ConfigManager(options.config);
      const agentManager = new AgentManager(configManager);
      
      await agentManager.startAll();
      spinner.succeed(chalk.green('All background agents started successfully'));
      
      logger.info('Background agents are running. Use Ctrl+C to stop.');
      
      // Keep the process alive
      process.on('SIGINT', async () => {
        spinner.start('Stopping background agents...');
        await agentManager.stopAll();
        spinner.succeed(chalk.green('All background agents stopped'));
        process.exit(0);
      });
      
    } catch (error) {
      spinner.fail(chalk.red('Failed to start background agents'));
      logger.error('Error starting agents:', error);
      process.exit(1);
    }
  });

// Start specific agent
program
  .command('agent <name>')
  .description('Start a specific background agent')
  .option('-c, --config <path>', 'Path to configuration file', './config/agents.json')
  .action(async (name, options) => {
    const spinner = ora(`Starting agent: ${name}`).start();
    
    try {
      const configManager = new ConfigManager(options.config);
      const agentManager = new AgentManager(configManager);
      
      await agentManager.startAgent(name);
      spinner.succeed(chalk.green(`Agent '${name}' started successfully`));
      
    } catch (error) {
      spinner.fail(chalk.red(`Failed to start agent '${name}'`));
      logger.error('Error starting agent:', error);
      process.exit(1);
    }
  });

// List available agents
program
  .command('list')
  .description('List all available background agents')
  .option('-c, --config <path>', 'Path to configuration file', './config/agents.json')
  .action(async (options) => {
    try {
      const configManager = new ConfigManager(options.config);
      const agents = configManager.getAvailableAgents();
      
      console.log(chalk.blue('\nAvailable Background Agents:'));
      console.log(chalk.gray('─'.repeat(50)));
      
      agents.forEach(agent => {
        console.log(chalk.cyan(`• ${agent.name}`));
        console.log(chalk.gray(`  ${agent.description}`));
        console.log(chalk.gray(`  Status: ${agent.enabled ? 'Enabled' : 'Disabled'}`));
        console.log('');
      });
      
    } catch (error) {
      logger.error('Error listing agents:', error);
      process.exit(1);
    }
  });

// Setup command
program
  .command('setup')
  .description('Setup the background agents environment')
  .action(async () => {
    const spinner = ora('Setting up background agents environment...').start();
    
    try {
      // Run setup script
      const { setupEnvironment } = require('../scripts/setup');
      await setupEnvironment();
      
      spinner.succeed(chalk.green('Background agents environment setup completed'));
      
    } catch (error) {
      spinner.fail(chalk.red('Failed to setup environment'));
      logger.error('Setup error:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(); 
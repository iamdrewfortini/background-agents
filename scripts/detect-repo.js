#!/usr/bin/env node

const RepoConfig = require('../src/config/repo-config');
const { Logger } = require('../src/utils/logger');
const chalk = require('chalk');

async function detectAndConfigureRepo() {
  const logger = new Logger();
  const repoConfig = new RepoConfig();
  
  console.log(chalk.blue('🔍 Detecting repository configuration...'));
  
  try {
    // Get repository information
    const repoInfo = repoConfig.getRepoConfig();
    
    console.log(chalk.green('\n📊 Repository Information:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`📁 Repository: ${chalk.cyan(repoInfo.repoName)}`);
    console.log(`📍 Path: ${chalk.cyan(repoInfo.repoPath)}`);
    console.log(`🚀 Environment: ${chalk.cyan(repoInfo.isCursor ? 'Cursor' : 'Local')}`);
    console.log(`📦 Node Modules: ${chalk.cyan(repoInfo.nodeModules ? '✅ Found' : '❌ Not found')}`);
    console.log(`🔧 Git Repository: ${chalk.cyan(repoInfo.gitInfo.hasGit ? '✅ Found' : '❌ Not found')}`);
    
    if (repoInfo.gitInfo.hasGit && repoInfo.gitInfo.remoteUrl) {
      console.log(`🔗 Remote: ${chalk.cyan(repoInfo.gitInfo.remoteUrl)}`);
    }
    
    if (repoInfo.packageJson) {
      console.log(`📋 Package: ${chalk.cyan(repoInfo.packageJson.name || 'Unknown')}`);
      console.log(`📦 Version: ${chalk.cyan(repoInfo.packageJson.version || 'Unknown')}`);
      
      if (repoInfo.scripts.length > 0) {
        console.log(`🔧 Available Scripts: ${chalk.cyan(repoInfo.scripts.join(', '))}`);
      }
    }
    
    console.log(chalk.gray('─'.repeat(50)));
    
    // Generate repository-specific configuration
    console.log(chalk.blue('\n⚙️  Generating repository-specific configuration...'));
    
    const config = await repoConfig.loadOrCreateConfig();
    
    console.log(chalk.green('✅ Configuration generated successfully!'));
    console.log(`📁 Config saved to: ${chalk.cyan(repoConfig.configPath)}`);
    
    // Show agent configuration
    console.log(chalk.blue('\n🤖 Agent Configuration:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    Object.entries(config.agents).forEach(([name, agent]) => {
      const status = agent.enabled ? chalk.green('✅ Enabled') : chalk.red('❌ Disabled');
      console.log(`${chalk.cyan(name)}: ${status} - ${agent.description}`);
    });
    
    console.log(chalk.gray('─'.repeat(50)));
    
    // Show watch paths
    const codeReviewAgent = config.agents['code-review'];
    if (codeReviewAgent && codeReviewAgent.config.watchPaths) {
      console.log(chalk.blue('\n👀 Watch Paths:'));
      codeReviewAgent.config.watchPaths.forEach(path => {
        console.log(`  📁 ${chalk.cyan(path)}`);
      });
    }
    
    // Show test command
    const testRunnerAgent = config.agents['test-runner'];
    if (testRunnerAgent && testRunnerAgent.config.testCommand) {
      console.log(chalk.blue('\n🧪 Test Command:'));
      console.log(`  ${chalk.cyan(testRunnerAgent.config.testCommand)}`);
    }
    
    console.log(chalk.gray('\n─'.repeat(50)));
    console.log(chalk.green('🎉 Repository configuration complete!'));
    console.log(chalk.yellow('\nNext steps:'));
    console.log(`  ${chalk.cyan('npm start')} - Start all agents`);
    console.log(`  ${chalk.cyan('npm run dev')} - Start dashboard`);
    console.log(`  ${chalk.cyan('npm run list')} - List agents`);
    
  } catch (error) {
    console.error(chalk.red('❌ Error configuring repository:'), error.message);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  detectAndConfigureRepo();
}

module.exports = { detectAndConfigureRepo }; 
#!/usr/bin/env node

require('dotenv').config();
const chalk = require('chalk');
const { GitHubClient } = require('../src/utils/github-client');
const { AIService } = require('../src/utils/ai-service');

async function testGitHubSetup() {
  console.log(chalk.blue('\n🔍 Testing GitHub Automation Setup\n'));
  
  let testsPass = true;
  
  // Test 1: Check environment variables
  console.log(chalk.yellow('1. Checking environment variables...'));
  
  const requiredVars = {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    AI_PROVIDER: process.env.AI_PROVIDER || 'openai'
  };
  
  if (requiredVars.AI_PROVIDER === 'openai') {
    requiredVars.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  } else if (requiredVars.AI_PROVIDER === 'anthropic') {
    requiredVars.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  }
  
  for (const [key, value] of Object.entries(requiredVars)) {
    if (!value) {
      console.log(chalk.red(`  ❌ ${key} is not set`));
      testsPass = false;
    } else {
      const maskedValue = value.substring(0, 10) + '...';
      console.log(chalk.green(`  ✅ ${key} is set (${maskedValue})`));
    }
  }
  
  if (!testsPass) {
    console.log(chalk.red('\n❌ Missing required environment variables.'));
    console.log(chalk.yellow('Please copy .env.example to .env and fill in your values.'));
    return;
  }
  
  // Test 2: GitHub API connectivity
  console.log(chalk.yellow('\n2. Testing GitHub API connectivity...'));
  
  try {
    const github = new GitHubClient(process.env.GITHUB_TOKEN);
    
    // Test authentication
    const { data: user } = await github.api.get('/user');
    console.log(chalk.green(`  ✅ Authenticated as: ${user.login}`));
    
    // Test rate limit
    const rateLimit = await github.checkRateLimit();
    console.log(chalk.green(`  ✅ API Rate Limit: ${rateLimit.rate.remaining}/${rateLimit.rate.limit}`));
    
    // Test repository access if configured
    if (process.env.GITHUB_OWNER && process.env.GITHUB_REPO) {
      github.setRepository(process.env.GITHUB_OWNER, process.env.GITHUB_REPO);
      const repo = await github.getRepository();
      console.log(chalk.green(`  ✅ Repository access: ${repo.full_name}`));
    } else {
      console.log(chalk.yellow('  ⚠️  GITHUB_OWNER and GITHUB_REPO not set - using auto-detection'));
    }
    
  } catch (error) {
    console.log(chalk.red(`  ❌ GitHub API Error: ${error.message}`));
    if (error.response?.status === 401) {
      console.log(chalk.yellow('     Invalid token. Please check your GITHUB_TOKEN.'));
    }
    testsPass = false;
  }
  
  // Test 3: AI Service connectivity
  console.log(chalk.yellow('\n3. Testing AI Service connectivity...'));
  
  try {
    const ai = new AIService();
    console.log(chalk.green(`  ✅ AI Provider: ${ai.provider}`));
    
    // Test with a simple prompt
    const testCode = 'function add(a, b) { return a + b; }';
    console.log(chalk.yellow('  🔄 Testing AI analysis...'));
    
    const result = await ai.analyzeCode(testCode, 'javascript');
    if (result && result.quality_score !== undefined) {
      console.log(chalk.green(`  ✅ AI Service working - Quality score: ${result.quality_score}/100`));
    } else {
      console.log(chalk.yellow('  ⚠️  AI Service returned unexpected format'));
    }
    
  } catch (error) {
    console.log(chalk.red(`  ❌ AI Service Error: ${error.message}`));
    if (error.response?.status === 401) {
      console.log(chalk.yellow(`     Invalid ${process.env.AI_PROVIDER} API key.`));
    }
    testsPass = false;
  }
  
  // Test 4: Git repository check
  console.log(chalk.yellow('\n4. Checking Git repository...'));
  
  try {
    const { execSync } = require('child_process');
    
    // Check if in git repo
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    console.log(chalk.green('  ✅ Git repository detected'));
    
    // Get current branch
    const branch = execSync('git branch --show-current').toString().trim();
    console.log(chalk.green(`  ✅ Current branch: ${branch}`));
    
    // Get remote URL
    const remoteUrl = execSync('git config --get remote.origin.url').toString().trim();
    console.log(chalk.green(`  ✅ Remote URL: ${remoteUrl}`));
    
  } catch (error) {
    console.log(chalk.red('  ❌ Not in a git repository'));
    console.log(chalk.yellow('     Initialize with: git init'));
    testsPass = false;
  }
  
  // Test 5: Check GitHub CLI (optional)
  console.log(chalk.yellow('\n5. Checking GitHub CLI (optional)...'));
  
  try {
    const { execSync } = require('child_process');
    const ghVersion = execSync('gh --version').toString().trim();
    console.log(chalk.green(`  ✅ GitHub CLI installed: ${ghVersion.split('\n')[0]}`));
    
    // Check if authenticated
    try {
      execSync('gh auth status', { stdio: 'ignore' });
      console.log(chalk.green('  ✅ GitHub CLI authenticated'));
    } catch {
      console.log(chalk.yellow('  ⚠️  GitHub CLI not authenticated'));
      console.log(chalk.yellow('     Run: gh auth login'));
    }
    
  } catch (error) {
    console.log(chalk.yellow('  ⚠️  GitHub CLI not installed'));
    console.log(chalk.yellow('     Install from: https://cli.github.com/'));
  }
  
  // Summary
  console.log(chalk.blue('\n📊 Summary\n'));
  
  if (testsPass) {
    console.log(chalk.green('✅ All required tests passed!'));
    console.log(chalk.green('Your GitHub automation agent is ready to use.'));
    console.log(chalk.yellow('\nNext steps:'));
    console.log('1. Enable the agent in config/agents.json');
    console.log('2. Start the agents: npm start');
    console.log('3. Access dashboard: http://localhost:3000');
  } else {
    console.log(chalk.red('❌ Some tests failed.'));
    console.log(chalk.yellow('Please fix the issues above before using the GitHub automation agent.'));
  }
}

// Run tests
testGitHubSetup().catch(error => {
  console.error(chalk.red('Test script error:'), error);
  process.exit(1);
});
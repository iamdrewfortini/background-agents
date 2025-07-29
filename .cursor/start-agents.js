#!/usr/bin/env node

const { AgentManager } = require('../src/agents/agent-manager');
const { ConfigManager } = require('../src/config/config-manager');
const { Logger } = require('../src/utils/logger');

// Check if we're running inside Cursor
function isCursorEnvironment() {
  return process.env.CURSOR_ENVIRONMENT === 'true' || 
         process.env.CURSOR_WORKSPACE_ID || 
         process.env.CURSOR_SESSION_ID ||
         process.cwd().includes('.cursor') ||
         process.env.TERM_PROGRAM === 'cursor';
}

async function startCursorAgents() {
  const logger = new Logger();
  
  if (!isCursorEnvironment()) {
    logger.info('Not running in Cursor environment. Skipping agent startup.');
    return;
  }
  
  logger.info('Cursor environment detected. Starting background agents...');
  
  try {
    // Use main config with Cursor environment detection
    const configManager = new ConfigManager('./config/agents.json');
    const agentManager = new AgentManager(configManager);
    
    // Start all enabled agents
    await agentManager.startAll();
    
    logger.info('Cursor background agents started successfully');
    
    // Keep the process alive
    process.on('SIGINT', async () => {
      logger.info('Stopping Cursor background agents...');
      await agentManager.stopAll();
      logger.info('Cursor background agents stopped');
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to start Cursor agents:', error);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  startCursorAgents();
}

module.exports = { startCursorAgents, isCursorEnvironment }; 
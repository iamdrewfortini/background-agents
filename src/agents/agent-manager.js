const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const path = require('path');
const { Logger } = require('../utils/logger');

class AgentManager extends EventEmitter {
  constructor(configManager) {
    super();
    this.configManager = configManager;
    this.logger = new Logger();
    this.activeAgents = new Map();
    this.agentProcesses = new Map();
  }

  async startAll() {
    const agents = this.configManager.getEnabledAgents();
    
    for (const agent of agents) {
      try {
        await this.startAgent(agent.name);
      } catch (error) {
        this.logger.error(`Failed to start agent ${agent.name}:`, error);
        // Continue with other agents even if one fails
      }
    }
  }

  async startAgent(agentName) {
    const agentConfig = this.configManager.getAgentConfig(agentName);
    
    if (!agentConfig) {
      throw new Error(`Agent '${agentName}' not found in configuration`);
    }

    if (!agentConfig.enabled) {
      this.logger.warn(`Agent '${agentName}' is disabled`);
      return;
    }

    if (this.activeAgents.has(agentName)) {
      this.logger.warn(`Agent '${agentName}' is already running`);
      return;
    }

    this.logger.info(`Starting agent: ${agentName}`);

    // Create agent instance
    const AgentClass = this.getAgentClass(agentName);
    const agent = new AgentClass(agentConfig, this.logger);
    
    // Start the agent
    await agent.start();
    
    // Store active agent
    this.activeAgents.set(agentName, agent);
    
    // Emit event
    this.emit('agentStarted', { name: agentName, agent });
    
    this.logger.info(`Agent '${agentName}' started successfully`);
  }

  async stopAgent(agentName) {
    const agent = this.activeAgents.get(agentName);
    
    if (!agent) {
      this.logger.warn(`Agent '${agentName}' is not running`);
      return;
    }

    this.logger.info(`Stopping agent: ${agentName}`);
    
    try {
      await agent.stop();
      this.activeAgents.delete(agentName);
      this.emit('agentStopped', { name: agentName });
      this.logger.info(`Agent '${agentName}' stopped successfully`);
    } catch (error) {
      this.logger.error(`Error stopping agent '${agentName}':`, error);
      throw error;
    }
  }

  async stopAll() {
    const agentNames = Array.from(this.activeAgents.keys());
    
    for (const agentName of agentNames) {
      try {
        await this.stopAgent(agentName);
      } catch (error) {
        this.logger.error(`Error stopping agent '${agentName}':`, error);
      }
    }
  }

  getAgentStatus(agentName) {
    const agent = this.activeAgents.get(agentName);
    
    if (!agent) {
      return { status: 'stopped', uptime: 0 };
    }
    
    return {
      status: agent.status,
      uptime: Date.now() - agent.startTime,
      lastActivity: agent.lastActivity
    };
  }

  getAllAgentStatuses() {
    const statuses = {};
    
    for (const [name, agent] of this.activeAgents) {
      statuses[name] = this.getAgentStatus(name);
    }
    
    return statuses;
  }

  getAgentClass(agentName) {
    // Map agent names to their classes
    const agentClasses = {
      'code-review': require('./code-review').CodeReviewAgent,
      'test-runner': require('./test-runner').TestRunnerAgent,
      'deployment': require('./deployment').DeploymentAgent,
      'monitoring': require('./monitoring').MonitoringAgent,
      'git-sync': require('./git-sync').GitSyncAgent,
      'performance': require('./performance').PerformanceAgent,
      'security': require('./security').SecurityAgent,
      'documentation': require('./documentation').DocumentationAgent
    };

    const AgentClass = agentClasses[agentName];
    
    if (!AgentClass) {
      throw new Error(`Unknown agent type: ${agentName}`);
    }

    return AgentClass;
  }

  async restartAgent(agentName) {
    this.logger.info(`Restarting agent: ${agentName}`);
    
    try {
      await this.stopAgent(agentName);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      await this.startAgent(agentName);
      this.logger.info(`Agent '${agentName}' restarted successfully`);
    } catch (error) {
      this.logger.error(`Failed to restart agent '${agentName}':`, error);
      throw error;
    }
  }

  getActiveAgents() {
    return Array.from(this.activeAgents.keys());
  }

  getAgentCount() {
    return this.activeAgents.size;
  }
}

module.exports = { AgentManager }; 
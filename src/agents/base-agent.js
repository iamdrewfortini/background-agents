const { EventEmitter } = require('events');
const { Logger } = require('../utils/logger');

class BaseAgent extends EventEmitter {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger || new Logger();
    this.name = config.name;
    this.status = 'stopped';
    this.startTime = null;
    this.lastActivity = null;
    this.interval = null;
    this.retryCount = 0;
    this.maxRetries = config.maxRetries || 3;
    this.healthCheckInterval = config.healthCheckInterval || 30000;
  }

  async start() {
    try {
      this.logger.agentInfo(this.name, 'Starting agent');
      
      this.status = 'starting';
      this.startTime = Date.now();
      this.lastActivity = Date.now();
      
      // Initialize the agent
      await this.initialize();
      
      // Start the main loop
      await this.startMainLoop();
      
      this.status = 'running';
      this.emit('started', { name: this.name, timestamp: Date.now() });
      
      this.logger.agentInfo(this.name, 'Agent started successfully');
      
    } catch (error) {
      this.status = 'error';
      this.logger.agentError(this.name, 'Failed to start agent', { error: error.message });
      this.emit('error', { name: this.name, error, timestamp: Date.now() });
      throw error;
    }
  }

  async stop() {
    try {
      this.logger.agentInfo(this.name, 'Stopping agent');
      
      this.status = 'stopping';
      
      // Clear any intervals
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
      
      // Cleanup
      await this.cleanup();
      
      this.status = 'stopped';
      this.emit('stopped', { name: this.name, timestamp: Date.now() });
      
      this.logger.agentInfo(this.name, 'Agent stopped successfully');
      
    } catch (error) {
      this.logger.agentError(this.name, 'Error stopping agent', { error: error.message });
      throw error;
    }
  }

  async restart() {
    this.logger.agentInfo(this.name, 'Restarting agent');
    
    try {
      await this.stop();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      await this.start();
      
      this.logger.agentInfo(this.name, 'Agent restarted successfully');
      
    } catch (error) {
      this.logger.agentError(this.name, 'Failed to restart agent', { error: error.message });
      throw error;
    }
  }

  async initialize() {
    // Override in subclasses
    this.logger.agentDebug(this.name, 'Initializing agent');
  }

  async startMainLoop() {
    // Override in subclasses
    this.logger.agentDebug(this.name, 'Starting main loop');
    
    // Default health check interval
    this.interval = setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckInterval);
  }

  async cleanup() {
    // Override in subclasses
    this.logger.agentDebug(this.name, 'Cleaning up agent');
  }

  async performHealthCheck() {
    try {
      this.lastActivity = Date.now();
      
      // Perform agent-specific health check
      const health = await this.checkHealth();
      
      if (health.status === 'healthy') {
        this.retryCount = 0;
        this.logger.agentDebug(this.name, 'Health check passed');
      } else {
        this.logger.agentWarn(this.name, 'Health check failed', { health });
        
        if (this.retryCount >= this.maxRetries) {
          this.logger.agentError(this.name, 'Max retries exceeded, stopping agent');
          await this.stop();
          return;
        }
        
        this.retryCount++;
        this.logger.agentWarn(this.name, `Retry attempt ${this.retryCount}/${this.maxRetries}`);
      }
      
      this.emit('healthCheck', { name: this.name, health, timestamp: Date.now() });
      
    } catch (error) {
      this.logger.agentError(this.name, 'Health check error', { error: error.message });
    }
  }

  async checkHealth() {
    // Override in subclasses
    return {
      status: 'healthy',
      uptime: Date.now() - this.startTime,
      lastActivity: this.lastActivity
    };
  }

  updateActivity() {
    this.lastActivity = Date.now();
  }

  getStatus() {
    return {
      name: this.name,
      status: this.status,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      lastActivity: this.lastActivity,
      retryCount: this.retryCount,
      config: this.config
    };
  }

  async handleError(error, context = {}) {
    this.logger.agentError(this.name, 'Agent error', { 
      error: error.message, 
      stack: error.stack,
      context 
    });
    
    this.emit('error', { 
      name: this.name, 
      error, 
      context, 
      timestamp: Date.now() 
    });
  }

  // Utility methods for subclasses
  async retry(operation, maxAttempts = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
        
        this.logger.agentWarn(this.name, `Operation failed, retrying (${attempt}/${maxAttempts})`, {
          error: error.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  async withTimeout(promise, timeoutMs = 30000) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }

  // Metrics and monitoring
  recordMetric(name, value, tags = {}) {
    this.logger.metric(name, value, { agent: this.name, ...tags });
  }

  recordEvent(eventName, data = {}) {
    this.emit('event', {
      name: this.name,
      event: eventName,
      data,
      timestamp: Date.now()
    });
  }
}

module.exports = { BaseAgent }; 
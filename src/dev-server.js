const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const { AgentManager } = require('./agents/agent-manager');
const { ConfigManager } = require('./config/config-manager');
const { Logger } = require('./utils/logger');

class DevServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.wss = null;
    this.agentManager = null;
    this.configManager = null;
    this.logger = new Logger();
    this.port = process.env.PORT || 3000;
  }

  async start() {
    try {
      this.logger.info('Starting development server');
      
      // Initialize managers
      await this.initializeManagers();
      
      // Setup middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Start server
      this.server = this.app.listen(this.port, () => {
        this.logger.info(`Development server running on http://localhost:${this.port}`);
        console.log(chalk.green(`🚀 Development server running on http://localhost:${this.port}`));
      });
      
      // Setup WebSocket after server is started
      this.setupWebSocket();
      
      // Start agents
      await this.startAgents();
      
    } catch (error) {
      this.logger.error('Failed to start development server', { error: error.message });
      throw error;
    }
  }

  async initializeManagers() {
    this.configManager = new ConfigManager();
    this.agentManager = new AgentManager(this.configManager);
    
    // Setup event listeners
    this.agentManager.on('agentStarted', (data) => {
      this.broadcast('agentStarted', data);
    });
    
    this.agentManager.on('agentStopped', (data) => {
      this.broadcast('agentStopped', data);
    });
    
    this.agentManager.on('healthCheck', (data) => {
      this.broadcast('healthCheck', data);
    });
    
    this.agentManager.on('error', (data) => {
      this.broadcast('error', data);
    });
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../public')));
    

    
    // CORS middleware
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: Date.now(),
        uptime: process.uptime()
      });
    });

    // API routes
    this.app.get('/api/agents', async (req, res) => {
      try {
        const agents = this.configManager.getAvailableAgents();
        const statuses = this.agentManager.getAllAgentStatuses();
        
        const agentList = agents.map(agent => ({
          ...agent,
          status: statuses[agent.name] || { status: 'stopped', uptime: 0 }
        }));
        
        res.json(agentList);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/agents/:name/start', async (req, res) => {
      try {
        const { name } = req.params;
        await this.agentManager.startAgent(name);
        res.json({ success: true, message: `Agent ${name} started` });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/agents/:name/stop', async (req, res) => {
      try {
        const { name } = req.params;
        await this.agentManager.stopAgent(name);
        res.json({ success: true, message: `Agent ${name} stopped` });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/agents/:name/restart', async (req, res) => {
      try {
        const { name } = req.params;
        await this.agentManager.restartAgent(name);
        res.json({ success: true, message: `Agent ${name} restarted` });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/agents/:name/status', async (req, res) => {
      try {
        const { name } = req.params;
        const status = this.agentManager.getAgentStatus(name);
        res.json(status);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/logs', (req, res) => {
      try {
        const logFiles = this.logger.getLogFiles();
        res.json(logFiles);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/logs/:file', (req, res) => {
      try {
        const { file } = req.params;
        const logPath = path.join(process.cwd(), 'logs', file);
        
        if (!fs.existsSync(logPath)) {
          return res.status(404).json({ error: 'Log file not found' });
        }
        
        const content = fs.readFileSync(logPath, 'utf8');
        res.json({ content, file });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Configuration routes
    this.app.get('/api/config', (req, res) => {
      try {
        const config = this.configManager.config;
        res.json(config);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.put('/api/config', (req, res) => {
      try {
        const updates = req.body;
        this.configManager.config = { ...this.configManager.config, ...updates };
        this.configManager.saveConfig();
        res.json({ success: true, message: 'Configuration updated' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Serve the main dashboard
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });
  }

  setupWebSocket() {
    this.wss = new WebSocket.Server({ 
      server: this.server
    });
    
    this.wss.on('connection', (ws) => {
      this.logger.info('WebSocket client connected');
      
      // Send initial state
      ws.send(JSON.stringify({
        type: 'connected',
        data: {
          agents: this.configManager.getAvailableAgents(),
          statuses: this.agentManager.getAllAgentStatuses()
        }
      }));
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          this.logger.error('WebSocket message error', { error: error.message });
        }
      });
      
      ws.on('close', () => {
        this.logger.info('WebSocket client disconnected');
      });
    });
  }

  handleWebSocketMessage(ws, message) {
    switch (message.type) {
      case 'startAgent':
        this.agentManager.startAgent(message.agentName).catch(error => {
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: error.message }
          }));
        });
        break;
        
      case 'stopAgent':
        this.agentManager.stopAgent(message.agentName).catch(error => {
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: error.message }
          }));
        });
        break;
        
      case 'restartAgent':
        this.agentManager.restartAgent(message.agentName).catch(error => {
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: error.message }
          }));
        });
        break;
        
      default:
        this.logger.warn('Unknown WebSocket message type', { type: message.type });
    }
  }

  broadcast(type, data) {
    if (!this.wss) return;
    
    try {
      // Filter out circular references and sensitive data
      const safeData = this.sanitizeData(data);
      const message = JSON.stringify({ type, data: safeData });
      
      this.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    } catch (error) {
      this.logger.error('Error broadcasting message', { error: error.message, type });
    }
  }

  sanitizeData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const seen = new WeakSet();
    const sanitize = (obj) => {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }

      if (seen.has(obj)) {
        return '[Circular Reference]';
      }

      seen.add(obj);

      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }

      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip logger and other problematic properties
        if (key === 'logger' || key === '_readableState' || key === 'parent') {
          continue;
        }
        result[key] = sanitize(value);
      }

      return result;
    };

    return sanitize(data);
  }

  async startAgents() {
    try {
      await this.agentManager.startAll();
      this.logger.info('All agents started');
    } catch (error) {
      this.logger.error('Failed to start agents', { error: error.message });
    }
  }

  async stop() {
    this.logger.info('Stopping development server');
    
    if (this.agentManager) {
      await this.agentManager.stopAll();
    }
    
    if (this.wss) {
      this.wss.close();
    }
    
    if (this.server) {
      this.server.close();
    }
  }
}

// Start server if this file is executed directly
if (require.main === module) {
  const server = new DevServer();
  
  process.on('SIGINT', async () => {
    console.log('\nShutting down development server...');
    await server.stop();
    process.exit(0);
  });
  
  server.start().catch(error => {
    console.error('Failed to start development server:', error.message);
    process.exit(1);
  });
}

module.exports = { DevServer }; 
# Background Agents - Cursor Environment Setup

This guide explains how to set up and use the background agents system in Cursor's remote environment.

## 🚀 Quick Setup

### 1. Environment Configuration
The `.cursor/environment.json` file is already configured with:
- **Install Command**: `npm install && npm run setup && sudo apt-get update && sudo apt-get install -y htop curl wget git`
- **Start Command**: Creates necessary directories and prepares the environment
- **5 Terminals**: Dashboard, logs, monitoring, status, and development
- **Port 3000**: Exposed for the web dashboard

### 2. Starting the Environment
1. Open Cursor
2. Press `Ctrl+E` to open the background agent control panel
3. Select "Background Agents Development Environment"
4. Wait for the environment to build and start

### 3. Accessing the Dashboard
Once the environment is running:
- **Web Dashboard**: http://localhost:3000
- **Terminal Access**: Multiple terminals are available for monitoring

## 📊 Terminal Layout

### Terminal 1: Background Agents Dashboard
```bash
npm run dev
```
- Starts the web dashboard server
- Provides real-time agent monitoring
- Allows agent control (start/stop/restart)

### Terminal 2: Agent Logs Monitor
```bash
tail -f logs/combined.log
```
- Shows real-time logs from all agents
- Displays errors, warnings, and info messages
- Helps with debugging agent issues

### Terminal 3: System Monitor
```bash
htop
```
- System resource monitoring
- CPU, memory, and process tracking
- Helps identify performance issues

### Terminal 4: Agent Status
```bash
watch -n 5 'node src/index.js list'
```
- Auto-refreshing agent status every 5 seconds
- Shows which agents are running/stopped
- Displays agent uptime and health

### Terminal 5: Development Terminal
```bash
bash
```
- Interactive shell for development
- Run custom commands and scripts
- Debug agent issues

## 🎯 Using Background Agents

### Starting Agents
```bash
# Start all agents
node src/index.js start

# Start specific agent
node src/index.js agent monitoring

# List available agents
node src/index.js list
```

### Web Dashboard Features
1. **Real-time Monitoring**: Live agent status updates
2. **Agent Controls**: Start/stop/restart individual agents
3. **Metrics Display**: System resource usage
4. **Log Viewer**: Real-time log monitoring
5. **Configuration**: Edit agent settings

### Agent Types Available

#### Currently Running:
- **Code Review Agent**: Watches for file changes and performs automated code analysis
- **Test Runner Agent**: Automatically runs tests and reports results
- **Monitoring Agent**: Collects system metrics (CPU, memory, disk, network)
- **Git Sync Agent**: Manages Git operations and branch synchronization

#### Ready to Enable:
- **Deployment Agent**: Manages deployment processes and environments
- **Security Agent**: Scans for vulnerabilities and compliance issues
- **Performance Agent**: Analyzes and optimizes application performance
- **Documentation Agent**: Automatically generates and maintains documentation

## 🔧 Configuration

### Agent Configuration
Edit `config/agents.json` to customize agent behavior:
```json
{
  "agents": {
    "code-review": {
      "enabled": true,
      "config": {
        "watchPaths": ["src/", "lib/", "app/"],
        "rules": {
          "complexity": true,
          "security": true,
          "performance": true,
          "style": true
        }
      }
    }
  }
}
```

### Global Settings
```json
{
  "global": {
    "logLevel": "info",
    "maxConcurrentAgents": 5,
    "healthCheckInterval": 30000,
    "restartOnFailure": true
  }
}
```

## 📁 Directory Structure

```
background-agents/
├── .cursor/
│   ├── environment.json    # Cursor environment config
│   └── README.md          # Environment documentation
├── src/
│   ├── agents/            # Agent implementations
│   ├── config/            # Configuration management
│   └── utils/             # Utilities
├── config/
│   └── agents.json        # Agent configurations
├── logs/                  # Agent log files
├── monitoring/            # System monitoring data
├── reviews/               # Code review reports
└── test-results/          # Test execution results
```

## 🔍 Monitoring & Debugging

### Viewing Logs
```bash
# Combined logs
tail -f logs/combined.log

# Specific agent logs
tail -f logs/agent-monitoring.log
tail -f logs/agent-code-review.log
```

### Health Checks
- All agents perform automatic health checks every 30 seconds
- Failed agents are automatically restarted
- Health status is reported via WebSocket

### Performance Metrics
- System resource usage (CPU, memory, disk)
- Agent performance metrics
- Error rates and response times

## 🛠️ Troubleshooting

### Common Issues

#### 1. Agent Fails to Start
```bash
# Check logs
tail -f logs/combined.log

# Test agent manually
node test-agents.js

# Restart agent
node src/index.js agent <agent-name>
```

#### 2. Dashboard Not Accessible
```bash
# Check if server is running
ps aux | grep node

# Restart development server
npm run dev

# Check port availability
netstat -tlnp | grep 3000
```

#### 3. WebSocket Connection Issues
- Refresh the dashboard page
- Check browser console for errors
- Restart the development server

#### 4. Configuration Errors
```bash
# Validate configuration
node -e "console.log(JSON.parse(require('fs').readFileSync('config/agents.json')))"

# Reset to defaults
npm run setup
```

### Debug Mode
```bash
# Run with debug logging
NODE_ENV=development node src/dev-server.js

# Test specific functionality
node test-dashboard.js
```

## 🎉 Advanced Features

### Custom Agent Development
1. Create new agent in `src/agents/`
2. Extend `BaseAgent` class
3. Add to `agent-manager.js` mapping
4. Update configuration in `config/agents.json`

### Integration with CI/CD
- Connect deployment agent to your CI pipeline
- Set up automated security scanning
- Configure performance monitoring

### External Service Integration
- Connect to monitoring services (Datadog, New Relic)
- Integrate with issue trackers (Jira, GitHub Issues)
- Set up notification systems (Slack, email)

## 📈 Performance Optimization

### Agent Tuning
- Adjust health check intervals
- Modify monitoring thresholds
- Configure log retention periods
- Set appropriate timeouts

### System Optimization
- Monitor resource usage with `htop`
- Adjust agent concurrency limits
- Optimize log file sizes
- Configure appropriate file watching

## 🔐 Security Considerations

### Environment Security
- All code runs in isolated VMs
- No code retention after agent completion
- Encrypted storage for sensitive data
- Network isolation for agent processes

### Best Practices
- Use environment variables for secrets
- Validate all configuration inputs
- Implement proper error handling
- Monitor for suspicious activities

---

## 🎯 Success Checklist

- ✅ Environment starts successfully
- ✅ All agents load without errors
- ✅ Web dashboard accessible at http://localhost:3000
- ✅ Real-time monitoring working
- ✅ Agent controls functional
- ✅ Logs being generated
- ✅ Health checks passing
- ✅ Configuration system operational

**Your background agents system is now ready for development automation in Cursor!** 
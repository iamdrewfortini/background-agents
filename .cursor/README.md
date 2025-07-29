# Background Agents - Cursor Environment

This Cursor environment is configured to run the unified background agents system for development automation.

## 🚀 Quick Start

1. **Environment Setup**: The environment automatically installs all dependencies and sets up the background agents system
2. **Dashboard Access**: The web dashboard will be available at `http://localhost:3000`
3. **Terminal Access**: Multiple terminals are available for monitoring and development

## 📊 Available Terminals

### 1. Background Agents Dashboard
- **Command**: `npm run dev`
- **Purpose**: Web dashboard for monitoring and controlling agents
- **Access**: http://localhost:3000

### 2. Agent Logs Monitor
- **Command**: `tail -f logs/combined.log`
- **Purpose**: Real-time log monitoring for all agents
- **Features**: Live updates of agent activities and errors

### 3. System Monitor
- **Command**: `htop`
- **Purpose**: System resource monitoring
- **Features**: CPU, memory, and process monitoring

### 4. Agent Status
- **Command**: `watch -n 5 'node src/index.js list'`
- **Purpose**: Periodic status updates of all agents
- **Features**: Auto-refreshing agent status every 5 seconds

### 5. Development Terminal
- **Command**: `bash`
- **Purpose**: Interactive development and debugging
- **Features**: Full shell access for development tasks

## 🔧 Available Agents

### Currently Running:
- **Code Review Agent**: Watches for file changes and performs automated code analysis
- **Test Runner Agent**: Automatically runs tests and reports results
- **Monitoring Agent**: Collects system metrics (CPU, memory, disk, network)
- **Git Sync Agent**: Manages Git operations and branch synchronization

### Ready to Enable:
- **Deployment Agent**: Manages deployment processes and environments
- **Security Agent**: Scans for vulnerabilities and compliance issues
- **Performance Agent**: Analyzes and optimizes application performance
- **Documentation Agent**: Automatically generates and maintains documentation

## 🎯 Common Commands

### Agent Management
```bash
# List all agents
node src/index.js list

# Start all agents
node src/index.js start

# Start specific agent
node src/index.js agent <agent-name>

# Test agent functionality
node test-agents.js
```

### Dashboard Access
```bash
# Start development server
npm run dev

# Test dashboard API
node test-dashboard.js
```

### Monitoring
```bash
# View combined logs
tail -f logs/combined.log

# View specific agent logs
tail -f logs/agent-monitoring.log

# Check agent status
node src/index.js list
```

## 📁 Key Directories

- `logs/` - Agent log files
- `monitoring/` - System monitoring data
- `reviews/` - Code review reports
- `test-results/` - Test execution results
- `config/` - Agent configuration files
- `public/` - Web dashboard files

## 🔍 Troubleshooting

### Agent Issues
1. Check logs in `logs/` directory
2. Restart agents using the dashboard or CLI
3. Verify configuration in `config/agents.json`

### Dashboard Issues
1. Ensure port 3000 is accessible
2. Check if development server is running
3. Verify WebSocket connections

### Environment Issues
1. Check if all dependencies are installed
2. Verify Node.js version (>=18.0.0)
3. Ensure proper file permissions

## 🎉 Features

- **Real-time Monitoring**: Live agent status and metrics
- **Web Dashboard**: Visual interface for agent management
- **CLI Tools**: Command-line interface for automation
- **Health Checks**: Automatic agent health monitoring
- **Log Management**: Comprehensive logging system
- **Configuration Management**: JSON-based agent configuration

## 📈 Performance

- **Auto-restart**: Failed agents are automatically restarted
- **Resource Monitoring**: System metrics are collected every 30 seconds
- **Health Checks**: Agents perform periodic health checks
- **Error Handling**: Comprehensive error handling and recovery

---

**Ready to automate your development workflow with background agents!** 
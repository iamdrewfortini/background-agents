# Background Agents

A comprehensive suite of background agents for development automation, designed to work seamlessly in both local and Cursor environments.

**Repository**: [https://github.com/Diatonic-AI/background-agents](https://github.com/Diatonic-AI/background-agents)

## 🚀 Features

- **Real-time Monitoring**: Live agent status and metrics
- **Unified Dashboard**: Single dashboard for all environments
- **Environment Detection**: Automatically detects Cursor vs local environment
- **Agent Management**: Start, stop, restart individual agents
- **Health Checks**: Automatic agent health monitoring
- **Log Management**: Comprehensive logging system

## 🎯 Quick Start

### Local Environment
```bash
# Install dependencies
npm install

# Setup environment
npm run setup

# Start all agents
npm start

# Start dashboard
npm run dev
```

### Cursor Environment
The system automatically detects when running in Cursor and starts agents accordingly.

#### Cursor Background Agents Setup
1. **Press `Ctrl+E`** to open the background agent control panel
2. **Select "Background Agents Development Environment"**
3. **Grant GitHub permissions** when prompted
4. **Wait for environment setup** (installs dependencies and starts agents)
5. **Access dashboard** at `http://localhost:3000`

#### GitHub Integration
- Repository: `https://github.com/Diatonic-AI/background-agents`
- Branch: `main`
- Permissions: Read/Write access required
- Auto-sync: Enabled for seamless collaboration

## 📊 Available Agents

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

## 🌐 Dashboard

Access the unified dashboard at `http://localhost:3000` to:
- Monitor agent status in real-time
- Start/stop/restart individual agents
- View system metrics and logs
- Configure agent settings

The dashboard automatically detects your environment and shows appropriate branding.

## 🔧 Configuration

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
  },
  "global": {
    "logLevel": "info",
    "maxConcurrentAgents": 5,
    "healthCheckInterval": 30000,
    "restartOnFailure": true
  }
}
```

## 📁 Project Structure

```
background-agents/
├── .cursor/                 # Cursor environment files
├── config/                  # Configuration files
├── logs/                    # Agent log files
├── monitoring/              # System monitoring data
├── public/                  # Web dashboard files
├── reviews/                 # Code review reports
├── scripts/                 # Setup and utility scripts
├── src/                     # Source code
│   ├── agents/             # Agent implementations
│   ├── config/             # Configuration management
│   └── utils/              # Utilities
└── test-results/           # Test execution results
```

## 🛠️ Commands

```bash
# Start all agents
npm start

# Start dashboard
npm run dev

# List agents
npm run list

# Setup environment
npm run setup

# Clean all data
npm run clean

# Reset to defaults
npm run reset

# Cursor-specific startup
npm run cursor
```

## 🔍 Monitoring

### View Logs
```bash
# Combined logs
tail -f logs/combined.log

# Specific agent logs
tail -f logs/agent-monitoring.log
```

### Health Checks
- All agents perform automatic health checks every 30 seconds
- Failed agents are automatically restarted
- Health status is reported via WebSocket

## 🎉 Environment Support

### Local Development
- Full agent functionality
- Local dashboard access
- Standard configuration

### Cursor Environment
- Automatic environment detection
- Cursor-specific optimizations
- Integrated terminal support
- Enhanced dashboard experience

## 📈 Performance

- **Auto-restart**: Failed agents are automatically restarted
- **Resource Monitoring**: System metrics collected every 30 seconds
- **Health Checks**: Agents perform periodic health checks
- **Error Handling**: Comprehensive error handling and recovery

## 🔐 Security

- **Environment Isolation**: All code runs in isolated environments
- **Configuration Validation**: All inputs are validated
- **Error Handling**: Proper error handling and logging
- **Network Security**: Secure WebSocket connections

---

**Ready to automate your development workflow with background agents!**

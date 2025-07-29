# Environment Variables for Background Agents

This document outlines all the environment variables used by the background agents system. Create a `.env` file in your project root and add the variables you need.

## Quick Setup

1. Copy the variables below into a `.env` file
2. Update the values according to your environment
3. The system will automatically load these variables

## Environment Variables Reference

### Application Settings
```bash
# Core application settings
NODE_ENV=development                    # Environment: development, production, test
PORT=3000                              # Dashboard port
HOST=localhost                         # Dashboard host
```

### Logging Configuration
```bash
# Logging settings
LOG_LEVEL=info                         # Log level: debug, info, warn, error
LOG_DIR=./logs                         # Log directory path
LOG_MAX_SIZE=10MB                      # Maximum log file size
LOG_MAX_FILES=5                        # Maximum number of log files
LOG_RETENTION_DAYS=30                  # How long to keep logs
```

### Agent Configuration
```bash
# Agent management
AGENT_CONFIG_PATH=./config/agents.json # Path to agent configuration
MAX_CONCURRENT_AGENTS=5                # Maximum agents running simultaneously
HEALTH_CHECK_INTERVAL=30000            # Health check interval (ms)
RESTART_ON_FAILURE=true                # Auto-restart failed agents
MAX_RESTART_ATTEMPTS=3                 # Maximum restart attempts
```

### Cursor Environment Detection
```bash
# Cursor-specific settings
CURSOR_ENVIRONMENT=true                # Enable Cursor environment detection
CURSOR_WORKSPACE_ID=                   # Cursor workspace ID (auto-detected)
CURSOR_SESSION_ID=                     # Cursor session ID (auto-detected)
```

### GitHub Integration
```bash
# GitHub settings
GITHUB_TOKEN=                          # GitHub personal access token
GITHUB_REPOSITORY=iamdrewfortini/background-agents
GITHUB_BRANCH=main                     # Default branch
GITHUB_AUTO_SYNC=true                 # Auto-sync with GitHub
```

### Security Settings
```bash
# Security scanning
SECURITY_SCAN_INTERVAL=86400000        # Security scan interval (24h)
SECURITY_DEPENDENCY_CHECK=true         # Check for vulnerable dependencies
SECURITY_SECRETS_SCAN=true             # Scan for secrets in code
SECURITY_COMPLIANCE_CHECK=true         # Run compliance checks
```

### Monitoring Configuration
```bash
# System monitoring
MONITORING_INTERVAL=30000              # Monitoring interval (30s)
MONITORING_METRICS=cpu,memory,disk,network
MONITORING_ALERT_CPU=80                # CPU usage alert threshold (%)
MONITORING_ALERT_MEMORY=85             # Memory usage alert threshold (%)
MONITORING_ALERT_DISK=90               # Disk usage alert threshold (%)
```

### Testing Configuration
```bash
# Test runner settings
TEST_COMMAND=npm test                  # Test command to run
TEST_COVERAGE_THRESHOLD=80             # Minimum coverage percentage
TEST_TIMEOUT=30000                     # Test timeout (30s)
TEST_MAX_RETRIES=3                     # Maximum test retries
TEST_PARALLEL=true                     # Run tests in parallel
```

### Deployment Settings
```bash
# Deployment configuration
DEPLOYMENT_ENVIRONMENTS=staging,production
DEPLOYMENT_AUTO_DEPLOY=false           # Auto-deploy on changes
DEPLOYMENT_REQUIRE_APPROVAL=true       # Require manual approval
DEPLOYMENT_ROLLBACK_ON_FAILURE=true    # Auto-rollback on failure
DEPLOYMENT_HEALTH_CHECKS=true          # Run health checks after deploy
```

### Performance Settings
```bash
# Performance analysis
PERFORMANCE_ANALYSIS_INTERVAL=3600000  # Analysis interval (1h)
PERFORMANCE_THRESHOLD_FCP=2000         # First Contentful Paint threshold (ms)
PERFORMANCE_THRESHOLD_LCP=4000         # Largest Contentful Paint threshold (ms)
PERFORMANCE_THRESHOLD_CLS=0.1          # Cumulative Layout Shift threshold
```

### Documentation Settings
```bash
# Documentation generation
DOCS_AUTO_GENERATE=true                # Auto-generate documentation
DOCS_FORMATS=markdown,html,pdf         # Output formats
DOCS_INCLUDE_EXAMPLES=true             # Include code examples
DOCS_UPDATE_ON_CHANGE=true             # Update docs on code changes
DOCS_OUTPUT_DIR=./docs                 # Documentation output directory
```

### Notification Settings
```bash
# Notification channels
NOTIFICATION_CHANNELS=console,file     # Available channels
NOTIFICATION_WEBHOOK_URL=              # Webhook URL for notifications
NOTIFICATION_SLACK_WEBHOOK=            # Slack webhook URL
NOTIFICATION_EMAIL=                    # Email for notifications
```

### Development Settings
```bash
# Development mode settings
DEV_MODE=true                          # Enable development mode
DEBUG=false                            # Enable debug logging
VERBOSE_LOGGING=false                  # Enable verbose logging
ENABLE_METRICS=true                    # Enable metrics collection
ENABLE_HEALTH_CHECKS=true              # Enable health checks
```

### File Watching Settings
```bash
# File watching configuration
WATCH_PATHS=src/,lib/,app/,tests/     # Paths to watch for changes
EXCLUDE_PATHS=node_modules/,dist/,build/,coverage/,.git/
MAX_FILE_SIZE=1MB                      # Maximum file size to process
```

### Cache Settings
```bash
# Caching configuration
CACHE_ENABLED=true                     # Enable caching
CACHE_TTL=3600000                      # Cache time-to-live (1h)
CACHE_MAX_SIZE=100MB                   # Maximum cache size
```

### API Settings
```bash
# API configuration
API_RATE_LIMIT=100                     # API rate limit per minute
API_TIMEOUT=30000                      # API timeout (30s)
API_CORS_ORIGIN=*                      # CORS origin
API_AUTH_REQUIRED=false                # Require API authentication
```

## Environment-Specific Configurations

### Development Environment
```bash
NODE_ENV=development
LOG_LEVEL=debug
DEV_MODE=true
DEBUG=true
VERBOSE_LOGGING=true
```

### Production Environment
```bash
NODE_ENV=production
LOG_LEVEL=warn
DEV_MODE=false
DEBUG=false
VERBOSE_LOGGING=false
ENABLE_METRICS=true
```

### Cursor Environment
```bash
CURSOR_ENVIRONMENT=true
CURSOR_WORKSPACE_ID=your-workspace-id
CURSOR_SESSION_ID=your-session-id
```

## Loading Environment Variables

The system automatically loads environment variables from:
1. `.env` file in the project root
2. System environment variables
3. Docker environment variables (when running in container)

## Security Notes

- **Never commit `.env` files** to version control
- **Use strong, unique values** for sensitive variables
- **Rotate tokens regularly** for GitHub and other integrations
- **Use environment-specific values** for different deployments

## Example .env File

```bash
# Copy this to .env and customize for your environment
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
CURSOR_ENVIRONMENT=true
GITHUB_TOKEN=your-github-token-here
MONITORING_ALERT_CPU=80
TEST_COVERAGE_THRESHOLD=80
```

## Troubleshooting

### Common Issues

1. **Variables not loading**: Ensure `.env` file is in the project root
2. **Permission errors**: Check file permissions on `.env` file
3. **Missing variables**: Use the example above as a template
4. **Docker issues**: Pass environment variables via `-e` flag or `docker-compose.yml`

### Validation

The system validates environment variables on startup. Check the logs for any validation errors or missing required variables. 
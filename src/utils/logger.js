const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');

class Logger {
  constructor(options = {}) {
    this.options = {
      level: options.level || 'info',
      logDir: options.logDir || './logs',
      maxFiles: options.maxFiles || 5,
      maxSize: options.maxSize || '10m',
      ...options
    };

    this.setupLogger();
  }

  setupLogger() {
    // Ensure log directory exists
    fs.ensureDirSync(this.options.logDir);

    // Create custom format
    const customFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    // Create console format for development
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'HH:mm:ss'
      }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
          msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
      })
    );

    // Create logger instance
    this.logger = winston.createLogger({
      level: this.options.level,
      format: customFormat,
      transports: [
        // Console transport
        new winston.transports.Console({
          format: consoleFormat,
          level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
        }),
        
        // File transport for all logs
        new winston.transports.File({
          filename: path.join(this.options.logDir, 'combined.log'),
          maxsize: this.parseSize(this.options.maxSize),
          maxFiles: this.options.maxFiles,
          tailable: true
        }),
        
        // Error file transport
        new winston.transports.File({
          filename: path.join(this.options.logDir, 'error.log'),
          level: 'error',
          maxsize: this.parseSize(this.options.maxSize),
          maxFiles: this.options.maxFiles,
          tailable: true
        })
      ]
    });

    // Add agent-specific loggers
    this.agentLoggers = new Map();
  }

  parseSize(size) {
    const units = {
      'b': 1,
      'kb': 1024,
      'mb': 1024 * 1024,
      'gb': 1024 * 1024 * 1024
    };

    const match = size.toLowerCase().match(/^(\d+)([kmgb]?)$/);
    if (!match) {
      return 10 * 1024 * 1024; // Default 10MB
    }

    const value = parseInt(match[1]);
    const unit = match[2] || 'b';
    return value * units[unit];
  }

  getAgentLogger(agentName) {
    if (!this.agentLoggers.has(agentName)) {
      const agentLogger = winston.createLogger({
        level: this.options.level,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        ),
        transports: [
          new winston.transports.File({
            filename: path.join(this.options.logDir, `agent-${agentName}.log`),
            maxsize: this.parseSize(this.options.maxSize),
            maxFiles: this.options.maxFiles,
            tailable: true
          })
        ]
      });

      this.agentLoggers.set(agentName, agentLogger);
    }

    return this.agentLoggers.get(agentName);
  }

  // Standard logging methods
  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  // Agent-specific logging
  agentInfo(agentName, message, meta = {}) {
    const agentLogger = this.getAgentLogger(agentName);
    agentLogger.info(message, { agent: agentName, ...meta });
    this.info(`[${agentName}] ${message}`, meta);
  }

  agentWarn(agentName, message, meta = {}) {
    const agentLogger = this.getAgentLogger(agentName);
    agentLogger.warn(message, { agent: agentName, ...meta });
    this.warn(`[${agentName}] ${message}`, meta);
  }

  agentError(agentName, message, meta = {}) {
    const agentLogger = this.getAgentLogger(agentName);
    agentLogger.error(message, { agent: agentName, ...meta });
    this.error(`[${agentName}] ${message}`, meta);
  }

  agentDebug(agentName, message, meta = {}) {
    const agentLogger = this.getAgentLogger(agentName);
    agentLogger.debug(message, { agent: agentName, ...meta });
    this.debug(`[${agentName}] ${message}`, meta);
  }

  // Performance logging
  time(label) {
    console.time(label);
  }

  timeEnd(label) {
    console.timeEnd(label);
  }

  // Structured logging for metrics
  metric(name, value, tags = {}) {
    this.logger.info('METRIC', {
      metric: name,
      value: value,
      tags: tags,
      timestamp: new Date().toISOString()
    });
  }

  // Health check logging
  health(component, status, details = {}) {
    this.logger.info('HEALTH', {
      component: component,
      status: status,
      details: details,
      timestamp: new Date().toISOString()
    });
  }

  // Audit logging
  audit(action, user, resource, details = {}) {
    this.logger.info('AUDIT', {
      action: action,
      user: user,
      resource: resource,
      details: details,
      timestamp: new Date().toISOString()
    });
  }

  // Get log files info
  getLogFiles() {
    try {
      const files = fs.readdirSync(this.options.logDir);
      return files.map(file => ({
        name: file,
        path: path.join(this.options.logDir, file),
        size: fs.statSync(path.join(this.options.logDir, file)).size
      }));
    } catch (error) {
      return [];
    }
  }

  // Clear old logs
  clearOldLogs(days = 7) {
    try {
      const files = this.getLogFiles();
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

      files.forEach(file => {
        const stats = fs.statSync(file.path);
        if (stats.mtime.getTime() < cutoff) {
          fs.unlinkSync(file.path);
          this.info(`Cleared old log file: ${file.name}`);
        }
      });
    } catch (error) {
      this.error('Error clearing old logs:', error);
    }
  }
}

module.exports = { Logger }; 
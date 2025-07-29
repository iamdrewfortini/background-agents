const { BaseAgent } = require('./base-agent');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class DocumentationAgent extends BaseAgent {
  constructor(config, logger) {
    super(config, logger);
    this.autoGenerate = config.config.autoGenerate || true;
    this.formats = config.config.formats || ['markdown', 'html', 'pdf'];
    this.includeExamples = config.config.includeExamples || true;
    this.updateOnChange = config.config.updateOnChange || true;
    this.templates = config.config.templates || {
      api: './templates/api.md',
      readme: './templates/readme.md'
    };
    this.documentationHistory = [];
    this.currentDocs = null;
  }

  async initialize() {
    this.logger.agentInfo(this.name, 'Initializing documentation agent');
    
    // Setup documentation directory
    await this.setupDocumentationDirectory();
    
    // Check documentation tools
    await this.checkDocumentationTools();
    
    // Generate initial documentation
    await this.generateDocumentation();
    
    this.logger.agentInfo(this.name, 'Documentation agent initialized');
  }

  async setupDocumentationDirectory() {
    const docsDir = path.join(process.cwd(), 'docs');
    await fs.ensureDir(docsDir);
    
    // Create subdirectories
    await fs.ensureDir(path.join(docsDir, 'api'));
    await fs.ensureDir(path.join(docsDir, 'guides'));
    await fs.ensureDir(path.join(docsDir, 'examples'));
    await fs.ensureDir(path.join(docsDir, 'templates'));
    
    this.logger.agentInfo(this.name, 'Documentation directory setup complete');
  }

  async checkDocumentationTools() {
    const tools = ['jsdoc', 'typedoc', 'sphinx', 'doxygen', 'pandoc'];
    
    for (const tool of tools) {
      try {
        await execAsync(`which ${tool}`);
        this.logger.agentInfo(this.name, `Found documentation tool: ${tool}`);
      } catch (error) {
        this.logger.agentWarn(this.name, `Documentation tool not found: ${tool}`);
      }
    }
  }

  async generateDocumentation() {
    this.logger.agentInfo(this.name, 'Generating documentation');
    
    const docs = {
      timestamp: Date.now(),
      readme: null,
      api: null,
      guides: null,
      examples: null,
      summary: {
        totalFiles: 0,
        generatedFiles: 0,
        updatedFiles: 0
      }
    };

    try {
      // Generate README
      docs.readme = await this.generateReadme();
      
      // Generate API documentation
      docs.api = await this.generateApiDocs();
      
      // Generate guides
      docs.guides = await this.generateGuides();
      
      // Generate examples
      if (this.includeExamples) {
        docs.examples = await this.generateExamples();
      }
      
      // Generate summary
      docs.summary = this.generateDocsSummary(docs);
      
      // Save documentation
      await this.saveDocumentation(docs);
      
      this.currentDocs = docs;
      this.documentationHistory.push(docs);
      
      this.logger.agentInfo(this.name, 'Documentation generation completed', {
        totalFiles: docs.summary.totalFiles,
        generatedFiles: docs.summary.generatedFiles
      });
      
      this.recordMetric('documentation_generation_success', 1);
      this.recordEvent('documentation_generated', { docs });
      
    } catch (error) {
      this.logger.agentError(this.name, 'Documentation generation failed', { error: error.message });
      this.recordMetric('documentation_generation_failure', 1, { error: error.message });
    }
  }

  async generateReadme() {
    this.logger.agentInfo(this.name, 'Generating README');
    
    try {
      const packageJson = await fs.readJson('package.json');
      const projectName = packageJson.name || 'Background Agents';
      const description = packageJson.description || 'A suite of background agents for development automation';
      const version = packageJson.version || '1.0.0';
      
      const readmeContent = `# ${projectName}

${description}

## Version
${version}

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`bash
# Start all agents
npm run start

# Start specific agent
npm run agent code-review

# List available agents
npm run list
\`\`\`

## Available Agents

- **Code Review Agent**: Automatically reviews code changes and provides feedback
- **Test Runner Agent**: Automatically runs tests and reports results
- **Deployment Agent**: Manages deployment processes and environments
- **Monitoring Agent**: Monitors application performance and health
- **Git Sync Agent**: Synchronizes with Git repositories and manages branches
- **Performance Agent**: Analyzes and optimizes application performance
- **Security Agent**: Scans for security vulnerabilities and compliance issues
- **Documentation Agent**: Automatically generates and maintains documentation

## Configuration

Edit \`config/agents.json\` to configure agent behavior.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

${packageJson.license || 'MIT'}
`;

      const readmePath = path.join(process.cwd(), 'README.md');
      await fs.writeFile(readmePath, readmeContent);
      
      this.logger.agentInfo(this.name, 'README generated successfully');
      
      return {
        path: readmePath,
        content: readmeContent,
        timestamp: Date.now()
      };
      
    } catch (error) {
      this.logger.agentError(this.name, 'README generation failed', { error: error.message });
      return null;
    }
  }

  async generateApiDocs() {
    this.logger.agentInfo(this.name, 'Generating API documentation');
    
    try {
      const apiDocs = {
        agents: [],
        utilities: [],
        configuration: null
      };

      // Generate agent documentation
      const agentFiles = await this.findAgentFiles();
      
      for (const file of agentFiles) {
        const agentDoc = await this.generateAgentDoc(file);
        if (agentDoc) {
          apiDocs.agents.push(agentDoc);
        }
      }

      // Generate utility documentation
      const utilityFiles = await this.findUtilityFiles();
      
      for (const file of utilityFiles) {
        const utilityDoc = await this.generateUtilityDoc(file);
        if (utilityDoc) {
          apiDocs.utilities.push(utilityDoc);
        }
      }

      // Generate configuration documentation
      apiDocs.configuration = await this.generateConfigDoc();

      // Save API documentation
      const apiDocsPath = path.join(process.cwd(), 'docs', 'api', 'index.md');
      const apiDocsContent = this.formatApiDocs(apiDocs);
      await fs.writeFile(apiDocsPath, apiDocsContent);
      
      this.logger.agentInfo(this.name, 'API documentation generated successfully');
      
      return {
        path: apiDocsPath,
        content: apiDocsContent,
        agents: apiDocs.agents.length,
        utilities: apiDocs.utilities.length,
        timestamp: Date.now()
      };
      
    } catch (error) {
      this.logger.agentError(this.name, 'API documentation generation failed', { error: error.message });
      return null;
    }
  }

  async generateAgentDoc(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const fileName = path.basename(filePath, path.extname(filePath));
      
      // Extract class information
      const classMatch = content.match(/class\s+(\w+)/);
      const className = classMatch ? classMatch[1] : fileName;
      
      // Extract method information
      const methodMatches = content.matchAll(/async\s+(\w+)\s*\(/g);
      const methods = [];
      
      for (const match of methodMatches) {
        methods.push(match[1]);
      }
      
      // Extract constructor parameters
      const constructorMatch = content.match(/constructor\s*\(([^)]*)\)/);
      const constructorParams = constructorMatch ? 
        constructorMatch[1].split(',').map(p => p.trim()).filter(p => p) : [];
      
      return {
        name: className,
        file: filePath,
        methods: methods,
        constructorParams: constructorParams,
        description: this.extractDescription(content)
      };
      
    } catch (error) {
      this.logger.agentWarn(this.name, `Error generating agent doc for ${filePath}`, { error: error.message });
      return null;
    }
  }

  async generateUtilityDoc(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const fileName = path.basename(filePath, path.extname(filePath));
      
      // Extract function information
      const functionMatches = content.matchAll(/function\s+(\w+)\s*\(/g);
      const functions = [];
      
      for (const match of functionMatches) {
        functions.push(match[1]);
      }
      
      return {
        name: fileName,
        file: filePath,
        functions: functions,
        description: this.extractDescription(content)
      };
      
    } catch (error) {
      this.logger.agentWarn(this.name, `Error generating utility doc for ${filePath}`, { error: error.message });
      return null;
    }
  }

  async generateConfigDoc() {
    try {
      const configPath = path.join(process.cwd(), 'src', 'config', 'config-manager.js');
      const content = await fs.readFile(configPath, 'utf8');
      
      // Extract configuration structure
      const configMatch = content.match(/getDefaultConfig\s*\(\)\s*{([^}]+)}/);
      
      return {
        path: configPath,
        structure: configMatch ? configMatch[1] : 'Default configuration structure',
        description: 'Configuration management for background agents'
      };
      
    } catch (error) {
      this.logger.agentWarn(this.name, 'Error generating config doc', { error: error.message });
      return null;
    }
  }

  formatApiDocs(apiDocs) {
    let content = `# API Documentation

## Agents

`;

    apiDocs.agents.forEach(agent => {
      content += `### ${agent.name}

${agent.description || 'No description available'}

**File:** \`${agent.file}\`

**Methods:**
${agent.methods.map(method => `- \`${method}()\``).join('\n')}

**Constructor Parameters:**
${agent.constructorParams.map(param => `- \`${param}\``).join('\n')}

---
`;
    });

    content += `## Utilities

`;

    apiDocs.utilities.forEach(utility => {
      content += `### ${utility.name}

${utility.description || 'No description available'}

**File:** \`${utility.file}\`

**Functions:**
${utility.functions.map(func => `- \`${func}()\``).join('\n')}

---
`;
    });

    if (apiDocs.configuration) {
      content += `## Configuration

${apiDocs.configuration.description}

**File:** \`${apiDocs.configuration.path}\`

\`\`\`javascript
${apiDocs.configuration.structure}
\`\`\`
`;

    }

    return content;
  }

  async generateGuides() {
    this.logger.agentInfo(this.name, 'Generating guides');
    
    try {
      const guides = [];

      // Setup guide
      const setupGuide = await this.generateSetupGuide();
      guides.push(setupGuide);

      // Configuration guide
      const configGuide = await this.generateConfigGuide();
      guides.push(configGuide);

      // Usage guide
      const usageGuide = await this.generateUsageGuide();
      guides.push(usageGuide);

      // Troubleshooting guide
      const troubleshootingGuide = await this.generateTroubleshootingGuide();
      guides.push(troubleshootingGuide);

      // Save guides
      for (const guide of guides) {
        const guidePath = path.join(process.cwd(), 'docs', 'guides', `${guide.name}.md`);
        await fs.writeFile(guidePath, guide.content);
      }
      
      this.logger.agentInfo(this.name, `Generated ${guides.length} guides`);
      
      return {
        guides: guides,
        count: guides.length,
        timestamp: Date.now()
      };
      
    } catch (error) {
      this.logger.agentError(this.name, 'Guide generation failed', { error: error.message });
      return null;
    }
  }

  async generateSetupGuide() {
    const content = `# Setup Guide

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git

## Installation

1. Clone the repository:
\`\`\`bash
git clone <repository-url>
cd background-agents
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Run setup:
\`\`\`bash
npm run setup
\`\`\`

## Configuration

1. Edit \`config/agents.json\` to configure your agents
2. Set up environment variables if needed
3. Configure your IDE for the best experience

## Verification

Run the following command to verify installation:

\`\`\`bash
npm run list
\`\`\`

You should see a list of available agents.
`;

    return {
      name: 'setup',
      content: content,
      title: 'Setup Guide'
    };
  }

  async generateConfigGuide() {
    const content = `# Configuration Guide

## Agent Configuration

Each agent can be configured in \`config/agents.json\`:

\`\`\`json
{
  "agents": {
    "code-review": {
      "enabled": true,
      "config": {
        "watchPaths": ["src/"],
        "rules": {
          "complexity": true,
          "security": true
        }
      }
    }
  }
}
\`\`\`

## Global Configuration

Global settings affect all agents:

\`\`\`json
{
  "global": {
    "logLevel": "info",
    "maxConcurrentAgents": 5,
    "healthCheckInterval": 30000
  }
}
\`\`\`

## Environment Variables

- \`NODE_ENV\`: Set to "production" for production mode
- \`LOG_LEVEL\`: Override log level
- \`AGENT_CONFIG_PATH\`: Custom config file path
`;

    return {
      name: 'configuration',
      content: content,
      title: 'Configuration Guide'
    };
  }

  async generateUsageGuide() {
    const content = `# Usage Guide

## Starting Agents

### Start All Agents
\`\`\`bash
npm run start
\`\`\`

### Start Specific Agent
\`\`\`bash
npm run agent code-review
\`\`\`

## Agent Commands

### Code Review Agent
- Automatically reviews code changes
- Provides feedback on code quality
- Runs on file changes

### Test Runner Agent
- Runs tests automatically
- Reports test results
- Monitors test coverage

### Deployment Agent
- Manages deployment processes
- Supports multiple environments
- Includes rollback capabilities

### Monitoring Agent
- Monitors system performance
- Tracks application health
- Generates alerts

## Monitoring and Logs

Check agent status:
\`\`\`bash
npm run list
\`\`\`

View logs:
\`\`\`bash
tail -f logs/combined.log
\`\`\`
`;

    return {
      name: 'usage',
      content: content,
      title: 'Usage Guide'
    };
  }

  async generateTroubleshootingGuide() {
    const content = `# Troubleshooting Guide

## Common Issues

### Agent Won't Start

1. Check if dependencies are installed:
\`\`\`bash
npm install
\`\`\`

2. Verify configuration:
\`\`\`bash
npm run list
\`\`\`

3. Check logs:
\`\`\`bash
tail -f logs/error.log
\`\`\`

### Agent Crashes

1. Check memory usage
2. Review agent logs
3. Restart the agent

### Performance Issues

1. Reduce concurrent agents
2. Increase health check interval
3. Review agent configuration

## Debug Mode

Enable debug logging:

\`\`\`bash
LOG_LEVEL=debug npm run start
\`\`\`

## Getting Help

1. Check the logs in \`logs/\` directory
2. Review agent-specific documentation
3. Check GitHub issues
4. Contact support
`;

    return {
      name: 'troubleshooting',
      content: content,
      title: 'Troubleshooting Guide'
    };
  }

  async generateExamples() {
    this.logger.agentInfo(this.name, 'Generating examples');
    
    try {
      const examples = [];

      // Code review example
      const codeReviewExample = await this.generateCodeReviewExample();
      examples.push(codeReviewExample);

      // Test runner example
      const testRunnerExample = await this.generateTestRunnerExample();
      examples.push(testRunnerExample);

      // Monitoring example
      const monitoringExample = await this.generateMonitoringExample();
      examples.push(monitoringExample);

      // Save examples
      for (const example of examples) {
        const examplePath = path.join(process.cwd(), 'docs', 'examples', `${example.name}.md`);
        await fs.writeFile(examplePath, example.content);
      }
      
      this.logger.agentInfo(this.name, `Generated ${examples.length} examples`);
      
      return {
        examples: examples,
        count: examples.length,
        timestamp: Date.now()
      };
      
    } catch (error) {
      this.logger.agentError(this.name, 'Example generation failed', { error: error.message });
      return null;
    }
  }

  async generateCodeReviewExample() {
    const content = `# Code Review Example

## Configuration

\`\`\`json
{
  "code-review": {
    "enabled": true,
    "config": {
      "watchPaths": ["src/"],
      "rules": {
        "complexity": true,
        "security": true,
        "performance": true,
        "style": true
      }
    }
  }
}
\`\`\`

## Usage

1. Start the agent:
\`\`\`bash
npm run agent code-review
\`\`\`

2. Make changes to your code
3. The agent will automatically review changes
4. Check the \`reviews/\` directory for reports

## Example Output

\`\`\`
[code-review] File modified: src/agents/code-review.js
[code-review] Found 3 issues in src/agents/code-review.js
[code-review] WARNING: High cyclomatic complexity: 15
[code-review] INFO: Long function: calculateComplexity (45 lines)
[code-review] Review report saved: reviews/code-review.js.review.json
\`\`\`
`;

    return {
      name: 'code-review',
      content: content,
      title: 'Code Review Example'
    };
  }

  async generateTestRunnerExample() {
    const content = `# Test Runner Example

## Configuration

\`\`\`json
{
  "test-runner": {
    "enabled": true,
    "config": {
      "testCommand": "npm test",
      "coverageThreshold": 80,
      "runOnCommit": true,
      "parallel": true
    }
  }
}
\`\`\`

## Usage

1. Start the agent:
\`\`\`bash
npm run agent test-runner
\`\`\`

2. The agent will run tests automatically
3. Check \`test-results/\` for detailed reports

## Example Output

\`\`\`
[test-runner] Running full test suite
[test-runner] Tests completed in 2341ms
[test-runner] All 45 tests passed
[test-runner] Coverage is good: 87.5%
[test-runner] Test results saved: test-results/test-run-1234567890.json
\`\`\`
`;

    return {
      name: 'test-runner',
      content: content,
      title: 'Test Runner Example'
    };
  }

  async generateMonitoringExample() {
    const content = `# Monitoring Example

## Configuration

\`\`\`json
{
  "monitoring": {
    "enabled": true,
    "config": {
      "metrics": ["cpu", "memory", "disk", "network"],
      "alertThresholds": {
        "cpu": 80,
        "memory": 85,
        "disk": 90
      }
    }
  }
}
\`\`\`

## Usage

1. Start the agent:
\`\`\`bash
npm run agent monitoring
\`\`\`

2. Monitor system metrics
3. Check \`monitoring/\` for reports and alerts

## Example Output

\`\`\`
[monitoring] CPU usage: 45.2%
[monitoring] Memory usage: 67.8%
[monitoring] Disk usage: 23.1%
[monitoring] All metrics within normal range
[monitoring] Report generated: monitoring/reports/report-1234567890.json
\`\`\`
`;

    return {
      name: 'monitoring',
      content: content,
      title: 'Monitoring Example'
    };
  }

  async findAgentFiles() {
    const agentDir = path.join(process.cwd(), 'src', 'agents');
    const files = [];
    
    try {
      const items = await fs.readdir(agentDir);
      
      for (const item of items) {
        if (item.endsWith('.js') && item !== 'base-agent.js') {
          files.push(path.join(agentDir, item));
        }
      }
    } catch (error) {
      this.logger.agentWarn(this.name, 'Error finding agent files', { error: error.message });
    }
    
    return files;
  }

  async findUtilityFiles() {
    const utilDir = path.join(process.cwd(), 'src', 'utils');
    const files = [];
    
    try {
      const items = await fs.readdir(utilDir);
      
      for (const item of items) {
        if (item.endsWith('.js')) {
          files.push(path.join(utilDir, item));
        }
      }
    } catch (error) {
      this.logger.agentWarn(this.name, 'Error finding utility files', { error: error.message });
    }
    
    return files;
  }

  extractDescription(content) {
    // Extract JSDoc comments or simple comments
    const commentMatch = content.match(/\/\*\*([^*]|\*(?!\/))*\*\//);
    if (commentMatch) {
      return commentMatch[0].replace(/\/\*\*|\*\//g, '').trim();
    }
    
    // Extract single line comments
    const singleLineMatch = content.match(/\/\/\s*(.+)/);
    if (singleLineMatch) {
      return singleLineMatch[1];
    }
    
    return null;
  }

  generateDocsSummary(docs) {
    const summary = {
      totalFiles: 0,
      generatedFiles: 0,
      updatedFiles: 0
    };

    if (docs.readme) summary.generatedFiles++;
    if (docs.api) summary.generatedFiles++;
    if (docs.guides) summary.generatedFiles += docs.guides.count;
    if (docs.examples) summary.generatedFiles += docs.examples.count;

    summary.totalFiles = summary.generatedFiles;

    return summary;
  }

  async saveDocumentation(docs) {
    const docsPath = path.join(process.cwd(), 'docs', 'generated', `docs-${Date.now()}.json`);
    
    try {
      await fs.ensureDir(path.dirname(docsPath));
      await fs.writeJson(docsPath, docs, { spaces: 2 });
      this.logger.agentInfo(this.name, `Documentation saved: ${docsPath}`);
    } catch (error) {
      this.logger.agentError(this.name, 'Error saving documentation', { error: error.message });
    }
  }

  async cleanup() {
    this.logger.agentInfo(this.name, 'Cleaning up documentation agent');
  }

  async checkHealth() {
    const health = await super.checkHealth();
    
    health.metrics = {
      documentationHistoryLength: this.documentationHistory.length,
      currentDocs: this.currentDocs ? {
        timestamp: this.currentDocs.timestamp,
        totalFiles: this.currentDocs.summary.totalFiles,
        generatedFiles: this.currentDocs.summary.generatedFiles
      } : null
    };
    
    return health;
  }

  // Public methods
  async getDocumentation() {
    return this.currentDocs;
  }

  async getDocumentationHistory(limit = 10) {
    return this.documentationHistory.slice(-limit);
  }

  async generateDocs() {
    return this.generateDocumentation();
  }
}

module.exports = { DocumentationAgent }; 
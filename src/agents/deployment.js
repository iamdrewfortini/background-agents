const { BaseAgent } = require('./base-agent');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs-extra');
const path = require('path');

const execAsync = promisify(exec);

class DeploymentAgent extends BaseAgent {
  constructor(config, logger) {
    super(config, logger);
    this.environments = config.config.environments || ['staging', 'production'];
    this.autoDeploy = config.config.autoDeploy || false;
    this.requireApproval = config.config.requireApproval || true;
    this.rollbackOnFailure = config.config.rollbackOnFailure || true;
    this.healthChecks = config.config.healthChecks || true;
    this.deploymentHistory = [];
    this.currentDeployment = null;
    this.deploymentQueue = [];
    this.isDeploying = false;
  }

  async initialize() {
    this.logger.agentInfo(this.name, 'Initializing deployment agent');
    
    // Setup deployment directory
    await this.setupDeploymentDirectory();
    
    // Check deployment tools
    await this.checkDeploymentTools();
    
    // Load deployment history
    await this.loadDeploymentHistory();
    
    this.logger.agentInfo(this.name, 'Deployment agent initialized');
  }

  async setupDeploymentDirectory() {
    const deploymentDir = path.join(process.cwd(), 'deployments');
    await fs.ensureDir(deploymentDir);
    
    // Create subdirectories
    await fs.ensureDir(path.join(deploymentDir, 'configs'));
    await fs.ensureDir(path.join(deploymentDir, 'logs'));
    await fs.ensureDir(path.join(deploymentDir, 'releases'));
    await fs.ensureDir(path.join(deploymentDir, 'rollbacks'));
    
    this.logger.agentInfo(this.name, 'Deployment directory setup complete');
  }

  async checkDeploymentTools() {
    const tools = ['docker', 'kubectl', 'helm', 'git', 'ssh'];
    
    for (const tool of tools) {
      try {
        await execAsync(`which ${tool}`);
        this.logger.agentInfo(this.name, `Found deployment tool: ${tool}`);
      } catch (error) {
        this.logger.agentWarn(this.name, `Deployment tool not found: ${tool}`);
      }
    }
  }

  async loadDeploymentHistory() {
    const historyPath = path.join(process.cwd(), 'deployments', 'history.json');
    
    try {
      if (await fs.pathExists(historyPath)) {
        this.deploymentHistory = await fs.readJson(historyPath);
        this.logger.agentInfo(this.name, `Loaded ${this.deploymentHistory.length} deployment records`);
      }
    } catch (error) {
      this.logger.agentWarn(this.name, 'Error loading deployment history', { error: error.message });
    }
  }

  async saveDeploymentHistory() {
    const historyPath = path.join(process.cwd(), 'deployments', 'history.json');
    
    try {
      await fs.writeJson(historyPath, this.deploymentHistory, { spaces: 2 });
    } catch (error) {
      this.logger.agentError(this.name, 'Error saving deployment history', { error: error.message });
    }
  }

  async deploy(environment, options = {}) {
    const deployment = {
      id: `deploy-${Date.now()}`,
      environment,
      status: 'pending',
      startTime: Date.now(),
      options,
      logs: [],
      steps: []
    };

    // Add to queue
    this.deploymentQueue.push(deployment);
    
    this.logger.agentInfo(this.name, `Queued deployment to ${environment}`, { deploymentId: deployment.id });
    
    // Process queue if not already deploying
    if (!this.isDeploying) {
      this.processDeploymentQueue();
    }

    return deployment.id;
  }

  async processDeploymentQueue() {
    if (this.isDeploying || this.deploymentQueue.length === 0) {
      return;
    }

    this.isDeploying = true;

    try {
      while (this.deploymentQueue.length > 0) {
        const deployment = this.deploymentQueue.shift();
        await this.executeDeployment(deployment);
      }
    } catch (error) {
      this.logger.agentError(this.name, 'Error processing deployment queue', { error: error.message });
    } finally {
      this.isDeploying = false;
    }
  }

  async executeDeployment(deployment) {
    this.currentDeployment = deployment;
    deployment.status = 'running';
    
    this.logger.agentInfo(this.name, `Starting deployment to ${deployment.environment}`, { 
      deploymentId: deployment.id 
    });

    try {
      // Pre-deployment checks
      await this.addDeploymentStep(deployment, 'pre-deployment-checks', async () => {
        await this.runPreDeploymentChecks(deployment.environment);
      });

      // Build application
      await this.addDeploymentStep(deployment, 'build', async () => {
        await this.buildApplication(deployment.options);
      });

      // Run tests
      await this.addDeploymentStep(deployment, 'tests', async () => {
        await this.runDeploymentTests();
      });

      // Deploy to environment
      await this.addDeploymentStep(deployment, 'deploy', async () => {
        await this.deployToEnvironment(deployment.environment, deployment.options);
      });

      // Health checks
      if (this.healthChecks) {
        await this.addDeploymentStep(deployment, 'health-checks', async () => {
          await this.runHealthChecks(deployment.environment);
        });
      }

      // Post-deployment tasks
      await this.addDeploymentStep(deployment, 'post-deployment', async () => {
        await this.runPostDeploymentTasks(deployment.environment);
      });

      deployment.status = 'completed';
      deployment.endTime = Date.now();
      deployment.duration = deployment.endTime - deployment.startTime;

      this.logger.agentInfo(this.name, `Deployment completed successfully`, {
        deploymentId: deployment.id,
        environment: deployment.environment,
        duration: deployment.duration
      });

      // Save deployment record
      this.deploymentHistory.push(deployment);
      await this.saveDeploymentHistory();

      this.recordMetric('deployment_success', 1, { 
        environment: deployment.environment,
        duration: deployment.duration 
      });

    } catch (error) {
      deployment.status = 'failed';
      deployment.error = error.message;
      deployment.endTime = Date.now();
      deployment.duration = deployment.endTime - deployment.startTime;

      this.logger.agentError(this.name, `Deployment failed`, {
        deploymentId: deployment.id,
        environment: deployment.environment,
        error: error.message
      });

      // Rollback if enabled
      if (this.rollbackOnFailure) {
        await this.rollback(deployment);
      }

      // Save deployment record
      this.deploymentHistory.push(deployment);
      await this.saveDeploymentHistory();

      this.recordMetric('deployment_failure', 1, { 
        environment: deployment.environment,
        error: error.message 
      });
    }

    this.currentDeployment = null;
  }

  async addDeploymentStep(deployment, stepName, stepFunction) {
    const step = {
      name: stepName,
      startTime: Date.now(),
      status: 'running'
    };

    deployment.steps.push(step);
    
    try {
      await stepFunction();
      step.status = 'completed';
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      
      this.logger.agentInfo(this.name, `Deployment step completed: ${stepName}`, {
        deploymentId: deployment.id,
        duration: step.duration
      });
      
    } catch (error) {
      step.status = 'failed';
      step.error = error.message;
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      
      this.logger.agentError(this.name, `Deployment step failed: ${stepName}`, {
        deploymentId: deployment.id,
        error: error.message
      });
      
      throw error;
    }
  }

  async runPreDeploymentChecks(environment) {
    this.logger.agentInfo(this.name, `Running pre-deployment checks for ${environment}`);
    
    // Check if environment is valid
    if (!this.environments.includes(environment)) {
      throw new Error(`Invalid environment: ${environment}`);
    }
    
    // Check if we have access to the environment
    await this.checkEnvironmentAccess(environment);
    
    // Check current deployment status
    await this.checkCurrentDeploymentStatus(environment);
  }

  async buildApplication(options = {}) {
    this.logger.agentInfo(this.name, 'Building application');
    
    const buildCommand = options.buildCommand || 'npm run build';
    
    try {
      const { stdout, stderr } = await execAsync(buildCommand, {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: 'production' }
      });
      
      this.logger.agentInfo(this.name, 'Build completed successfully');
      
    } catch (error) {
      throw new Error(`Build failed: ${error.message}`);
    }
  }

  async runDeploymentTests() {
    this.logger.agentInfo(this.name, 'Running deployment tests');
    
    try {
      const { stdout, stderr } = await execAsync('npm test', {
        cwd: process.cwd(),
        env: { ...process.env, CI: 'true' }
      });
      
      this.logger.agentInfo(this.name, 'Deployment tests passed');
      
    } catch (error) {
      throw new Error(`Deployment tests failed: ${error.message}`);
    }
  }

  async deployToEnvironment(environment, options = {}) {
    this.logger.agentInfo(this.name, `Deploying to ${environment}`);
    
    // Determine deployment method
    const deploymentMethod = options.method || this.getDeploymentMethod(environment);
    
    switch (deploymentMethod) {
      case 'docker':
        await this.deployWithDocker(environment, options);
        break;
      case 'kubernetes':
        await this.deployWithKubernetes(environment, options);
        break;
      case 'ssh':
        await this.deployWithSSH(environment, options);
        break;
      default:
        throw new Error(`Unknown deployment method: ${deploymentMethod}`);
    }
  }

  async deployWithDocker(environment, options) {
    const imageName = options.imageName || 'app';
    const tag = options.tag || 'latest';
    
    try {
      // Build Docker image
      await execAsync(`docker build -t ${imageName}:${tag} .`);
      
      // Push to registry if specified
      if (options.registry) {
        await execAsync(`docker tag ${imageName}:${tag} ${options.registry}/${imageName}:${tag}`);
        await execAsync(`docker push ${options.registry}/${imageName}:${tag}`);
      }
      
      this.logger.agentInfo(this.name, `Docker deployment completed for ${environment}`);
      
    } catch (error) {
      throw new Error(`Docker deployment failed: ${error.message}`);
    }
  }

  async deployWithKubernetes(environment, options) {
    const namespace = options.namespace || environment;
    const manifestPath = options.manifestPath || `k8s/${environment}.yaml`;
    
    try {
      // Apply Kubernetes manifests
      await execAsync(`kubectl apply -f ${manifestPath} -n ${namespace}`);
      
      // Wait for deployment to be ready
      await execAsync(`kubectl rollout status deployment/app -n ${namespace}`);
      
      this.logger.agentInfo(this.name, `Kubernetes deployment completed for ${environment}`);
      
    } catch (error) {
      throw new Error(`Kubernetes deployment failed: ${error.message}`);
    }
  }

  async deployWithSSH(environment, options) {
    const host = options.host;
    const user = options.user || 'deploy';
    const path = options.path || '/var/www/app';
    
    if (!host) {
      throw new Error('SSH host not specified');
    }
    
    try {
      // Copy files to server
      await execAsync(`rsync -avz --delete dist/ ${user}@${host}:${path}`);
      
      // Restart application
      await execAsync(`ssh ${user}@${host} "cd ${path} && npm install && pm2 restart app"`);
      
      this.logger.agentInfo(this.name, `SSH deployment completed for ${environment}`);
      
    } catch (error) {
      throw new Error(`SSH deployment failed: ${error.message}`);
    }
  }

  async runHealthChecks(environment) {
    this.logger.agentInfo(this.name, `Running health checks for ${environment}`);
    
    const healthCheckUrl = this.getHealthCheckUrl(environment);
    
    if (!healthCheckUrl) {
      this.logger.agentWarn(this.name, 'No health check URL configured');
      return;
    }
    
    try {
      const { default: axios } = await import('axios');
      
      const response = await axios.get(healthCheckUrl, {
        timeout: 30000,
        validateStatus: () => true
      });
      
      if (response.status !== 200) {
        throw new Error(`Health check failed with status ${response.status}`);
      }
      
      this.logger.agentInfo(this.name, 'Health checks passed');
      
    } catch (error) {
      throw new Error(`Health checks failed: ${error.message}`);
    }
  }

  async runPostDeploymentTasks(environment) {
    this.logger.agentInfo(this.name, `Running post-deployment tasks for ${environment}`);
    
    // Send notifications
    await this.sendDeploymentNotification(environment, 'success');
    
    // Update deployment status
    await this.updateDeploymentStatus(environment, 'deployed');
  }

  async rollback(deployment) {
    this.logger.agentInfo(this.name, `Rolling back deployment to ${deployment.environment}`);
    
    try {
      // Find previous successful deployment
      const previousDeployment = this.deploymentHistory
        .filter(d => d.environment === deployment.environment && d.status === 'completed')
        .pop();
      
      if (!previousDeployment) {
        throw new Error('No previous deployment found for rollback');
      }
      
      // Perform rollback
      await this.deployToEnvironment(deployment.environment, {
        ...deployment.options,
        rollback: true,
        previousVersion: previousDeployment.version
      });
      
      this.logger.agentInfo(this.name, 'Rollback completed successfully');
      
    } catch (error) {
      this.logger.agentError(this.name, 'Rollback failed', { error: error.message });
    }
  }

  getDeploymentMethod(environment) {
    // Determine deployment method based on environment
    const methods = {
      'staging': 'docker',
      'production': 'kubernetes'
    };
    
    return methods[environment] || 'ssh';
  }

  getHealthCheckUrl(environment) {
    const urls = {
      'staging': 'https://staging.example.com/health',
      'production': 'https://example.com/health'
    };
    
    return urls[environment];
  }

  async checkEnvironmentAccess(environment) {
    // Check if we can access the deployment environment
    this.logger.agentInfo(this.name, `Checking access to ${environment}`);
  }

  async checkCurrentDeploymentStatus(environment) {
    // Check current deployment status in the environment
    this.logger.agentInfo(this.name, `Checking current deployment status for ${environment}`);
  }

  async sendDeploymentNotification(environment, status) {
    // Send deployment notification
    this.logger.agentInfo(this.name, `Sending ${status} notification for ${environment}`);
  }

  async updateDeploymentStatus(environment, status) {
    // Update deployment status in external systems
    this.logger.agentInfo(this.name, `Updating deployment status for ${environment}: ${status}`);
  }

  async cleanup() {
    // Cleanup deployment resources
    this.logger.agentInfo(this.name, 'Cleaning up deployment agent');
  }

  async checkHealth() {
    const health = await super.checkHealth();
    
    health.metrics = {
      deploymentQueueLength: this.deploymentQueue.length,
      isDeploying: this.isDeploying,
      currentDeployment: this.currentDeployment ? {
        id: this.currentDeployment.id,
        environment: this.currentDeployment.environment,
        status: this.currentDeployment.status
      } : null,
      totalDeployments: this.deploymentHistory.length
    };
    
    return health;
  }

  // Public methods
  async getDeploymentStatus(deploymentId) {
    const deployment = this.deploymentHistory.find(d => d.id === deploymentId);
    return deployment || null;
  }

  async getDeploymentHistory(environment = null, limit = 50) {
    let history = this.deploymentHistory;
    
    if (environment) {
      history = history.filter(d => d.environment === environment);
    }
    
    return history.slice(-limit);
  }

  async cancelDeployment(deploymentId) {
    if (this.currentDeployment && this.currentDeployment.id === deploymentId) {
      this.currentDeployment.status = 'cancelled';
      this.logger.agentInfo(this.name, `Deployment cancelled: ${deploymentId}`);
      return true;
    }
    
    return false;
  }
}

module.exports = { DeploymentAgent }; 
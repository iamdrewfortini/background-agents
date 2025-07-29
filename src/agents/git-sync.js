const { BaseAgent } = require('./base-agent');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs-extra');
const path = require('path');

const execAsync = promisify(exec);

class GitSyncAgent extends BaseAgent {
  constructor(config, logger) {
    super(config, logger);
    this.autoCommit = config.config.autoCommit || false;
    this.autoPush = config.config.autoPush || false;
    this.branchNaming = config.config.branchNaming || 'feature/{ticket}';
    this.commitMessageTemplate = config.config.commitMessageTemplate || 'feat: {description}';
    this.syncInterval = config.config.syncInterval || 300000; // 5 minutes
    this.currentBranch = null;
    this.lastSync = null;
    this.pendingChanges = [];
    this.syncHistory = [];
  }

  async initialize() {
    this.logger.agentInfo(this.name, 'Initializing git sync agent');
    
    // Check if we're in a git repository
    await this.checkGitRepository();
    
    // Get current branch
    await this.getCurrentBranch();
    
    // Setup git configuration
    await this.setupGitConfig();
    
    // Start sync loop
    this.startSyncLoop();
    
    this.logger.agentInfo(this.name, 'Git sync agent initialized');
  }

  async checkGitRepository() {
    try {
      const { stdout } = await execAsync('git rev-parse --git-dir');
      this.logger.agentInfo(this.name, 'Git repository found');
    } catch (error) {
      throw new Error('Not a git repository. Please initialize git first.');
    }
  }

  async getCurrentBranch() {
    try {
      const { stdout } = await execAsync('git branch --show-current');
      this.currentBranch = stdout.trim();
      this.logger.agentInfo(this.name, `Current branch: ${this.currentBranch}`);
    } catch (error) {
      this.logger.agentWarn(this.name, 'Could not determine current branch', { error: error.message });
    }
  }

  async setupGitConfig() {
    try {
      // Set up git user if not configured
      const { stdout: userName } = await execAsync('git config user.name').catch(() => ({ stdout: '' }));
      const { stdout: userEmail } = await execAsync('git config user.email').catch(() => ({ stdout: '' }));
      
      if (!userName) {
        await execAsync('git config user.name "Background Agent"');
        this.logger.agentInfo(this.name, 'Set git user name');
      }
      
      if (!userEmail) {
        await execAsync('git config user.email "agent@background-agents.local"');
        this.logger.agentInfo(this.name, 'Set git user email');
      }
      
    } catch (error) {
      this.logger.agentWarn(this.name, 'Error setting up git config', { error: error.message });
    }
  }

  startSyncLoop() {
    this.interval = setInterval(async () => {
      try {
        await this.performSync();
      } catch (error) {
        this.logger.agentError(this.name, 'Error in sync loop', { error: error.message });
      }
    }, this.syncInterval);
  }

  async performSync() {
    this.logger.agentDebug(this.name, 'Starting git sync');
    
    try {
      // Check for remote changes
      await this.fetchRemoteChanges();
      
      // Check for local changes
      const localChanges = await this.getLocalChanges();
      
      if (localChanges.length > 0) {
        this.logger.agentInfo(this.name, `Found ${localChanges.length} local changes`);
        
        if (this.autoCommit) {
          await this.commitChanges(localChanges);
        }
        
        if (this.autoPush) {
          await this.pushChanges();
        }
      }
      
      // Update current branch
      await this.getCurrentBranch();
      
      this.lastSync = Date.now();
      
      this.recordMetric('git_sync_success', 1);
      this.recordEvent('git_sync_completed', { 
        branch: this.currentBranch,
        changes: localChanges.length 
      });
      
    } catch (error) {
      this.logger.agentError(this.name, 'Git sync failed', { error: error.message });
      this.recordMetric('git_sync_failure', 1, { error: error.message });
    }
  }

  async fetchRemoteChanges() {
    try {
      await execAsync('git fetch --all');
      this.logger.agentDebug(this.name, 'Fetched remote changes');
    } catch (error) {
      this.logger.agentWarn(this.name, 'Error fetching remote changes', { error: error.message });
    }
  }

  async getLocalChanges() {
    try {
      const { stdout } = await execAsync('git status --porcelain');
      const changes = stdout.trim().split('\n').filter(line => line.length > 0);
      
      return changes.map(line => {
        const status = line.substring(0, 2).trim();
        const file = line.substring(3);
        
        return {
          status,
          file,
          type: this.getChangeType(status)
        };
      });
    } catch (error) {
      this.logger.agentWarn(this.name, 'Error getting local changes', { error: error.message });
      return [];
    }
  }

  getChangeType(status) {
    if (status.includes('M')) return 'modified';
    if (status.includes('A')) return 'added';
    if (status.includes('D')) return 'deleted';
    if (status.includes('R')) return 'renamed';
    if (status.includes('C')) return 'copied';
    if (status.includes('U')) return 'unmerged';
    return 'unknown';
  }

  async commitChanges(changes) {
    if (changes.length === 0) return;
    
    try {
      // Stage all changes
      await execAsync('git add .');
      
      // Generate commit message
      const commitMessage = this.generateCommitMessage(changes);
      
      // Create commit
      await execAsync(`git commit -m "${commitMessage}"`);
      
      this.logger.agentInfo(this.name, `Committed ${changes.length} changes`, { message: commitMessage });
      
      this.recordMetric('git_commits', 1, { changes: changes.length });
      
    } catch (error) {
      this.logger.agentError(this.name, 'Error committing changes', { error: error.message });
      throw error;
    }
  }

  generateCommitMessage(changes) {
    const changeTypes = changes.map(c => c.type);
    const uniqueTypes = [...new Set(changeTypes)];
    const fileCount = changes.length;
    
    let description = '';
    if (uniqueTypes.length === 1) {
      description = `${uniqueTypes[0]} ${fileCount} file${fileCount > 1 ? 's' : ''}`;
    } else {
      description = `update ${fileCount} files`;
    }
    
    return this.commitMessageTemplate.replace('{description}', description);
  }

  async pushChanges() {
    try {
      await execAsync(`git push origin ${this.currentBranch}`);
      this.logger.agentInfo(this.name, `Pushed changes to ${this.currentBranch}`);
      
      this.recordMetric('git_pushes', 1, { branch: this.currentBranch });
      
    } catch (error) {
      this.logger.agentError(this.name, 'Error pushing changes', { error: error.message });
      throw error;
    }
  }

  async createBranch(branchName, baseBranch = 'main') {
    try {
      // Checkout base branch and pull latest
      await execAsync(`git checkout ${baseBranch}`);
      await execAsync('git pull origin ${baseBranch}');
      
      // Create and checkout new branch
      await execAsync(`git checkout -b ${branchName}`);
      
      this.currentBranch = branchName;
      this.logger.agentInfo(this.name, `Created branch: ${branchName}`);
      
      this.recordMetric('git_branches_created', 1, { branch: branchName });
      
      return branchName;
      
    } catch (error) {
      this.logger.agentError(this.name, 'Error creating branch', { error: error.message });
      throw error;
    }
  }

  async createFeatureBranch(ticketNumber, description = '') {
    const branchName = this.branchNaming
      .replace('{ticket}', ticketNumber)
      .replace('{description}', description.replace(/\s+/g, '-').toLowerCase());
    
    return this.createBranch(branchName);
  }

  async mergeBranch(sourceBranch, targetBranch = 'main') {
    try {
      // Checkout target branch
      await execAsync(`git checkout ${targetBranch}`);
      await execAsync(`git pull origin ${targetBranch}`);
      
      // Merge source branch
      await execAsync(`git merge ${sourceBranch}`);
      
      this.logger.agentInfo(this.name, `Merged ${sourceBranch} into ${targetBranch}`);
      
      this.recordMetric('git_merges', 1, { source: sourceBranch, target: targetBranch });
      
    } catch (error) {
      this.logger.agentError(this.name, 'Error merging branch', { error: error.message });
      throw error;
    }
  }

  async deleteBranch(branchName, force = false) {
    try {
      if (force) {
        await execAsync(`git branch -D ${branchName}`);
      } else {
        await execAsync(`git branch -d ${branchName}`);
      }
      
      this.logger.agentInfo(this.name, `Deleted branch: ${branchName}`);
      
      this.recordMetric('git_branches_deleted', 1, { branch: branchName });
      
    } catch (error) {
      this.logger.agentError(this.name, 'Error deleting branch', { error: error.message });
      throw error;
    }
  }

  async getBranchInfo() {
    try {
      const { stdout: branches } = await execAsync('git branch -a');
      const { stdout: status } = await execAsync('git status --porcelain');
      const { stdout: log } = await execAsync('git log --oneline -10');
      
      return {
        currentBranch: this.currentBranch,
        branches: branches.trim().split('\n').map(b => b.trim()),
        pendingChanges: status.trim().split('\n').filter(l => l.length > 0).length,
        recentCommits: log.trim().split('\n')
      };
    } catch (error) {
      this.logger.agentWarn(this.name, 'Error getting branch info', { error: error.message });
      return null;
    }
  }

  async getCommitHistory(branch = null, limit = 20) {
    try {
      const branchArg = branch ? branch : '';
      const { stdout } = await execAsync(`git log --oneline -${limit} ${branchArg}`);
      
      return stdout.trim().split('\n').map(line => {
        const [hash, ...messageParts] = line.split(' ');
        return {
          hash,
          message: messageParts.join(' ')
        };
      });
    } catch (error) {
      this.logger.agentWarn(this.name, 'Error getting commit history', { error: error.message });
      return [];
    }
  }

  async getFileHistory(filePath, limit = 10) {
    try {
      const { stdout } = await execAsync(`git log --oneline -${limit} -- ${filePath}`);
      
      return stdout.trim().split('\n').map(line => {
        const [hash, ...messageParts] = line.split(' ');
        return {
          hash,
          message: messageParts.join(' '),
          file: filePath
        };
      });
    } catch (error) {
      this.logger.agentWarn(this.name, 'Error getting file history', { error: error.message });
      return [];
    }
  }

  async stashChanges(message = 'Auto-stash by background agent') {
    try {
      await execAsync(`git stash push -m "${message}"`);
      this.logger.agentInfo(this.name, 'Stashed changes', { message });
      
      this.recordMetric('git_stashes', 1);
      
    } catch (error) {
      this.logger.agentError(this.name, 'Error stashing changes', { error: error.message });
      throw error;
    }
  }

  async popStash(stashIndex = 0) {
    try {
      await execAsync(`git stash pop stash@{${stashIndex}}`);
      this.logger.agentInfo(this.name, 'Popped stash', { stashIndex });
      
    } catch (error) {
      this.logger.agentError(this.name, 'Error popping stash', { error: error.message });
      throw error;
    }
  }

  async cleanup() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    
    this.logger.agentInfo(this.name, 'Cleaning up git sync agent');
  }

  async checkHealth() {
    const health = await super.checkHealth();
    
    health.metrics = {
      currentBranch: this.currentBranch,
      lastSync: this.lastSync,
      pendingChanges: this.pendingChanges.length,
      syncHistoryLength: this.syncHistory.length
    };
    
    return health;
  }

  // Public methods
  async getStatus() {
    return {
      currentBranch: this.currentBranch,
      lastSync: this.lastSync,
      autoCommit: this.autoCommit,
      autoPush: this.autoPush,
      branchInfo: await this.getBranchInfo()
    };
  }

  async getSyncHistory(limit = 50) {
    return this.syncHistory.slice(-limit);
  }

  async forceSync() {
    return this.performSync();
  }
}

module.exports = { GitSyncAgent }; 
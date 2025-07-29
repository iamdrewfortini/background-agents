const { BaseAgent } = require('./base-agent');
const { GitHubClient } = require('../utils/github-client');
const { AIService } = require('../utils/ai-service');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');

const execAsync = promisify(exec);

class GitHubAutomationAgent extends BaseAgent {
  constructor(config, logger) {
    super(config, logger);
    
    this.githubToken = process.env.GITHUB_TOKEN || config.config.githubToken;
    this.githubClient = null;
    this.aiService = null;
    
    this.watchPaths = config.config.watchPaths || ['src/', 'lib/', 'app/'];
    this.excludePaths = config.config.excludePaths || ['node_modules/', 'dist/', '.git/'];
    
    // Configuration options
    this.autoCreatePR = config.config.autoCreatePR || false;
    this.autoReviewPR = config.config.autoReviewPR || true;
    this.autoFixIssues = config.config.autoFixIssues || false;
    this.autoImplementFeatures = config.config.autoImplementFeatures || false;
    this.requireApproval = config.config.requireApproval || true;
    
    // Webhooks for real-time GitHub events
    this.webhookSecret = config.config.webhookSecret;
    
    // Task queues
    this.prQueue = [];
    this.issueQueue = [];
    this.reviewQueue = [];
  }

  async initialize() {
    try {
      if (!this.githubToken) {
        throw new Error('GitHub token not configured. Please set GITHUB_TOKEN environment variable.');
      }
      
      // Initialize GitHub client
      this.githubClient = new GitHubClient(this.githubToken);
      
      // Initialize AI service
      this.aiService = new AIService();
      
      // Get repository info from git
      await this.detectRepository();
      
      this.logger.agentInfo(this.name, 'GitHub automation agent initialized');
      
    } catch (error) {
      this.logger.agentError(this.name, 'Failed to initialize GitHub automation', error);
      throw error;
    }
  }

  async detectRepository() {
    try {
      const { stdout: remoteUrl } = await execAsync('git config --get remote.origin.url');
      const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
      
      if (match) {
        const [, owner, repo] = match;
        this.githubClient.setRepository(owner, repo.replace('.git', ''));
        this.logger.agentInfo(this.name, `Detected repository: ${owner}/${repo}`);
      }
    } catch (error) {
      this.logger.agentWarn(this.name, 'Could not detect repository from git remote');
    }
  }

  async startMainLoop() {
    // Start file watcher for automatic PR creation
    if (this.autoCreatePR) {
      this.startFileWatcher();
    }
    
    // Start GitHub event polling
    this.startGitHubPolling();
    
    // Start task processors
    this.startTaskProcessors();
    
    // Call parent's health check setup
    await super.startMainLoop();
  }

  startFileWatcher() {
    const watcher = chokidar.watch(this.watchPaths, {
      ignored: this.excludePaths,
      persistent: true,
      ignoreInitial: true
    });
    
    let changeTimeout;
    const changes = new Set();
    
    watcher.on('change', (filePath) => {
      changes.add(filePath);
      
      // Debounce changes
      clearTimeout(changeTimeout);
      changeTimeout = setTimeout(() => {
        this.handleFileChanges(Array.from(changes));
        changes.clear();
      }, 5000); // Wait 5 seconds after last change
    });
  }

  async handleFileChanges(changedFiles) {
    try {
      this.logger.agentInfo(this.name, `Detected changes in ${changedFiles.length} files`);
      
      // Check if we're on a feature branch
      const { stdout: currentBranch } = await execAsync('git branch --show-current');
      const branch = currentBranch.trim();
      
      if (branch === 'main' || branch === 'master') {
        // Create a new feature branch
        const featureBranch = `auto-update-${Date.now()}`;
        await execAsync(`git checkout -b ${featureBranch}`);
        
        // Stage and commit changes
        await execAsync('git add -A');
        const commitMessage = await this.generateCommitMessage(changedFiles);
        await execAsync(`git commit -m "${commitMessage}"`);
        
        // Push branch
        await execAsync(`git push origin ${featureBranch}`);
        
        // Create PR
        await this.createAutoPullRequest(featureBranch, changedFiles);
        
        // Switch back to main
        await execAsync(`git checkout ${branch}`);
      }
    } catch (error) {
      this.logger.agentError(this.name, 'Error handling file changes', error);
    }
  }

  async generateCommitMessage(changedFiles) {
    try {
      const { stdout: diff } = await execAsync(`git diff --staged`);
      const result = await this.aiService.generateCommitMessage(diff);
      return result.message;
    } catch (error) {
      return `chore: update ${changedFiles.length} files`;
    }
  }

  async createAutoPullRequest(branch, changedFiles) {
    try {
      // Get diff for PR description
      const { stdout: diff } = await execAsync(`git diff origin/main...${branch}`);
      
      // Generate PR description using AI
      const commits = [`Update ${changedFiles.length} files`];
      const prInfo = await this.aiService.generatePRDescription(diff, commits);
      
      // Create the pull request
      const pr = await this.githubClient.createPullRequest(
        prInfo.title,
        branch,
        'main',
        prInfo.description,
        false // not a draft
      );
      
      this.logger.agentInfo(this.name, `Created PR #${pr.number}: ${pr.title}`);
      
      // Add to review queue if auto-review is enabled
      if (this.autoReviewPR) {
        this.reviewQueue.push(pr.number);
      }
      
      return pr;
    } catch (error) {
      this.logger.agentError(this.name, 'Failed to create pull request', error);
      throw error;
    }
  }

  startGitHubPolling() {
    // Poll for new PRs every minute
    setInterval(async () => {
      await this.checkNewPullRequests();
    }, 60000);
    
    // Poll for new issues every 2 minutes
    setInterval(async () => {
      await this.checkNewIssues();
    }, 120000);
  }

  async checkNewPullRequests() {
    try {
      const prs = await this.githubClient.listPullRequests('open');
      
      for (const pr of prs) {
        // Check if PR needs review
        if (this.autoReviewPR && !pr.draft && !this.hasReviewed(pr)) {
          this.reviewQueue.push(pr.number);
        }
      }
    } catch (error) {
      this.logger.agentError(this.name, 'Error checking pull requests', error);
    }
  }

  hasReviewed(pr) {
    // Check if we've already reviewed this PR
    // In a real implementation, this would check a database or state file
    return false;
  }

  async checkNewIssues() {
    try {
      const issues = await this.githubClient.listIssues('open', ['bug', 'enhancement']);
      
      for (const issue of issues) {
        // Check if issue needs attention
        if (this.shouldHandleIssue(issue)) {
          this.issueQueue.push(issue.number);
        }
      }
    } catch (error) {
      this.logger.agentError(this.name, 'Error checking issues', error);
    }
  }

  shouldHandleIssue(issue) {
    // Check if we should handle this issue
    const labels = issue.labels.map(l => l.name);
    
    if (this.autoFixIssues && labels.includes('bug')) {
      return true;
    }
    
    if (this.autoImplementFeatures && labels.includes('enhancement')) {
      return true;
    }
    
    return false;
  }

  startTaskProcessors() {
    // Process review queue
    setInterval(async () => {
      if (this.reviewQueue.length > 0) {
        const prNumber = this.reviewQueue.shift();
        await this.reviewPullRequest(prNumber);
      }
    }, 10000);
    
    // Process issue queue
    setInterval(async () => {
      if (this.issueQueue.length > 0) {
        const issueNumber = this.issueQueue.shift();
        await this.handleIssue(issueNumber);
      }
    }, 15000);
  }

  async reviewPullRequest(prNumber) {
    try {
      this.logger.agentInfo(this.name, `Reviewing PR #${prNumber}`);
      
      // Get PR details
      const pr = await this.githubClient.getPullRequest(prNumber);
      
      // Get PR diff
      const { stdout: diff } = await execAsync(`gh pr diff ${prNumber}`).catch(() => ({ stdout: '' }));
      
      // Perform AI review
      const review = await this.aiService.reviewPullRequest(diff || pr.diff_url, pr.title, pr.body);
      
      // Post review comments
      for (const issue of review.issues) {
        await this.githubClient.createReviewComment(
          prNumber,
          issue.comment,
          pr.head.sha,
          issue.file,
          issue.line
        );
      }
      
      // Post overall review
      await this.githubClient.createPullRequestReview(
        prNumber,
        review.summary,
        review.approval_status === 'approved' ? 'APPROVE' : 
        review.approval_status === 'changes_requested' ? 'REQUEST_CHANGES' : 'COMMENT'
      );
      
      this.logger.agentInfo(this.name, `Completed review of PR #${prNumber}`);
      
      // If approved and auto-merge is enabled, merge the PR
      if (review.approval_status === 'approved' && !this.requireApproval) {
        await this.mergePullRequest(prNumber);
      }
      
    } catch (error) {
      this.logger.agentError(this.name, `Failed to review PR #${prNumber}`, error);
    }
  }

  async mergePullRequest(prNumber) {
    try {
      const pr = await this.githubClient.getPullRequest(prNumber);
      
      // Check if PR is mergeable
      if (pr.mergeable) {
        await this.githubClient.mergePullRequest(
          prNumber,
          `Merge PR #${prNumber}: ${pr.title}`,
          'Auto-merged by GitHub automation agent',
          'squash' // or 'merge' or 'rebase'
        );
        
        this.logger.agentInfo(this.name, `Merged PR #${prNumber}`);
      }
    } catch (error) {
      this.logger.agentError(this.name, `Failed to merge PR #${prNumber}`, error);
    }
  }

  async handleIssue(issueNumber) {
    try {
      this.logger.agentInfo(this.name, `Handling issue #${issueNumber}`);
      
      // Get issue details
      const issue = await this.githubClient.getIssue(issueNumber);
      const labels = issue.labels.map(l => l.name);
      
      if (labels.includes('bug') && this.autoFixIssues) {
        await this.fixBugIssue(issue);
      } else if (labels.includes('enhancement') && this.autoImplementFeatures) {
        await this.implementFeature(issue);
      }
      
    } catch (error) {
      this.logger.agentError(this.name, `Failed to handle issue #${issueNumber}`, error);
    }
  }

  async fixBugIssue(issue) {
    try {
      // Analyze the issue
      const codebaseContext = await this.gatherCodebaseContext();
      const solution = await this.aiService.implementFeatureFromIssue(
        issue.title,
        issue.body,
        codebaseContext
      );
      
      if (solution.estimated_complexity === 'low' || !this.requireApproval) {
        // Create a branch for the fix
        const branchName = `fix-issue-${issue.number}`;
        await this.githubClient.createBranch(branchName);
        
        // Checkout the branch
        await execAsync(`git checkout ${branchName}`);
        
        // Apply the fixes
        for (const change of solution.code_changes) {
          await this.applyCodeChange(change);
        }
        
        // Commit changes
        await execAsync('git add -A');
        await execAsync(`git commit -m "fix: ${issue.title} (fixes #${issue.number})"`);
        
        // Push branch
        await execAsync(`git push origin ${branchName}`);
        
        // Create PR
        const pr = await this.githubClient.createPullRequest(
          `Fix: ${issue.title}`,
          branchName,
          'main',
          `## Description\n${solution.documentation}\n\n## Implementation\n${solution.implementation_plan.join('\n- ')}\n\nFixes #${issue.number}`,
          false
        );
        
        // Comment on issue
        await this.githubClient.createIssueComment(
          issue.number,
          `I've created a pull request to fix this issue: #${pr.number}`
        );
        
        // Switch back to main
        await execAsync('git checkout main');
      } else {
        // Comment on issue with proposed solution
        await this.githubClient.createIssueComment(
          issue.number,
          `I've analyzed this issue and here's my proposed solution:\n\n${solution.implementation_plan.join('\n- ')}\n\nEstimated complexity: ${solution.estimated_complexity}\n\nPlease review and approve if you'd like me to implement this.`
        );
      }
    } catch (error) {
      this.logger.agentError(this.name, `Failed to fix bug issue #${issue.number}`, error);
    }
  }

  async implementFeature(issue) {
    try {
      // Similar to fixBugIssue but for feature implementation
      const codebaseContext = await this.gatherCodebaseContext();
      const implementation = await this.aiService.implementFeatureFromIssue(
        issue.title,
        issue.body,
        codebaseContext
      );
      
      if (implementation.estimated_complexity !== 'high' || !this.requireApproval) {
        // Create feature branch
        const branchName = `feature-issue-${issue.number}`;
        await this.githubClient.createBranch(branchName);
        
        // Implement the feature
        await execAsync(`git checkout ${branchName}`);
        
        for (const change of implementation.code_changes) {
          await this.applyCodeChange(change);
        }
        
        // Add tests
        if (implementation.tests.code) {
          await fs.writeFile(
            `tests/issue-${issue.number}.test.js`,
            implementation.tests.code
          );
        }
        
        // Commit and push
        await execAsync('git add -A');
        await execAsync(`git commit -m "feat: ${issue.title} (closes #${issue.number})"`);
        await execAsync(`git push origin ${branchName}`);
        
        // Create PR
        const pr = await this.githubClient.createPullRequest(
          `Feature: ${issue.title}`,
          branchName,
          'main',
          `## Description\n${implementation.documentation}\n\n## Implementation\n${implementation.implementation_plan.join('\n- ')}\n\nCloses #${issue.number}`,
          false
        );
        
        // Update issue
        await this.githubClient.createIssueComment(
          issue.number,
          `I've implemented this feature in PR #${pr.number}`
        );
        
        await execAsync('git checkout main');
      }
    } catch (error) {
      this.logger.agentError(this.name, `Failed to implement feature #${issue.number}`, error);
    }
  }

  async applyCodeChange(change) {
    const filePath = change.file;
    
    switch (change.type) {
      case 'create':
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, change.changes);
        break;
        
      case 'modify':
        const currentContent = await fs.readFile(filePath, 'utf8');
        // This is simplified - in reality, you'd need more sophisticated merging
        await fs.writeFile(filePath, change.changes);
        break;
        
      case 'delete':
        await fs.remove(filePath);
        break;
    }
  }

  async gatherCodebaseContext() {
    // Gather relevant context about the codebase
    const context = [];
    
    try {
      // Get package.json
      if (await fs.exists('package.json')) {
        const pkg = await fs.readJson('package.json');
        context.push(`Project: ${pkg.name} v${pkg.version}`);
        context.push(`Dependencies: ${Object.keys(pkg.dependencies || {}).join(', ')}`);
      }
      
      // Get file structure
      const { stdout: tree } = await execAsync('find . -type f -name "*.js" -o -name "*.ts" | head -20');
      context.push(`Main files:\n${tree}`);
      
    } catch (error) {
      // Ignore errors in context gathering
    }
    
    return context.join('\n\n');
  }

  async checkHealth() {
    const health = await super.checkHealth();
    
    try {
      // Check GitHub API connectivity
      const rateLimit = await this.githubClient.checkRateLimit();
      health.github_api = {
        connected: true,
        rate_limit: rateLimit.rate.remaining,
        reset_at: new Date(rateLimit.rate.reset * 1000)
      };
    } catch (error) {
      health.github_api = {
        connected: false,
        error: error.message
      };
    }
    
    // Check queues
    health.queues = {
      pr_queue: this.prQueue.length,
      issue_queue: this.issueQueue.length,
      review_queue: this.reviewQueue.length
    };
    
    return health;
  }

  async cleanup() {
    // Clean up any resources
    await super.cleanup();
  }

  // Public methods for manual control
  async createIssue(title, body, labels = []) {
    return await this.githubClient.createIssue(title, body, labels);
  }

  async createPullRequest(title, body, sourceBranch, targetBranch = 'main') {
    return await this.githubClient.createPullRequest(title, sourceBranch, targetBranch, body);
  }

  async reviewCode(code, language = 'javascript') {
    return await this.aiService.analyzeCode(code, language);
  }

  async suggestImprovements(code) {
    return await this.aiService.suggestImprovements(code);
  }
}

module.exports = { GitHubAutomationAgent };
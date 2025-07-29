const axios = require('axios');
const { Logger } = require('./logger');

class GitHubClient {
  constructor(token, owner, repo) {
    this.token = token;
    this.owner = owner || process.env.GITHUB_OWNER;
    this.repo = repo || process.env.GITHUB_REPO;
    this.logger = new Logger();
    
    this.api = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    
    // Handle rate limiting
    this.api.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 403 && error.response?.headers['x-ratelimit-remaining'] === '0') {
          const resetTime = parseInt(error.response.headers['x-ratelimit-reset']) * 1000;
          const waitTime = resetTime - Date.now();
          this.logger.warn('GitHub rate limit reached, waiting...', { waitTime });
          await new Promise(resolve => setTimeout(resolve, waitTime));
          return this.api.request(error.config);
        }
        throw error;
      }
    );
  }

  // Repository Information
  async getRepository() {
    const { data } = await this.api.get(`/repos/${this.owner}/${this.repo}`);
    return data;
  }

  async getBranches() {
    const { data } = await this.api.get(`/repos/${this.owner}/${this.repo}/branches`);
    return data;
  }

  async getDefaultBranch() {
    const repo = await this.getRepository();
    return repo.default_branch;
  }

  // Pull Request Management
  async createPullRequest(title, head, base, body, draft = false) {
    const { data } = await this.api.post(`/repos/${this.owner}/${this.repo}/pulls`, {
      title,
      head,
      base,
      body,
      draft,
      maintainer_can_modify: true
    });
    return data;
  }

  async getPullRequest(prNumber) {
    const { data } = await this.api.get(`/repos/${this.owner}/${this.repo}/pulls/${prNumber}`);
    return data;
  }

  async listPullRequests(state = 'open', sort = 'created', direction = 'desc') {
    const { data } = await this.api.get(`/repos/${this.owner}/${this.repo}/pulls`, {
      params: { state, sort, direction }
    });
    return data;
  }

  async updatePullRequest(prNumber, updates) {
    const { data } = await this.api.patch(`/repos/${this.owner}/${this.repo}/pulls/${prNumber}`, updates);
    return data;
  }

  async mergePullRequest(prNumber, commitTitle, commitMessage, mergeMethod = 'merge') {
    const { data } = await this.api.put(`/repos/${this.owner}/${this.repo}/pulls/${prNumber}/merge`, {
      commit_title: commitTitle,
      commit_message: commitMessage,
      merge_method: mergeMethod
    });
    return data;
  }

  async createPullRequestReview(prNumber, body, event = 'COMMENT') {
    const { data } = await this.api.post(`/repos/${this.owner}/${this.repo}/pulls/${prNumber}/reviews`, {
      body,
      event
    });
    return data;
  }

  async createReviewComment(prNumber, body, commitId, path, line) {
    const { data } = await this.api.post(`/repos/${this.owner}/${this.repo}/pulls/${prNumber}/comments`, {
      body,
      commit_id: commitId,
      path,
      line
    });
    return data;
  }

  // Issue Management
  async createIssue(title, body, labels = [], assignees = [], milestone = null) {
    const { data } = await this.api.post(`/repos/${this.owner}/${this.repo}/issues`, {
      title,
      body,
      labels,
      assignees,
      milestone
    });
    return data;
  }

  async getIssue(issueNumber) {
    const { data } = await this.api.get(`/repos/${this.owner}/${this.repo}/issues/${issueNumber}`);
    return data;
  }

  async listIssues(state = 'open', labels = [], sort = 'created', direction = 'desc') {
    const { data } = await this.api.get(`/repos/${this.owner}/${this.repo}/issues`, {
      params: {
        state,
        labels: labels.join(','),
        sort,
        direction
      }
    });
    return data;
  }

  async updateIssue(issueNumber, updates) {
    const { data } = await this.api.patch(`/repos/${this.owner}/${this.repo}/issues/${issueNumber}`, updates);
    return data;
  }

  async createIssueComment(issueNumber, body) {
    const { data } = await this.api.post(`/repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`, {
      body
    });
    return data;
  }

  async addLabelsToIssue(issueNumber, labels) {
    const { data } = await this.api.post(`/repos/${this.owner}/${this.repo}/issues/${issueNumber}/labels`, {
      labels
    });
    return data;
  }

  // File and Content Management
  async getFileContent(path, ref = null) {
    const params = ref ? { ref } : {};
    const { data } = await this.api.get(`/repos/${this.owner}/${this.repo}/contents/${path}`, { params });
    return data;
  }

  async createOrUpdateFile(path, message, content, branch, sha = null) {
    const body = {
      message,
      content: Buffer.from(content).toString('base64'),
      branch
    };
    
    if (sha) {
      body.sha = sha;
    }
    
    const { data } = await this.api.put(`/repos/${this.owner}/${this.repo}/contents/${path}`, body);
    return data;
  }

  async deleteFile(path, message, sha, branch) {
    const { data } = await this.api.delete(`/repos/${this.owner}/${this.repo}/contents/${path}`, {
      data: {
        message,
        sha,
        branch
      }
    });
    return data;
  }

  // Branch Management
  async createBranch(branchName, fromBranch = null) {
    const baseBranch = fromBranch || await this.getDefaultBranch();
    const { data: refData } = await this.api.get(`/repos/${this.owner}/${this.repo}/git/ref/heads/${baseBranch}`);
    
    const { data } = await this.api.post(`/repos/${this.owner}/${this.repo}/git/refs`, {
      ref: `refs/heads/${branchName}`,
      sha: refData.object.sha
    });
    return data;
  }

  async deleteBranch(branchName) {
    await this.api.delete(`/repos/${this.owner}/${this.repo}/git/refs/heads/${branchName}`);
  }

  // Commit Management
  async getCommit(sha) {
    const { data } = await this.api.get(`/repos/${this.owner}/${this.repo}/commits/${sha}`);
    return data;
  }

  async listCommits(branch = null, since = null, until = null) {
    const params = {};
    if (branch) params.sha = branch;
    if (since) params.since = since;
    if (until) params.until = until;
    
    const { data } = await this.api.get(`/repos/${this.owner}/${this.repo}/commits`, { params });
    return data;
  }

  async createCommit(message, tree, parents, author = null) {
    const body = {
      message,
      tree,
      parents
    };
    
    if (author) {
      body.author = author;
    }
    
    const { data } = await this.api.post(`/repos/${this.owner}/${this.repo}/git/commits`, body);
    return data;
  }

  // Project Management
  async listProjects() {
    const { data } = await this.api.get(`/repos/${this.owner}/${this.repo}/projects`, {
      headers: {
        'Accept': 'application/vnd.github.inertia-preview+json'
      }
    });
    return data;
  }

  async createProject(name, body = '') {
    const { data } = await this.api.post(`/repos/${this.owner}/${this.repo}/projects`, {
      name,
      body
    }, {
      headers: {
        'Accept': 'application/vnd.github.inertia-preview+json'
      }
    });
    return data;
  }

  async updateProject(projectId, updates) {
    const { data } = await this.api.patch(`/projects/${projectId}`, updates, {
      headers: {
        'Accept': 'application/vnd.github.inertia-preview+json'
      }
    });
    return data;
  }

  // Workflow and Action Management
  async triggerWorkflow(workflowId, ref, inputs = {}) {
    const { data } = await this.api.post(
      `/repos/${this.owner}/${this.repo}/actions/workflows/${workflowId}/dispatches`,
      {
        ref,
        inputs
      }
    );
    return data;
  }

  async listWorkflowRuns(workflowId = null, status = null) {
    const params = {};
    if (status) params.status = status;
    
    const url = workflowId 
      ? `/repos/${this.owner}/${this.repo}/actions/workflows/${workflowId}/runs`
      : `/repos/${this.owner}/${this.repo}/actions/runs`;
    
    const { data } = await this.api.get(url, { params });
    return data;
  }

  // Code Search and Analysis
  async searchCode(query, language = null) {
    const q = `${query} repo:${this.owner}/${this.repo}`;
    const params = { q };
    if (language) params.q += ` language:${language}`;
    
    const { data } = await this.api.get('/search/code', { params });
    return data;
  }

  async getCodeFrequency() {
    const { data } = await this.api.get(`/repos/${this.owner}/${this.repo}/stats/code_frequency`);
    return data;
  }

  // Webhook Management
  async createWebhook(url, events = ['push', 'pull_request', 'issues']) {
    const { data } = await this.api.post(`/repos/${this.owner}/${this.repo}/hooks`, {
      config: {
        url,
        content_type: 'json'
      },
      events,
      active: true
    });
    return data;
  }

  // Release Management
  async createRelease(tagName, name, body, draft = false, prerelease = false) {
    const { data } = await this.api.post(`/repos/${this.owner}/${this.repo}/releases`, {
      tag_name: tagName,
      name,
      body,
      draft,
      prerelease
    });
    return data;
  }

  // Collaboration Features
  async addCollaborator(username, permission = 'push') {
    const { data } = await this.api.put(
      `/repos/${this.owner}/${this.repo}/collaborators/${username}`,
      { permission }
    );
    return data;
  }

  async protectBranch(branchName, protectionRules) {
    const { data } = await this.api.put(
      `/repos/${this.owner}/${this.repo}/branches/${branchName}/protection`,
      protectionRules
    );
    return data;
  }

  // Utility Methods
  async checkRateLimit() {
    const { data } = await this.api.get('/rate_limit');
    return data;
  }

  setRepository(owner, repo) {
    this.owner = owner;
    this.repo = repo;
  }
}

module.exports = { GitHubClient };
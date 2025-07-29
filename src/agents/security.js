const { BaseAgent } = require('./base-agent');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs-extra');
const path = require('path');

const execAsync = promisify(exec);

class SecurityAgent extends BaseAgent {
  constructor(config, logger) {
    super(config, logger);
    this.vulnerabilityScan = config.config.vulnerabilityScan || true;
    this.dependencyCheck = config.config.dependencyCheck || true;
    this.secretsScan = config.config.secretsScan || true;
    this.complianceCheck = config.config.complianceCheck || true;
    this.autoFix = config.config.autoFix || false;
    this.severityLevels = config.config.severityLevels || ['high', 'medium', 'low'];
    this.securityHistory = [];
    this.currentScan = null;
  }

  async initialize() {
    this.logger.agentInfo(this.name, 'Initializing security agent');
    
    // Setup security directory
    await this.setupSecurityDirectory();
    
    // Check security tools
    await this.checkSecurityTools();
    
    // Run initial security scan
    await this.runSecurityScan();
    
    this.logger.agentInfo(this.name, 'Security agent initialized');
  }

  async setupSecurityDirectory() {
    const securityDir = path.join(process.cwd(), 'security');
    await fs.ensureDir(securityDir);
    
    // Create subdirectories
    await fs.ensureDir(path.join(securityDir, 'scans'));
    await fs.ensureDir(path.join(securityDir, 'reports'));
    await fs.ensureDir(path.join(securityDir, 'secrets'));
    await fs.ensureDir(path.join(securityDir, 'compliance'));
    
    this.logger.agentInfo(this.name, 'Security directory setup complete');
  }

  async checkSecurityTools() {
    const tools = ['npm', 'yarn', 'snyk', 'trivy', 'gitleaks', 'bandit'];
    
    for (const tool of tools) {
      try {
        await execAsync(`which ${tool}`);
        this.logger.agentInfo(this.name, `Found security tool: ${tool}`);
      } catch (error) {
        this.logger.agentWarn(this.name, `Security tool not found: ${tool}`);
      }
    }
  }

  async runSecurityScan() {
    this.logger.agentInfo(this.name, 'Starting security scan');
    
    const scan = {
      timestamp: Date.now(),
      vulnerabilityScan: null,
      dependencyCheck: null,
      secretsScan: null,
      complianceCheck: null,
      summary: {
        totalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0,
        criticalIssues: 0
      }
    };

    try {
      // Run vulnerability scan if enabled
      if (this.vulnerabilityScan) {
        scan.vulnerabilityScan = await this.runVulnerabilityScan();
      }

      // Run dependency check if enabled
      if (this.dependencyCheck) {
        scan.dependencyCheck = await this.runDependencyCheck();
      }

      // Run secrets scan if enabled
      if (this.secretsScan) {
        scan.secretsScan = await this.runSecretsScan();
      }

      // Run compliance check if enabled
      if (this.complianceCheck) {
        scan.complianceCheck = await this.runComplianceCheck();
      }

      // Generate summary
      scan.summary = this.generateScanSummary(scan);

      // Save scan results
      await this.saveSecurityScan(scan);

      this.currentScan = scan;
      this.securityHistory.push(scan);

      this.logger.agentInfo(this.name, 'Security scan completed', {
        totalIssues: scan.summary.totalIssues,
        criticalIssues: scan.summary.criticalIssues,
        highIssues: scan.summary.highIssues
      });
      
      this.recordMetric('security_scan_success', 1);
      this.recordEvent('security_scan_completed', { scan });

    } catch (error) {
      this.logger.agentError(this.name, 'Security scan failed', { error: error.message });
      this.recordMetric('security_scan_failure', 1, { error: error.message });
    }
  }

  async runVulnerabilityScan() {
    this.logger.agentInfo(this.name, 'Running vulnerability scan');
    
    try {
      const scanResults = {
        npmAudit: null,
        snykScan: null,
        trivyScan: null,
        issues: []
      };

      // Run npm audit
      try {
        const { stdout } = await execAsync('npm audit --json');
        const npmAudit = JSON.parse(stdout);
        scanResults.npmAudit = npmAudit;
        
        // Parse npm audit results
        if (npmAudit.vulnerabilities) {
          Object.values(npmAudit.vulnerabilities).forEach(vuln => {
            scanResults.issues.push({
              type: 'npm',
              severity: vuln.severity,
              package: vuln.name,
              version: vuln.version,
              title: vuln.title,
              description: vuln.description,
              recommendation: vuln.recommendation
            });
          });
        }
      } catch (error) {
        this.logger.agentWarn(this.name, 'npm audit failed', { error: error.message });
      }

      // Run Snyk scan if available
      try {
        await execAsync('which snyk');
        const { stdout } = await execAsync('snyk test --json');
        const snykResults = JSON.parse(stdout);
        scanResults.snykScan = snykResults;
        
        // Parse Snyk results
        if (snykResults.vulnerabilities) {
          snykResults.vulnerabilities.forEach(vuln => {
            scanResults.issues.push({
              type: 'snyk',
              severity: vuln.severity,
              package: vuln.packageName,
              version: vuln.version,
              title: vuln.title,
              description: vuln.description,
              recommendation: vuln.recommendation
            });
          });
        }
      } catch (error) {
        this.logger.agentWarn(this.name, 'Snyk scan failed', { error: error.message });
      }

      // Run Trivy scan if available
      try {
        await execAsync('which trivy');
        const { stdout } = await execAsync('trivy fs --format json .');
        const trivyResults = JSON.parse(stdout);
        scanResults.trivyScan = trivyResults;
        
        // Parse Trivy results
        if (trivyResults.Results) {
          trivyResults.Results.forEach(result => {
            if (result.Vulnerabilities) {
              result.Vulnerabilities.forEach(vuln => {
                scanResults.issues.push({
                  type: 'trivy',
                  severity: vuln.Severity,
                  package: vuln.PkgName,
                  version: vuln.InstalledVersion,
                  title: vuln.Title,
                  description: vuln.Description,
                  recommendation: vuln.FixedVersion ? `Update to ${vuln.FixedVersion}` : 'No fix available'
                });
              });
            }
          });
        }
      } catch (error) {
        this.logger.agentWarn(this.name, 'Trivy scan failed', { error: error.message });
      }

      this.logger.agentInfo(this.name, `Vulnerability scan completed: ${scanResults.issues.length} issues found`);
      
      return scanResults;
      
    } catch (error) {
      this.logger.agentError(this.name, 'Vulnerability scan failed', { error: error.message });
      return null;
    }
  }

  async runDependencyCheck() {
    this.logger.agentInfo(this.name, 'Running dependency check');
    
    try {
      const checkResults = {
        outdated: [],
        licenses: [],
        issues: []
      };

      // Check for outdated dependencies
      try {
        const { stdout } = await execAsync('npm outdated --json');
        const outdated = JSON.parse(stdout);
        
        Object.entries(outdated).forEach(([packageName, info]) => {
          checkResults.outdated.push({
            package: packageName,
            current: info.current,
            wanted: info.wanted,
            latest: info.latest
          });
        });
      } catch (error) {
        // npm outdated returns non-zero exit code when there are outdated packages
        if (error.stdout) {
          const outdated = JSON.parse(error.stdout);
          Object.entries(outdated).forEach(([packageName, info]) => {
            checkResults.outdated.push({
              package: packageName,
              current: info.current,
              wanted: info.wanted,
              latest: info.latest
            });
          });
        }
      }

      // Check package licenses
      try {
        const { stdout } = await execAsync('npm list --json');
        const packages = JSON.parse(stdout);
        
        this.extractLicenses(packages.dependencies, checkResults.licenses);
      } catch (error) {
        this.logger.agentWarn(this.name, 'License check failed', { error: error.message });
      }

      // Check for known vulnerable packages
      const vulnerablePackages = [
        'lodash', 'moment', 'jquery', 'express', 'request'
      ];
      
      vulnerablePackages.forEach(pkg => {
        try {
          const packageJson = require(`${pkg}/package.json`);
          checkResults.issues.push({
            type: 'vulnerable_package',
            package: pkg,
            version: packageJson.version,
            severity: 'medium',
            description: `Known vulnerable package: ${pkg}`
          });
        } catch (error) {
          // Package not installed
        }
      });

      this.logger.agentInfo(this.name, `Dependency check completed: ${checkResults.outdated.length} outdated, ${checkResults.licenses.length} licenses checked`);
      
      return checkResults;
      
    } catch (error) {
      this.logger.agentError(this.name, 'Dependency check failed', { error: error.message });
      return null;
    }
  }

  extractLicenses(dependencies, licenses, parent = '') {
    if (!dependencies) return;
    
    Object.entries(dependencies).forEach(([name, pkg]) => {
      if (pkg.license) {
        licenses.push({
          package: parent ? `${parent}/${name}` : name,
          license: pkg.license,
          version: pkg.version
        });
      }
      
      if (pkg.dependencies) {
        this.extractLicenses(pkg.dependencies, licenses, parent ? `${parent}/${name}` : name);
      }
    });
  }

  async runSecretsScan() {
    this.logger.agentInfo(this.name, 'Running secrets scan');
    
    try {
      const scanResults = {
        gitleaks: null,
        customScan: null,
        secrets: []
      };

      // Run gitleaks if available
      try {
        await execAsync('which gitleaks');
        const { stdout } = await execAsync('gitleaks detect --source . --report-format json');
        const gitleaksResults = JSON.parse(stdout);
        scanResults.gitleaks = gitleaksResults;
        
        if (gitleaksResults) {
          gitleaksResults.forEach(secret => {
            scanResults.secrets.push({
              type: 'gitleaks',
              rule: secret.RuleID,
              file: secret.File,
              line: secret.StartLine,
              match: secret.Match,
              severity: 'high'
            });
          });
        }
      } catch (error) {
        this.logger.agentWarn(this.name, 'gitleaks scan failed', { error: error.message });
      }

      // Run custom secrets scan
      const customSecrets = await this.runCustomSecretsScan();
      scanResults.customScan = customSecrets;
      scanResults.secrets.push(...customSecrets);

      this.logger.agentInfo(this.name, `Secrets scan completed: ${scanResults.secrets.length} secrets found`);
      
      return scanResults;
      
    } catch (error) {
      this.logger.agentError(this.name, 'Secrets scan failed', { error: error.message });
      return null;
    }
  }

  async runCustomSecretsScan() {
    const secrets = [];
    const patterns = [
      { pattern: /password\s*=\s*['"][^'"]*['"]/, type: 'hardcoded_password', severity: 'high' },
      { pattern: /api_key\s*=\s*['"][^'"]*['"]/, type: 'hardcoded_api_key', severity: 'high' },
      { pattern: /secret\s*=\s*['"][^'"]*['"]/, type: 'hardcoded_secret', severity: 'high' },
      { pattern: /token\s*=\s*['"][^'"]*['"]/, type: 'hardcoded_token', severity: 'high' },
      { pattern: /private_key\s*=\s*['"][^'"]*['"]/, type: 'hardcoded_private_key', severity: 'critical' }
    ];

    try {
      const files = await this.findCodeFiles();
      
      for (const file of files) {
        const content = await fs.readFile(file, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          patterns.forEach(({ pattern, type, severity }) => {
            if (pattern.test(line)) {
              secrets.push({
                type: 'custom',
                rule: type,
                file: file,
                line: index + 1,
                match: line.trim(),
                severity: severity
              });
            }
          });
        });
      }
    } catch (error) {
      this.logger.agentWarn(this.name, 'Custom secrets scan failed', { error: error.message });
    }

    return secrets;
  }

  async findCodeFiles() {
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.php'];
    const excludeDirs = ['node_modules', 'dist', 'build', '.git', 'coverage'];
    
    const files = [];
    
    try {
      const { stdout } = await execAsync('find . -type f');
      const allFiles = stdout.trim().split('\n');
      
      for (const file of allFiles) {
        const ext = path.extname(file);
        const shouldExclude = excludeDirs.some(dir => file.includes(dir));
        
        if (extensions.includes(ext) && !shouldExclude) {
          files.push(file);
        }
      }
    } catch (error) {
      this.logger.agentWarn(this.name, 'Error finding code files', { error: error.message });
    }
    
    return files;
  }

  async runComplianceCheck() {
    this.logger.agentInfo(this.name, 'Running compliance check');
    
    try {
      const complianceResults = {
        licenseCompliance: null,
        codeStandards: null,
        securityStandards: null,
        issues: []
      };

      // Check license compliance
      complianceResults.licenseCompliance = await this.checkLicenseCompliance();

      // Check code standards
      complianceResults.codeStandards = await this.checkCodeStandards();

      // Check security standards
      complianceResults.securityStandards = await this.checkSecurityStandards();

      this.logger.agentInfo(this.name, `Compliance check completed: ${complianceResults.issues.length} issues found`);
      
      return complianceResults;
      
    } catch (error) {
      this.logger.agentError(this.name, 'Compliance check failed', { error: error.message });
      return null;
    }
  }

  async checkLicenseCompliance() {
    const issues = [];
    
    try {
      const packageJson = await fs.readJson('package.json');
      
      if (!packageJson.license) {
        issues.push({
          type: 'missing_license',
          severity: 'medium',
          description: 'No license specified in package.json'
        });
      }
      
      // Check for problematic licenses
      const problematicLicenses = ['GPL', 'AGPL', 'LGPL'];
      if (packageJson.license && problematicLicenses.some(license => packageJson.license.includes(license))) {
        issues.push({
          type: 'problematic_license',
          severity: 'low',
          description: `License ${packageJson.license} may have compliance implications`
        });
      }
      
    } catch (error) {
      this.logger.agentWarn(this.name, 'License compliance check failed', { error: error.message });
    }
    
    return { issues };
  }

  async checkCodeStandards() {
    const issues = [];
    
    try {
      // Check for common code quality issues
      const files = await this.findCodeFiles();
      
      for (const file of files) {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for TODO comments
        const todoMatches = content.match(/TODO/g);
        if (todoMatches) {
          issues.push({
            type: 'todo_comments',
            severity: 'low',
            file: file,
            description: `${todoMatches.length} TODO comments found`
          });
        }
        
        // Check for console.log statements
        const consoleMatches = content.match(/console\.log/g);
        if (consoleMatches) {
          issues.push({
            type: 'console_log',
            severity: 'low',
            file: file,
            description: `${consoleMatches.length} console.log statements found`
          });
        }
      }
      
    } catch (error) {
      this.logger.agentWarn(this.name, 'Code standards check failed', { error: error.message });
    }
    
    return { issues };
  }

  async checkSecurityStandards() {
    const issues = [];
    
    try {
      // Check for common security anti-patterns
      const files = await this.findCodeFiles();
      
      for (const file of files) {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for eval usage
        if (content.includes('eval(')) {
          issues.push({
            type: 'eval_usage',
            severity: 'high',
            file: file,
            description: 'eval() usage detected - security risk'
          });
        }
        
        // Check for innerHTML usage
        if (content.includes('.innerHTML')) {
          issues.push({
            type: 'innerhtml_usage',
            severity: 'medium',
            file: file,
            description: 'innerHTML usage detected - potential XSS risk'
          });
        }
        
        // Check for SQL injection patterns
        if (content.includes('SELECT') && content.includes('${')) {
          issues.push({
            type: 'sql_injection_risk',
            severity: 'high',
            file: file,
            description: 'Potential SQL injection risk detected'
          });
        }
      }
      
    } catch (error) {
      this.logger.agentWarn(this.name, 'Security standards check failed', { error: error.message });
    }
    
    return { issues };
  }

  generateScanSummary(scan) {
    const summary = {
      totalIssues: 0,
      criticalIssues: 0,
      highIssues: 0,
      mediumIssues: 0,
      lowIssues: 0
    };

    // Count issues from vulnerability scan
    if (scan.vulnerabilityScan?.issues) {
      scan.vulnerabilityScan.issues.forEach(issue => {
        summary.totalIssues++;
        summary[`${issue.severity}Issues`]++;
      });
    }

    // Count issues from secrets scan
    if (scan.secretsScan?.secrets) {
      scan.secretsScan.secrets.forEach(secret => {
        summary.totalIssues++;
        summary[`${secret.severity}Issues`]++;
      });
    }

    // Count issues from compliance check
    if (scan.complianceCheck?.licenseCompliance?.issues) {
      scan.complianceCheck.licenseCompliance.issues.forEach(issue => {
        summary.totalIssues++;
        summary[`${issue.severity}Issues`]++;
      });
    }

    if (scan.complianceCheck?.codeStandards?.issues) {
      scan.complianceCheck.codeStandards.issues.forEach(issue => {
        summary.totalIssues++;
        summary[`${issue.severity}Issues`]++;
      });
    }

    if (scan.complianceCheck?.securityStandards?.issues) {
      scan.complianceCheck.securityStandards.issues.forEach(issue => {
        summary.totalIssues++;
        summary[`${issue.severity}Issues`]++;
      });
    }

    return summary;
  }

  async saveSecurityScan(scan) {
    const scanPath = path.join(process.cwd(), 'security', 'scans', `scan-${Date.now()}.json`);
    
    try {
      await fs.writeJson(scanPath, scan, { spaces: 2 });
      this.logger.agentInfo(this.name, `Security scan saved: ${scanPath}`);
    } catch (error) {
      this.logger.agentError(this.name, 'Error saving security scan', { error: error.message });
    }
  }

  async cleanup() {
    this.logger.agentInfo(this.name, 'Cleaning up security agent');
  }

  async checkHealth() {
    const health = await super.checkHealth();
    
    health.metrics = {
      securityHistoryLength: this.securityHistory.length,
      currentScan: this.currentScan ? {
        timestamp: this.currentScan.timestamp,
        totalIssues: this.currentScan.summary.totalIssues,
        criticalIssues: this.currentScan.summary.criticalIssues
      } : null
    };
    
    return health;
  }

  // Public methods
  async getSecurityReport() {
    return this.currentScan;
  }

  async getSecurityHistory(limit = 10) {
    return this.securityHistory.slice(-limit);
  }

  async runScan() {
    return this.runSecurityScan();
  }
}

module.exports = { SecurityAgent }; 
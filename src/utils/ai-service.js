const axios = require('axios');
const { Logger } = require('./logger');

class AIService {
  constructor(apiKey = null) {
    this.logger = new Logger();
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    this.provider = process.env.AI_PROVIDER || 'openai'; // 'openai' or 'anthropic'
    
    if (this.provider === 'openai') {
      this.api = axios.create({
        baseURL: 'https://api.openai.com/v1',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
    } else if (this.provider === 'anthropic') {
      this.api = axios.create({
        baseURL: 'https://api.anthropic.com/v1',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      });
    }
  }

  async analyzeCode(code, language = 'javascript') {
    const prompt = `Analyze the following ${language} code and provide:
1. Code quality assessment
2. Potential bugs or issues
3. Security vulnerabilities
4. Performance concerns
5. Best practice violations
6. Suggested improvements

Code:
\`\`\`${language}
${code}
\`\`\`

Provide your analysis in JSON format with the following structure:
{
  "quality_score": 0-100,
  "issues": [{"type": "bug|security|performance|style", "severity": "high|medium|low", "line": number, "description": "...", "suggestion": "..."}],
  "improvements": [{"description": "...", "code": "..."}],
  "summary": "..."
}`;

    return await this.complete(prompt);
  }

  async suggestImprovements(code, context = '') {
    const prompt = `Given the following code and context, suggest specific improvements:

Context: ${context}

Code:
\`\`\`javascript
${code}
\`\`\`

Provide specific, actionable improvements that:
1. Enhance readability and maintainability
2. Improve performance
3. Follow best practices
4. Add proper error handling
5. Improve type safety

Return improvements in JSON format:
{
  "improvements": [
    {
      "type": "refactor|feature|fix|performance|security",
      "description": "...",
      "original_code": "...",
      "improved_code": "...",
      "explanation": "..."
    }
  ]
}`;

    return await this.complete(prompt);
  }

  async generateFix(code, issue) {
    const prompt = `Fix the following issue in the code:

Issue: ${issue}

Code:
\`\`\`javascript
${code}
\`\`\`

Generate the corrected code that fixes the issue while:
1. Maintaining the original functionality
2. Following best practices
3. Adding appropriate error handling
4. Including helpful comments

Return the response in JSON format:
{
  "fixed_code": "...",
  "changes_made": ["..."],
  "explanation": "..."
}`;

    return await this.complete(prompt);
  }

  async reviewPullRequest(diff, title, description) {
    const prompt = `Review this pull request:

Title: ${title}
Description: ${description}

Changes:
\`\`\`diff
${diff}
\`\`\`

Provide a comprehensive review including:
1. Overall assessment
2. Code quality issues
3. Potential bugs
4. Security concerns
5. Performance implications
6. Suggestions for improvement
7. Questions for clarification

Format your review as JSON:
{
  "summary": "...",
  "approval_status": "approved|changes_requested|comment",
  "issues": [{"file": "...", "line": number, "severity": "high|medium|low", "comment": "..."}],
  "suggestions": [{"file": "...", "line": number, "suggestion": "..."}],
  "questions": ["..."],
  "positive_feedback": ["..."]
}`;

    return await this.complete(prompt);
  }

  async generateCommitMessage(diff) {
    const prompt = `Generate a clear, concise commit message for these changes:

\`\`\`diff
${diff}
\`\`\`

Follow conventional commit format:
- feat: new feature
- fix: bug fix
- docs: documentation changes
- style: formatting changes
- refactor: code refactoring
- test: test changes
- chore: maintenance tasks

Return JSON:
{
  "message": "type(scope): description",
  "body": "optional detailed description",
  "breaking_changes": "optional BREAKING CHANGE notes"
}`;

    return await this.complete(prompt);
  }

  async generatePRDescription(diff, commits) {
    const prompt = `Generate a comprehensive pull request description:

Commits:
${commits.map(c => `- ${c}`).join('\n')}

Changes:
\`\`\`diff
${diff}
\`\`\`

Create a PR description that includes:
1. Summary of changes
2. Motivation and context
3. Type of change (feature, fix, etc.)
4. Testing performed
5. Checklist items

Return as JSON:
{
  "title": "...",
  "description": "...",
  "type": "feature|fix|docs|style|refactor|test|chore",
  "breaking_change": boolean,
  "issues_closed": ["#123"],
  "checklist": ["..."]
}`;

    return await this.complete(prompt);
  }

  async generateTests(code, framework = 'jest') {
    const prompt = `Generate comprehensive tests for this code using ${framework}:

\`\`\`javascript
${code}
\`\`\`

Create tests that:
1. Cover all functions and methods
2. Test edge cases
3. Test error conditions
4. Include both positive and negative test cases
5. Follow testing best practices

Return JSON:
{
  "test_code": "...",
  "coverage_areas": ["..."],
  "test_cases": [{"name": "...", "description": "..."}]
}`;

    return await this.complete(prompt);
  }

  async debugCode(code, error, context = '') {
    const prompt = `Debug this code that's producing an error:

Error: ${error}
Context: ${context}

Code:
\`\`\`javascript
${code}
\`\`\`

Analyze the error and provide:
1. Root cause analysis
2. Step-by-step debugging approach
3. Fixed code
4. Prevention strategies

Return JSON:
{
  "root_cause": "...",
  "debugging_steps": ["..."],
  "fixed_code": "...",
  "explanation": "...",
  "prevention": ["..."]
}`;

    return await this.complete(prompt);
  }

  async generateDocumentation(code) {
    const prompt = `Generate comprehensive documentation for this code:

\`\`\`javascript
${code}
\`\`\`

Include:
1. Overview/purpose
2. API documentation (functions, parameters, returns)
3. Usage examples
4. Error handling
5. Dependencies

Return JSON:
{
  "overview": "...",
  "api": [{"function": "...", "description": "...", "params": [...], "returns": "...", "example": "..."}],
  "usage_examples": ["..."],
  "error_handling": "...",
  "dependencies": ["..."]
}`;

    return await this.complete(prompt);
  }

  async complete(prompt) {
    try {
      let response;
      
      if (this.provider === 'openai') {
        const result = await this.api.post('/chat/completions', {
          model: process.env.OPENAI_MODEL || 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an expert software developer and code reviewer. Always respond with valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 4000
        });
        
        response = result.data.choices[0].message.content;
      } else if (this.provider === 'anthropic') {
        const result = await this.api.post('/messages', {
          model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          system: 'You are an expert software developer and code reviewer. Always respond with valid JSON.',
          max_tokens: 4000
        });
        
        response = result.data.content[0].text;
      }
      
      // Parse JSON response
      try {
        return JSON.parse(response);
      } catch (error) {
        // If JSON parsing fails, try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw error;
      }
    } catch (error) {
      this.logger.error('AI completion error:', error);
      throw error;
    }
  }

  // GitHub Copilot Integration (simulated - actual integration would require GitHub Copilot API)
  async getCopilotSuggestion(code, cursor, context) {
    // This simulates Copilot suggestions using the AI service
    const prompt = `Given this code context, suggest the next lines of code:

Previous code:
\`\`\`javascript
${context}
\`\`\`

Current code up to cursor:
\`\`\`javascript
${code}
\`\`\`

Generate the most likely code completion that:
1. Follows the existing patterns
2. Completes the current thought
3. Is syntactically correct
4. Follows best practices

Return JSON:
{
  "suggestions": ["..."],
  "confidence": 0-1,
  "explanation": "..."
}`;

    return await this.complete(prompt);
  }

  async implementFeatureFromIssue(issueTitle, issueBody, codebaseContext) {
    const prompt = `Implement a solution for this GitHub issue:

Title: ${issueTitle}
Description: ${issueBody}

Codebase context:
${codebaseContext}

Generate:
1. Implementation plan
2. Code changes needed
3. Test cases
4. Documentation updates

Return JSON:
{
  "implementation_plan": ["..."],
  "code_changes": [{"file": "...", "changes": "...", "type": "create|modify|delete"}],
  "tests": {"code": "...", "description": "..."},
  "documentation": "...",
  "estimated_complexity": "low|medium|high"
}`;

    return await this.complete(prompt);
  }
}

module.exports = { AIService };
# Environment Variables Configuration

This document describes all environment variables used by the Background Agents system.

## Required Variables

### GitHub Integration

#### `GITHUB_TOKEN`
- **Description**: GitHub Personal Access Token (classic) with full repo access
- **Required**: Yes (for GitHub automation agent)
- **Permissions needed**:
  - `repo` (Full control of private repositories)
  - `workflow` (Update GitHub Action workflows)
  - `write:packages` (Upload packages to GitHub Package Registry)
  - `delete:packages` (Delete packages from GitHub Package Registry)
  - `admin:org` (Full control of orgs and teams, read and write org projects)
  - `admin:public_key` (Full control of user public keys)
  - `admin:repo_hook` (Full control of repository hooks)
  - `gist` (Create gists)
  - `notifications` (Access notifications)
  - `user` (Update ALL user data)
  - `project` (Full control of projects)
- **How to create**:
  1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
  2. Click "Generate new token (classic)"
  3. Select all required scopes
  4. Copy the token and set it as an environment variable

#### `GITHUB_OWNER`
- **Description**: GitHub repository owner (username or organization)
- **Required**: No (auto-detected from git remote)
- **Example**: `iamdrewfortini`

#### `GITHUB_REPO`
- **Description**: GitHub repository name
- **Required**: No (auto-detected from git remote)
- **Example**: `background-agents`

## AI Integration Variables

### OpenAI Configuration

#### `OPENAI_API_KEY`
- **Description**: OpenAI API key for GPT models
- **Required**: Yes (if using OpenAI as AI provider)
- **How to get**: https://platform.openai.com/api-keys

#### `OPENAI_MODEL`
- **Description**: OpenAI model to use
- **Default**: `gpt-4`
- **Options**: `gpt-4`, `gpt-4-turbo-preview`, `gpt-3.5-turbo`

### Anthropic Configuration

#### `ANTHROPIC_API_KEY`
- **Description**: Anthropic API key for Claude models
- **Required**: Yes (if using Anthropic as AI provider)
- **How to get**: https://console.anthropic.com/account/keys

#### `ANTHROPIC_MODEL`
- **Description**: Anthropic model to use
- **Default**: `claude-3-opus-20240229`
- **Options**: `claude-3-opus-20240229`, `claude-3-sonnet-20240229`, `claude-3-haiku-20240307`

### General AI Configuration

#### `AI_PROVIDER`
- **Description**: Which AI provider to use
- **Default**: `openai`
- **Options**: `openai`, `anthropic`

## Optional Variables

### Server Configuration

#### `PORT`
- **Description**: Port for the development dashboard
- **Default**: `3000`

#### `NODE_ENV`
- **Description**: Node environment
- **Default**: `development`
- **Options**: `development`, `production`, `test`

### Cursor Environment

#### `CURSOR_ENVIRONMENT`
- **Description**: Indicates if running in Cursor environment
- **Default**: `false`
- **Auto-detected**: Yes

#### `CURSOR_WORKSPACE_ID`
- **Description**: Cursor workspace identifier
- **Auto-set**: By Cursor

#### `CURSOR_SESSION_ID`
- **Description**: Cursor session identifier
- **Auto-set**: By Cursor

## Example .env File

Create a `.env` file in the project root:

```env
# GitHub Configuration
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=iamdrewfortini
GITHUB_REPO=background-agents

# AI Configuration (choose one provider)
# For OpenAI:
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4

# OR for Anthropic:
# AI_PROVIDER=anthropic
# ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# ANTHROPIC_MODEL=claude-3-opus-20240229

# Server Configuration
PORT=3000
NODE_ENV=development

# Optional: Webhook Secret for GitHub
# GITHUB_WEBHOOK_SECRET=your-webhook-secret
```

## Security Best Practices

1. **Never commit .env files** - The `.env` file is already in `.gitignore`
2. **Use environment-specific files**:
   - `.env.local` for local development
   - `.env.production` for production
   - `.env.test` for testing
3. **Rotate tokens regularly** - Especially the GitHub token
4. **Use minimal permissions** - Only grant the permissions actually needed
5. **Store secrets securely** in production:
   - Use environment variables in your deployment platform
   - Use secret management services (AWS Secrets Manager, HashiCorp Vault, etc.)

## Setting Environment Variables

### Local Development
```bash
# Using .env file (recommended)
cp .env.example .env
# Edit .env with your values

# Or export directly
export GITHUB_TOKEN=ghp_xxxx
export OPENAI_API_KEY=sk-xxxx
```

### Cursor Environment
Environment variables are automatically loaded from:
1. `.env` file in project root
2. `.cursor/environment.json`
3. System environment variables

### Production Deployment
Set environment variables in your deployment platform:
- **Heroku**: `heroku config:set GITHUB_TOKEN=xxx`
- **Vercel**: Project Settings → Environment Variables
- **AWS**: Use Parameter Store or Secrets Manager
- **Docker**: Use `--env-file` or `-e` flags

## Troubleshooting

### GitHub Token Issues
- **401 Unauthorized**: Token is invalid or expired
- **403 Forbidden**: Token lacks required permissions
- **404 Not Found**: Repository not accessible with token

### AI API Issues
- **Rate limiting**: Both OpenAI and Anthropic have rate limits
- **Invalid API key**: Check key format and validity
- **Model not available**: Ensure you have access to the specified model

### Verification Commands
```bash
# Check if GitHub token works
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user

# Check OpenAI key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Check Anthropic key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01"
``` 
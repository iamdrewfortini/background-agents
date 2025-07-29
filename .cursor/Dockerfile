FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_VERSION=18.x
ENV CURSOR_ENVIRONMENT=true

# Update system and install basic dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    htop \
    vim \
    nano \
    tmux \
    build-essential \
    ca-certificates \
    gnupg \
    lsb-release \
    software-properties-common \
    tree \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION} | bash - \
    && apt-get install -y nodejs

# Install additional monitoring tools
RUN apt-get update && apt-get install -y \
    procps \
    sysstat \
    iotop \
    nethogs \
    && rm -rf /var/lib/apt/lists/*

# Install nodemon globally for development
RUN npm install -g nodemon

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create necessary directories for background agents
RUN mkdir -p logs monitoring reviews test-results deployments security performance docs

# Set permissions for executable scripts
RUN chmod +x src/index.js scripts/setup.js .cursor/start-agents.js

# Create a non-root user for security
RUN useradd -m -s /bin/bash cursor && \
    chown -R cursor:cursor /app

# Switch to non-root user
USER cursor

# Expose port for dashboard
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Default command - start background agents and dashboard
CMD ["sh", "-c", "node .cursor/start-agents.js & npm run dev"]

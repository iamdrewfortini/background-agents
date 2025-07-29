FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_VERSION=18.x

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

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p logs monitoring reviews test-results deployments security performance docs

# Set permissions
RUN chmod +x src/index.js scripts/setup.js

# Expose port for dashboard
EXPOSE 3000

# Default command
CMD ["npm", "run", "dev"] 
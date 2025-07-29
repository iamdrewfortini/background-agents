FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_VERSION=18.x
ENV CURSOR_ENVIRONMENT=true

# Background Agents Environment Variables
ENV NODE_ENV=development
ENV PORT=3000
ENV HOST=localhost
ENV LOG_LEVEL=info
ENV LOG_DIR=/home/ubuntu/logs
ENV MAX_CONCURRENT_AGENTS=5
ENV HEALTH_CHECK_INTERVAL=30000
ENV RESTART_ON_FAILURE=true
ENV MAX_RESTART_ATTEMPTS=3
ENV DEV_MODE=true
ENV ENABLE_METRICS=true
ENV ENABLE_HEALTH_CHECKS=true
ENV MONITORING_INTERVAL=30000
ENV MONITORING_ALERT_CPU=80
ENV MONITORING_ALERT_MEMORY=85
ENV MONITORING_ALERT_DISK=90

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
    procps \
    sysstat \
    iotop \
    nethogs \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION} | bash - \
    && apt-get install -y nodejs

# Install nodemon globally for development
RUN npm install -g nodemon

# Create ubuntu user with home directory
RUN useradd -m -s /bin/bash ubuntu && \
    usermod -aG sudo ubuntu

# Set WORKDIR to home directory as per best practices
WORKDIR /home/ubuntu

# Switch to ubuntu user
USER ubuntu

# Expose port for dashboard
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Default command - this will be overridden by the agent
CMD ["/bin/bash"]

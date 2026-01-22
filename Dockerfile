# Multi-service Dockerfile for backend services
FROM node:20-alpine

ARG SERVICE
ENV SERVICE=${SERVICE}

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy TypeScript config
COPY tsconfig.json ./

# Copy shared code
COPY shared/ ./shared/

# Copy service code
COPY src/${SERVICE}/ ./src/${SERVICE}/

# Copy shared library
COPY src/lib/ ./src/lib/

# Set working directory to service
WORKDIR /app/src/${SERVICE}

# Default command - use tsx for TypeScript execution
CMD ["npx", "tsx", "index.ts"]

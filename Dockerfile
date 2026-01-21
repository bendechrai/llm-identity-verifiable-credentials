# Multi-service Dockerfile for backend services
FROM node:20-alpine

ARG SERVICE
ENV SERVICE=${SERVICE}

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy shared code
COPY shared/ ./shared/

# Copy service code
COPY src/${SERVICE}/ ./src/

# Set working directory to service
WORKDIR /app/src

# Default command (override per service if needed)
CMD ["node", "--experimental-specifier-resolution=node", "index.js"]

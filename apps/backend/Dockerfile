# syntax=docker/dockerfile:1

# Stage 1: Install all dependencies (including devDependencies)
FROM node:20.13.1-bookworm-slim AS deps
WORKDIR /app

# Copy root package files and ALL workspace package files to ensure npm workspace resolution works perfectly
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json

# Install all dependencies (dev + production) and clean cache
RUN npm ci --workspace=apps/backend --include-workspace-root \
  && npm cache clean --force

# Stage 2: Build/compile the NestJS application
FROM node:20.13.1-bookworm-slim AS builder
WORKDIR /app

# Copy dependency files and local node_modules
COPY --from=deps /app /app
COPY apps/backend apps/backend

# Build the NestJS app
RUN npm run build --workspace=apps/backend

# Stage 3: Install production dependencies only
FROM node:20.13.1-bookworm-slim AS production-deps
WORKDIR /app
ENV NODE_ENV=production

# Copy root package files and ALL workspace package files
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json

# Install only production dependencies
RUN npm ci --workspace=apps/backend --omit=dev --include-workspace-root \
  && npm cache clean --force

# Stage 4: Secure production runtime
FROM node:20.13.1-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy production node_modules and built dist folder
COPY --from=production-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=production-deps --chown=node:node /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=production-deps --chown=node:node /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder --chown=node:node /app/apps/backend/dist ./apps/backend/dist

# Expose port and run as non-root user 'node'
EXPOSE 4000
USER node

# Start the application
CMD ["node", "apps/backend/dist/main.js"]

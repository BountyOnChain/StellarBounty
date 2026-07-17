# syntax=docker/dockerfile:1

# Stage 1: Install all dependencies (including devDependencies)
FROM node:20.13.1-bookworm-slim AS deps
WORKDIR /app

# Copy root package files and ALL workspace package files to ensure npm workspace resolution works perfectly
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json

# Install all dependencies (dev + production) and clean cache
RUN npm ci --workspace=apps/frontend --include-workspace-root \
  && npm cache clean --force

# Stage 2: Build the Next.js application
FROM node:20.13.1-bookworm-slim AS builder
WORKDIR /app

# Arguments for Next.js build-time env variables
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_STELLAR_NETWORK=testnet

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_STELLAR_NETWORK=$NEXT_PUBLIC_STELLAR_NETWORK

# Copy dependency files and source code
COPY --from=deps /app /app
COPY apps/frontend apps/frontend

# Build the Next.js application
RUN npm run build --workspace=apps/frontend

# Stage 3: Secure production runtime
FROM node:20.13.1-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Next.js standalone output contains everything needed to run, including node_modules.
# We copy standalone output files and the static files.
COPY --from=builder --chown=node:node /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/frontend/.next/static ./apps/frontend/.next/static

# Create public directory (if it doesn't exist) and ensure proper ownership
RUN mkdir -p apps/frontend/public && chown -R node:node apps/frontend/public

# Expose port and run as non-root user 'node'
EXPOSE 3000
USER node

# Start the application
CMD ["node", "apps/frontend/server.js"]

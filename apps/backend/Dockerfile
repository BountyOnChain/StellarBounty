# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci --workspace=apps/backend --include-workspace-root

FROM deps AS build
COPY apps/backend apps/backend
RUN npm run build --workspace=apps/backend

FROM deps AS development
ENV NODE_ENV=development
COPY apps/backend apps/backend
EXPOSE 4000
CMD ["npm", "run", "dev", "--workspace=apps/backend"]

FROM node:20-alpine AS production-deps
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci --workspace=apps/backend --omit=dev --include-workspace-root \
  && npm cache clean --force

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S stellar && adduser -S stellar -G stellar
COPY --from=production-deps --chown=stellar:stellar /app/node_modules ./node_modules
COPY --from=production-deps --chown=stellar:stellar /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=production-deps --chown=stellar:stellar /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build --chown=stellar:stellar /app/apps/backend/dist ./apps/backend/dist
USER stellar
EXPOSE 4000
CMD ["node", "apps/backend/dist/main.js"]

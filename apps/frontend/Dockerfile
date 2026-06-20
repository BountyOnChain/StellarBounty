# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci --workspace=apps/frontend --include-workspace-root

FROM deps AS development
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_STELLAR_NETWORK=testnet
ENV NODE_ENV=development
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_STELLAR_NETWORK=$NEXT_PUBLIC_STELLAR_NETWORK
COPY apps/frontend apps/frontend
EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=apps/frontend", "--", "-H", "0.0.0.0"]

FROM deps AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_STELLAR_NETWORK=testnet
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_STELLAR_NETWORK=$NEXT_PUBLIC_STELLAR_NETWORK
COPY apps/frontend apps/frontend
RUN npm run build --workspace=apps/frontend

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
COPY --from=build --chown=nextjs:nextjs /app/apps/frontend/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/apps/frontend/.next/static ./apps/frontend/.next/static
RUN mkdir -p apps/frontend/public && chown -R nextjs:nextjs apps/frontend/public
USER nextjs
EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]

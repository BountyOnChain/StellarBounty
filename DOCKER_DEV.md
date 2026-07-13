# Docker Compose for Local Development

## Quick Start

```bash
# 1. Copy env file
cp .env.docker .env

# 2. Start everything (backend + frontend + postgres)
docker compose -f docker-compose.dev.yml up

# 3. In another terminal — run migrations (first time only)
docker compose -f docker-compose.dev.yml exec backend-dev npm run migration:run --workspace=apps/backend

# 4. Open
#   Frontend: http://localhost:3000
#   Backend:  http://localhost:4000
#   Postgres: localhost:5432 (postgres / password)
```

## Services

| Service         | Port  | Purpose                          |
|-----------------|-------|----------------------------------|
| `postgres`      | 5432  | PostgreSQL 16 with init SQL      |
| `backend-dev`   | 4000  | NestJS API (hot-reload)          |
| `frontend-dev`  | 3000  | Next.js frontend (fast refresh)  |
| `contracts`     | —     | Rust/Soroban toolchain (optional)|

## Hot-Reload

Source code is bind-mounted into the containers. Edits in your editor reflect immediately:
- Backend: `nest start --watch`
- Frontend: `next dev`

Node modules are stored inside the container (`/app/node_modules`) to avoid
platform-specific `node-sass` / native module issues.

## Stopping

```bash
docker compose -f docker-compose.dev.yml down
# Wipe data too:
docker compose -f docker-compose.dev.yml down -v
```

## Building Contracts (Optional)

```bash
docker compose -f docker-compose.dev.yml --profile contracts up contracts
```

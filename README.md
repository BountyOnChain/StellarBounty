# StellarBounty

A decentralized bounty and task marketplace built on the Stellar network. Project owners post bounties funded with XLM; contributors claim and complete them; Soroban smart contracts handle escrow and payouts trustlessly.

> **Status:** Early development — contributors welcome. Browse [open issues](https://github.com/BountyOnChain/StellarBounty/issues) to get started.

## Structure

```
apps/
  frontend/   Next.js 14 · TypeScript · Tailwind CSS
  backend/    NestJS · TypeScript · REST API
  contracts/  Soroban smart contracts · Rust
```

## Prerequisites

| Tool          | Version                                    |
| ------------- | ------------------------------------------ |
| Node.js       | 20+                                        |
| Rust + cargo  | stable                                     |
| wasm32 target | `rustup target add wasm32-unknown-unknown` |
| Stellar CLI   | `cargo install --locked stellar-cli`       |

## Setup

```bash
# 1. Clone
git clone https://github.com/BountyOnChain/StellarBounty.git
cd StellarBounty

# 2. Install JS dependencies (frontend + backend)
npm install

# 3. Copy env and fill in values
cp .env.example .env
```

## Development

```bash
# Frontend — http://localhost:3000
npm run dev:frontend

# Backend — http://localhost:4000
npm run dev:backend
```

## Docker Compose Development

Run the full local stack with one command:

```bash
docker compose up --watch
```

Services:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000`
- Stellar Quickstart RPC: `http://localhost:8000/rpc`
- PostgreSQL: `localhost:5432`

The Compose stack starts PostgreSQL, the NestJS backend in watch mode, the Next.js frontend with HMR, and `stellar/quickstart` for a local Soroban RPC endpoint. Backend containers use `COMPOSE_STELLAR_RPC_URL=http://quickstart:8000/rpc` by default so contract calls stay inside the Compose network. Source files are mounted into the Node containers, and Compose watch syncs frontend/backend source changes while preserving container-managed build output and dependencies in named volumes.

For local overrides, copy `.env.example` to `.env`; the Compose defaults already provide development-safe values for the database, JWT secret, frontend API URL, and Stellar testnet RPC. After changing `package.json` or `package-lock.json`, rerun `docker compose run --rm deps` so the shared dependency volume is refreshed.

## Contracts

```bash
cd apps/contracts

# Build WASM
cargo build --target wasm32-unknown-unknown --release

# Run tests
cargo test
```

## Environment Variables

| Variable               | Description                                                                       |
| ---------------------- | --------------------------------------------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string                                                      |
| `JWT_SECRET`           | Secret for signing JWTs                                                           |
| `STELLAR_NETWORK`      | `testnet` or `mainnet`                                                            |
| `NEXT_PUBLIC_API_URL`  | Backend URL used by the frontend                                                  |
| `NEXT_PUBLIC_SITE_URL` | Public frontend URL used for canonical links, OpenGraph URLs, and sitemap entries |

## Contributing

1. Browse [open issues](https://github.com/BountyOnChain/StellarBounty/issues) — issues tagged [`good first issue`](https://github.com/BountyOnChain/StellarBounty/issues?q=is%3Aopen+label%3A%22good+first+issue%22) are a great starting point.
2. Fork the repo and create a branch: `git checkout -b feat/your-feature`
3. Make your changes and open a pull request referencing the issue.

## License

MIT

# StellarBounty

A decentralized bounty and task marketplace built on the Stellar network. Project owners post bounties funded with XLM; contributors claim and complete them; Soroban smart contracts handle escrow and payouts trustlessly.

> **Status:** Early development — contributors welcome. Browse [open issues](https://github.com/BountyOnChain/StellarBounty/issues) to get started.

> **Important:** Soroban contracts are immutable. Once deployed, they cannot be upgraded or modified. See [Architecture](docs/architecture.md) for details.

## Structure

```
apps/
  frontend/   Next.js 14 · TypeScript · Tailwind CSS
  backend/    NestJS · TypeScript · REST API
  contracts/  Soroban smart contracts · Rust
```

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| Rust + cargo | stable |
| wasm32 target | `rustup target add wasm32-unknown-unknown` |
| Stellar CLI | `cargo install --locked stellar-cli` |

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

## Contracts

```bash
cd apps/contracts

# Build WASM
cargo build --target wasm32-unknown-unknown --release

# Run tests
cargo test
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `STELLAR_NETWORK` | `testnet` or `mainnet` |
| `NEXT_PUBLIC_API_URL` | Backend URL used by the frontend |
| `NEXT_PUBLIC_SITE_URL` | Public frontend URL used for canonical links, OpenGraph URLs, and sitemap entries |

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) for development checks, changelog rules, and the release process.

1. Browse [open issues](https://github.com/BountyOnChain/StellarBounty/issues) — issues tagged [`good first issue`](https://github.com/BountyOnChain/StellarBounty/issues?q=is%3Aopen+label%3A%22good+first+issue%22) are a great starting point.
2. Fork the repo and create a branch: `git checkout -b feat/your-feature`
3. Make your changes and open a pull request referencing the issue.

## Database Backup & Restore

Automated database backups run daily via GitHub Actions. See the [Operations Runbook](docs/operations.md) for detailed procedures.

Quick reference:

```bash
# Create a backup
DATABASE_URL="postgresql://user:pass@host:5432/stellar_bounty" ./scripts/backup-db.sh

# Restore from latest backup
DATABASE_URL="postgresql://user:pass@host:5432/stellar_bounty" ./scripts/restore-db.sh backups/latest.dump
```

## License

MIT

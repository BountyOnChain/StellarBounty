# Contributing to StellarBounty

Thank you for your interest in contributing to StellarBounty! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## How to Contribute

### Reporting Issues

1. Check if the issue already exists in the [issue tracker](https://github.com/BountyOnChain/StellarBounty/issues)
2. If not, create a new issue with:
   - A clear, descriptive title
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Your environment (OS, Node version, etc.)

### Claiming Issues

1. Look for open issues labeled `Maybe Rewarded` or `Official Campaign`
2. Comment on the issue to express interest
3. Wait for a maintainer to assign the issue to you
4. **Only work on assigned issues** — PRs for unassigned issues may not be merged

### Submitting Pull Requests

1. **Fork the repository** and create a branch from `main`
2. **One issue per PR** — keep changes focused and atomic
3. **Write clear commit messages** following conventional commits format:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `test:` for test additions/changes
   - `chore:` for maintenance tasks
4. **Ensure all tests pass** before submitting
5. **Update documentation** if your changes affect the API or user-facing behavior
6. Reference the issue number in your PR title: `feat(#123): description`

## Development Setup

### Prerequisites

- Node.js 20+
- Rust (latest stable)
- Docker and Docker Compose
- PostgreSQL 15+

### Local Development

```bash
# Clone the repository
git clone https://github.com/BountyOnChain/StellarBounty.git
cd StellarBounty

# Install dependencies
npm install

# Start the database
docker compose up -d postgres

# Run database migrations
npm run migration:run --workspace=apps/backend

# Start the backend
npm run start:dev --workspace=apps/backend

# In another terminal, start the frontend
npm run dev --workspace=apps/frontend
```

### Running Tests

```bash
# Backend tests
npm run test --workspace=apps/backend

# Frontend tests
npm run test --workspace=apps/frontend

# E2E tests
npm run test:e2e --workspace=apps/backend

# Contract tests
cd apps/contracts && cargo test
```

### Linting

```bash
# Backend lint
npm run lint --workspace=apps/backend

# Frontend lint
npm run lint --workspace=apps/frontend
```

## Project Structure

```
StellarBounty/
├── apps/
│   ├── backend/          # NestJS API server
│   │   ├── src/
│   │   │   ├── auth/     # Authentication module
│   │   │   ├── bounties/ # Bounty management
│   │   │   ├── submissions/ # Submission handling
│   │   │   ├── health/   # Health check endpoints
│   │   │   └── common/   # Shared utilities
│   │   └── test/         # Test files
│   ├── frontend/         # Next.js web application
│   │   ├── app/          # Pages and layouts
│   │   ├── components/   # Reusable UI components
│   │   └── lib/          # Utility functions
│   └── contracts/        # Soroban smart contracts (Rust)
├── .github/
│   └── workflows/        # CI/CD configuration
├── package.json          # Root workspace configuration
└── docker-compose.yml    # Local development services
```

## Coding Standards

### TypeScript

- Use strict TypeScript configuration
- Prefer `interface` over `type` for object shapes
- Use explicit return types for public functions
- Avoid `any` — use `unknown` when the type is truly unknown

### NestJS

- Follow the module-based architecture pattern
- Use dependency injection consistently
- Keep controllers thin — business logic belongs in services
- Use DTOs for input validation

### React/Next.js

- Use functional components with hooks
- Keep components small and focused
- Use TypeScript for all components
- Follow the existing file naming conventions

### Rust (Contracts)

- Follow Rust idioms and best practices
- Use `Result` types for error handling — avoid `unwrap()`
- Document public functions with doc comments
- Write tests for all contract functions

## Review Process

1. All PRs require at least one review from a maintainer
2. CI checks must pass before merge
3. Address review feedback promptly
4. Maintainers may request changes or provide feedback
5. PRs are merged using squash merge to keep history clean

## Reward Program

StellarBounty participates in the GrantFox OSS reward program. Issues labeled `Maybe Rewarded` and `Official Campaign` may be eligible for rewards upon successful merge. Coordinate with maintainers for reward distribution.

## Questions?

- Open a [discussion](https://github.com/BountyOnChain/StellarBounty/discussions) for general questions
- Comment on the relevant issue for issue-specific questions
- Reach out to maintainers for private inquiries

## License

By contributing to StellarBounty, you agree that your contributions will be licensed under the project's license.

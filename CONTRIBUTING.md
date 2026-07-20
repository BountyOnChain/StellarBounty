# Contributing to StellarBounty

Thank you for your interest in contributing to StellarBounty!

## 🚀 Contributor Quick-Start Guide

If you are a new contributor, please start with our **[Contributor Quick-Start Guide](docs/contributor-quickstart.md)**. 
It provides a 5-minute step-by-step setup using a one-liner command:

```bash
npm run dev:up
```

This will spin up the database, backend, and frontend via Docker Compose, letting you verify the health endpoint and test the end-to-end flow immediately.

---

## Review Assignment Process

We use a `.github/CODEOWNERS` file to automatically assign pull requests to the appropriate domain experts based on the files modified:

- **Contracts** (`apps/contracts/`): assigned to Soroban/Rust reviewers (`@bounty-team/contracts-reviewers`)
- **Backend** (`apps/backend/`): assigned to NestJS/TypeScript reviewers (`@bounty-team/backend-reviewers`)
- **Frontend** (`apps/frontend/`): assigned to Next.js/React reviewers (`@bounty-team/frontend-reviewers`)
- **CI/Infrastructure** (`.github/`): assigned to DevOps reviewers (`@bounty-team/devops-reviewers`)
- **Root config files** (`docker-compose.yml`, `.env.example`): assigned to all reviewers (`@bounty-team/maintainers`)

When you create a Pull Request, the appropriate reviewers will be automatically requested. Please address their feedback to get your PR merged.

## Development Flow

1. Fork the repository.
2. Create a topic branch from `main`, for example `feat/bounty-search` or `fix/wallet-validation`.
3. Make the smallest useful change for the linked issue.
4. Run the relevant checks before opening a pull request.
5. Open a pull request that references the issue, summarizes the behavior change, and lists validation output.

## Issue Claiming

- Comment on the issue before starting if the campaign or maintainer workflow asks contributors to claim work.
- Keep claim comments specific: mention the intended scope, files or area, and expected validation.
- Do not claim broad areas or unrelated issues in one pull request.
- Open the pull request promptly after starting so maintainers can see progress.
- If you cannot continue, leave a comment so another contributor can pick up the issue.

## Branch and Commit Conventions

Use short branch names with a type prefix:

- `feat/<short-description>`
- `fix/<short-description>`
- `docs/<short-description>`
- `test/<short-description>`
- `chore/<short-description>`

Use conventional commit prefixes:

- `feat:` for user-facing features
- `fix:` for bug fixes
- `docs:` for documentation-only changes
- `test:` for test coverage
- `chore:` for maintenance, tooling, or CI changes

## Code Conventions

- TypeScript should stay strongly typed. Avoid new `any` usage unless the boundary is unavoidable and documented.
- Keep NestJS code organized by module, DTO, service, controller, and spec files.
- Validate external API input with DTO decorators or explicit parsing before it reaches service logic.
- Keep React components small, typed, and close to the route or feature they support unless reuse is clear.
- Prefer named helpers for shared frontend API behavior instead of duplicating raw `fetch` logic across pages.
- Run `cargo fmt` and targeted Rust tests for Soroban contract changes.
- Do not commit secrets, private keys, wallet recovery material, API tokens, or environment-specific credentials.

## PR Process

Pull requests should include:

- linked issue, such as `Closes #123` or `Refs #123`
- summary of the behavior or documentation change
- screenshots or short before/after notes for UI changes
- validation commands and results
- notes about migrations, deployment, environment variables, or follow-up work when relevant

Keep pull requests focused. Split unrelated backend, frontend, contract, and documentation work unless the issue explicitly requires a cross-cutting change.

## Versioning

StellarBounty uses Semantic Versioning:

- `MAJOR` for incompatible API, contract, storage, or workflow changes.
- `MINOR` for backward-compatible features.
- `PATCH` for backward-compatible fixes, docs, tests, and maintenance.

## Changelog

Update `CHANGELOG.md` for user-visible changes. Add entries under `[Unreleased]` using these sections:

- `Added`
- `Changed`
- `Deprecated`
- `Removed`
- `Fixed`
- `Security`

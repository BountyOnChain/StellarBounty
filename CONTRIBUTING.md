# Contributing to StellarBounty

Welcome, and thank you for your interest in contributing to StellarBounty!

## Review Assignment Process

We use a `.github/CODEOWNERS` file to automatically assign pull requests to the appropriate domain experts based on the files modified:

- **Contracts** (`apps/contracts/`): assigned to Soroban/Rust reviewers (`@bounty-team/contracts-reviewers`)
- **Backend** (`apps/backend/`): assigned to NestJS/TypeScript reviewers (`@bounty-team/backend-reviewers`)
- **Frontend** (`apps/frontend/`): assigned to Next.js/React reviewers (`@bounty-team/frontend-reviewers`)
- **CI/Infrastructure** (`.github/`): assigned to DevOps reviewers (`@bounty-team/devops-reviewers`)
- **Root config files** (`docker-compose.yml`, `.env.example`): assigned to all reviewers (`@bounty-team/maintainers`)

When you create a Pull Request, the appropriate reviewers will be automatically requested. Please address their feedback to get your PR merged.
# Contributing

Thanks for helping improve StellarBounty. Keep pull requests focused, link the issue they address, and include the validation commands you ran.

## Development Setup

```bash
git clone https://github.com/BountyOnChain/StellarBounty.git
cd StellarBounty
npm install
cp .env.example .env
```

Install contract tooling when working under `apps/contracts`:

```bash
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli
```

Run the frontend and backend in separate terminals:

```bash
npm run dev:frontend
npm run dev:backend
```

## Project Structure

```text
apps/
  frontend/   Next.js app, wallet UI, bounty pages, dashboard flows
  backend/    NestJS API, auth, bounty/submission services, metrics, health checks
  contracts/  Soroban contracts and Rust tests for escrow-oriented bounty logic
.github/
  workflows/  CI for frontend, backend, and contract checks
```

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

## Checks

Run the checks that match the files you changed:

```bash
npm run build --workspaces --if-present
npm test --workspaces --if-present
```

For backend-only changes:

```bash
npm test --workspace=apps/backend -- --runInBand
npm run build --workspace=apps/backend
npm run lint --workspace=apps/backend
```

For contract changes:

```bash
cd apps/contracts
cargo test
cargo build --target wasm32-unknown-unknown --release
```

Always include `git diff --check` output for changes that touch Markdown, JSON, scripts, or generated examples.

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

Keep entries concise and describe the user or operator impact, not just the filename changed.

## Release Process

Maintainers should use this process for a release:

1. Confirm `main` is green and all release-bound pull requests are merged.
2. Move the relevant `[Unreleased]` changelog entries into a new version section.
3. Bump the root package version with `npm version patch`, `npm version minor`, or `npm version major`.
4. Confirm the `version` lifecycle check passes.
5. Push the release commit and tag, for example `git push origin main --follow-tags`.
6. Create a GitHub Release for the tag, using the matching `CHANGELOG.md` section as release notes.
7. Deploy the frontend, backend, and contracts according to the environment-specific deployment runbook.

For the initial release after this process is merged, maintainers can tag the current `0.1.0` baseline:

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

Then create the `v0.1.0` GitHub Release from the `CHANGELOG.md` notes.

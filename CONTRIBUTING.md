# Contributing

## Local Git Hooks

Run `npm install` from the repository root before committing. The root `prepare` script installs Husky and enables the committed hooks.

The pre-commit hook runs:

- `npx lint-staged` to format staged files with Prettier and run ESLint fixes for staged frontend/backend TypeScript files.
- `npm run typecheck` to compile-check the frontend and backend TypeScript projects.

The pre-push hook runs:

- `npm run test:workspaces` to execute unit tests for npm workspaces that define tests.

Hooks are local quality checks. They are opt-in through the normal Husky setup and can be skipped for exceptional cases with Git's `--no-verify` flag, for example `git commit --no-verify` or `git push --no-verify`.

## Pull Requests

Before opening a pull request, run the checks relevant to your change:

```bash
npm run lint --workspace=apps/frontend
npm run lint --workspace=apps/backend
npm run typecheck
npm run test:workspaces
```

Contract changes should also run:

```bash
cd apps/contracts
cargo fmt --check
cargo clippy -- -D warnings
cargo test
```

# Release Process

This document describes how to create and publish a new release of StellarBounty.

## Versioning

StellarBounty follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes

## Prerequisites

- You must have write access to the repository
- All CI checks must be passing on `main`
- The `CHANGELOG.md` must be up to date with all changes since the last release

## Release Steps

### 1. Prepare the Release

```bash
# Ensure you're on the latest main
git checkout main
git pull upstream main

# Create a release branch
git checkout -b release/vX.Y.Z
```

### 2. Update Version References

Update the version in the following files:

- `package.json` (root workspace)
- `apps/backend/package.json`
- `apps/frontend/package.json`
- `apps/contracts/Cargo.toml` (if contract changes exist)

### 3. Update CHANGELOG.md

Move all items from the `[Unreleased]` section to a new `[X.Y.Z]` section with today's date:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- ...

### Fixed
- ...

### Security
- ...
```

### 4. Commit and Push

```bash
git add -A
git commit -m "chore(release): prepare vX.Y.Z"
git push origin release/vX.Y.Z
```

### 5. Create a Pull Request

Open a PR from `release/vX.Y.Z` to `main` with:
- Title: `Release vX.Y.Z`
- Description summarizing key changes
- Labels: `release`

### 6. Merge and Tag

After the PR is merged:

```bash
git checkout main
git pull upstream main

# Create an annotated tag
git tag -a vX.Y.Z -m "Release vX.Y.Z"

# Push the tag
git push upstream vX.Y.Z
```

### 7. Create GitHub Release

1. Navigate to [Releases](https://github.com/BountyOnChain/StellarBounty/releases)
2. Click "Draft a new release"
3. Select the newly pushed tag
4. Title: `vX.Y.Z`
5. Copy the relevant CHANGELOG section into the description
6. Click "Publish release"

## Hotfix Process

For critical security fixes that can't wait for the next scheduled release:

1. Create a branch from `main`: `git checkout -b hotfix/vX.Y.Z+1`
2. Apply the fix with minimal changes
3. Follow steps 3-7 above
4. Merge the hotfix back into any active development branches

## Pre-release Versions

For testing and validation before a stable release:

- Use suffixes like `-alpha.1`, `-beta.1`, `-rc.1`
- Example: `v0.2.0-alpha.1`
- Pre-releases are published to GitHub but marked as pre-release

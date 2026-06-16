# Contributing

Thanks for helping improve StellarBounty. This guide explains how to propose
changes, keep versions consistent, and prepare releases.

## Development workflow

1. Create a branch from the latest `main`.
2. Make focused changes that are easy to review.
3. Update documentation and tests when behavior changes.
4. Run the relevant local checks before opening a pull request.

Useful commands:

```bash
npm install
npm run dev:frontend
npm run dev:backend
npm run build --workspaces --if-present
```

For contract changes, run the applicable Rust formatting, linting, and test
commands from the contract workspace before requesting review.

## Pull requests

Pull requests should include:

- A concise summary of the change.
- Screenshots or API examples for user-facing changes.
- Test notes, including commands run locally.
- Any migration, deployment, or environment updates.

Use Conventional Commit-style titles when practical, such as `feat:`,
`fix:`, `docs:`, `chore:`, or `refactor:`.

## Versioning

StellarBounty follows Semantic Versioning:

- `MAJOR` for incompatible API, contract, or data model changes.
- `MINOR` for backward-compatible features.
- `PATCH` for backward-compatible fixes and documentation corrections.

The root package and workspace package versions should stay aligned. Run this
check before release work:

```bash
npm run version:check
```

## Release process

1. Decide the next SemVer version.
2. Update the root and workspace package versions to the same version.
3. Move completed notes from `CHANGELOG.md` `Unreleased` into a new version
   section dated with the release date.
4. Keep the changelog sections in this order: Added, Changed, Deprecated,
   Removed, Fixed, Security.
5. Run the release verification command:

```bash
npm run release:check
```

6. Open a pull request with the changelog entry and version bump.
7. After the pull request is reviewed and merged, create an annotated tag:

```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

Replace `0.1.0` with the approved release version.

8. Create a GitHub Release from the tag and paste the matching changelog notes
   into the release description.
9. Deploy using the project's normal deployment workflow.

## Release checklist

- Package versions use `MAJOR.MINOR.PATCH`.
- Workspace versions match the root version.
- `CHANGELOG.md` has a dated entry for the release.
- `npm run release:check` passes.
- The release tag uses the `vX.Y.Z` format.
- The GitHub Release description matches the changelog entry.

# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in StellarBounty, please report it by:

1. **Do NOT** open a public GitHub issue for the vulnerability.
2. Email the maintainers directly with a description of the issue, steps to reproduce, and any relevant proof-of-concept.
3. Allow up to 48 hours for an initial response before disclosing publicly.

## Vulnerability Response Process

1. **Triage** — The maintainers will confirm the report and assess severity within 48 hours.
2. **Fix** — A patch will be developed and tested in a private branch.
3. **Disclosure** — Once a fix is merged, a GitHub Security Advisory will be published.
4. **Credit** — The reporter will be credited in the advisory (unless they request anonymity).

## Automated Scanning

StellarBounty uses the following automated security tools:

- **`npm audit`** — Runs in CI for both frontend and backend via the `security` job.
- **`cargo audit`** — Runs in CI for Soroban contracts. The build fails on any advisory.
- **Trivy** — Filesystem vulnerability scanning with CRITICAL/HIGH severity detection.
- **Dependabot** — Opens automated pull requests for dependency updates weekly across npm and Cargo ecosystems.

## Dependency Management

- All dependencies are pinned in `package-lock.json` and `Cargo.lock`.
- Dependabot opens PRs for security updates automatically.
- Non-security dependency updates are reviewed monthly.
